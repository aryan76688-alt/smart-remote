# How to Host SMART REMOTE on Cloudflare (Worldwide Access Without Tailscale)

There are **two ways** to host SMART REMOTE on Cloudflare:
1. **Quick Tunnel** (100% Free, Zero Setup, Instant `https://*.trycloudflare.com` URL)
2. **Permanent Named Tunnel** (Free, Custom Domain e.g. `https://remote.yourdomain.com`)

---

## Method 1: Instant Quick Tunnel (No Account / 0 Config)

With Quick Tunnels, Cloudflare routes your local port `7070` to a secure global HTTPS URL without needing a Cloudflare account or domain name.

### Option A: From SMART REMOTE UI (One Tap)
1. Start SMART REMOTE (`./scripts/start.sh`).
2. Open the app in your browser (`http://localhost:7070`).
3. Click the **`GLOBAL`** button in the TopBar or the **"Global Access Anywhere"** card on the Dashboard.
4. Select **Cloudflare Quick Tunnel**.
5. The app generates your live public HTTPS URL and a scannable **QR code** for your Samsung Galaxy A36 or any phone!

### Option B: From the Terminal
Run the bundled script:
```bash
./scripts/cloudflare_tunnel.sh
```
You will see output like:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://example-random-subdomain.trycloudflare.com                                        |
+--------------------------------------------------------------------------------------------+
```
Open that `https://` link on any smartphone or laptop anywhere in the world on 4G/5G mobile data.

---

## Method 2: Permanent Custom Domain Tunnel (Zero Trust)

If you own a domain (e.g. `yourdomain.com`) managed on Cloudflare, you can host SMART REMOTE permanently on a fixed URL like `https://remote.yourdomain.com`.

### Step 1: Create a Tunnel in Cloudflare Zero Trust Dashboard
1. Log in to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com).
2. On the left sidebar, navigate to **Networks** → **Tunnels**.
3. Click **Create a tunnel**.
4. Choose **Cloudflared** as the connector type and click **Next**.
5. Enter a name for the tunnel (e.g., `kali-smart-remote`) and click **Save tunnel**.

### Step 2: Get Your Tunnel Token
In the **Install and run a connector** step:
1. Under **Choose your environment**, select **Debian** or **Linux 64-bit**.
2. Cloudflare will display a command with a long token string starting with `eyJh...`:
   ```bash
   sudo cloudflared service install eyJhIjoi...<YOUR_TOKEN>...
   ```
3. Copy only the token string (`eyJh...`).

### Step 3: Configure the Public Hostname (Route)
1. Click the **Public Hostnames** tab in the tunnel settings.
2. Click **Add a public hostname**:
   - **Subdomain**: `remote` (or whatever you prefer)
   - **Domain**: Select your domain (e.g., `yourdomain.com`)
   - **Path**: leave empty
   - **Type**: `HTTP`
   - **URL**: `localhost:7070`
3. Under **Additional application settings**:
   - Make sure **WebSockets** is supported (Cloudflare tunnels support WebSockets by default, which powers SMART REMOTE's terminal and screen streaming).
4. Click **Save hostname**.

### Step 4: Run the Tunnel on Kali Linux

#### Option A: Run via bundled script
```bash
./scripts/cloudflare_tunnel.sh <YOUR_TOKEN>
```
Or set it as an environment variable in your `.env` file:
```bash
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...<YOUR_TOKEN>" >> .env
./scripts/cloudflare_tunnel.sh
```

#### Option B: Install as a 24/7 Systemd Service (Auto-starts on Boot)
Run once as root:
```bash
sudo ./bin/cloudflared service install <YOUR_TOKEN>
sudo systemctl enable --now cloudflared
```
To check service status:
```bash
sudo systemctl status cloudflared
```

---

## Accessing Your Remote Controller

Once running, navigate to your public URL:
- **URL**: `https://remote.yourdomain.com` (or your `trycloudflare.com` URL)
- **Login Credentials**:
  - **Username**: `ARYAN`
  - **Password**: `Aryan@2007`

### Installing on Samsung Galaxy A36 / Any Mobile Phone
1. Open the Cloudflare HTTPS URL in **Chrome** or **Samsung Internet**.
2. Tap the browser menu (**⋮** or **≡**).
3. Tap **"Add to Home screen"** or **"Install App"**.
4. SMART REMOTE will now launch as a full-screen standalone application with 120Hz smooth scrolling and haptic touch controls!
