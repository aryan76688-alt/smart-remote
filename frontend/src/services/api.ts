import {
  SystemInfo, SystemStats, ProcessItem, FileListResponse, FileReadResponse,
  DeviceItem, ActivityItem, ShortcutItem, TunnelStatus
} from '../types';

const BASE_URL = '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData ? undefined : headers,
  });

  if (!res.ok) {
    let errorDetail = `Request failed: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  // System
  getSystemInfo: () => request<SystemInfo>('/api/system/info'),
  getSystemStats: () => request<SystemStats>('/api/system/stats'),
  getProcesses: (limit = 40, sort = 'cpu') => request<ProcessItem[]>(`/api/system/processes?limit=${limit}&sort=${sort}`),
  killProcess: (pid: number, signal = 15) => request<{ success: boolean; pid: number }>('/api/system/kill', {
    method: 'POST',
    body: JSON.stringify({ pid, signal })
  }),
  powerAction: (action: string, confirmed = false) => request<{ success: boolean; action: string }>('/api/system/power', {
    method: 'POST',
    body: JSON.stringify({ action, confirmed })
  }),

  // Files
  listFiles: (path = '') => request<FileListResponse>(`/api/files/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) => request<FileReadResponse>(`/api/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) => request<{ success: boolean }>('/api/files/write', {
    method: 'POST',
    body: JSON.stringify({ path, content })
  }),
  createItem: (path: string, is_directory = false) => request<{ success: boolean; path: string }>('/api/files/create', {
    method: 'POST',
    body: JSON.stringify({ path, is_directory })
  }),
  renameItem: (old_path: string, new_path: string) => request<{ success: boolean; path: string }>('/api/files/rename', {
    method: 'POST',
    body: JSON.stringify({ old_path, new_path })
  }),
  deleteItem: (path: string, confirmed = false) => request<{ success: boolean; path: string }>('/api/files/delete', {
    method: 'POST',
    body: JSON.stringify({ path, confirmed })
  }),
  uploadFile: async (path: string, file: File) => {
    const formData = new FormData();
    formData.append('path', path);
    formData.append('file', file);
    return request<{ success: boolean; path: string }>('/api/files/upload', {
      method: 'POST',
      body: formData
    });
  },
  bulkDownload: async (paths: string[]) => {
    if (!paths || paths.length === 0) return false;
    const fileName = `smart_remote_export_${Date.now()}.zip`;
    const bridge = (window as any).AndroidBridge;

    if (bridge && typeof bridge.downloadFile === 'function') {
      const getUrl = `/api/files/bulk-download-zip?paths=${encodeURIComponent(paths.join(','))}`;
      bridge.downloadFile(getUrl, fileName, 'application/zip');
      return true;
    }

    const res = await fetch('/api/files/bulk-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) throw new Error('Bulk download failed');
    const blob = await res.blob();

    if (bridge && typeof bridge.saveBase64File === 'function') {
      const reader = new FileReader();
      reader.onloadend = () => {
        bridge.saveBase64File(fileName, reader.result as string, 'application/zip');
      };
      reader.readAsDataURL(blob);
      return true;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 60000);
    return true;
  },
  bulkUpload: async (path: string, files: File[] | FileList) => {
    const formData = new FormData();
    formData.append('path', path);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    return request<{ success: boolean; uploaded: string[]; count: number }>('/api/files/bulk-upload', {
      method: 'POST',
      body: formData
    });
  },
  bulkDelete: (paths: string[], confirmed = true) => request<{ success: boolean; deleted: string[]; count: number }>('/api/files/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ paths, confirmed })
  }),

  // Remote Phone Files (Access Android phone storage anywhere anytime)
  getPhoneQuickCategories: (deviceId = 'oppo') => 
    request<{ success: boolean; categories: Array<{ id: string; name: string; path: string; icon: string; badge: string; color: string }> }>(`/api/phone-files/quick-categories?device_id=${encodeURIComponent(deviceId)}`),
  
  getPhoneStorageInfo: (deviceId = 'oppo') => 
    request<{
      success: boolean;
      total_bytes: number;
      used_bytes: number;
      free_bytes: number;
      total_gb: number;
      used_gb: number;
      free_gb: number;
      used_percent: number;
      breakdown?: {
        images_bytes: number;
        videos_bytes: number;
        audio_bytes: number;
        documents_bytes: number;
        system_other_bytes: number;
      };
      has_all_files_access?: boolean;
      is_cached?: boolean;
    }>(`/api/phone-files/storage-info?device_id=${encodeURIComponent(deviceId)}`),

  listPhoneFiles: (path = '/storage/emulated/0', deviceId = 'oppo') => {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.listPhoneFiles === 'function') {
      try {
        const raw = bridge.listPhoneFiles(path);
        const parsed = JSON.parse(raw);
        if (parsed && parsed.success) return Promise.resolve(parsed);
      } catch (_) {}
    }
    return request<FileListResponse & { is_cached?: boolean; note?: string }>(`/api/phone-files/list?path=${encodeURIComponent(path)}&device_id=${encodeURIComponent(deviceId)}`);
  },

  readPhoneFile: (path: string, deviceId = 'oppo') => {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.readPhoneFile === 'function') {
      try {
        const raw = bridge.readPhoneFile(path);
        const parsed = JSON.parse(raw);
        if (parsed && parsed.success) return Promise.resolve(parsed);
      } catch (_) {}
    }
    return request<FileReadResponse>(`/api/phone-files/read?path=${encodeURIComponent(path)}&device_id=${encodeURIComponent(deviceId)}`);
  },

  deletePhoneFile: (path: string, deviceId = 'oppo') => {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.deletePhoneFile === 'function') {
      const ok = bridge.deletePhoneFile(path);
      if (ok) return Promise.resolve({ success: true, path, device_id: deviceId });
    }
    return request<{ success: boolean; path: string; device_id: string }>('/api/phone-files/delete', {
      method: 'POST',
      body: JSON.stringify({ path, device_id: deviceId })
    });
  },

  createPhoneItem: (path: string, is_directory = false, deviceId = 'oppo') => {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.createPhoneItem === 'function') {
      const ok = bridge.createPhoneItem(path, is_directory);
      if (ok) return Promise.resolve({ success: true, path, device_id: deviceId });
    }
    return request<{ success: boolean; path: string; device_id: string }>('/api/phone-files/create', {
      method: 'POST',
      body: JSON.stringify({ path, is_directory, device_id: deviceId })
    });
  },

  writePhoneFile: (path: string, content: string, deviceId = 'oppo') => {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.writePhoneFile === 'function') {
      const ok = bridge.writePhoneFile(path, content);
      if (ok) return Promise.resolve({ success: true, path, device_id: deviceId });
    }
    return request<{ success: boolean; path: string; device_id: string }>('/api/phone-files/write', {
      method: 'POST',
      body: JSON.stringify({ path, content, device_id: deviceId })
    });
  },

  uploadPhoneFiles: async (path: string, files: File[] | FileList, deviceId = 'oppo') => {
    const results: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('path', path);
      formData.append('file', file);
      formData.append('device_id', deviceId);
      const res = await request<{ success: boolean; path: string }>('/api/phone-files/upload', {
        method: 'POST',
        body: formData
      });
      results.push(res);
    }
    return { success: true, count: results.length, uploaded: results };
  },

  bulkPhoneDownloadZip: async (paths: string[], deviceId = 'oppo') => {
    if (!paths || paths.length === 0) return false;
    const fileName = `phone_export_${Date.now()}.zip`;
    const bridge = (window as any).AndroidBridge;

    if (bridge && typeof bridge.downloadFile === 'function') {
      const getUrl = `/api/phone-files/bulk-download-zip?paths=${encodeURIComponent(paths.join(','))}&device_id=${encodeURIComponent(deviceId)}`;
      bridge.downloadFile(getUrl, fileName, 'application/zip');
      return true;
    }

    const a = document.createElement('a');
    a.href = `/api/phone-files/bulk-download-zip?paths=${encodeURIComponent(paths.join(','))}&device_id=${encodeURIComponent(deviceId)}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  },


  // Devices
  getCurrentDevice: () => request<DeviceItem>('/api/devices/current'),
  getDevices: () => request<DeviceItem[]>('/api/devices/list'),
  pingDevice: () => request<{ status: string; timestamp: number; tailscale: string }>('/api/devices/ping', {
    method: 'POST'
  }),
  updateDevice: (id: number, data: Partial<DeviceItem>) => request<DeviceItem>(`/api/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // History & Activity
  getActivities: (limit = 50, actionType?: string) => {
    const q = actionType ? `&action_type=${encodeURIComponent(actionType)}` : '';
    return request<ActivityItem[]>(`/api/history/list?limit=${limit}${q}`);
  },
  clearHistory: () => request<{ success: boolean; message: string }>('/api/history/clear', {
    method: 'DELETE'
  }),
  exportHistory: () => request<any[]>('/api/history/export'),

  // Assistant & Voice
  chatAssistant: (message: string, context?: any) => request<any>('/api/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context })
  }),
  executeCommand: (command: string, confirmed = false) => request<{ command: string; stdout: string; stderr: string; exit_code: number }>('/api/assistant/execute', {
    method: 'POST',
    body: JSON.stringify({ command, confirmed })
  }),
  getShortcuts: () => request<ShortcutItem[]>('/api/assistant/shortcuts'),
  createShortcut: (sc: ShortcutItem) => request<ShortcutItem>('/api/assistant/shortcuts', {
    method: 'POST',
    body: JSON.stringify(sc)
  }),
  processVoice: (transcript: string) => request<{ transcript: string; spoken_reply: string; action_executed?: string; requires_confirmation?: boolean; pending_command?: string }>('/api/voice/process', {
    method: 'POST',
    body: JSON.stringify({ transcript })
  }),

  // Remote & Media
  sendPointer: (data: any) => request<{ success: boolean }>('/api/remote/pointer', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendKey: (key: string, modifiers: string[] = [], type = 'combination') => request<{ success: boolean }>('/api/remote/key', {
    method: 'POST',
    body: JSON.stringify({ key, modifiers, type })
  }),
  sendDPad: (direction: string, step = 20, precision = false) => request<{ success: boolean }>('/api/remote/dpad', {
    method: 'POST',
    body: JSON.stringify({ direction, step, precision })
  }),
  sendMedia: (action: string, ott_app?: string, volume_level?: number) => request<{ success: boolean }>('/api/remote/media', {
    method: 'POST',
    body: JSON.stringify({ action, ott_app, volume_level })
  }),
  unlockScreen: () => request<{ success: boolean; message: string }>('/api/remote/unlock-screen', {
    method: 'POST'
  }),
  wakeScreen: () => request<{ success: boolean; message: string }>('/api/remote/wake-screen', {
    method: 'POST'
  }),

  // Auth & Login
  login: (username: string, password: string) => request<{ success: boolean; username: string; token: string; role: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),

  // Settings & Sync
  getSettings: () => request<Record<string, string>>('/api/settings'),
  updateSettings: (data: Record<string, any>) => request<{ success: boolean }>('/api/settings', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getSyncStatus: () => request<any>('/api/sync/status'),
  exportBackup: () => request<any>('/api/sync/backup'),
  restoreBackup: (data: any) => request<{ success: boolean }>('/api/sync/restore', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  loginGDrive: (data: { email: string; name?: string; avatar_url?: string; access_token?: string; auto_sync?: boolean; sync_interval?: string }) => request<any>('/api/sync/gdrive/login', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getGDriveBackups: () => request<any[]>('/api/sync/gdrive/backups'),
  backupNowGDrive: () => request<any>('/api/sync/gdrive/backup-now', {
    method: 'POST'
  }),
  restoreGDriveSnapshot: (snapshot_id: string) => request<any>('/api/sync/gdrive/restore-snapshot', {
    method: 'POST',
    body: JSON.stringify({ snapshot_id })
  }),
  disconnectGDrive: () => request<any>('/api/sync/gdrive/disconnect', {
    method: 'POST'
  }),
  getRcloneStatus: () => request<{
    installed: boolean;
    version: string | null;
    binary_path: string;
    configured: boolean;
    authenticated: boolean;
    folder_exists: boolean;
    folder_name: string;
    target_email: string;
    auth_in_progress: boolean;
    auth_url: string | null;
    auth_state: string | null;
    error: string | null;
  }>('/api/sync/gdrive/rclone-status'),
  startGDriveAuth: (open_kali_browser = false) => request<{
    success: boolean;
    auth_url?: string;
    local_url?: string;
    state?: string;
    target_email?: string;
    folder?: string;
    error?: string;
  }>('/api/sync/gdrive/start-auth', {
    method: 'POST',
    body: JSON.stringify({ open_kali_browser })
  }),
  openGDriveBrowser: (url?: string) => request<{ success: boolean; opened: boolean; auth_url?: string }>('/api/sync/gdrive/open-browser', {
    method: 'POST',
    body: JSON.stringify({ url })
  }),
  finishGDriveAuth: (redirect_input: string) => request<{
    success: boolean;
    authenticated?: boolean;
    folder_exists?: boolean;
    message?: string;
    error?: string;
  }>('/api/sync/gdrive/finish-auth', {
    method: 'POST',
    body: JSON.stringify({ redirect_input })
  }),
  saveGDriveToken: (token: string) => request<{
    success: boolean;
    authenticated?: boolean;
    folder_exists?: boolean;
    message?: string;
    error?: string;
  }>('/api/sync/gdrive/save-token', {
    method: 'POST',
    body: JSON.stringify({ token })
  }),
  syncAllCctvToDrive: () => request<{ success: boolean; message: string }>('/api/sync/gdrive/sync-cctv', {
    method: 'POST'
  }),
  getDriveCctvFiles: () => request<Array<{ Path: string; Name: string; Size: number; ModTime: string; IsDir: boolean }>>('/api/sync/gdrive/cctv-files'),

  // Tunnel & Global Access Anywhere
  getTunnelStatus: () => request<TunnelStatus>('/api/tunnel/status'),
  startTunnel: (provider = 'auto', custom_url?: string, custom_token?: string) => request<TunnelStatus>('/api/tunnel/start', {
    method: 'POST',
    body: JSON.stringify({ provider, custom_url, custom_token })
  }),
  stopTunnel: () => request<TunnelStatus>('/api/tunnel/stop', {
    method: 'POST'
  }),
  restartTunnel: (provider?: string) => request<TunnelStatus>('/api/tunnel/restart', {
    method: 'POST',
    body: JSON.stringify({ provider })
  }),
  pingTunnel: () => request<{ pong: boolean; timestamp: number; tunnel_active: boolean; public_url: string | null }>('/api/tunnel/ping'),

  // Quick System Actions
  quickAction: (action: string) => request<{ success: boolean; action: string; description: string }>('/api/system/quick-action', {
    method: 'POST',
    body: JSON.stringify({ action })
  }),

  // Autostart at System Boot / User Login
  getAutostart: () => request<{ enabled: boolean }>('/api/system/autostart'),
  toggleAutostart: (enable: boolean) => request<{ enabled: boolean; success: boolean }>('/api/system/autostart', {
    method: 'POST',
    body: JSON.stringify({ enable })
  }),

  // Two-Way Camera (Laptop Webcam & Phone Camera to Kali Screen)
  getCameraStatus: () => request<{ laptop_camera_available: boolean; desktop_window_available: boolean; phone_streaming_active: boolean }>('/api/camera/status'),
  getLaptopCameraStreamUrl: () => '/api/camera/laptop/stream',
  getPhoneCameraStreamUrl: () => '/api/camera/phone/stream',
  getLaptopAudioStreamUrl: () => '/api/camera/laptop/audio',
  getPhoneAudioStreamUrl: () => '/api/camera/phone/audio-stream',
  getPhoneCameraStatus: () => request<{ camera_active: boolean; audio_active: boolean; fps: number; facing: string; torch: boolean }>('/api/camera/phone/status'),
  controlPhoneCamera: (action: 'flip_camera' | 'toggle_torch' | 'start_camera' | 'stop_camera' | 'start_mic' | 'stop_mic') => request<{ success: boolean; [key: string]: any }>('/api/camera/phone/control', {
    method: 'POST',
    body: JSON.stringify({ action })
  }),
  sendPhoneCameraFrame: (image: string) => request<{ success: boolean }>('/api/camera/phone/frame', {
    method: 'POST',
    body: JSON.stringify({ image })
  }),
  stopPhoneCamera: () => request<{ success: boolean }>('/api/camera/phone/stop', {
    method: 'POST'
  }),

  // Mobile Screen Mirroring
  getMobileScreenStatus: () => request<{ active: boolean; requested: boolean; fps: number; last_frame_sec: number | null }>('/api/remote/screen/mobile/status'),
  getMobileScreenStreamUrl: () => '/api/remote/screen/mobile/stream',
  controlMobileScreen: (action: 'start' | 'stop') => request<{ success: boolean; active: boolean; message: string }>('/api/remote/screen/mobile/control', {
    method: 'POST',
    body: JSON.stringify({ action })
  }),

  // CCTV 30-Minute Video Recording & Cloud Sync
  startCctvRecording: (chunk_duration_sec = 1800, auto_upload_gdrive = true) => request<{ success: boolean; message: string; chunk_duration_sec: number }>('/api/camera/cctv/start', {
    method: 'POST',
    body: JSON.stringify({ chunk_duration_sec, auto_upload_gdrive })
  }),
  stopCctvRecording: () => request<{ success: boolean; message: string; saved_file?: string }>('/api/camera/cctv/stop', {
    method: 'POST'
  }),
  getCctvStatus: () => request<{
    is_recording: boolean;
    always_record: boolean;
    current_filename?: string;
    chunk_duration_sec: number;
    chunk_elapsed_sec: number;
    chunk_remaining_sec: number;
    total_chunks_recorded: number;
    auto_upload_gdrive: boolean;
    resolution: string;
    fps: number;
    quality: string;
    night_mode: boolean;
    motion_detected: boolean;
    motion_detection_enabled?: boolean;
    audio_noise_cancellation?: boolean;
    auto_light_adjust?: boolean;
    motion_score?: number;
    motion_boxes?: Array<{ id: number; x: number; y: number; w: number; h: number; score: number; duration?: number }>;
    motion_sensitivity?: string;
    keep_laptop_screen_off?: boolean;
    screen_is_off?: boolean;
    free_disk_gb: number;
  }>('/api/camera/cctv/status'),
  getCctvRecordings: () => request<Array<{
    filename: string;
    timestamp: string;
    duration_seconds: number;
    size_bytes: number;
    resolution?: string;
    gdrive_uploaded: boolean;
    gdrive_folder: string;
    gdrive_account?: string;
    download_url: string;
  }>>('/api/camera/cctv/recordings'),
  getCloudRecordings: () => request<Array<{
    id: string;
    filename: string;
    size_bytes: number;
    created_at: string;
    duration_sec: number;
    gdrive_file_id?: string;
    stream_url: string;
    download_url: string;
    preview_url?: string;
    is_cloud: boolean;
  }>>('/api/camera/cctv/cloud-recordings'),
  uploadCctvToDrive: (filename: string) => request<{ success: boolean; message: string }>(`/api/camera/cctv/upload-to-drive/${encodeURIComponent(filename)}`, {
    method: 'POST'
  }),
  getCctvSettings: () => request<{
    always_record: boolean;
    quality: string;
    night_mode: boolean;
    motion_detection: boolean;
    motion_sensitivity?: string;
    keep_laptop_screen_off?: boolean;
    screen_is_off?: boolean;
    chunk_duration_sec: number;
    auto_upload_gdrive: boolean;
    min_free_disk_gb: number;
    retention_hours: number;
    resolution: string;
    fps: number;
  }>('/api/camera/cctv/settings'),
  updateCctvSettings: (settings: Record<string, any>) => request<{
    always_record: boolean;
    quality: string;
    night_mode: boolean;
    motion_detection: boolean;
    motion_sensitivity?: string;
    keep_laptop_screen_off?: boolean;
    screen_is_off?: boolean;
    chunk_duration_sec: number;
    auto_upload_gdrive: boolean;
  }>('/api/camera/cctv/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  }),
  getCctvEvents: () => request<Array<{
    id: string;
    timestamp: string;
    type: string;
    details: any;
  }>>('/api/camera/cctv/events'),
  getCctvVideoStreamUrl: (filename: string) => `/api/camera/cctv/stream-video/${encodeURIComponent(filename)}`,
  getCctvEventSnapshotUrl: (filename: string) => `/api/camera/cctv/events/${encodeURIComponent(filename)}/snapshot`,
  turnCctvScreenOff: () => request<{ success: boolean; message: string; screen_is_off: boolean }>('/api/camera/cctv/screen-off', {
    method: 'POST'
  }),
  wakeCctvScreen: () => request<{ success: boolean; message: string; screen_is_off: boolean }>('/api/camera/cctv/screen-on', {
    method: 'POST'
  }),
  getCctvScreenStatus: () => request<{ screen_is_off: boolean; keep_laptop_screen_off: boolean }>('/api/camera/cctv/screen-status'),
  toggleMotionDetection: (enabled?: boolean) => request<{
    success: boolean;
    motion_detection_enabled: boolean;
    message: string;
  }>('/api/camera/cctv/motion-toggle', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),
  toggleAudioNoiseCancellation: (enabled?: boolean) => request<{
    success: boolean;
    audio_noise_cancellation: boolean;
    message: string;
  }>('/api/camera/cctv/noise-cancellation', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),
  toggleAutoLightAdjust: (enabled?: boolean) => request<{
    success: boolean;
    auto_light_adjust: boolean;
    message: string;
  }>('/api/camera/cctv/auto-light', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),
  sendIntercomAudio: async (audioBlob: Blob): Promise<{
    success: boolean;
    filename?: string;
    played?: boolean;
    gdrive_syncing?: boolean;
    gdrive_folder?: string;
    error?: string;
  }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    const token = localStorage.getItem('token') || '';
    const res = await fetch('/api/camera/laptop/intercom', {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: formData
    });
    return res.json();
  },
  getIntercomHistory: () => request<Array<{
    filename: string;
    path: string;
    timestamp: string;
    size_bytes: number;
    gdrive_uploaded: boolean;
    gdrive_folder: string;
    download_url: string;
  }>>('/api/camera/cctv/intercom-history'),

  // ── Productivity & Smart Tools ──────────────────────────────────────────
  getClipboard: () => request<{ success: boolean; text: string; length: number }>('/api/clipboard'),
  setClipboard: (text: string, type_immediately: boolean = false) => request<{ success: boolean; length?: number; message?: string; typed?: boolean }>('/api/clipboard', {
    method: 'POST',
    body: JSON.stringify({ text, type_immediately })
  }),
  clearClipboard: () => request<{ success: boolean; message: string }>('/api/clipboard/clear', {
    method: 'POST'
  }),
  quickDropFile: async (file: File): Promise<{ success: boolean; filename: string; saved_path: string; size_bytes: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token') || '';
    const res = await fetch('/api/productivity/quick-drop', {
      method: 'POST',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: formData
    });
    return res.json();
  },
  getApps: () => request<{ apps: Array<{ id: string; name: string; icon: string; installed: boolean; running: boolean }> }>('/api/productivity/apps'),
  launchApp: (app_id: string) => request<{ success: boolean; message: string }>('/api/productivity/apps/launch', {
    method: 'POST',
    body: JSON.stringify({ app_id })
  }),
  killApp: (app_id: string) => request<{ success: boolean; message: string }>('/api/productivity/apps/kill', {
    method: 'POST',
    body: JSON.stringify({ app_id })
  }),
  getBattery: () => request<{
    percentage: number;
    status: string;
    is_plugged: boolean;
    overcharge_warning: boolean;
    low_battery_warning: boolean;
  }>('/api/productivity/battery'),

  // ── Gemini AI Brain ──────────────────────────────────────────────────────
  getGeminiStatus: () => request<{ configured: boolean; masked_key: string | null }>('/api/productivity/gemini/status'),
  setGeminiKey: (api_key: string) => request<{ success: boolean; configured: boolean }>('/api/productivity/gemini/key', {
    method: 'POST',
    body: JSON.stringify({ api_key })
  }),
  askJarvis: (prompt: string, context?: any) => request<{ reply: string; command: string | null; configured: boolean }>('/api/productivity/gemini/ask', {
    method: 'POST',
    body: JSON.stringify({ prompt, context })
  }),
  aiAnalyzeCctv: (event_id?: string) => request<{ success: boolean; summary: string; configured?: boolean }>('/api/camera/cctv/ai-analyze', {
    method: 'POST',
    body: JSON.stringify({ event_id })
  }),

  // ── Emergency Siren ──────────────────────────────────────────────────────
  getSirenStatus: () => request<{ active: boolean }>('/api/camera/siren/status'),
  triggerSiren: (action: 'start' | 'stop', duration_sec: number = 30) => request<{ active: boolean; message?: string }>('/api/camera/siren/trigger', {
    method: 'POST',
    body: JSON.stringify({ action, duration_sec })
  }),

  // ── n8n Smart Automation & Workflow Hub ──────────────────────────────────
  getN8nStatus: () => request<{
    online: boolean;
    status: string;
    base_url: string;
    webhook_url: string;
    enabled: boolean;
    triggers: Record<string, boolean>;
  }>('/api/n8n/status'),
  getN8nConfig: () => request<any>('/api/n8n/config'),
  updateN8nConfig: (config: any) => request<any>('/api/n8n/config', {
    method: 'POST',
    body: JSON.stringify(config)
  }),
  testN8nTrigger: (payload: { event: string; data?: any }) => request<any>('/api/n8n/test-trigger', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  executeN8nAction: (payload: { action: string; params?: any }) => request<any>('/api/n8n/action', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // ── Cyber & Pentesting Cockpit ──────────────────────────────────────────
  getNetworkRadar: () => request<{ success: boolean; count: number; connections: any[] }>('/api/cyber/radar'),
  killSocket: (pid: number, signal: number = 9) => request<{ success: boolean; message: string }>('/api/cyber/radar/kill', {
    method: 'POST',
    body: JSON.stringify({ pid, signal })
  }),
  getTorStatus: () => request<{ tor_running: boolean; socks_open: boolean; public_ip: string; status: string }>('/api/cyber/tor/status'),
  renewTorCircuit: () => request<{ success: boolean; message: string; new_ip?: string }>('/api/cyber/tor/renew', {
    method: 'POST'
  }),
  generatePayload: (payload_type: string, lhost: string = '100.69.194.11', lport: number = 4444) => request<{ payload_type: string; lhost: string; lport: number; command: string }>('/api/cyber/payload/generate', {
    method: 'POST',
    body: JSON.stringify({ payload_type, lhost, lport })
  }),
  togglePayloadStager: (action: 'start' | 'stop', port: number = 8888, payload_text?: string) => request<{ running: boolean; port: number; url?: string }>('/api/cyber/payload/stager/toggle', {
    method: 'POST',
    body: JSON.stringify({ action, port, payload_text })
  }),
  scanWifi: () => request<{ success: boolean; count: number; networks: any[] }>('/api/cyber/wifi/scan'),
  getCyberListeners: () => request<{ listeners: any[] }>('/api/cyber/listeners'),

  // ── DevOps & Sysadmin Command Deck ───────────────────────────────────────
  getContainers: () => request<{ runtime: string; containers: any[] }>('/api/devops/containers'),
  containerAction: (id: string, action: 'start' | 'stop' | 'restart') => request<{ success: boolean; message: string }>('/api/devops/containers/action', {
    method: 'POST',
    body: JSON.stringify({ id, action })
  }),
  getContainerLogs: (id: string, tail: number = 100) => request<{ id: string; logs: string }>(`/api/devops/containers/logs?id=${id}&tail=${tail}`),
  getServices: () => request<{ success: boolean; services: any[] }>('/api/devops/services'),
  serviceAction: (service: string, action: 'start' | 'stop' | 'restart', is_user: boolean = false) => request<{ success: boolean; message: string }>('/api/devops/services/action', {
    method: 'POST',
    body: JSON.stringify({ service, action, is_user })
  }),
  getGitStatus: () => request<{ success: boolean; branch: string; modified: number; untracked: number; commits: any[]; error?: string }>('/api/devops/git'),
  cleanSystem: (target: 'all' | 'apt' | 'journal' | 'containers' = 'all') => request<{ success: boolean; details: any }>('/api/devops/clean', {
    method: 'POST',
    body: JSON.stringify({ target })
  }),

  // ── Multimedia & Audio ───────────────────────────────────────────────────
  getMediaStatus: () => request<{ status: string; title: string; artist: string; album: string; player: string; volume: number; muted: boolean }>('/api/media/player'),
  sendMediaAction: (action: string) => request<{ success: boolean; action: string }>('/api/media/action', {
    method: 'POST',
    body: JSON.stringify({ action })
  }),
  speakTts: (text: string, rate: number = 0, pitch: number = 0) => request<{ success: boolean; message: string }>('/api/media/tts', {
    method: 'POST',
    body: JSON.stringify({ text, rate, pitch })
  }),
  playSoundboard: (sound: string) => request<{ success: boolean; sound: string }>('/api/media/soundboard', {
    method: 'POST',
    body: JSON.stringify({ sound })
  }),

  // ── Security & Anti-Tamper ───────────────────────────────────────────────
  getTamperStatus: () => request<{ tampered: boolean; ac_power_online: boolean; lid_state: string; battery_level: number; battery_status: string; alert: string }>('/api/security/tamper'),
  toggleStealth: (enabled: boolean) => request<{ success: boolean; stealth: boolean; message: string }>('/api/security/stealth', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),
  triggerPanic: (options: { lock_screen?: boolean; mute_audio?: boolean; blank_screen?: boolean; minimize_windows?: boolean } = {}) => request<{ success: boolean; status: string; details: any }>('/api/security/panic', {
    method: 'POST',
    body: JSON.stringify({
      lock_screen: options.lock_screen ?? true,
      mute_audio: options.mute_audio ?? true,
      blank_screen: options.blank_screen ?? true,
      minimize_windows: options.minimize_windows ?? true
    })
  }),
  armIntruderTrap: (options?: { honeypot?: boolean; trigger_mode?: string } | boolean) => request<{ success: boolean; armed: boolean; honeypot?: boolean }>('/api/security/intruder/arm', {
    method: 'POST',
    body: JSON.stringify(typeof options === 'boolean' ? { honeypot: options } : (options || {}))
  }),
  disarmIntruderTrap: () => request<{ success: boolean; armed: boolean }>('/api/security/intruder/disarm', {
    method: 'POST'
  }),
  getIntruderStatus: () => request<{ armed: boolean; honeypot: boolean; trigger_mode?: string; armed_at?: string | null; last_triggered?: string | null; latest_photo_b64?: string; events: any[] }>('/api/security/intruder/status'),
  testTriggerIntruder: () => request<{ success: boolean; event: any }>('/api/security/intruder/trigger', {
    method: 'POST'
  }),
  getIntruderSnapshots: () => request<{ snapshots: any[]; total: number }>('/api/security/intruder/snapshots'),
  launchDecoyScreen: () => request<{ success: boolean }>('/api/security/decoy/launch', {
    method: 'POST'
  }),
  closeDecoyScreen: () => request<{ success: boolean }>('/api/security/decoy/close', {
    method: 'POST'
  }),

  // ── Productivity & AI Screen Vision ──────────────────────────────────────
  getScreenVision: (prompt?: string) => request<{ success: boolean; summary: string; explanation: string; terminal_commands: string[]; configured: boolean }>('/api/productivity/screen-vision', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  }),

  // ── Workspaces & Wake-on-LAN ─────────────────────────────────────────────
  getWorkspaces: () => request<{ current: number; total: number }>('/api/system/workspaces'),
  switchWorkspace: (workspace: number) => request<{ success: boolean; workspace: number }>('/api/system/workspaces/switch', {
    method: 'POST',
    body: JSON.stringify({ workspace })
  }),
  sendWakeOnLan: (mac_address: string, broadcast_ip?: string) => request<{ success: boolean; mac: string; message: string }>('/api/system/wol', {
    method: 'POST',
    body: JSON.stringify({ mac_address, broadcast_ip: broadcast_ip || '255.255.255.255' })
  }),

  // ── Tactical Fleet & Google Maps Radar ──────────────────────────────────
  getFleetTelemetry: () => request<{
    success: boolean;
    total: number;
    online_count: number;
    devices: Array<{
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
    }>;
    geofence: {
      enabled: boolean;
      name: string;
      center_lat: number;
      center_lng: number;
      radius_meters: number;
      breached: boolean;
    };
    server_time: number;
  }>('/api/tracking/fleet'),

  updateDeviceLocation: (data: {
    device_id: string;
    name?: string;
    model?: string;
    role?: 'laptop' | 'mobile';
    lat: number;
    lng: number;
    accuracy?: number;
    battery?: number;
    is_charging?: boolean;
    speed?: number;
    heading?: number;
  }) => request<{ success: boolean; device: any }>('/api/tracking/device/update', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  executeDeviceAction: (deviceId: string, action: string, value?: boolean) => request<{
    success: boolean;
    action: string;
    device_id: string;
    active?: boolean;
    message?: string;
  }>(`/api/tracking/device/${deviceId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, value })
  }),

  getProximityMatrix: () => request<{
    success: boolean;
    host_id: string;
    matrix: Array<{
      target_id: string;
      target_name: string;
      model: string;
      distance_meters: number;
      bearing_degrees: number;
      battery: number;
      leash_active: boolean;
      leash_radius: number;
      leash_broken: boolean;
    }>;
    broken_leashes: Array<{
      device_id: string;
      device_name: string;
      distance: number;
      limit: number;
    }>;
    nearest: any;
  }>('/api/tracking/proximity'),

  getTrackingHistory: () => request<{
    success: boolean;
    count: number;
    history: Array<{
      device_id: string;
      lat: number;
      lng: number;
      speed: number;
      timestamp: number;
    }>;
  }>('/api/tracking/history'),

  updateGeofence: (config: {
    center_lat: number;
    center_lng: number;
    radius_meters: number;
    name?: string;
    enabled: boolean;
  }) => request<{ success: boolean; geofence: any }>('/api/tracking/geofence', {
    method: 'POST',
    body: JSON.stringify(config)
  }),

  getGeofence: () => request<{ success: boolean; geofence: any }>('/api/tracking/geofence'),

  // ── AI Agent OS & Multi-Agent Fleet ──────────────────────────────────
  getAgentFleet: () => request<{
    success: boolean;
    orchestrator: string;
    fleet: Array<{
      id: string;
      name: string;
      role: string;
      avatar: string;
      color: string;
      description: string;
      status: 'ready' | 'busy' | 'offline';
      active_tasks: number;
      load_percent: number;
    }>;
  }>('/api/agents/fleet'),

  getAgentPlugins: () => request<{
    success: boolean;
    plugins: Array<{
      name: string;
      description: string;
      category: string;
      parameters: any;
      enabled: boolean;
    }>;
  }>('/api/agents/plugins'),

  toggleAgentPlugin: (name: string, enabled: boolean) => request<{ success: boolean; plugin: string; enabled: boolean }>(`/api/agents/plugins/${encodeURIComponent(name)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),

  executeAgentPlugin: (plugin: string, parameters?: Record<string, any>) => request<any>('/api/agents/execute-plugin', {
    method: 'POST',
    body: JSON.stringify({ plugin, parameters: parameters || {} })
  }),

  getLlmProviders: () => request<{
    success: boolean;
    providers: Array<{
      id: string;
      name: string;
      configured: boolean;
      key_preview?: string;
      base_url?: string;
      models: string[];
    }>;
  }>('/api/agents/providers'),

  configureLlmProvider: (provider: string, apiKey?: string, baseUrl?: string) => request<{ success: boolean; message: string }>('/api/agents/configure', {
    method: 'POST',
    body: JSON.stringify({ provider, api_key: apiKey, base_url: baseUrl })
  }),

  chatWithAgentOS: (data: {
    message: string;
    provider?: string;
    model?: string;
    target_subagent?: string;
    context?: Record<string, any>;
  }) => request<{
    success: boolean;
    goal: string;
    provider_used: string;
    model_used: string;
    duration_seconds: number;
    primary_subagent: {
      id: string;
      name: string;
      role: string;
      avatar: string;
      color: string;
      description: string;
    };
    subagents_invoked: string[];
    thought_chain: Array<{
      agent: string;
      type: 'thought' | 'tool_call' | 'tool_result';
      content?: string;
      tool?: string;
      params?: any;
      result?: any;
      timestamp: number;
    }>;
    tool_results: Array<{
      plugin: string;
      params: any;
      result: any;
    }>;
    visual_artifacts: Array<{
      type: 'image' | 'system_stats' | 'files_list' | 'siren_alert';
      title: string;
      url?: string;
      data?: any;
      items?: any[];
      active?: boolean;
    }>;
    reply: string;
  }>('/api/agents/chat', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  setLeashConfig: (active: boolean, radiusMeters: number) => request<{ success: boolean; active: boolean; radius_meters: number }>('/api/tracking/device/oppo/leash-config', {
    method: 'POST',
    body: JSON.stringify({ active, radius_meters: radiusMeters })
  }),

  getUniversalClipboard: () => request<{ success: boolean; text: string; length: number; updated_at?: number; source?: string }>('/api/clipboard'),

  setUniversalClipboard: (text: string) => request<{ success: boolean; length: number; updated_at?: number; source?: string; message?: string }>('/api/clipboard', {
    method: 'POST',
    body: JSON.stringify({ text })
  }),

  // ── Tab Handoff & Continuity ─────────────────────────────────────────────
  handoffTab: (url: string) => request<{ success: boolean; url: string; message: string }>('/api/productivity/handoff', {
    method: 'POST',
    body: JSON.stringify({ url })
  }),

  // ── Hardware Thermals & Power Profiles ───────────────────────────────────
  getThermals: () => request<{ cpu_temp_c: number; status: string; governor: string; fan_mode: string }>('/api/system/thermals'),

  setPowerProfile: (profile: 'powersave' | 'balanced' | 'performance') => request<{ success: boolean; profile: string }>('/api/system/power-profile', {
    method: 'POST',
    body: JSON.stringify({ profile })
  }),

  // ── Network Scanner & Connected Devices ──────────────────────────────────
  scanNetworkDevices: () => request<{ success: boolean; devices: Array<{ ip: string; mac: string; status: string; type: string }>; total: number }>('/api/system/network/devices'),

  // ── Presentation & Virtual Game Controller ───────────────────────────────
  sendPresentationCommand: (command: 'next' | 'prev' | 'blank' | 'start' | 'escape') => request<{ success: boolean; command: string }>('/api/remote/presentation', {
    method: 'POST',
    body: JSON.stringify({ command })
  }),

  sendGamepadEvent: (action: 'btn_press' | 'btn_down' | 'btn_up', button?: string) => request<{ success: boolean; button?: string }>('/api/remote/gamepad', {
    method: 'POST',
    body: JSON.stringify({ action, button })
  }),

  // ── Mobile Phone CCTV Frame Upload ──────────────────────────────────────
  postPhoneCameraFrame: async (jpegBlob: Blob): Promise<{ success: boolean }> => {
    const res = await fetch('/api/camera/phone/frame', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: jpegBlob
    });
    return res.json();
  },

  // ── 20 New Tactical Pro Features (1-20) ──────────────────────────────────
  getCctvGridStatus: () => request<{
    feeds: Array<{ id: string; title: string; stream_url?: string; type: string; active: boolean; has_snapshot?: boolean; latest_photo_b64?: string; last_triggered?: string }>;
    thermal_mode: boolean;
    osd_enabled: boolean;
    acoustic_tripwire_armed: boolean;
  }>('/api/camera/grid-status'),

  toggleThermalMode: (enabled: boolean) => request<{ success: boolean; thermal_mode: boolean }>('/api/camera/thermal-mode', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),

  toggleOsdWatermark: (enabled: boolean) => request<{ success: boolean; osd_enabled: boolean }>('/api/camera/osd', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),

  getFacePresence: (source: 'laptop' | 'phone' | 'mobile' = 'laptop') => request<{
    detected: boolean;
    count: number;
    faces: Array<{ x: number; y: number; w: number; h: number; confidence?: number; authorized: boolean }>;
    status: string;
    timestamp: number;
  }>(`/api/camera/face-presence?source=${source === 'mobile' ? 'phone' : source}`),

  getAcousticStatus: () => request<{
    rms: number;
    db: number;
    threshold: number;
    spike: boolean;
    armed: boolean;
    timestamp: number;
  }>('/api/camera/acoustic/status'),

  setAcousticTripwire: (armed: boolean, thresholdDb: number) => request<{ success: boolean; armed: boolean; threshold_db: number }>('/api/camera/acoustic/tripwire', {
    method: 'POST',
    body: JSON.stringify({ armed, threshold_db: thresholdDb })
  }),

  sendGyroPointer: (dx: number, dy: number, click?: 'left' | 'right' | 'down' | 'up') => request<{ success: boolean }>('/api/remote/gyro-pointer', {
    method: 'POST',
    body: JSON.stringify({ dx, dy, click })
  }),

  sendGesture: (gesture: string, deltaX: number = 0, deltaY: number = 0, scale: number = 1) => request<{ success: boolean; gesture: string }>('/api/remote/gestures', {
    method: 'POST',
    body: JSON.stringify({ gesture, delta_x: deltaX, delta_y: deltaY, scale })
  }),

  typeScannedBarcode: (text: string, pressEnter: boolean = true) => request<{ success: boolean; typed?: string; error?: string }>('/api/remote/type-scanned', {
    method: 'POST',
    body: JSON.stringify({ text, press_enter: pressEnter })
  }),

  sendVolumeShortcut: (key: 'volume_up' | 'volume_down', action?: string) => request<{ success: boolean; action?: string; message?: string }>('/api/remote/volume-shortcut', {
    method: 'POST',
    body: JSON.stringify({ key, action })
  }),

  getBiometricChallenge: () => request<{ success: boolean; challenge: string; rp_name: string; user: any }>('/api/auth/biometric-challenge'),

  biometricUnlock: (token?: string, credentialId?: string) => request<{ success: boolean; unlocked: boolean; message: string }>('/api/auth/biometric-unlock', {
    method: 'POST',
    body: JSON.stringify({ token, credential_id: credentialId })
  }),

  setProximityLeash: (enabled: boolean, distanceMeters: number, autoLock: boolean, autoWake: boolean) => request<{ success: boolean; config: any }>('/api/tracking/proximity-leash', {
    method: 'POST',
    body: JSON.stringify({ enabled, distance_threshold_meters: distanceMeters, auto_lock: autoLock, auto_wake: autoWake })
  }),

  getProximityStatus: () => request<{
    success: boolean;
    enabled: boolean;
    distance_meters: number;
    threshold_meters: number;
    in_range: boolean;
    locked: boolean;
    status: string;
  }>('/api/tracking/proximity-status'),

  listMacros: () => request<{ success: boolean; macros: Array<{ id: string; title: string; subtitle: string; icon: string; category: string }> }>('/api/system/macros'),

  executeMacro: (macroId: string) => request<{ success: boolean; macro_id: string; output: string }>('/api/system/macro-execute', {
    method: 'POST',
    body: JSON.stringify({ macro_id: macroId })
  }),

  processInMemoryOcr: (imageB64: string, copyToClipboard: boolean = true, typeToCursor: boolean = false) => request<{
    success: boolean;
    text: string;
    word_count: number;
    copied_to_clipboard: boolean;
    typed_to_cursor: boolean;
  }>('/api/productivity/in-memory-ocr', {
    method: 'POST',
    body: JSON.stringify({ image: imageB64, copy_to_clipboard: copyToClipboard, type_to_cursor: typeToCursor })
  }),

  listPeardropLaptopFiles: () => request<{
    success: boolean;
    files: Array<{ name: string; path: string; folder: string; size: number; modified: number; extension: string }>;
    total: number;
  }>('/api/sync/peardrop/laptop-files'),

  fixTerminalError: (command: string, errorOutput: string, exitCode: number = 1) => request<{
    success: boolean;
    explanation: string;
    suggested_command: string;
    original_command: string;
    auto_executable: boolean;
  }>('/api/agents/fix-terminal-error', {
    method: 'POST',
    body: JSON.stringify({ command, error_output: errorOutput, exit_code: exitCode })
  }),

  speechToCommand: (speechText: string) => request<{
    success: boolean;
    command: string;
    explanation: string;
    speech: string;
  }>('/api/agents/speech-to-command', {
    method: 'POST',
    body: JSON.stringify({ speech_text: speechText })
  }),

  getHealthDoctor: () => request<{
    success: boolean;
    score: number;
    grade: string;
    cpu_percent: number;
    ram_percent: number;
    ram_used_gb: number;
    ram_total_gb: number;
    swap_percent: number;
    swap_used_mb: number;
    zombie_count: number;
    zombies: Array<{ pid: number; name: string }>;
    top_processes: Array<{ pid: number; name: string; mem_percent: number; cpu_percent: number }>;
    optimizations_available: string[];
  }>('/api/system/health-doctor'),

  optimizeHealthDoctor: () => request<{
    success: boolean;
    ram_reclaimed_mb: number;
    optimizations_applied: string[];
    new_score: number;
  }>('/api/system/health-doctor/optimize', {
    method: 'POST'
  }),

  verifyDecoyPin: (pin: string) => request<{
    success: boolean;
    is_decoy: boolean;
    alert: string;
    event?: any;
  }>('/api/security/decoy-pin-verify', {
    method: 'POST',
    body: JSON.stringify({ pin })
  }),

  getDecoyStatus: () => request<{
    decoy_active: boolean;
    last_triggered?: string;
  }>('/api/security/decoy-status'),

  getLatestIntruderRam: () => request<{
    success: boolean;
    has_photo: boolean;
    latest_photo_b64?: string;
    last_triggered?: string;
    armed: boolean;
  }>('/api/security/intruder/latest-ram'),

  // --- Features 1-50 Expansion ---
  getDynamicIslandStatus: () => request<{
    success: boolean;
    mode: string;
    cpu_percent: number;
    memory_percent: number;
    battery_percent: number;
    power_plugged: boolean;
    media: { title: string; artist: string; playing: boolean; progress_pct: number };
    alert?: { type: string; text: string };
  }>('/api/system/dynamic-island-status'),

  getTouchbarItems: () => request<{
    success: boolean;
    active_app: string;
    items: Array<{ id: string; label: string; action: string; color: string }>;
  }>('/api/remote/touchbar'),

  executeTouchbarAction: (action: string) => request<{ success: boolean; action: string }>('/api/remote/touchbar/execute', {
    method: 'POST',
    body: JSON.stringify({ action })
  }),

  getClipboardHistory: () => request<{
    success: boolean;
    history: Array<{ id: string; text: string; timestamp: number; source: string }>;
  }>('/api/productivity/clipboard-history'),

  pushClipboardHistory: (text: string, source: string = 'mobile') => request<{ success: boolean; count: number }>('/api/productivity/clipboard-history/push', {
    method: 'POST',
    body: JSON.stringify({ text, source })
  }),

  selectClipboardHistory: (slotId: string, pasteToCursor: boolean = true) => request<{ success: boolean; text: string }>('/api/productivity/clipboard-history/select', {
    method: 'POST',
    body: JSON.stringify({ slot_id: slotId, paste_to_cursor: pasteToCursor })
  }),

  sendTabletStroke: (x: number, y: number, pressure: number = 1.0, isDown: boolean = false, isUp: boolean = false) => request<{ success: boolean; x: number; y: number }>('/api/remote/tablet-stroke', {
    method: 'POST',
    body: JSON.stringify({ x, y, pressure, is_down: isDown, is_up: isUp })
  }),

  getTripwireStatus: () => request<{
    success: boolean;
    tripwire: { armed: boolean; x1: number; y1: number; x2: number; y2: number; triggered: boolean };
  }>('/api/camera/tripwire-status'),

  configureTripwire: (armed: boolean, x1: number = 0.1, y1: number = 0.5, x2: number = 0.9, y2: number = 0.5) => request<{
    success: boolean;
    tripwire: any;
  }>('/api/camera/tripwire-config', {
    method: 'POST',
    body: JSON.stringify({ armed, x1, y1, x2, y2 })
  }),

  emitUltrasonicBeacon: (frequencyHz: number = 19500, durationMs: number = 300) => request<{ success: boolean; inaudible: boolean }>('/api/camera/ultrasonic-beacon', {
    method: 'POST',
    body: JSON.stringify({ frequency_hz: frequencyHz, duration_ms: durationMs })
  }),

  getShoulderSurferStatus: () => request<{
    success: boolean;
    alert: boolean;
    face_count: number;
    action: string;
  }>('/api/camera/shoulder-surfer-status'),

  toggleKernelPanicDecoy: (enabled: boolean) => request<{ success: boolean; kernel_panic_active: boolean }>('/api/security/kernel-panic-decoy', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),

  emergencySilentWipe: () => request<{ success: boolean; message: string }>('/api/security/silent-wipe', {
    method: 'POST'
  }),

  meetingTranscribe: (transcriptText?: string) => request<{
    success: boolean;
    summary: string;
    action_items: string[];
  }>('/api/agents/meeting-transcribe', {
    method: 'POST',
    body: JSON.stringify({ transcript_text: transcriptText })
  }),

  explainVision: (imageBase64: string, query?: string) => request<{
    success: boolean;
    explanation: string;
    key_points: string[];
  }>('/api/agents/explain-vision', {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64, query })
  }),

  terminalAutocomplete: (recentCommands: string[]) => request<{
    success: boolean;
    suggestions: string[];
    context: string;
  }>('/api/agents/terminal-autocomplete', {
    method: 'POST',
    body: JSON.stringify({ recent_commands: recentCommands })
  }),

  aiFileRename: (originalName: string) => request<{
    success: boolean;
    original_name: string;
    suggested_name: string;
    confidence: number;
  }>('/api/agents/ai-rename', {
    method: 'POST',
    body: JSON.stringify({ original_name: originalName })
  }),

  summarizeUrl: (url: string) => request<{
    success: boolean;
    url: string;
    title: string;
    summary: string;
    takeaways: string[];
  }>('/api/agents/summarize-url', {
    method: 'POST',
    body: JSON.stringify({ url })
  }),

  sendProGamepadEvent: (evt: { button?: string; is_pressed?: boolean; lx?: number; ly?: number; rx?: number; ry?: number; gyro_x?: number; gyro_y?: number }) => request<{ success: boolean }>('/api/remote/gamepad-event', {
    method: 'POST',
    body: JSON.stringify(evt)
  }),

  getMovementTamperStatus: () => request<{
    success: boolean;
    tamper_state: { armed: boolean; alarm_sounding: boolean; sensitivity: string };
  }>('/api/security/tamper-status'),

  getSyncAudioInfo: () => request<{
    success: boolean;
    server_time_ms: number;
    ntp_drift_tolerance_ms: number;
    stream_endpoint: string;
    format: string;
  }>('/api/camera/sync-audio-info'),

  getMediaLyrics: () => request<{
    success: boolean;
    title: string;
    artist: string;
    album: string;
    current_sec: number;
    duration_sec: number;
    lyrics: Array<{ sec: number; text: string }>;
    visualizer_bars: number[];
  }>('/api/system/media-lyrics'),

  sendAirVolume: (deltaRoll: number) => request<{ success: boolean; action: string }>('/api/remote/air-volume', {
    method: 'POST',
    body: JSON.stringify({ delta_roll: deltaRoll })
  }),

  getBatteryGuardian: () => request<{
    success: boolean;
    percentage: number;
    is_charging: boolean;
    health_score: number;
    cycle_count: number;
    temperature_c: number;
    charge_limit_percent: number;
    guardian_active: boolean;
    recommendation: string;
  }>('/api/system/battery-guardian'),

  setBatteryChargeLimit: (limitPercent: number) => request<{ success: boolean; limit_percent: number }>('/api/system/battery-guardian/limit', {
    method: 'POST',
    body: JSON.stringify({ limit_percent: limitPercent })
  }),

  managePowerState: (action: string) => request<{ success: boolean; action: string; message: string }>('/api/system/power-state', {
    method: 'POST',
    body: JSON.stringify({ action })
  }),

  getInteractiveProcesses: () => request<{
    success: boolean;
    processes: Array<{ pid: number; name: string; user: string; cpu_percent: number; memory_mb: number; status: string }>;
  }>('/api/system/processes-interactive'),

  sendProcessSignal: (pid: number, signal: string) => request<{ success: boolean; pid: number; signal: string }>('/api/system/process-signal', {
    method: 'POST',
    body: JSON.stringify({ pid, signal })
  }),

  getNetworkFirewall: () => request<{
    success: boolean;
    connections: Array<{ proto: string; state: string; local: string; remote: string; process: string }>;
    count: number;
  }>('/api/system/network-firewall'),

  runSpeedtest: () => request<{
    success: boolean;
    latency_ms: number;
    download_mbps: number;
    upload_mbps: number;
    channel: string;
  }>('/api/system/speedtest'),

  setPhoneTorchMode: (enabled: boolean, brightness: number = 1.0, strobe: boolean = false) => request<{
    success: boolean;
    torch_active: boolean;
    brightness: number;
    strobe: boolean;
  }>('/api/camera/phone/torch-mode', {
    method: 'POST',
    body: JSON.stringify({ enabled, brightness, strobe })
  }),

  computePpgHeartrate: (greenIntensity: number = 128.0, samples?: number[]) => request<{
    success: boolean;
    bpm: number;
    hrv_ms: number;
    status: string;
    timestamp: number;
  }>('/api/camera/ppg-heartrate', {
    method: 'POST',
    body: JSON.stringify({ green_intensity: greenIntensity, samples })
  }),

  pollHapticEvents: () => request<{
    success: boolean;
    events: Array<{ id: string; type: string; pattern: string; timestamp: number }>;
  }>('/api/system/haptic-events'),

  sendEdgeCrossing: (edge: string) => request<{ success: boolean; state: any }>('/api/remote/edge-crossing', {
    method: 'POST',
    body: JSON.stringify({ edge })
  }),

  syncTrueTone: (lux: number, colorTempKelvin: number = 5500) => request<{
    success: boolean;
    state: { enabled: boolean; lux: number; color_temp_kelvin: number; calibrated_gamma: number };
  }>('/api/system/truetone-sync', {
    method: 'POST',
    body: JSON.stringify({ lux, color_temp_kelvin: colorTempKelvin })
  }),

  configureTamperAlarm: (armed: boolean, sensitivity: string = 'medium') => request<{
    success: boolean;
    tamper_state: { armed: boolean; alarm_sounding: boolean; sensitivity: string };
  }>('/api/security/tamper-alarm', {
    method: 'POST',
    body: JSON.stringify({ armed, sensitivity })
  }),

  toggleDecoyDesktop: (enabled: boolean) => request<{ success: boolean; decoy_desktop_active: boolean }>('/api/security/decoy-desktop', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),

  getAcousticSpectrum: () => request<{
    success: boolean;
    bands: Array<{ freq: string; db: number }>;
    rf_detected: boolean;
    highest_freq_spike: string;
  }>('/api/camera/acoustic-spectrum'),

  triggerFlipLock: () => request<{ success: boolean; locked: boolean; muted: boolean }>('/api/remote/flip-lock', {
    method: 'POST'
  }),

  configureClipboardHoneypot: (armed: boolean) => request<{
    success: boolean;
    honeypot: { armed: boolean; canary_token: string; unauthorized_reads_detected: number };
  }>('/api/security/clipboard-honeypot', {
    method: 'POST',
    body: JSON.stringify({ armed })
  }),

  getGitCommitAutopilot: () => request<{
    success: boolean;
    git_stat: string;
    suggested_message: string;
    commit_ready: boolean;
  }>('/api/agents/git-commit-autopilot'),

  executeGitCommit: (message: string) => request<{ success: boolean; output: string }>('/api/agents/git-commit-autopilot/commit', {
    method: 'POST',
    body: JSON.stringify({ message })
  }),

  executeCodeRepl: (language: string, code: string) => request<{
    success: boolean;
    stdout: string;
    stderr: string;
    exit_code: number;
    language: string;
  }>('/api/agents/code-repl', {
    method: 'POST',
    body: JSON.stringify({ language, code })
  }),

  generateQuery: (prompt: string, targetType: string = 'regex') => request<{
    success: boolean;
    target_type: string;
    generated_code: string;
    explanation: string;
    prompt: string;
  }>('/api/agents/generate-query', {
    method: 'POST',
    body: JSON.stringify({ prompt, target_type: targetType })
  }),

  ocrAndTranslateLens: (imageBase64: string, targetLang: string = 'en') => request<{
    success: boolean;
    original_text: string;
    translated_text: string;
    target_lang: string;
  }>('/api/productivity/ocr-translate', {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64, target_lang: targetLang })
  }),

  getLogStreamAnalysis: () => request<{
    success: boolean;
    logs: Array<{ level: string; text: string }>;
    anomaly_score: number;
    assessment: string;
  }>('/api/system/log-stream-analysis'),

  getDeviceRadar: () => request<{
    success: boolean;
    radar_active: boolean;
    device_count: number;
    devices: Array<{ id: string; name: string; type: string; ip: string; status: string; signal: string; distance_m: number; avatar: string }>;
  }>('/api/sync/device-radar'),

  insertSignature: (imageBase64: string) => request<{ success: boolean; message: string }>('/api/productivity/insert-signature', {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64 })
  }),

  getTeleprompter: () => request<{
    success: boolean;
    state: { script: string; scroll_speed: number; font_size: number; active: boolean };
  }>('/api/productivity/teleprompter'),

  updateTeleprompter: (state: { script?: string; scroll_speed?: number; font_size?: number; active?: boolean }) => request<{
    success: boolean;
    state: any;
  }>('/api/productivity/teleprompter', {
    method: 'POST',
    body: JSON.stringify(state)
  }),

  getQuickNotes: () => request<{
    success: boolean;
    notes: Array<{ id: string; title: string; content: string; color: string; pinned: boolean; updated_at: number }>;
  }>('/api/productivity/quick-notes'),

  saveQuickNote: (title: string, content: string, color?: string, pinned?: boolean) => request<{
    success: boolean;
    note: any;
  }>('/api/productivity/quick-notes', {
    method: 'POST',
    body: JSON.stringify({ title, content, color, pinned })
  }),

  deleteQuickNote: (noteId: string) => request<{ success: boolean; deleted_id: string }>(`/api/productivity/quick-notes/${noteId}`, {
    method: 'DELETE'
  }),

  syncMediaPlayback: (url: string, timestampSec?: number, title?: string) => request<{
    success: boolean;
    synced: any;
  }>('/api/productivity/media-sync', {
    method: 'POST',
    body: JSON.stringify({ url, timestamp_sec: timestampSec, title })
  }),

  getAudioEqualizer: () => request<{
    success: boolean;
    bands: Record<string, number>;
    preset: string;
  }>('/api/system/audio-equalizer'),

  setAudioEqualizer: (bands: Record<string, number>) => request<{ success: boolean; bands: Record<string, number> }>('/api/system/audio-equalizer', {
    method: 'POST',
    body: JSON.stringify({ bands })
  }),

  toggleWhiteNoise: (active: boolean, sound: string = 'rain', timerMin: number = 30) => request<{
    success: boolean;
    state: { active: boolean; sound: string; timer_min: number };
  }>('/api/system/white-noise', {
    method: 'POST',
    body: JSON.stringify({ active, sound, timer_min: timerMin })
  }),

  scrubMedia: (action: string) => request<{ success: boolean; action: string }>('/api/system/media-scrub', {
    method: 'POST',
    body: JSON.stringify({ action })
  }),

  getBluetoothDevices: () => request<{
    success: boolean;
    bluetooth_enabled: boolean;
    devices: Array<{ id: string; name: string; type: string; connected: boolean; battery: number }>;
  }>('/api/system/bluetooth-devices'),

  toggleBluetoothDevice: (deviceId: string, connect: boolean) => request<{ success: boolean; device_id: string; connected: boolean }>('/api/system/bluetooth-connect', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, connect })
  }),

  getWidgetDashboard: () => request<{
    success: boolean;
    config: { widgets: Array<{ id: string; type: string; col_span: number; visible: boolean }> };
  }>('/api/system/widget-dashboard'),

  updateWidgetDashboard: (widgets: Array<{ id: string; type: string; col_span: number; visible: boolean }>) => request<{
    success: boolean;
    config: any;
  }>('/api/system/widget-dashboard', {
    method: 'POST',
    body: JSON.stringify({ widgets })
  })
};


