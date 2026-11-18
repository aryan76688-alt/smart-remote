const BASE_URL = window.location.origin;

export const api = {
  // System Telemetry & Status
  async getDynamicIslandStatus() {
    const res = await fetch(`${BASE_URL}/api/system/dynamic-island-status`);
    return res.json();
  },

  async getTelemetry() {
    const res = await fetch(`${BASE_URL}/api/system/telemetry`);
    return res.json();
  },

  async setVolume(level: number) {
    const res = await fetch(`${BASE_URL}/api/system/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level })
    });
    return res.json();
  },

  async setBrightness(level: number) {
    const res = await fetch(`${BASE_URL}/api/system/brightness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level })
    });
    return res.json();
  },

  async getProcesses() {
    const res = await fetch(`${BASE_URL}/api/system/processes`);
    return res.json();
  },

  async sendProcessSignal(pid: number, signal: 'STOP' | 'CONT' | 'KILL') {
    const res = await fetch(`${BASE_URL}/api/system/process-signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, signal })
    });
    return res.json();
  },

  async getClipboardHistory() {
    const res = await fetch(`${BASE_URL}/api/system/clipboard-history`);
    return res.json();
  },

  async pushClipboard(text: string) {
    const res = await fetch(`${BASE_URL}/api/system/clipboard-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return res.json();
  },

  async clearRam() {
    const res = await fetch(`${BASE_URL}/api/system/clear-ram`, { method: 'POST' });
    return res.json();
  },

  async lockScreen() {
    const res = await fetch(`${BASE_URL}/api/system/lock-screen`, { method: 'POST' });
    return res.json();
  },

  async runSpeedtest() {
    const res = await fetch(`${BASE_URL}/api/system/speedtest`);
    return res.json();
  },

  // Remote Input
  async moveCursor(dx: number, dy: number) {
    const res = await fetch(`${BASE_URL}/api/remote/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dx, dy })
    });
    return res.json();
  },

  async clickMouse(button: number = 1, double: boolean = false) {
    const res = await fetch(`${BASE_URL}/api/remote/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ button, double })
    });
    return res.json();
  },

  async scrollMouse(dy: number) {
    const res = await fetch(`${BASE_URL}/api/remote/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dy })
    });
    return res.json();
  },

  async typeText(text: string) {
    const res = await fetch(`${BASE_URL}/api/remote/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return res.json();
  },

  async sendShortcut(shortcut: string) {
    const res = await fetch(`${BASE_URL}/api/remote/shortcut`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcut })
    });
    return res.json();
  },

  async sendGyro(alpha: number, beta: number, gamma: number) {
    const res = await fetch(`${BASE_URL}/api/remote/gyro-pointer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alpha, beta, gamma })
    });
    return res.json();
  },

  async getTouchbar() {
    const res = await fetch(`${BASE_URL}/api/remote/touchbar`);
    return res.json();
  },

  async executeTouchbar(action: string) {
    const res = await fetch(`${BASE_URL}/api/remote/touchbar/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcut: action })
    });
    return res.json();
  },

  // CCTV & 30-Minute Recorder
  async getCctvStatus() {
    const res = await fetch(`${BASE_URL}/api/cctv/status`);
    return res.json();
  },

  async toggleLaptopCctv(active: boolean) {
    const res = await fetch(`${BASE_URL}/api/cctv/laptop/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    return res.json();
  },

  async toggleMobileCctv(active: boolean) {
    const res = await fetch(`${BASE_URL}/api/cctv/mobile/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    return res.json();
  },

  async toggleThermal(enabled: boolean) {
    const res = await fetch(`${BASE_URL}/api/cctv/thermal-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    return res.json();
  },

  async configureTripwire(enabled: boolean, line_y: number = 0.5) {
    const res = await fetch(`${BASE_URL}/api/cctv/tripwire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, line_y })
    });
    return res.json();
  },

  async startRecording(source: 'laptop' | 'mobile', duration_minutes: number = 30, continuous_loop: boolean = false) {
    const res = await fetch(`${BASE_URL}/api/cctv/record/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, duration_minutes, continuous_loop })
    });
    return res.json();
  },

  async stopRecording() {
    const res = await fetch(`${BASE_URL}/api/cctv/record/stop`, { method: 'POST' });
    return res.json();
  },

  async listRecordings() {
    const res = await fetch(`${BASE_URL}/api/cctv/recordings`);
    return res.json();
  },

  async deleteRecording(filename: string) {
    const res = await fetch(`${BASE_URL}/api/cctv/recordings/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Maps & Companion Phone
  async getDeviceLocation() {
    const res = await fetch(`${BASE_URL}/api/maps/location`);
    return res.json();
  },

  async updateLocation(coords: { latitude: number; longitude: number; accuracy?: number; altitude?: number; speed?: number; heading?: number }) {
    const res = await fetch(`${BASE_URL}/api/maps/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coords)
    });
    return res.json();
  },

  async controlPhone(payload: { siren?: boolean; strobe?: boolean; camera?: boolean }) {
    const res = await fetch(`${BASE_URL}/api/phone/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async getPhoneStatus() {
    const res = await fetch(`${BASE_URL}/api/phone/status`);
    return res.json();
  },

  // Multi-Agent AI
  async predictTerminal(command_history: string) {
    const res = await fetch(`${BASE_URL}/api/ai/terminal-pilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command_history })
    });
    return res.json();
  },

  async runCodeRepl(language: string, code: string) {
    const res = await fetch(`${BASE_URL}/api/ai/code-repl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code })
    });
    return res.json();
  },

  async transcribeMeeting(audio_text: string) {
    const res = await fetch(`${BASE_URL}/api/ai/meeting-transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_text })
    });
    return res.json();
  },

  async explainVision(query?: string) {
    const res = await fetch(`${BASE_URL}/api/ai/vision-explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  },

  // Files & pearDrop
  async listFiles(path?: string) {
    const url = path ? `${BASE_URL}/api/files/list?path=${encodeURIComponent(path)}` : `${BASE_URL}/api/files/list`;
    const res = await fetch(url);
    return res.json();
  }
};
