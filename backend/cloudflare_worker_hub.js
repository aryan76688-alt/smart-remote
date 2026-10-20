// Cloudflare Worker: Smart Remote Autonomous Edge Hub & Proxy Gateway
// Handles full proxying when Laptop is ON, and Autonomous Edge Control when Laptop is OFF!

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const TARGET_BASE = "__TARGET_BASE__";
const CUSTOM_DOMAIN = "https://remote.shreeji7.com";

async function handleRequest(request) {
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
    });
  }

  // 1. Try forwarding to the active laptop tunnel if configured
  if (TARGET_BASE && TARGET_BASE.startsWith('http') && !TARGET_BASE.includes('__TARGET')) {
    try {
      const targetUrl = new URL(url.pathname + url.search, TARGET_BASE);
      const headers = new Headers(request.headers);
      headers.set('host', new URL(TARGET_BASE).host);
      headers.set('x-forwarded-host', url.host);
      headers.set('x-forwarded-proto', 'https');

      // WebSocket pass-through
      if (request.headers.get('Upgrade') === 'websocket') {
        return fetch(targetUrl.toString(), { headers, body: request.body });
      }

      // Clone body if needed for caching
      let reqBody = undefined;
      let bodyText = "";
      if (!['GET', 'HEAD'].includes(request.method)) {
        bodyText = await request.text();
        reqBody = bodyText;
      }

      // Fast probe with 2.8s timeout so users aren't left hanging if laptop is off
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2800);

      const res = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: reqBody,
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // If upstream is healthy, cache phone updates to KV in background so Edge is always fresh
      if (res.status < 500) {
        if (url.pathname.includes('/api/tracking/device/update') && bodyText) {
          try {
            await HUB_KV.put('oppo_telemetry', bodyText);
            await HUB_KV.put('oppo_last_seen', Date.now().toString());
          } catch (_) {}
        }
        const newHeaders = new Headers(res.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, { status: res.status, headers: newHeaders });
      }
    } catch (proxyErr) {
      // Laptop is OFFLINE! Fall through to Autonomous Edge Hub!
    }
  }

  // 2. AUTONOMOUS CLOUD EDGE HUB (When Laptop is OFF)
  return handleAutonomousEdge(request, url);
}

async function handleAutonomousEdge(request, url) {
  const path = url.pathname;

  // Headers helper
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };

  // --- API: Device Telemetry Update from Phone ---
  if (path === '/api/tracking/device/update' && request.method === 'POST') {
    try {
      const data = await request.json();
      data.updated_at = new Date().toISOString();
      data.server_timestamp = Date.now();
      await HUB_KV.put('oppo_telemetry', JSON.stringify(data));
      await HUB_KV.put('oppo_last_seen', Date.now().toString());

      // Get pending actions to return to phone
      let actions = {};
      const actionsRaw = await HUB_KV.get('oppo_actions');
      if (actionsRaw) {
        actions = JSON.parse(actionsRaw);
      }

      return new Response(JSON.stringify({
        status: 'ok',
        hub: 'cloudflare_edge_autonomous',
        message: 'Telemetry stored on Cloudflare Edge',
        actions: actions
      }), { headers: jsonHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: jsonHeaders });
    }
  }

  // --- API: Fleet Telemetry (for Web UI) ---
  if (path === '/api/tracking/fleet') {
    let oppo = {
      device_id: 'oppo',
      name: 'Oppo Mobile Phone (Cloud Edge)',
      model: 'CPH2607 / Android',
      role: 'mobile',
      status: 'offline',
      battery: 0,
      is_charging: false,
      lat: 23.168191,
      lng: 72.822328,
      accuracy: 10.0,
      speed: 0.0,
      heading: 0.0,
      last_seen: null
    };

    try {
      const raw = await HUB_KV.get('oppo_telemetry');
      if (raw) {
        const parsed = JSON.parse(raw);
        oppo = { ...oppo, ...parsed };
        const lastSeen = parseInt(await HUB_KV.get('oppo_last_seen') || '0');
        const isOnline = (Date.now() - lastSeen) < 15000; // seen within 15s
        oppo.status = isOnline ? 'online' : 'away';
        oppo.last_seen_seconds_ago = Math.round((Date.now() - lastSeen) / 1000);
      }
    } catch (_) {}

    const payload = {
      laptop: {
        device_id: 'kali-laptop',
        name: 'Kali Linux Laptop',
        status: 'offline',
        note: 'Laptop is powered off. Edge Guard Hub active.',
        last_seen: 'Laptop Offline'
      },
      oppo: oppo,
      edge_hub: {
        status: 'active',
        provider: 'Cloudflare Workers Edge & KV',
        url: url.origin
      }
    };
    return new Response(JSON.stringify(payload), { headers: jsonHeaders });
  }

  // --- API: Remote Phone Control (Trigger Siren, Torch, Locate, Camera) ---
  if (path === '/api/phone/control' || path === '/api/camera/phone/control' || path === '/api/remote/screen/mobile/control') {
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        let actions = {};
        const existing = await HUB_KV.get('oppo_actions');
        if (existing) actions = JSON.parse(existing);

        // Merge requested commands
        if (body.action === 'siren' || body.siren !== undefined) {
          actions.siren = body.siren !== undefined ? Boolean(body.siren) : !actions.siren;
        }
        if (body.action === 'strobe' || body.action === 'toggle_torch' || body.strobe !== undefined) {
          actions.strobe = body.strobe !== undefined ? Boolean(body.strobe) : !actions.strobe;
        }
        if (body.action === 'start_camera' || body.action === 'camera_snapshot') {
          actions.camera = true;
          actions.camera_req_time = Date.now();
        }
        if (body.action === 'stop_camera') {
          actions.camera = false;
        }
        if (body.action === 'locate' || body.locate !== undefined) {
          actions.locate = true;
          actions.locate_req_time = Date.now();
        }
        if (body.action === 'flip_camera') {
          actions.flip_camera = true;
          actions.flip_time = Date.now();
        }

        await HUB_KV.put('oppo_actions', JSON.stringify(actions));

        return new Response(JSON.stringify({
          success: true,
          message: 'Command queued in Cloudflare Edge Hub for Oppo Phone',
          actions: actions
        }), { headers: jsonHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: jsonHeaders });
      }
    }
  }

  // --- API: Poll commands directly ---
  if (path === '/api/phone/poll') {
    let actions = {};
    const existing = await HUB_KV.get('oppo_actions');
    if (existing) actions = JSON.parse(existing);
    return new Response(JSON.stringify({ status: 'ok', actions }), { headers: jsonHeaders });
  }

  // --- API: Phone Camera Frame Upload & Fetch ---
  if (path === '/api/camera/phone/frame') {
    if (request.method === 'POST') {
      try {
        const buf = await request.arrayBuffer();
        await HUB_KV.put('oppo_last_frame', buf);
        await HUB_KV.put('oppo_frame_time', Date.now().toString());
        return new Response(JSON.stringify({ success: true, size: buf.byteLength }), { headers: jsonHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: jsonHeaders });
      }
    } else {
      const frameBuf = await HUB_KV.get('oppo_last_frame', { type: 'arrayBuffer' });
      if (frameBuf) {
        return new Response(frameBuf, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      return new Response('No frame available', { status: 404 });
    }
  }

  // --- API: Camera & Mobile Screen Status ---
  if (path === '/api/camera/phone/status' || path === '/api/remote/screen/mobile/status') {
    let actions = {};
    const existing = await HUB_KV.get('oppo_actions');
    if (existing) actions = JSON.parse(existing);
    return new Response(JSON.stringify({
      active: Boolean(actions.camera),
      siren: Boolean(actions.siren),
      strobe: Boolean(actions.strobe),
      requested: false,
      hub: 'edge'
    }), { headers: jsonHeaders });
  }

  // --- API: Current Server JSON ---
  if (path === '/current_server.json') {
    return new Response(JSON.stringify({
      primary_priority: 'cloudflare_worker_edge',
      workers_dev_url: 'https://smart-remote.aryan76688.workers.dev',
      custom_domain_url: 'https://smart-remote.aryan76688.workers.dev',
      tunnel_status: 'edge_autonomous',
      active_provider: 'cloudflare_edge',
      note: 'Laptop is offline. Cloudflare Edge Hub active for mobile control.'
    }), { headers: jsonHeaders });
  }

  // --- API: System Info Mock for Android Probe ---
  if (path === '/api/system/info') {
    return new Response(JSON.stringify({
      hostname: 'cloudflare-edge-hub',
      username: 'aryan',
      os_name: 'Cloudflare Edge Linux Gateway',
      tailscale_ip: '100.69.194.11',
      tunnel_status: 'edge_autonomous',
      laptop_status: 'offline',
      edge_online: true
    }), { headers: jsonHeaders });
  }

  // --- Web UI: Standalone Edge Cockpit (HTML) ---
  return new Response(renderEdgeCockpitHtml(url.origin), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

function renderEdgeCockpitHtml(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Smart Remote - Cloud Edge Cockpit (Laptop Offline)</title>
  <link rel="icon" href="https://assets.ubuntu.com/v1/49a1a858-favicon-32x32.png">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(16, 24, 39, 0.85);
      --border: rgba(56, 189, 248, 0.2);
      --primary: #00f2fe;
      --accent: #4facfe;
      --danger: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --text: #f1f5f9;
      --text-dim: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; padding: 16px; background-image: radial-gradient(circle at 50% 0%, rgba(0, 242, 254, 0.12), transparent 45%); }
    .container { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    
    .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; backdrop-filter: blur(12px); }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.05rem; letter-spacing: 0.5px; }
    .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--success); box-shadow: 0 0 12px var(--success); animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
    
    .banner { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); padding: 12px 16px; border-radius: 12px; font-size: 0.82rem; color: #fde68a; display: flex; align-items: center; gap: 10px; }
    
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 18px; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .card-title { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .device-pill { padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
    .device-name { font-size: 0.88rem; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .device-sub { font-size: 0.76rem; color: var(--text-dim); }
    .badge { font-size: 0.68rem; padding: 2px 7px; border-radius: 6px; font-weight: 700; }
    .badge-online { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge-offline { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    
    .map-box { height: 210px; width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); position: relative; background: #1e293b; margin-top: 10px; }
    .map-frame { width: 100%; height: 100%; border: none; }
    
    .btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { padding: 14px; border-radius: 12px; border: none; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
    .btn:active { transform: scale(0.98); }
    .btn-siren { background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; box-shadow: 0 4px 18px rgba(239,68,68,0.4); grid-column: span 2; font-size: 1rem; padding: 16px; }
    .btn-siren.active { animation: blinkSiren 0.8s infinite; background: #dc2626; }
    @keyframes blinkSiren { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .btn-action { background: rgba(255,255,255,0.06); color: var(--text); border: 1px solid var(--border); }
    .btn-action:hover { background: rgba(0, 242, 254, 0.15); border-color: var(--primary); }
    
    .photo-preview { display: none; margin-top: 14px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
    .photo-preview img { width: 100%; height: auto; display: block; }
    
    .footer { text-align: center; font-size: 0.75rem; color: var(--text-dim); margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    
    <div class="header">
      <div class="brand">
        <div class="pulse-dot"></div>
        <span>SMART REMOTE <span style="color:var(--primary);font-size:0.8rem;margin-left:4px;">CLOUD EDGE</span></span>
      </div>
      <span class="badge badge-online">24/7 AUTONOMOUS</span>
    </div>

    <div class="banner">
      <span>⚡</span>
      <div><b>Laptop is powered off.</b> Cloudflare Edge Hub is directly guarding and controlling your Oppo phone.</div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Fleet Vitals</span>
        <span id="last-update" style="font-size:0.75rem;font-family:monospace;color:var(--primary);">Connecting...</span>
      </div>
      
      <div class="status-grid">
        <div class="device-pill">
          <div class="device-name">
            <span>💻 Kali Laptop</span>
            <span class="badge badge-offline">OFFLINE</span>
          </div>
          <div class="device-sub">System powered off</div>
        </div>

        <div class="device-pill">
          <div class="device-name">
            <span>📱 Oppo Phone</span>
            <span id="oppo-badge" class="badge badge-online">ONLINE</span>
          </div>
          <div class="device-sub" id="oppo-battery">Battery: --% • Searching</div>
        </div>
      </div>

      <div class="device-pill" style="margin-bottom:10px;">
        <div style="font-size:0.8rem;font-weight:700;display:flex;justify-content:space-between;">
          <span>📍 Live Location</span>
          <a id="gmaps-link" href="#" target="_blank" style="color:var(--primary);text-decoration:none;font-size:0.75rem;">Open Google Maps ↗</a>
        </div>
        <div id="oppo-coords" style="font-size:0.76rem;color:var(--text-dim);font-family:monospace;margin-top:4px;">
          Coordinates: Retrieving GPS fix...
        </div>
      </div>

      <div class="map-box">
        <iframe id="map-frame" class="map-frame" src="about:blank"></iframe>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Device Drawer Remote Actions</div>
      <div class="btn-grid">
        <button id="siren-btn" class="btn btn-siren" onclick="toggleSiren()">
          <span>🔊</span>
          <span id="siren-txt">BLAST 110dB EMERGENCY SIREN</span>
        </button>

        <button class="btn btn-action" onclick="triggerLocate()">
          <span>📍</span>
          <span>Force GPS Locate</span>
        </button>

        <button class="btn btn-action" onclick="toggleTorch()">
          <span>🔦</span>
          <span>Toggle Torch</span>
        </button>

        <button class="btn btn-action" onclick="capturePhoto()" style="grid-column: span 2;">
          <span>📸</span>
          <span>Capture Remote Camera Snapshot</span>
        </button>
      </div>

      <div id="photo-box" class="photo-preview">
        <img id="photo-img" src="" alt="Remote Snapshot">
      </div>
    </div>

    <div class="footer">
      Connected to Cloudflare Worker Edge & KV • Zero Laptop Power Required
    </div>

  </div>

  <script>
    let isSirenOn = false;
    let isTorchOn = false;

    async function fetchFleet() {
      try {
        const res = await fetch('/api/tracking/fleet');
        const data = await res.json();
        
        document.getElementById('last-update').innerText = new Date().toLocaleTimeString();

        if (data.oppo) {
          const o = data.oppo;
          const isOnline = o.status === 'online';
          const badge = document.getElementById('oppo-badge');
          badge.className = isOnline ? 'badge badge-online' : 'badge badge-offline';
          badge.innerText = isOnline ? 'ONLINE' : (o.last_seen_seconds_ago ? 'SEEN ' + o.last_seen_seconds_ago + 's AGO' : 'OFFLINE');
          
          document.getElementById('oppo-battery').innerText = 'Battery: ' + (o.battery || 0) + '% ' + (o.is_charging ? '⚡' : '') + ' • ' + (o.model || 'Oppo');
          
          if (o.lat && o.lng) {
            document.getElementById('oppo-coords').innerText = 'Lat: ' + o.lat.toFixed(6) + ', Lng: ' + o.lng.toFixed(6) + ' (±' + Math.round(o.accuracy || 0) + 'm)';
            document.getElementById('gmaps-link').href = 'https://www.google.com/maps?q=' + o.lat + ',' + o.lng;
            
            const mapFrame = document.getElementById('map-frame');
            const targetSrc = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (o.lng - 0.005) + '%2C' + (o.lat - 0.003) + '%2C' + (o.lng + 0.005) + '%2C' + (o.lat + 0.003) + '&layer=mapnik&marker=' + o.lat + '%2C' + o.lng;
            if (mapFrame.src !== targetSrc) {
              mapFrame.src = targetSrc;
            }
          }
        }

        // Fetch current actions to sync siren button state
        const pollRes = await fetch('/api/phone/poll');
        const pollData = await pollRes.json();
        if (pollData.actions) {
          isSirenOn = Boolean(pollData.actions.siren);
          const btn = document.getElementById('siren-btn');
          const txt = document.getElementById('siren-txt');
          if (isSirenOn) {
            btn.classList.add('active');
            txt.innerText = 'STOPPING SIREN (CLICK TO SILENCE)';
          } else {
            btn.classList.remove('active');
            txt.innerText = 'BLAST 110dB EMERGENCY SIREN';
          }
        }
      } catch (err) {
        console.warn('Fleet fetch error:', err);
      }
    }

    async function toggleSiren() {
      isSirenOn = !isSirenOn;
      await fetch('/api/phone/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'siren', siren: isSirenOn })
      });
      fetchFleet();
    }

    async function toggleTorch() {
      isTorchOn = !isTorchOn;
      await fetch('/api/phone/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'strobe', strobe: isTorchOn })
      });
      alert('Torch command sent to phone!');
    }

    async function triggerLocate() {
      await fetch('/api/phone/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'locate' })
      });
      alert('High precision GPS fix requested!');
      setTimeout(fetchFleet, 2000);
    }

    async function capturePhoto() {
      await fetch('/api/phone/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'camera_snapshot' })
      });
      alert('Camera snapshot requested from phone! Loading image...');
      setTimeout(async () => {
        const img = document.getElementById('photo-img');
        img.src = '/api/camera/phone/frame?t=' + Date.now();
        document.getElementById('photo-box').style.display = 'block';
      }, 3500);
    }

    fetchFleet();
    setInterval(fetchFleet, 2500);
  </script>
</body>
</html>`;
}
