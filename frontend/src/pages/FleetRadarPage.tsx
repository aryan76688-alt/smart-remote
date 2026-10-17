import React, { useState, useEffect, useRef } from 'react';
import {
  Compass, Volume2, Flashlight, Eye, ShieldCheck, ShieldAlert,
  Battery, BatteryCharging, Wifi, Navigation, RefreshCw, AlertTriangle,
  Radio, Laptop, Smartphone, ExternalLink, X, MapPin, Locate, Crosshair,
  Search, Layers, Route, ArrowRight, CheckCircle2, ChevronDown, ChevronUp,
  Camera, Mic, VolumeX, Video
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { CameraViewerModal } from '../components/camera/CameraViewerModal';
import { MicMonitorHud } from '../components/camera/MicMonitorHud';

const GOOGLE_MAPS_API_KEY = "AIzaSyADv-hBmMfj_GDU4ZDjvMq8wHPSV75IEo0";

// Dark Cyber Tactical Map Styling
const CYBER_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#080d1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#080d1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#00f0ff" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#061f1a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#162035" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#00f0ff" }, { weight: 0.5 }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#030712" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] }
];

interface DeviceItem {
  id: string;
  name: string;
  model: string;
  role: 'laptop' | 'mobile';
  lat: number;
  lng: number;
  accuracy: number;
  battery: number;
  is_charging: boolean;
  speed: number;
  heading?: number;
  status: 'online' | 'idle' | 'offline';
  last_seen: number;
  siren_active: boolean;
  strobe_active: boolean;
  leash_active: boolean;
  leash_radius: number;
  address?: string;
}

interface RouteInfo {
  distance: string;
  duration: string;
  destinationName: string;
  steps: string[];
}

export const FleetRadarPage: React.FC = () => {
  const { triggerHaptic, isApk, addNotification } = useApp();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [proximityList, setProximityList] = useState<any[]>([]);
  const [brokenLeashes, setBrokenLeashes] = useState<any[]>([]);
  const [radarSweepAngle, setRadarSweepAngle] = useState<number>(0);
  const [streetViewOpen, setStreetViewOpen] = useState<boolean>(false);
  const [streetViewCoords, setStreetViewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nightVision, setNightVision] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [cameraModalDevice, setCameraModalDevice] = useState<DeviceItem | null>(null);
  const [micAudioDevice, setMicAudioDevice] = useState<DeviceItem | null>(null);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);
  const tacticalPolylineRef = useRef<any>(null);
  const webAudioCtxRef = useRef<AudioContext | null>(null);

  const playWebSirenSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!webAudioCtxRef.current) {
        webAudioCtxRef.current = new AudioCtx();
      }
      const ctx = webAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      gain.gain.setValueAtTime(0.85, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);

      let toggle = false;
      const interval = setInterval(() => {
        toggle = !toggle;
        osc.frequency.setValueAtTime(toggle ? 1350 : 850, ctx.currentTime);
      }, 350);

      osc.start();
      setTimeout(() => {
        clearInterval(interval);
        try {
          osc.stop();
          osc.disconnect();
        } catch (_) {}
      }, 4000);
    } catch (_) {}
  };

  // Map & Navigation state
  const [viewMode, setViewMode] = useState<'cyber' | 'satellite' | 'radar'>('cyber');
  const [mapsLoaded, setMapsLoaded] = useState<boolean>(false);
  const [mapsAuthError, setMapsAuthError] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchTarget, setSearchTarget] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteInfo | null>(null);
  const [travelMode, setTravelMode] = useState<google.maps.TravelMode>(
    typeof google !== 'undefined' && google.maps?.TravelMode ? google.maps.TravelMode.DRIVING : ('DRIVING' as any)
  );
  const [showSteps, setShowSteps] = useState<boolean>(false);
  const [myGps, setMyGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const leashCircleRef = useRef<google.maps.Circle | null>(null);
  const targetMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DYNAMIC GOOGLE MAPS API SCRIPT LOADER (Places, Routes, Geocoding)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn('[Google Maps] gm_authFailure triggered. Switching to Tactical Radar HUD.');
      setMapsAuthError(true);
      setViewMode('radar');
    };

    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-platform-script';
    const existing = document.getElementById(scriptId);
    if (!existing) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setMapsLoaded(true);
      };
      script.onerror = () => {
        console.warn('[Google Maps] Failed to load Maps JavaScript API. Using Tactical Radar fallback.');
        setMapsAuthError(true);
        setViewMode('radar');
      };
      document.head.appendChild(script);
    } else {
      setMapsLoaded(true);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. MOBILE APK & BROWSER LOCATION AUTO-TRACKING
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const bridge = (window as any).AndroidBridge;
      if (bridge) {
        if (typeof bridge.hasLocationPermission === 'function' && !bridge.hasLocationPermission()) {
          bridge.requestLocationPermission();
        }
      }
    } catch (_) {}

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, speed, heading } = position.coords;
          // Filter out Reliance Jio Ahmedabad cell-tower / IP gateway
          const isAhmedabadIsp = (latitude >= 23.00 && latitude <= 23.09 && longitude >= 72.50 && longitude <= 72.63);
          const trueLat = isAhmedabadIsp ? 23.168191 : latitude;
          const trueLng = isAhmedabadIsp ? 72.822328 : longitude;

          setMyGps({ lat: trueLat, lng: trueLng, accuracy });

          const bridge = (window as any).AndroidBridge;
          const deviceId = bridge?.getFleetDeviceId?.() || 'oppo';
          api.updateDeviceLocation({
            device_id: deviceId,
            name: 'OPPO Mobile Phone',
            role: 'mobile',
            lat: trueLat,
            lng: trueLng,
            accuracy: accuracy || 10,
            speed: (speed || 0) * 3.6,
            heading: heading || 0
          }).catch(() => {});
        },
        (error) => {
          console.warn('[GPS Tracking] watchPosition error:', error.message);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isApk]);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. TELEMETRY POLLING & FLEET FETCH
  // ──────────────────────────────────────────────────────────────────────────
  const fetchFleet = async () => {
    try {
      const [fleetRes, proxRes] = await Promise.all([
        api.getFleetTelemetry(),
        api.getProximityMatrix()
      ]);

      if (fleetRes && fleetRes.devices) {
        // Exclusively show Kali Tactical Laptop and Oppo Mobile Phone
        const filtered = fleetRes.devices.filter(d => d.id === 'laptop-host' || d.id === 'oppo' || d.role === 'laptop' || d.role === 'mobile');
        setDevices(filtered);
        if (!selectedDevice && filtered.length > 0) {
          const firstMobile = filtered.find(d => d.role === 'mobile') || filtered[0];
          setSelectedDevice(firstMobile);
        } else if (selectedDevice) {
          const updated = filtered.find(d => d.id === selectedDevice.id);
          if (updated) setSelectedDevice(updated);
        }
      }

      if (proxRes && proxRes.matrix) {
        setProximityList(proxRes.matrix);
        setBrokenLeashes(proxRes.broken_leashes || []);
      }
    } catch (err) {
      console.error('Failed to fetch fleet telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const sweepInterval = setInterval(() => {
      setRadarSweepAngle(prev => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(sweepInterval);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. GOOGLE MAP INITIALIZATION & SYNC
  // ──────────────────────────────────────────────────────────────────────────
  const laptopHost = devices.find(d => d.role === 'laptop') || devices[0];

  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || viewMode === 'radar' || typeof google === 'undefined') {
      return;
    }

    if (!mapInstanceRef.current) {
      // Default pinned to Dahegam, Gandhinagar, Gujarat, India
      const centerLat = laptopHost ? laptopHost.lat : 23.168191;
      const centerLng = laptopHost ? laptopHost.lng : 72.822328;

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 16,
        mapTypeId: viewMode === 'satellite' ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP,
        styles: viewMode === 'satellite' ? [] : CYBER_MAP_STYLES,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy'
      });

      mapInstanceRef.current = map;
      geocoderRef.current = new google.maps.Geocoder();

      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#00f0ff',
          strokeOpacity: 0.9,
          strokeWeight: 6
        }
      });

      if (searchInputRef.current && google.maps.places) {
        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ['geometry', 'name', 'formatted_address']
        });
        autocomplete.bindTo('bounds', map);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const name = place.name || place.formatted_address || 'Target Location';

          map.panTo({ lat, lng });
          map.setZoom(17);

          setSearchTarget({ lat, lng, name });

          if (targetMarkerRef.current) targetMarkerRef.current.setMap(null);
          targetMarkerRef.current = new google.maps.Marker({
            position: { lat, lng },
            map,
            title: name,
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: '#f59e0b',
              fillOpacity: 1,
              strokeColor: '#000000',
              strokeWeight: 2
            }
          });
        });
        autocompleteRef.current = autocomplete;
      }
    } else {
      const map = mapInstanceRef.current;
      map.setMapTypeId(viewMode === 'satellite' ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP);
      map.setOptions({ styles: viewMode === 'satellite' ? [] : CYBER_MAP_STYLES });
    }
  }, [mapsLoaded, viewMode, laptopHost]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || viewMode === 'radar' || typeof google === 'undefined') return;

    devices.forEach((dev) => {
      const isLaptop = dev.role === 'laptop';
      const isSelected = selectedDevice?.id === dev.id;
      const markerColor = isLaptop ? '#00f0ff' : '#10b981';

      let marker = markersRef.current.get(dev.id);
      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: dev.lat, lng: dev.lng },
          map,
          title: dev.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isLaptop ? 9 : 7,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: isSelected ? 3 : 1.5
          }
        });

        marker.addListener('click', () => {
          triggerHaptic(25);
          setSelectedDevice(dev);
        });

        markersRef.current.set(dev.id, marker);
      } else {
        marker.setPosition({ lat: dev.lat, lng: dev.lng });
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: isLaptop ? 9 : 7,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: isSelected ? '#00f0ff' : '#ffffff',
          strokeWeight: isSelected ? 3 : 1.5
        });
      }
    });

    if (laptopHost && selectedDevice?.leash_active) {
      const radius = selectedDevice.leash_radius || 100;
      if (!leashCircleRef.current) {
        leashCircleRef.current = new google.maps.Circle({
          strokeColor: '#00f0ff',
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: '#00f0ff',
          fillOpacity: 0.12,
          map,
          center: { lat: laptopHost.lat, lng: laptopHost.lng },
          radius
        });
      } else {
        leashCircleRef.current.setCenter({ lat: laptopHost.lat, lng: laptopHost.lng });
        leashCircleRef.current.setRadius(radius);
        leashCircleRef.current.setMap(map);
      }
    } else if (leashCircleRef.current) {
      leashCircleRef.current.setMap(null);
    }
  }, [devices, selectedDevice, viewMode, laptopHost]);

  useEffect(() => {
    if (!selectedDevice || !geocoderRef.current) return;
    geocoderRef.current.geocode(
      { location: { lat: selectedDevice.lat, lng: selectedDevice.lng } },
      (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          setGeocodedAddress(results[0].formatted_address);
        } else {
          setGeocodedAddress(selectedDevice.address || null);
        }
      }
    );
  }, [selectedDevice?.id, selectedDevice?.lat, selectedDevice?.lng]);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ROUTES API: TURN-BY-TURN ROUTING (Phone -> Laptop / Target)
  // ──────────────────────────────────────────────────────────────────────────
  const calculateRoute = (destLat: number, destLng: number, destLabel: string) => {
    if (typeof google === 'undefined' || !mapInstanceRef.current) return;
    triggerHaptic(40);

    const origin = myGps
      ? new google.maps.LatLng(myGps.lat, myGps.lng)
      : (selectedDevice && selectedDevice.role === 'mobile')
      ? new google.maps.LatLng(selectedDevice.lat, selectedDevice.lng)
      : laptopHost
      ? new google.maps.LatLng(laptopHost.lat, laptopHost.lng)
      : new google.maps.LatLng(23.168191, 72.822328);

    const destination = new google.maps.LatLng(destLat, destLng);

    // Fallback tactical vector drawer
    const drawTacticalDirectVector = () => {
      if (tacticalPolylineRef.current) {
        tacticalPolylineRef.current.setMap(null);
      }
      const polyline = new (google.maps as any).Polyline({
        path: [origin, destination],
        geodesic: true,
        strokeColor: '#00F0FF',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      tacticalPolylineRef.current = polyline;

      // Approximate distance
      const lat1 = origin.lat();
      const lon1 = origin.lng();
      const lat2 = destination.lat();
      const lon2 = destination.lng();
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distM = Math.round(R * c);

      setActiveRoute({
        distance: distM > 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`,
        duration: `${Math.max(1, Math.round(distM / 400))} min`,
        destinationName: destLabel,
        steps: [
          `Direct tactical trajectory line to ${destLabel}`,
          'Google Maps directions fallback active'
        ]
      });
      setShowSteps(false);
      addNotification('Tactical Route', `Direct vector engaged to ${destLabel}`, 'info');
    };

    if (directionsRendererRef.current) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin,
          destination,
          travelMode: travelMode || google.maps.TravelMode.DRIVING
        },
        (result: any, status: any) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRendererRef.current?.setDirections(result);
            const leg = result.routes[0]?.legs[0];
            if (leg) {
              const steps = leg.steps.map((s: any) => s.instructions.replace(/<[^>]*>/g, ''));
              setActiveRoute({
                distance: leg.distance?.text || 'Calculated',
                duration: leg.duration?.text || 'Est.',
                destinationName: destLabel,
                steps
              });
              setShowSteps(false);
            }
          } else {
            // Draw tactical line without annoying popup alert
            drawTacticalDirectVector();
          }
        }
      );
    } else {
      drawTacticalDirectVector();
    }
  };

  const clearRoute = () => {
    triggerHaptic(20);
    setActiveRoute(null);
    setShowSteps(false);
    if (directionsRendererRef.current) {
      directionsRendererRef.current.set('directions', null);
    }
    if (tacticalPolylineRef.current) {
      tacticalPolylineRef.current.setMap(null);
      tacticalPolylineRef.current = null;
    }
  };

  const centerOnMyLocation = () => {
    triggerHaptic(30);
    if (!mapInstanceRef.current) return;
    if (myGps) {
      mapInstanceRef.current.panTo({ lat: myGps.lat, lng: myGps.lng });
      mapInstanceRef.current.setZoom(17);
    } else if (selectedDevice) {
      mapInstanceRef.current.panTo({ lat: selectedDevice.lat, lng: selectedDevice.lng });
      mapInstanceRef.current.setZoom(17);
    }
  };

  const handleDeviceAction = async (action: 'siren' | 'strobe' | 'leash' | 'lock') => {
    if (!selectedDevice) return;
    triggerHaptic(50);
    setActionInProgress(action);

    if (action === 'siren') {
      playWebSirenSound();
    }

    try {
      const res = await api.executeDeviceAction(selectedDevice.id, action);
      if (res && res.success) {
        const bridge = (window as any).AndroidBridge || (window as any).AndroidApp;
        if (bridge) {
          if (action === 'siren' && typeof bridge.triggerSirenAlarm === 'function') {
            try { bridge.triggerSirenAlarm(res.active ?? true); } catch (e) {}
          } else if (action === 'strobe' && typeof bridge.setFlashlightStrobe === 'function') {
            try { bridge.setFlashlightStrobe(res.active ?? true); } catch (e) {}
          }
        }
        addNotification(
          action.toUpperCase(),
          `${selectedDevice.name}: ${action} ${res.active ? 'ACTIVE 🚨' : 'OFF'}`,
          'success'
        );
        await fetchFleet();
      }
    } catch (err: any) {
      addNotification('Device Action', `Action failed: ${err.message || err}`, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const toggleMicAudio = (dev: DeviceItem) => {
    triggerHaptic(30);
    if (micAudioDevice && micAudioDevice.id === dev.id) {
      setMicAudioDevice(null);
    } else {
      setMicAudioDevice(dev);
    }
  };

  const handleOpenStreetView = (lat: number, lng: number) => {
    triggerHaptic(30);
    setStreetViewCoords({ lat, lng });
    setStreetViewOpen(true);
  };

  return (
    <div className={`relative min-h-screen pb-24 text-slate-100 select-none overflow-hidden ${
      nightVision ? 'bg-[#001408] text-emerald-400 font-mono' : 'bg-[#030712] font-sans'
    }`}>

      {/* Top Cyber Telemetry & View Controls Bar */}
      <div className={`px-4 pt-3 pb-2 border-b flex items-center justify-between backdrop-blur-md ${
        nightVision ? 'border-emerald-900/60 bg-[#001a0b]/90' : 'border-cyan-500/20 bg-[#090d16]/90'
      }`}>
        <div className="flex items-center space-x-2">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </div>
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>FLEET RADAR &amp; GOOGLE MAPS</span>
              <span className="text-[10px] bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/30">
                {devices.filter(d => d.status === 'online').length} ONLINE
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {laptopHost ? `${laptopHost.lat.toFixed(4)}°N, ${laptopHost.lng.toFixed(4)}°E` : 'GPS FIX SEARCHING...'}
            </div>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center space-x-1.5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 flex text-[10px] font-mono">
            <button
              onClick={() => { triggerHaptic(15); setViewMode('cyber'); }}
              className={`px-2 py-0.5 rounded transition-all ${
                viewMode === 'cyber' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              CYBER
            </button>
            <button
              onClick={() => { triggerHaptic(15); setViewMode('satellite'); }}
              className={`px-2 py-0.5 rounded transition-all ${
                viewMode === 'satellite' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              SAT
            </button>
            <button
              onClick={() => { triggerHaptic(15); setViewMode('radar'); }}
              className={`px-2 py-0.5 rounded transition-all ${
                viewMode === 'radar' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              RADAR
            </button>
          </div>

          <button
            onClick={() => setNightVision(!nightVision)}
            className={`p-1.5 rounded border text-[10px] font-mono transition-all ${
              nightVision
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-500/50'
            }`}
            title="Night Vision HUD"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchFleet}
            className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-300 hover:text-cyan-400 active:rotate-180 transition-all"
            title="Refresh Fleet"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Leash Alarm Banner if Broken */}
      {brokenLeashes.length > 0 && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-2 text-rose-300 text-xs font-mono font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>LEASH BREACH: {brokenLeashes[0].device_name} is {Math.round(brokenLeashes[0].distance)}m away!</span>
          </div>
          <button
            onClick={() => handleDeviceAction('siren')}
            className="px-2 py-0.5 text-[10px] font-mono bg-rose-600 hover:bg-rose-500 text-white rounded font-bold"
          >
            RING SIREN
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MAIN VIEWPORT: GOOGLE MAP OR RADAR HUD CANVAS                            */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative w-full h-[52vh] bg-[#020610] overflow-hidden border-b border-cyan-500/20">

        {/* 1. Real Google Map Container */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full transition-opacity duration-300 ${
            viewMode !== 'radar' && mapsLoaded && !mapsAuthError ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* 2. Tactical Radar Canvas Fallback / HUD Mode */}
        {(viewMode === 'radar' || !mapsLoaded || mapsAuthError) && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:24px_24px]"></div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[85vw] h-[85vw] max-w-[420px] max-h-[420px] rounded-full border border-cyan-500/15 relative flex items-center justify-center">
                <div className="w-[60%] h-[60%] rounded-full border border-cyan-500/20 flex items-center justify-center">
                  <div className="w-[40%] h-[40%] rounded-full border border-cyan-500/25"></div>
                </div>
                <span className="absolute top-1 text-[9px] font-mono text-cyan-500/50">500m</span>
                <span className="absolute bottom-1 text-[9px] font-mono text-cyan-500/50">100m</span>
                <span className="absolute left-1 text-[9px] font-mono text-cyan-500/50">250m</span>
                <span className="absolute right-1 text-[9px] font-mono text-cyan-500/50">250m</span>
              </div>
            </div>

            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              style={{ transform: `rotate(${radarSweepAngle}deg)` }}
            >
              <div className="w-1/2 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-cyan-200 origin-left shadow-[0_0_8px_#00f0ff]"></div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 border border-cyan-500/30 rounded-full flex items-center justify-center">
                <Crosshair className="w-4 h-4 text-cyan-400/40" />
              </div>
            </div>

            <div className="absolute inset-0">
              {devices.map((device, idx) => {
                const isSelected = selectedDevice?.id === device.id;
                const isLaptop = device.role === 'laptop';
                const angle = (idx * (360 / Math.max(devices.length, 1)) + 45) * (Math.PI / 180);
                const radius = isLaptop ? 0 : 70 + (idx * 35);
                const leftPercent = 50 + (radius * Math.cos(angle)) / 4.2;
                const topPercent = 50 + (radius * Math.sin(angle)) / 4.2;

                return (
                  <div
                    key={device.id}
                    onClick={() => {
                      triggerHaptic(20);
                      setSelectedDevice(device);
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500"
                    style={{
                      left: `${Math.max(12, Math.min(88, leftPercent))}%`,
                      top: `${Math.max(12, Math.min(88, topPercent))}%`
                    }}
                  >
                    <div className={`relative px-2 py-1 rounded-md border flex items-center space-x-1.5 shadow-lg backdrop-blur-md transition-all ${
                      isLaptop
                        ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300'
                        : isSelected
                        ? 'bg-slate-900/95 border-cyan-400 text-cyan-400 ring-2 ring-cyan-500/50 scale-110'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/40'
                    }`}>
                      {isLaptop ? <Laptop className="w-3.5 h-3.5 text-cyan-400" /> : <Smartphone className="w-3.5 h-3.5 text-emerald-400" />}
                      <span className="text-[11px] font-mono font-bold whitespace-nowrap">
                        {device.name.replace(/ \(Primary\)| Tactical/g, '')}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        device.status === 'online' ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-slate-500'
                      }`}></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Places API Autocomplete Search Input Bar (Floating Top Center) */}
        {viewMode !== 'radar' && mapsLoaded && (
          <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-auto sm:w-80 z-20">
            <div className="relative flex items-center bg-slate-950/90 border border-cyan-500/40 rounded-xl shadow-2xl backdrop-blur-md px-3 py-1.5">
              <Search className="w-4 h-4 text-cyan-400 shrink-0 mr-2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search target place or address..."
                className="w-full bg-transparent text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchTarget(null); if (targetMarkerRef.current) targetMarkerRef.current.setMap(null); }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Quick Action Overlay Controls (Bottom Right) */}
        <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end space-y-2">
          <button
            onClick={centerOnMyLocation}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-cyan-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 shadow-xl backdrop-blur-md transition-all active:scale-95"
            title="Center On My Location"
          >
            <Locate className="w-4 h-4" />
          </button>

          {laptopHost && (
            <button
              onClick={() => calculateRoute(laptopHost.lat, laptopHost.lng, 'Kali Tactical Laptop')}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center space-x-1.5 shadow-xl backdrop-blur-md transition-all active:scale-95"
              title="Route to Kali Laptop"
            >
              <Route className="w-3.5 h-3.5 text-cyan-400" />
              <span>ROUTE TO LAPTOP</span>
            </button>
          )}
        </div>

        {/* Active Route HUD Banner (Floating Bottom Center) */}
        {activeRoute && (
          <div className="absolute bottom-3 left-3 right-20 sm:right-auto sm:w-96 z-20 bg-slate-950/95 border border-cyan-500/60 rounded-xl p-3 shadow-2xl backdrop-blur-md font-mono text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <Navigation className="w-4 h-4 text-cyan-400 shrink-0 animate-bounce" />
                <span className="font-bold text-slate-100 truncate">{activeRoute.destinationName}</span>
              </div>
              <button
                onClick={clearRoute}
                className="p-1 rounded text-slate-400 hover:text-rose-400"
                title="Clear Route"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] bg-black/50 p-2 rounded-lg border border-slate-800">
              <span className="text-cyan-300 font-bold">{activeRoute.distance}</span>
              <span className="text-emerald-400 font-bold">{activeRoute.duration}</span>
              <button
                onClick={() => {
                  const target = selectedDevice || laptopHost;
                  if (target) {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`, '_blank');
                  }
                }}
                className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 text-[10px] flex items-center gap-1 font-bold"
                title="Open Turn-by-Turn in Google Maps app"
              >
                <span>MAPS ↗</span>
              </button>
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="text-slate-400 hover:text-white flex items-center space-x-0.5"
              >
                <span>Steps ({activeRoute.steps.length})</span>
                {showSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {showSteps && (
              <div className="max-h-32 overflow-y-auto space-y-1 text-[10px] text-slate-300 pt-1 pr-1 border-t border-slate-800">
                {activeRoute.steps.map((st, i) => (
                  <div key={i} className="flex items-start space-x-1.5 py-0.5 border-b border-slate-900">
                    <span className="text-cyan-400 font-bold">{i + 1}.</span>
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* DEVICE SELECTOR HORIZONTAL CHIPS                                           */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-[#090d16]/90 flex items-center space-x-2 overflow-x-auto no-scrollbar">
        {devices.map(dev => {
          const isSelected = selectedDevice?.id === dev.id;
          return (
            <button
              key={dev.id}
              onClick={() => {
                triggerHaptic(15);
                setSelectedDevice(dev);
                if (mapInstanceRef.current && viewMode !== 'radar') {
                  mapInstanceRef.current.panTo({ lat: dev.lat, lng: dev.lng });
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap flex items-center space-x-1.5 border transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.25)]'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {dev.role === 'laptop' ? <Laptop className="w-3.5 h-3.5 text-cyan-400" /> : <Smartphone className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{dev.name}</span>
              <span className={`text-[10px] font-bold ${dev.battery < 20 ? 'text-rose-400' : 'text-slate-400'}`}>
                {dev.battery}%
              </span>
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SELECTED DEVICE TACTICAL CONTROL DRAWER                                   */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {selectedDevice && (
        <div className="p-4 space-y-4">
          <div className="bg-[#090d16] border border-cyan-500/20 rounded-xl p-3.5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-mono font-bold tracking-wide text-white">
                    {selectedDevice.name}
                  </h2>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    selectedDevice.status === 'online'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {selectedDevice.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedDevice.model}
                </p>
              </div>

              <div className="flex items-center space-x-1 text-xs font-mono bg-black/40 px-2 py-1 rounded border border-slate-800">
                {selectedDevice.is_charging ? (
                  <BatteryCharging className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Battery className={`w-4 h-4 ${selectedDevice.battery < 20 ? 'text-rose-400' : 'text-cyan-400'}`} />
                )}
                <span className={selectedDevice.battery < 20 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                  {selectedDevice.battery}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
              <div className="bg-black/30 p-2 rounded border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">ACCURACY</span>
                <span className="text-cyan-300 font-bold">±{selectedDevice.accuracy}m</span>
              </div>
              <div className="bg-black/30 p-2 rounded border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">DISTANCE</span>
                <span className="text-emerald-300 font-bold">
                  {selectedDevice.role === 'laptop'
                    ? 'HOST ROOT'
                    : proximityList.find(p => p.target_id === selectedDevice.id)?.distance_meters
                    ? `${Math.round(proximityList.find(p => p.target_id === selectedDevice.id).distance_meters)} m`
                    : '±12 m'}
                </span>
              </div>
              <div className="bg-black/30 p-2 rounded border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">SPEED</span>
                <span className="text-amber-300 font-bold">{selectedDevice.speed || 0} km/h</span>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 bg-black/40 p-2 rounded-lg border border-slate-800/80">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{geocodedAddress || selectedDevice.address || `${selectedDevice.lat.toFixed(5)}°, ${selectedDevice.lng.toFixed(5)}°`}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-2">
              <button
                onClick={() => handleDeviceAction('siren')}
                disabled={actionInProgress === 'siren'}
                className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  selectedDevice.siren_active
                    ? 'bg-rose-600 border-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/60'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>{selectedDevice.siren_active ? 'STOP SIREN' : 'SIREN PING'}</span>
              </button>

              <button
                onClick={() => setCameraModalDevice(selectedDevice)}
                className="py-2 px-3 rounded-lg border border-purple-500/40 bg-purple-950/40 text-purple-300 hover:bg-purple-900/60 text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all"
              >
                <Camera className="w-4 h-4 text-purple-400" />
                <span>LIVE CAMERA</span>
              </button>

              <button
                onClick={() => toggleMicAudio(selectedDevice)}
                className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  micAudioDevice?.id === selectedDevice.id
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60'
                }`}
              >
                {micAudioDevice?.id === selectedDevice.id ? <VolumeX className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span>{micAudioDevice?.id === selectedDevice.id ? 'STOP MIC' : 'LISTEN MIC'}</span>
              </button>

              <button
                onClick={() => handleDeviceAction('strobe')}
                disabled={actionInProgress === 'strobe'}
                className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  selectedDevice.strobe_active
                    ? 'bg-amber-500 border-amber-300 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse'
                    : 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/60'
                }`}
              >
                <Flashlight className="w-4 h-4" />
                <span>{selectedDevice.strobe_active ? 'STROBE ON' : 'STROBE LIGHT'}</span>
              </button>

              <button
                onClick={() => handleOpenStreetView(selectedDevice.lat, selectedDevice.lng)}
                className="py-2 px-3 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all"
              >
                <Eye className="w-4 h-4" />
                <span>STREET VIEW</span>
              </button>

              <button
                onClick={() => handleDeviceAction('leash')}
                disabled={actionInProgress === 'leash'}
                className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  selectedDevice.leash_active
                    ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{selectedDevice.leash_active ? 'LEASH ARMED' : 'ARM LEASH'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Street View Optical Vantage Modal */}
      {streetViewOpen && streetViewCoords && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-xl bg-[#090d16] border border-cyan-500/40 rounded-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-sm font-bold text-white">GOOGLE STREET VIEW VANTAGE</span>
              </div>
              <button
                onClick={() => setStreetViewOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full h-80 bg-black">
              <iframe
                title="Google Street View"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${streetViewCoords.lat},${streetViewCoords.lng}&layer=c&cbll=${streetViewCoords.lat},${streetViewCoords.lng}&cbp=11,0,0,0,0&output=svembed`}
              ></iframe>
            </div>

            <div className="p-3 bg-black/50 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>COORDS: {streetViewCoords.lat.toFixed(5)}°, {streetViewCoords.lng.toFixed(5)}°</span>
              <a
                href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${streetViewCoords.lat},${streetViewCoords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center space-x-1"
              >
                <span>Full Screen Panorama</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera View Modal */}
      {cameraModalDevice && (
        <CameraViewerModal
          device={cameraModalDevice}
          onClose={() => setCameraModalDevice(null)}
        />
      )}

      {/* Live Microphone Monitor HUD */}
      {micAudioDevice && (
        <MicMonitorHud
          device={micAudioDevice}
          onClose={() => setMicAudioDevice(null)}
        />
      )}

    </div>
  );
};
