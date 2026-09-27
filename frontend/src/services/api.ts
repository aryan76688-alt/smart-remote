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
    const res = await fetch('/api/files/bulk-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) throw new Error('Bulk download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_remote_files_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
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
  sendPhoneCameraFrame: (image: string) => request<{ success: boolean }>('/api/camera/phone/frame', {
    method: 'POST',
    body: JSON.stringify({ image })
  }),
  stopPhoneCamera: () => request<{ success: boolean }>('/api/camera/phone/stop', {
    method: 'POST'
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
};

