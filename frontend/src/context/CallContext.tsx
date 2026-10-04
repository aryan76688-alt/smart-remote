import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useApp } from './AppContext';

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

interface CallContextType {
  callState: CallState;
  sessionId: string | null;
  remoteRole: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicMuted: boolean;
  isVideoMuted: boolean;
  callDurationSec: number;
  facingMode: 'user' | 'environment';
  startCall: () => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMicMute: () => void;
  toggleVideoMute: () => void;
  switchCameraFacing: () => void;
  initPreview: () => Promise<MediaStream | null>;
  stopPreview: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isApk, triggerHaptic, addNotification } = useApp();

  const [callState, setCallState] = useState<CallState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('session_id') || null;
    }
    return null;
  });
  const [remoteRole, setRemoteRole] = useState<string>('laptop');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [callDurationSec, setCallDurationSec] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const sessionIdRef = useRef<string | null>(sessionId);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const ringtoneTimerRef = useRef<number | null>(null);
  const iceCandidateQueueRef = useRef<any[]>([]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Initialize WebSocket connection for call signaling
  useEffect(() => {
    let active = true;

    const connectWs = () => {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const urlParams = new URLSearchParams(window.location.search);
      const queryRole = urlParams.get('role');
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || Boolean((window as any).AndroidBridge);
      const role = queryRole || (isMobileDevice ? 'mobile' : 'laptop');
      const deviceId = isMobileDevice ? 'mobile-client' : 'laptop-client';
      const wsUrl = `${protocol}//${host}/api/call/ws?role=${role}&device_id=${deviceId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[CALL-WS] Connected as', role);
        const autoJoin = urlParams.get('auto_join') === 'true';
        const urlSid = urlParams.get('session_id');
        if (autoJoin && urlSid) {
          sessionIdRef.current = urlSid;
          setSessionId(urlSid);
          ws.send(JSON.stringify({
            type: 'call_accept',
            session_id: urlSid
          }));
        }
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleSignalingMessage(msg);
        } catch (e) {
          console.error('[CALL-WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        if (active) {
          setTimeout(connectWs, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // WebRTC PeerConnection Setup
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice_candidate',
          session_id: sessionIdRef.current,
          candidate: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      console.log('[WEBRTC] Remote track received:', event.track.kind, event.streams);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        setRemoteStream(prev => {
          const stream = prev || new MediaStream();
          if (!stream.getTracks().find(t => t.id === event.track.id)) {
            stream.addTrack(event.track);
          }
          return stream;
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WEBRTC] Connection state changed:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        startCallTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    peerConnRef.current = pc;
    return pc;
  };

  const startCallTimer = () => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    setCallDurationSec(0);
    durationTimerRef.current = window.setInterval(() => {
      setCallDurationSec(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const handleSignalingMessage = async (msg: any) => {
    switch (msg.type) {
      case 'incoming_call':
        setSessionId(msg.session_id);
        setRemoteRole(msg.caller_role || 'laptop');
        setCallState('incoming');
        triggerHaptic(400);

        // Ringing vibration pulse
        if (ringtoneTimerRef.current) clearInterval(ringtoneTimerRef.current);
        ringtoneTimerRef.current = window.setInterval(() => {
          triggerHaptic(300);
        }, 1500);
        break;

      case 'peer_joined':
        console.log('[WEBRTC] Peer joined call session:', msg);
        if (callState === 'calling' || callState === 'incoming') {
          setCallState('connected');
          startCallTimer();
        }
        // Send fresh offer to the connected peer
        sendOfferToPeer();
        break;

      case 'call_accepted':
        console.log('[WEBRTC] Peer accepted call');
        setCallState('connected');
        startCallTimer();
        sendOfferToPeer();
        break;

      case 'call_rejected':
        addNotification('Call Declined', 'Kali Laptop declined the video call.', 'warning');
        cleanupCall();
        setCallState('idle');
        break;

      case 'call_ended':
        addNotification('Call Ended', 'The video call has finished.', 'info');
        cleanupCall();
        setCallState('idle');
        break;

      case 'webrtc_offer':
        try {
          console.log('[WEBRTC] Received offer from peer');
          let pc = peerConnRef.current;
          if (!pc) {
            pc = createPeerConnection();
          }
          let stream = localStreamRef.current;
          if (!stream) {
            stream = await getUserMediaStream(facingMode);
          }
          if (stream && pc) {
            const existingSenders = pc.getSenders();
            stream.getTracks().forEach(track => {
              if (!existingSenders.find(s => s.track === track)) {
                pc.addTrack(track, stream);
              }
            });
          }
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            // Drain buffered ICE candidates
            while (iceCandidateQueueRef.current.length > 0) {
              const candidate = iceCandidateQueueRef.current.shift();
              if (candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
              }
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'webrtc_answer',
                session_id: msg.session_id || sessionId,
                answer
              }));
            }
            setCallState('connected');
            startCallTimer();
          }
        } catch (e) {
          console.error('[WEBRTC] Error processing offer:', e);
        }
        break;

      case 'webrtc_answer':
        try {
          console.log('[WEBRTC] Received answer from peer');
          if (peerConnRef.current) {
            await peerConnRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
            // Drain buffered ICE candidates
            while (iceCandidateQueueRef.current.length > 0) {
              const candidate = iceCandidateQueueRef.current.shift();
              if (candidate) {
                await peerConnRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.error('[WEBRTC] Error processing answer:', e);
        }
        break;

      case 'ice_candidate':
        if (msg.candidate) {
          if (peerConnRef.current && peerConnRef.current.remoteDescription) {
            try {
              await peerConnRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              console.error('[WEBRTC] Error adding ice candidate:', e);
            }
          } else {
            iceCandidateQueueRef.current.push(msg.candidate);
          }
        }
        break;
    }
  };

  const sendOfferToPeer = async () => {
    try {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await getUserMediaStream(facingMode);
      }
      let pc = peerConnRef.current;
      if (!pc) {
        pc = createPeerConnection();
      }
      if (stream && pc) {
        const existingSenders = pc.getSenders();
        stream.getTracks().forEach(track => {
          if (!existingSenders.find(s => s.track === track)) {
            pc.addTrack(track, stream);
          }
        });
      }
      if (pc) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'webrtc_offer',
            session_id: sessionIdRef.current,
            offer
          }));
        }
      }
    } catch (err) {
      console.error('[CALL] Failed to create offer:', err);
    }
  };

  const getUserMediaStream = async (facing: 'user' | 'environment') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (e) {
      console.warn('[CALL] Full A/V capture failed, attempting audio only:', e);
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
        });
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        return audioOnly;
      } catch (err) {
        console.error('[CALL] Mic & Camera access denied:', err);
        return null;
      }
    }
  };

  const startCall = async () => {
    triggerHaptic(50);
    const sid = Math.random().toString(36).substring(2, 9);
    setSessionId(sid);
    setCallState('calling');
    setRemoteRole('laptop');

    // Directly open the video call interface on Kali Linux screen with zero prompts
    try {
      fetch('/api/call/direct_start', { method: 'POST' }).catch(() => {});
    } catch {}

    let stream = localStreamRef.current;
    if (!stream) {
      stream = await getUserMediaStream(facingMode);
    }
    let pc = peerConnRef.current;
    if (!pc) {
      pc = createPeerConnection();
    }

    if (stream) {
      const existingSenders = pc.getSenders();
      stream.getTracks().forEach(track => {
        if (!existingSenders.find(s => s.track === track)) {
          pc.addTrack(track, stream);
        }
      });
    }

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'call_invite',
          session_id: sid
        }));

        wsRef.current.send(JSON.stringify({
          type: 'webrtc_offer',
          session_id: sid,
          offer
        }));
      }
    } catch (err) {
      console.error('[CALL] Failed to create offer:', err);
    }
  };

  const acceptCall = async () => {
    triggerHaptic(60);
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }

    setCallState('connected');
    startCallTimer();

    let stream = localStreamRef.current;
    if (!stream) {
      stream = await getUserMediaStream(facingMode);
    }
    let pc = peerConnRef.current;
    if (!pc) {
      pc = createPeerConnection();
    }

    if (stream) {
      const existingSenders = pc.getSenders();
      stream.getTracks().forEach(track => {
        if (!existingSenders.find(s => s.track === track)) {
          pc.addTrack(track, stream);
        }
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_accept',
        session_id: sessionId
      }));
    }
  };

  const rejectCall = () => {
    triggerHaptic(40);
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_reject',
        session_id: sessionId
      }));
    }
    cleanupCall();
    setCallState('idle');
  };

  const endCall = () => {
    triggerHaptic(50);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_end',
        session_id: sessionId,
        duration_sec: callDurationSec
      }));
    }
    cleanupCall();
    setCallState('idle');
  };

  const cleanupCall = () => {
    stopCallTimer();
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
  };

  const toggleMicMute = () => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !next;
      });
    }
  };

  const toggleVideoMute = () => {
    const next = !isVideoMuted;
    setIsVideoMuted(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !next;
      });
    }
  };

  const switchCameraFacing = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    const newStream = await getUserMediaStream(nextFacing);
    if (newStream && peerConnRef.current) {
      const senders = peerConnRef.current.getSenders();
      const videoTrack = newStream.getVideoTracks()[0];
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender && videoTrack) {
        videoSender.replaceTrack(videoTrack);
      }
    }
  };

  const initPreview = async (): Promise<MediaStream | null> => {
    try {
      if (localStreamRef.current && localStreamRef.current.active) {
        setLocalStream(localStreamRef.current);
        return localStreamRef.current;
      }
      const stream = await getUserMediaStream(facingMode);
      return stream;
    } catch (e) {
      console.warn('Preview error:', e);
      return null;
    }
  };

  const stopPreview = () => {
    if (callState === 'idle' && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        sessionId,
        remoteRole,
        localStream,
        remoteStream,
        isMicMuted,
        isVideoMuted,
        callDurationSec,
        facingMode,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMicMute,
        toggleVideoMute,
        switchCameraFacing,
        initPreview,
        stopPreview
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
