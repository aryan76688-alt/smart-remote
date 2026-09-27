export type DeviceLayoutMode = 'mobile' | 'desktop' | 'tablet';

export interface SystemStats {
  cpu_percent: number;
  cpu_cores: number;
  cpu_freq_mhz?: number;
  cpu_per_core: number[];
  memory_total_bytes: number;
  memory_used_bytes: number;
  memory_free_bytes: number;
  memory_cached_bytes: number;
  memory_percent: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
  swap_percent: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_free_bytes: number;
  disk_percent: number;
  net_bytes_sent: number;
  net_bytes_recv: number;
  net_rate_tx_kbps: number;
  net_rate_rx_kbps: number;
  uptime_seconds: number;
  temperature_celsius?: number;
  battery_percent?: number;
  battery_plugged?: boolean;
}

export interface SystemInfo {
  hostname: string;
  username: string;
  os_name: string;
  os_release: string;
  kernel_version: string;
  architecture: string;
  tailscale_ip: string;
  local_ip: string;
  uptime_human: string;
  server_time: string;
  allowed_file_root: string;
  tunnel_url?: string;
  tunnel_status?: string;
}

export interface TunnelProviderOption {
  id: string;
  name: string;
  description: string;
}

export interface TunnelStatus {
  status: 'stopped' | 'starting' | 'active' | 'error';
  provider: string;
  active_provider: string;
  public_url: string | null;
  qr_code_svg: string | null;
  error_message: string | null;
  uptime_seconds: number;
  target_port: number;
  cloudflare_available: boolean;
  available_providers: TunnelProviderOption[];
  logs: string[];
}

export interface ProcessItem {
  pid: number;
  name: string;
  username: string;
  cpu_percent: number;
  memory_percent: number;
  status: string;
  create_time: string;
}

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  modified_time: string;
  permissions: string;
  mime_type?: string;
  extension: string;
}

export interface FileListResponse {
  current_path: string;
  parent_path: string | null;
  allowed_root: string;
  items: FileItem[];
}

export interface FileReadResponse {
  path: string;
  name: string;
  size_bytes: number;
  content?: string;
  is_text: boolean;
  mime_type: string;
}

export interface DeviceItem {
  id: number;
  name: string;
  hostname: string;
  ip_address: string;
  tailscale_ip: string;
  os_info: string;
  kernel: string;
  is_favorite: boolean;
  last_seen: string;
}

export interface ActivityItem {
  id: number;
  timestamp: string;
  action_type: string;
  description: string;
  result: string;
  device_id: string;
}

export interface ShortcutItem {
  id?: number;
  name: string;
  icon: string;
  command?: string;
  sequence?: string;
  confirmation_required: boolean;
  category: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggested_command?: string;
  is_destructive?: boolean;
  requires_confirmation?: boolean;
  action_type?: string;
  navigation_route?: string;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
}
