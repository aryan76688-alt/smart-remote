import React, { useState, useEffect } from 'react';
import {
  X, Cloud, Check, Video, Download, RefreshCw, Upload,
  HardDrive, ShieldCheck, LogOut, FileVideo, Clock, ExternalLink,
  Laptop, Smartphone, AlertCircle, Play
} from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { CctvPlayerModal } from '../camera/CctvPlayerModal';

export const GDriveConnectModal: React.FC = () => {
  const { gdriveModalOpen, setGdriveModalOpen, addNotification } = useApp();

  const [loading, setLoading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [rcloneStatus, setRcloneStatus] = useState<any>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authInput, setAuthInput] = useState<string>('');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'account' | 'recordings'>('account');
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [isStartingAuth, setIsStartingAuth] = useState<boolean>(false);
  const [isCompletingAuth, setIsCompletingAuth] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  const fetchStatusAndRecordings = async () => {
    try {
      const [status, rclone, recs] = await Promise.all([
        api.getSyncStatus(),
        api.getRcloneStatus(),
        api.getCctvRecordings()
      ]);
      setSyncStatus(status);
      setRcloneStatus(rclone);
      setRecordings(recs);
      if (rclone?.auth_url) {
        setAuthUrl(rclone.auth_url);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (gdriveModalOpen) {
      fetchStatusAndRecordings();
    }
  }, [gdriveModalOpen]);

  if (!gdriveModalOpen) return null;

  // Step 1: Start OAuth Session
  const handleStartAuthMobile = async () => {
    setIsStartingAuth(true);
    try {
      const res = await api.startGDriveAuth(false);
      if (res.success && res.auth_url) {
        setAuthUrl(res.auth_url);
        window.open(res.auth_url, '_blank');
        addNotification('Google Sign-In Opened', 'Log in with aryan76688@gmail.com, then copy the address bar link and paste it in Step 2.', 'info');
      } else {
        addNotification('Auth Error', res.error || 'Could not start Google OAuth.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to start authentication.', 'error');
    } finally {
      setIsStartingAuth(false);
    }
  };

  const handleStartAuthLaptop = async () => {
    setIsStartingAuth(true);
    try {
      const res = await api.startGDriveAuth(true);
      if (res.success) {
        setAuthUrl(res.auth_url || null);
        addNotification('Opened on Laptop Screen', 'Firefox/Chromium opened on your Kali Linux display. Use Screen Mirror to sign in directly!', 'success');
      } else {
        addNotification('Browser Error', res.error || 'Could not open browser on Kali screen.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to open on Kali screen.', 'error');
    } finally {
      setIsStartingAuth(false);
    }
  };

  // Step 2: Complete OAuth Session
  const handleCompleteAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authInput.trim()) {
      addNotification('Input Required', 'Please paste the redirected link or authorization code from your browser.', 'error');
      return;
    }
    setIsCompletingAuth(true);
    try {
      const res = await api.finishGDriveAuth(authInput.trim());
      if (res.success || res.authenticated) {
        addNotification('Google Drive Connected', "Google Drive linked! Folder 'Kali_CCTV_Recordings' created on aryan76688@gmail.com.", 'success');
        setAuthInput('');
        await fetchStatusAndRecordings();
        setActiveTab('recordings');
      } else {
        addNotification('Verification Notice', res.error || 'Could not verify OAuth code. Please try again.', 'error');
      }
    } catch (err: any) {
      addNotification('Auth Failed', err.message || 'Authentication error occurred.', 'error');
    } finally {
      setIsCompletingAuth(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectGDrive();
      addNotification('Google Drive Disconnected', 'Account unlinked from CCTV cloud storage.', 'info');
      await fetchStatusAndRecordings();
    } catch {
      addNotification('Error', 'Failed to disconnect.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAllNow = async () => {
    setIsSyncingAll(true);
    try {
      const res = await api.syncAllCctvToDrive();
      addNotification('Sync Started', res.message, 'success');
      setTimeout(fetchStatusAndRecordings, 2500);
    } catch {
      addNotification('Sync Failed', 'Could not trigger background sync.', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleManualUpload = async (filename: string) => {
    setUploadingFilename(filename);
    try {
      const res = await api.uploadCctvToDrive(filename);
      addNotification('Upload Queued', res.message, 'success');
      setTimeout(fetchStatusAndRecordings, 1500);
    } catch {
      addNotification('Upload Failed', `Could not upload ${filename}`, 'error');
    } finally {
      setUploadingFilename(null);
    }
  };

  const isRcloneAuth = rcloneStatus?.authenticated;
  const targetEmail = 'aryan76688@gmail.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-cyber-surface border border-cyan-500/40 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Cloud className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono">GOOGLE DRIVE CLOUD SYNC</h3>
              <p className="text-[10px] text-slate-400">Save &amp; Auto-Upload 30-Min CCTV Video Recordings</p>
            </div>
          </div>
          <button
            onClick={() => setGdriveModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'account'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Account &amp; Status</span>
          </button>
          <button
            onClick={() => setActiveTab('recordings')}
            className={`flex-1 py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'recordings'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileVideo className="w-3.5 h-3.5" />
            <span>CCTV Recordings ({recordings.length})</span>
          </button>
        </div>

        {/* TAB 1: Account Connection & Cloud Status */}
        {activeTab === 'account' && (
          <div className="flex-1 overflow-y-auto space-y-3.5 text-xs text-slate-300 pr-1">
            {/* Linux Engine Status Banner */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Linux Sync Engine:</span>
                <span className="text-emerald-400 font-bold">rclone v1.75.1 (Ready)</span>
              </div>
              <span className="text-slate-500 text-[10px]">Folder: Kali_CCTV_Recordings</span>
            </div>

            {isRcloneAuth ? (
              /* Already Authenticated View */
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-emerald-400 font-mono">ACTIVE GOOGLE DRIVE CONNECTION</span>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-rose-400 hover:text-rose-300 text-[11px] font-mono flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">Linked Google Email:</span>
                    <span className="text-slate-100 font-bold break-all">{targetEmail}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Google Drive Folder:</span>
                    <span className="text-cyan-400 font-bold">Kali_CCTV_Recordings</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">30-Min CCTV Upload:</span>
                    <span className="text-emerald-400 font-bold">AUTOMATIC</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Recorded Video Chunks:</span>
                    <span className="text-slate-200 font-bold">{recordings.length} files</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSyncAllNow}
                    disabled={isSyncingAll}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isSyncingAll ? 'SYNCING TO GDRIVE...' : 'SYNC ALL CCTV TO DRIVE'}</span>
                  </button>
                  <button
                    onClick={fetchStatusAndRecordings}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    title="Check status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Needs Real Google Sign-In View */
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 font-mono flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-cyan-400" />
                      <span>Connect Google Drive ({targetEmail})</span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30">
                      Sign-In Required
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Authenticate your Google Account to create the <strong>Kali_CCTV_Recordings</strong> folder and allow Kali Linux to upload 30-minute CCTV video chunks.
                  </p>
                </div>

                {/* Step 1: Sign in button */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] font-bold text-cyan-400 font-mono block">
                    STEP 1: Open Google Sign-In
                  </span>
                  <p className="text-[10px] text-slate-400">Choose where to sign in:</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleStartAuthMobile}
                      disabled={isStartingAuth}
                      className="py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>{isStartingAuth ? 'Opening...' : 'On Phone'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartAuthLaptop}
                      disabled={isStartingAuth}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>{isStartingAuth ? 'Opening...' : 'On Laptop Screen'}</span>
                    </button>
                  </div>
                  {authUrl && (
                    <div className="pt-1.5">
                      <a
                        href={authUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 break-all"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span>Direct Auth Link (Tap if popups blocked)</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Step 2: Paste link or code */}
                <form onSubmit={handleCompleteAuth} className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] font-bold text-emerald-400 font-mono block">
                    STEP 2: Complete Sign-In &amp; Create Folder
                  </span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    After granting permission on Google, if the browser redirects to <code>127.0.0.1</code>, copy the address bar link or code and paste it below:
                  </p>
                  <input
                    type="text"
                    required
                    value={authInput}
                    onChange={e => setAuthInput(e.target.value)}
                    placeholder="e.g. http://127.0.0.1:53682/?state=...&code=4/0A... or code"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isCompletingAuth}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isCompletingAuth ? 'VERIFYING & CONNECTING...' : 'VERIFY & CREATE Kali_CCTV_Recordings'}</span>
                  </button>
                </form>
              </div>
            )}

            {/* Feature Highlights */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                <ShieldCheck className="w-4 h-4" />
                <span>CCTV 30-Minute Continuous Surveillance Engine</span>
              </div>
              <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                <li>Captures Kali laptop camera continuously into rolling 30-minute chunks.</li>
                <li>Burns live timestamp watermark (YYYY-MM-DD HH:MM:SS) onto each video frame.</li>
                <li>Uploads finalized video files automatically to your Google Drive folder <strong>Kali_CCTV_Recordings</strong>.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: CCTV Recordings List */}
        {activeTab === 'recordings' && (
          <div className="flex-1 overflow-y-auto space-y-2 text-xs pr-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
              <span>Saved CCTV Clips ({recordings.length})</span>
              <div className="flex items-center gap-2">
                {isRcloneAuth && (
                  <button
                    onClick={handleSyncAllNow}
                    disabled={isSyncingAll}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/30"
                  >
                    <Upload className="w-2.5 h-2.5" />
                    <span>{isSyncingAll ? 'Syncing...' : 'Sync All'}</span>
                  </button>
                )}
                <button
                  onClick={fetchStatusAndRecordings}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {recordings.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <Video className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-xs font-mono">No CCTV video clips recorded yet.</p>
                <p className="text-[11px] text-slate-500">
                  Open the Laptop Camera and tap <strong>"RECORD CCTV (30 MIN)"</strong> to begin!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {recordings.map((rec: any, idx: number) => {
                  const sizeMB = (rec.size_bytes / (1024 * 1024)).toFixed(1);
                  const isUploading = uploadingFilename === rec.filename;

                  return (
                    <div
                      key={rec.filename || idx}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileVideo className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="font-mono font-bold text-slate-100 truncate">{rec.filename}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{rec.duration_seconds}s (30-min chunk)</span>
                          </span>
                          <span>•</span>
                          <span>{sizeMB} MB</span>
                        </div>
                        <div className="pt-0.5">
                          {rec.gdrive_uploaded ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              <span>Google Drive: Uploaded ({rec.gdrive_folder})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
                              <span>Saved locally on Kali</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setSelectedVideo(rec)}
                          className="p-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/60 border border-purple-500/50 text-purple-200 text-[11px] font-mono flex items-center gap-1"
                          title="Play video in surveillance player"
                        >
                          <Play className="w-3.5 h-3.5 fill-purple-300 text-purple-300" />
                          <span className="hidden sm:inline">Play</span>
                        </button>
                        {isRcloneAuth && (
                          <button
                            disabled={isUploading}
                            onClick={() => handleManualUpload(rec.filename)}
                            className="p-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 text-[11px] font-mono flex items-center gap-1"
                            title="Upload to Google Drive now"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{isUploading ? '...' : 'Drive'}</span>
                          </button>
                        )}
                        <a
                          href={rec.download_url}
                          download={rec.filename}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
                          title="Download video file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="border-t border-slate-800 pt-3 flex justify-end">
          <button
            onClick={() => setGdriveModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>

      {/* CCTV Surveillance Player Modal */}
      <CctvPlayerModal
        filename={selectedVideo ? selectedVideo.filename : null}
        recordingItem={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    </div>
  );
};
