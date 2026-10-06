package com.example.smartremote

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.media.MediaScannerConnection
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.text.format.Formatter
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorLayout: LinearLayout
    private lateinit var errorText: TextView
    private lateinit var rootLayout: FrameLayout
    private lateinit var loadingOverlay: LinearLayout

    private val PREFS_NAME = "smart_remote_prefs"
    private val KEY_SERVER_URL = "server_url"
    private val KEY_LAST_KNOWN_TUNNEL = "last_known_tunnel_url"
    private val KEY_CUSTOM_URL = "custom_user_url"

    private val TAILSCALE_DEFAULT_URL = "http://100.69.194.11:7070"
    private val LOCAL_WIFI_DEFAULT_URL = "http://192.168.31.141:7070"
    private val GITHUB_CONFIG_URL = "https://raw.githubusercontent.com/aryan76688-alt/smart-remote/main/current_server.json"

    // First server priority: Tailscale IP
    private var activeServerUrl: String = TAILSCALE_DEFAULT_URL
    private var activeServerType: String = "tailscale"
    private var lastBackPressTime: Long = 0
    var defaultStatusBarHeight: Int = 0
    var isFullscreenMode: Boolean = false
    var customView: View? = null
    var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val isDiscovering = AtomicBoolean(false)
    private val executor = Executors.newFixedThreadPool(6)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var powerReceiver: android.content.BroadcastReceiver? = null

    data class ServerCandidate(
        val id: String,
        val name: String,
        val url: String,
        val priorityBonusMs: Long = 0L
    )

    data class ServerProbeResult(
        val candidate: ServerCandidate,
        val isAlive: Boolean,
        val latencyMs: Long,
        val discoveredTunnelUrl: String? = null
    )

    fun applyFullscreen(enable: Boolean) {
        isFullscreenMode = enable
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        if (enable) {
            windowInsetsController.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
            rootLayout.setPadding(0, 0, 0, 0)
        } else {
            windowInsetsController.show(WindowInsetsCompat.Type.systemBars())
            rootLayout.setPadding(0, defaultStatusBarHeight, 0, 0)
        }
    }

    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val data = result.data
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
            fileChooserCallback?.onReceiveValue(uris)
        } else {
            fileChooserCallback?.onReceiveValue(null)
        }
        fileChooserCallback = null
    }

    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val grantedStorage = results[Manifest.permission.WRITE_EXTERNAL_STORAGE] == true ||
            results[Manifest.permission.READ_EXTERNAL_STORAGE] == true ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && (
                results[Manifest.permission.READ_MEDIA_IMAGES] == true ||
                results[Manifest.permission.POST_NOTIFICATIONS] == true
            ))
        if (grantedStorage) {
            Toast.makeText(this, "Storage permission granted! Files can now be saved to your mobile storage.", Toast.LENGTH_LONG).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.parseColor("#080d1a")
        window.navigationBarColor = Color.parseColor("#080d1a")
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        checkAndRequestPermissions()

        defaultStatusBarHeight = run {
            val resId = resources.getIdentifier("status_bar_height", "dimen", "android")
            if (resId > 0) resources.getDimensionPixelSize(resId) else (28 * resources.displayMetrics.density).toInt()
        }

        rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            setBackgroundColor(Color.parseColor("#080d1a"))
            setPadding(0, defaultStatusBarHeight, 0, 0)
        }

        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { view, insets ->
            if (isFullscreenMode) {
                view.setPadding(0, 0, 0, 0)
            } else {
                val statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
                val navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
                val cutoutInsets = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
                val topInset = maxOf(statusBarInsets.top, cutoutInsets.top, defaultStatusBarHeight)
                view.setPadding(0, topInset, 0, navBarInsets.bottom)
            }
            insets
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            setBackgroundColor(Color.parseColor("#080d1a"))
        }

        setupWebViewSettings()
        setupWebViewClients()
        setupDownloadListener()
        webView.addJavascriptInterface(AndroidAppBridge(this), "AndroidBridge")

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 8).apply { gravity = Gravity.TOP }
            isIndeterminate = false
            max = 100
            visibility = View.GONE
        }

        errorLayout = createErrorLayout()
        loadingOverlay = createLoadingOverlay()

        rootLayout.addView(webView)
        rootLayout.addView(progressBar)
        rootLayout.addView(errorLayout)
        rootLayout.addView(loadingOverlay)
        setContentView(rootLayout)

        setupBackPressHandler()
        setupNetworkAutoFailover()
        setupPowerReceiver()

        // Kick off smart best server discovery
        showLoadingOverlay("Finding best server & measuring latency...")
        discoverAndLoadBestServer(force = true)
    }

    private fun setupBackPressHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    webView.webChromeClient?.onHideCustomView()
                    return
                }
                webView.evaluateJavascript(
                    "(function() { if (typeof window.onAndroidBackPressed === 'function') { return window.onAndroidBackPressed(); } return false; })()"
                ) { result ->
                    if (result == "true" || result == "\"true\"") return@evaluateJavascript
                    if (isFullscreenMode) {
                        applyFullscreen(false)
                        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                        return@evaluateJavascript
                    }
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        val now = System.currentTimeMillis()
                        if (now - lastBackPressTime < 2000) {
                            finish()
                        } else {
                            lastBackPressTime = now
                            Toast.makeText(this@MainActivity, "Press BACK again to exit Smart Remote", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        })
    }

    // ──────────────────────────────────────────────────────────────────────────
    // NETWORK FAILOVER LISTENER (Disabled background auto-switching per user requirement)
    // ──────────────────────────────────────────────────────────────────────────
    private fun setupNetworkAutoFailover() {
        // Disabled background auto-switching to prevent disruptive server jumps while app is in use.
        // Server is selected once at startup and remains stable.
    }

    // ──────────────────────────────────────────────────────────────────────────
    // INTELLIGENT AUTO BEST SERVER ENGINE
    // ──────────────────────────────────────────────────────────────────────────
    fun discoverAndLoadBestServer(force: Boolean = false) {
        if (!force && isDiscovering.get()) return
        isDiscovering.set(true)

        executor.execute {
            try {
                val candidateList = mutableListOf<ServerCandidate>()

                // 1. Tailscale IP (ABSOLUTE 1ST PRIORITY - Direct Encrypted WireGuard P2P)
                candidateList.add(
                    ServerCandidate(
                        id = "tailscale",
                        name = "Tailscale IP (1st Priority)",
                        url = TAILSCALE_DEFAULT_URL,
                        priorityBonusMs = -500L
                    )
                )

                // 2. Local Wi-Fi (Secondary LAN candidate)
                candidateList.add(
                    ServerCandidate(
                        id = "local",
                        name = "Local Wi-Fi",
                        url = LOCAL_WIFI_DEFAULT_URL,
                        priorityBonusMs = -100L
                    )
                )

                // Dynamic local subnet candidate if phone is on Wi-Fi
                try {
                    val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                    val ipInt = wm?.connectionInfo?.ipAddress ?: 0
                    if (ipInt != 0) {
                        val deviceIp = Formatter.formatIpAddress(ipInt)
                        val lastDot = deviceIp.lastIndexOf('.')
                        if (lastDot > 0) {
                            val subnet = deviceIp.substring(0, lastDot)
                            val dynamicCandidate = "http://$subnet.141:7070"
                            if (dynamicCandidate != LOCAL_WIFI_DEFAULT_URL) {
                                candidateList.add(
                                    ServerCandidate(
                                        id = "local_dyn",
                                        name = "Local Subnet ($subnet.141)",
                                        url = dynamicCandidate,
                                        priorityBonusMs = -90L
                                    )
                                )
                            }
                        }
                    }
                } catch (_: Exception) {}

                // 3. User Custom URL if configured
                val customUrl = getCustomUrl()
                if (!customUrl.isNullOrBlank()) {
                    candidateList.add(
                        ServerCandidate(
                            id = "custom",
                            name = "Custom Server",
                            url = customUrl,
                            priorityBonusMs = -40L
                        )
                    )
                }

                // 4. Cached Cloudflare Tunnel URL from SharedPreferences
                val cachedTunnel = getCachedTunnelUrl()
                if (!cachedTunnel.isNullOrBlank()) {
                    candidateList.add(
                        ServerCandidate(
                            id = "cloudflare_cached",
                            name = "Cloudflare Tunnel (Cached)",
                            url = cachedTunnel,
                            priorityBonusMs = 0L
                        )
                    )
                }

                // 5. Live Cloudflare URL discovery via GitHub repo
                try {
                    val ghUrl = URL("$GITHUB_CONFIG_URL?nocache=${System.currentTimeMillis()}")
                    val ghConn = (ghUrl.openConnection() as HttpURLConnection).apply {
                        connectTimeout = 2500
                        readTimeout = 2500
                        requestMethod = "GET"
                        instanceFollowRedirects = true
                    }
                    if (ghConn.responseCode == 200) {
                        val ghBody = ghConn.inputStream.bufferedReader().readText()
                        ghConn.disconnect()
                        val ghJson = JSONObject(ghBody)
                        val cloudflareLive = ghJson.optString("cloudflare_url", "").trim()
                        if (cloudflareLive.startsWith("https://") && cloudflareLive != cachedTunnel) {
                            saveTunnelCache(cloudflareLive)
                            candidateList.add(
                                ServerCandidate(
                                    id = "cloudflare",
                                    name = "Cloudflare Public Web",
                                    url = cloudflareLive,
                                    priorityBonusMs = 0L
                                )
                            )
                        }
                    } else {
                        ghConn.disconnect()
                    }
                } catch (_: Exception) {}

                // Parallel latency race
                val results = CopyOnWriteArrayList<ServerProbeResult>()
                val latch = CountDownLatch(candidateList.size)
                val fastWinnerFound = AtomicBoolean(false)

                for (cand in candidateList) {
                    executor.execute {
                        val probe = probeCandidate(cand)
                        results.add(probe)
                        // Tailscale 1st Priority: If Tailscale responds and is alive, instant win!
                        if (probe.isAlive && probe.candidate.id == "tailscale") {
                            fastWinnerFound.set(true)
                        }
                        latch.countDown()
                    }
                }

                // Wait for all candidates or fast Tailscale winner
                if (fastWinnerFound.get()) {
                    latch.await(200, TimeUnit.MILLISECONDS)
                } else {
                    latch.await(2000, TimeUnit.MILLISECONDS)
                }

                // Filter alive servers and score them
                val aliveResults = results.filter { it.isAlive }

                // Cache any discovered tunnel URL
                for (r in aliveResults) {
                    if (!r.discoveredTunnelUrl.isNullOrBlank()) {
                        saveTunnelCache(r.discoveredTunnelUrl)
                    }
                }

                // ABSOLUTE 1ST PRIORITY: If Tailscale is reachable, ALWAYS select Tailscale!
                val tailscaleWinner = aliveResults.firstOrNull { it.candidate.id == "tailscale" }
                val best = tailscaleWinner ?: aliveResults.minByOrNull { it.latencyMs + it.candidate.priorityBonusMs }

                mainHandler.post {
                    isDiscovering.set(false)
                    if (best != null) {
                        val chosenCandidate = best.candidate
                        activeServerUrl = chosenCandidate.url
                        activeServerType = chosenCandidate.id
                        saveUrl(chosenCandidate.url)
                        loadUrl(chosenCandidate.url)

                        val badge = when {
                            chosenCandidate.id == "tailscale" -> "🔒 Tailscale (1st Priority)"
                            chosenCandidate.id.startsWith("local") -> "⚡ Local Wi-Fi"
                            chosenCandidate.id.startsWith("cloudflare") -> "🌐 Cloudflare Tunnel"
                            else -> "🚀 ${chosenCandidate.name}"
                        }
                        Toast.makeText(
                            this@MainActivity,
                            "$badge connected (${best.latencyMs}ms)",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        // All probes timed out; attempt fallback to Tailscale first, then saved or tunnel
                        val fallback = TAILSCALE_DEFAULT_URL
                        if (activeServerUrl.isEmpty()) {
                            loadUrl(fallback)
                        } else {
                            showConnectionError(
                                "No active servers responded.\n\n" +
                                "• 1st Priority: Tailscale ($TAILSCALE_DEFAULT_URL)\n" +
                                "• Local Wi-Fi (192.168.31.141)\n" +
                                "• Cloudflare Tunnel\n\n" +
                                "Tap RETRY to scan again or enter a custom server URL."
                            )
                        }
                    }
                }

            } catch (e: Exception) {
                mainHandler.post {
                    isDiscovering.set(false)
                    val fallback = TAILSCALE_DEFAULT_URL
                    loadUrl(fallback)
                }
            }
        }
    }

    private fun probeCandidate(candidate: ServerCandidate): ServerProbeResult {
        val start = System.currentTimeMillis()
        var isAlive = false
        var discoveredTunnel: String? = null
        try {
            val endpoint = "${candidate.url.trimEnd('/')}/api/system/info"
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                connectTimeout = 2200
                readTimeout = 2200
                requestMethod = "GET"
                instanceFollowRedirects = true
                setRequestProperty("User-Agent", "SmartRemoteMobileAndroid/6.0-AutoServer")
            }
            val code = conn.responseCode
            if (code in 200..299) {
                val stream = conn.inputStream.bufferedReader().readText()
                isAlive = true
                try {
                    val json = JSONObject(stream)
                    val tUrl = json.optString("tunnel_url", "")
                    if (tUrl.startsWith("http")) {
                        discoveredTunnel = tUrl
                    }
                } catch (_: Exception) {}
            }
            conn.disconnect()
        } catch (_: Exception) {
            isAlive = false
        }
        val elapsed = System.currentTimeMillis() - start
        return ServerProbeResult(candidate, isAlive, elapsed, discoveredTunnel)
    }

    private fun loadUrl(url: String) {
        val finalUrl = if (!url.startsWith("http://") && !url.startsWith("https://")) "http://$url" else url
        activeServerUrl = finalUrl
        hideLoadingOverlay()
        errorLayout.visibility = View.GONE
        webView.loadUrl(finalUrl)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PREFS HELPERS
    // ──────────────────────────────────────────────────────────────────────────
    private fun getSavedUrl(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_SERVER_URL, null)
    }

    private fun getCustomUrl(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_CUSTOM_URL, null)
    }

    fun getServerUrl(): String {
        return if (activeServerUrl.isNotEmpty()) activeServerUrl else (getSavedUrl() ?: TAILSCALE_DEFAULT_URL)
    }

    private fun saveUrl(url: String) {
        val clean = if (!url.startsWith("http://") && !url.startsWith("https://")) "http://$url" else url
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString(KEY_SERVER_URL, clean).apply()
    }

    private fun saveCustomUrl(url: String) {
        val clean = if (!url.startsWith("http://") && !url.startsWith("https://")) "http://$url" else url
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString(KEY_CUSTOM_URL, clean).apply()
    }

    private fun saveTunnelCache(url: String) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString(KEY_LAST_KNOWN_TUNNEL, url).apply()
    }

    private fun getCachedTunnelUrl(): String? {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_LAST_KNOWN_TUNNEL, null)
    }

    fun setServerUrl(url: String) {
        saveCustomUrl(url)
        saveUrl(url)
        loadUrl(url)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // UI HELPERS
    // ──────────────────────────────────────────────────────────────────────────
    private fun createLoadingOverlay(): LinearLayout {
        val tv = TextView(this).apply {
            text = "Finding best server & measuring latency..."
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 13f
            gravity = Gravity.CENTER
            id = View.generateViewId()
        }

        val logo = TextView(this).apply {
            text = "⬡ SMART REMOTE"
            setTextColor(Color.parseColor("#06b6d4"))
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 32)
        }

        val spinner = ProgressBar(this).apply {
            isIndeterminate = true
            setPadding(0, 0, 0, 24)
        }

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#080d1a"))
            setPadding(48, 48, 48, 48)
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            addView(logo)
            addView(spinner)
            addView(tv)
            tag = tv
            visibility = View.GONE
        }
    }

    private fun showLoadingOverlay(msg: String) {
        loadingOverlay.visibility = View.VISIBLE
        errorLayout.visibility = View.GONE
        (loadingOverlay.tag as? TextView)?.text = msg
    }

    private fun hideLoadingOverlay() {
        loadingOverlay.visibility = View.GONE
    }

    private fun showConnectionError(msg: String) {
        errorText.text = msg
        errorLayout.visibility = View.VISIBLE
        loadingOverlay.visibility = View.GONE
    }

    private fun createErrorLayout(): LinearLayout {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#080d1a"))
            setPadding(48, 48, 48, 48)
            visibility = View.GONE
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }

        val title = TextView(this).apply {
            text = "ALL SERVERS UNREACHABLE"
            setTextColor(Color.parseColor("#f43f5e"))
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }

        errorText = TextView(this).apply {
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(0, 20, 0, 32)
        }

        val autoScanBtn = Button(this).apply {
            text = "⚡ AUTO-DETECT BEST SERVER"
            setTextColor(Color.parseColor("#020617"))
            setBackgroundColor(Color.parseColor("#06b6d4"))
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setOnClickListener {
                errorLayout.visibility = View.GONE
                showLoadingOverlay("Scanning all servers...")
                discoverAndLoadBestServer(force = true)
            }
        }

        val changeUrlBtn = Button(this).apply {
            text = "ENTER CUSTOM SERVER URL"
            setTextColor(Color.parseColor("#e2e8f0"))
            setBackgroundColor(Color.parseColor("#1e293b"))
            textSize = 12f
            setPadding(0, 16, 0, 16)
            setOnClickListener { showServerUrlDialog() }
        }

        layout.addView(title)
        layout.addView(errorText)
        layout.addView(autoScanBtn)
        layout.addView(changeUrlBtn)
        return layout
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PERMISSIONS
    // ──────────────────────────────────────────────────────────────────────────
    fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
            Manifest.permission.CAMERA
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO)
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }
        val needed = permissions.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (needed.isNotEmpty()) requestPermissionsLauncher.launch(needed.toTypedArray())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WEBVIEW SETUP
    // ──────────────────────────────────────────────────────────────────────────
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebViewSettings() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        val defaultUa = settings.userAgentString
        settings.userAgentString = "$defaultUa SmartRemoteMobileAndroid/6.0-AutoServer"
    }

    private fun setupWebViewClients() {
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread { request?.grant(request.resources) }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                try {
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    fileChooserLauncher.launch(intent)
                    return true
                } catch (e: Exception) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    return false
                }
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                super.onShowCustomView(view, callback)
                if (customView != null) { onHideCustomView(); return }
                customView = view
                customViewCallback = callback
                rootLayout.addView(view, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
                webView.visibility = View.GONE
                applyFullscreen(true)
            }

            override fun onHideCustomView() {
                super.onHideCustomView()
                if (customView == null) return
                rootLayout.removeView(customView)
                customView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
                webView.visibility = View.VISIBLE
                applyFullscreen(false)
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?) = false

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                errorLayout.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                hideLoadingOverlay()
                errorLayout.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    hideLoadingOverlay()
                    showConnectionError(
                        "Unable to load Smart Remote from server:\n$activeServerUrl\n\n" +
                        "Tap RETRY to reload or tap AUTO-DETECT to scan available servers."
                    )
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DOWNLOAD & MOBILE STORAGE MANAGEMENT
    // ──────────────────────────────────────────────────────────────────────────
    private fun setupDownloadListener() {
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            handleFileDownload(url, userAgent, contentDisposition, mimetype)
        }
    }

    fun handleFileDownload(
        rawUrl: String,
        userAgent: String?,
        contentDisposition: String?,
        mimetype: String?,
        customFileName: String? = null
    ) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionsLauncher.launch(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE))
                Toast.makeText(this, "Storage permission requested. Please allow to download files.", Toast.LENGTH_LONG).show()
                return
            }
        }

        try {
            if (rawUrl.startsWith("data:")) {
                val commaIndex = rawUrl.indexOf(",")
                if (commaIndex != -1) {
                    val base64Data = rawUrl.substring(commaIndex + 1)
                    val resolvedName = customFileName ?: ("download_" + System.currentTimeMillis() + ".bin")
                    val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                    saveBytesToLocalStorage(resolvedName, bytes, mimetype ?: "application/octet-stream")
                    return
                }
            }

            if (rawUrl.startsWith("blob:")) {
                val script = """
                    (async function() {
                        try {
                            const res = await fetch('$rawUrl');
                            const blob = await res.blob();
                            const reader = new FileReader();
                            reader.onloadend = function() {
                                if (window.AndroidBridge && window.AndroidBridge.saveBase64File) {
                                    window.AndroidBridge.saveBase64File('${customFileName ?: "download_" + System.currentTimeMillis()}', reader.result, blob.type || 'application/octet-stream');
                                }
                            };
                            reader.readAsDataURL(blob);
                        } catch (e) {
                            console.error('Blob download failed', e);
                        }
                    })();
                """.trimIndent()
                runOnUiThread {
                    webView.evaluateJavascript(script, null)
                }
                return
            }

            val absoluteUrl = when {
                rawUrl.startsWith("http://") || rawUrl.startsWith("https://") -> rawUrl
                rawUrl.startsWith("/") -> activeServerUrl.trimEnd('/') + rawUrl
                else -> activeServerUrl.trimEnd('/') + "/" + rawUrl
            }

            val guessedName = if (!customFileName.isNullOrBlank()) {
                customFileName
            } else {
                URLUtil.guessFileName(absoluteUrl, contentDisposition, mimetype)
            }

            val request = DownloadManager.Request(Uri.parse(absoluteUrl)).apply {
                if (!mimetype.isNullOrBlank() && mimetype != "application/octet-stream") {
                    setMimeType(mimetype)
                }
                val cookies = CookieManager.getInstance().getCookie(absoluteUrl)
                if (!cookies.isNullOrEmpty()) {
                    addRequestHeader("Cookie", cookies)
                }
                if (!userAgent.isNullOrEmpty()) {
                    addRequestHeader("User-Agent", userAgent)
                }
                setDescription("Downloading to mobile local storage...")
                setTitle(guessedName)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, guessedName)
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }

            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "Downloading $guessedName to /Download on mobile...", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Download error: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    fun saveBytesToLocalStorage(filename: String, bytes: ByteArray, mimeType: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(MediaStore.MediaColumns.MIME_TYPE, if (mimeType.isNotBlank()) mimeType else "application/octet-stream")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: return false
                resolver.openOutputStream(uri)?.use { os ->
                    os.write(bytes)
                    os.flush()
                }
                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
            } else {
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!dir.exists()) dir.mkdirs()
                val targetFile = File(dir, filename)
                FileOutputStream(targetFile).use { fos ->
                    fos.write(bytes)
                    fos.flush()
                }
                MediaScannerConnection.scanFile(this, arrayOf(targetFile.absolutePath), arrayOf(mimeType), null)
            }
            runOnUiThread {
                Toast.makeText(this, "Created new file in mobile storage: /Download/$filename", Toast.LENGTH_LONG).show()
            }
            true
        } catch (e: Exception) {
            runOnUiThread {
                Toast.makeText(this, "Error creating file on storage: ${e.message}", Toast.LENGTH_SHORT).show()
            }
            false
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DIALOGS
    // ──────────────────────────────────────────────────────────────────────────
    fun showServerUrlDialog() {
        val cachedTunnel = getCachedTunnelUrl() ?: ""
        val options = arrayOf(
            "🔒 Tailscale IP ($TAILSCALE_DEFAULT_URL) [1ST PRIORITY]",
            "⚡ Auto-Detect Best (Probe All Servers)",
            if (cachedTunnel.isNotEmpty()) "☁️ Cloudflare Global Tunnel ($cachedTunnel)" else "☁️ Cloudflare Global Tunnel (Auto-Discover)",
            "📶 Local Wi-Fi ($LOCAL_WIFI_DEFAULT_URL)",
            "✏️ Enter Custom Server URL..."
        )

        AlertDialog.Builder(this)
            .setTitle("Network & Server Selection")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> {
                        setServerUrl(TAILSCALE_DEFAULT_URL)
                        Toast.makeText(this, "Connected via Tailscale Direct P2P (1st Priority)", Toast.LENGTH_SHORT).show()
                    }
                    1 -> {
                        showLoadingOverlay("Testing servers & connecting to lowest latency...")
                        discoverAndLoadBestServer(force = true)
                    }
                    2 -> {
                        if (cachedTunnel.isNotEmpty()) {
                            setServerUrl(cachedTunnel)
                            Toast.makeText(this, "Connected via Cloudflare Global Tunnel", Toast.LENGTH_SHORT).show()
                        } else {
                            showLoadingOverlay("Fetching Cloudflare Tunnel URL...")
                            discoverAndLoadBestServer(force = true)
                        }
                    }
                    3 -> {
                        setServerUrl(LOCAL_WIFI_DEFAULT_URL)
                        Toast.makeText(this, "Connected via Local Wi-Fi", Toast.LENGTH_SHORT).show()
                    }
                    4 -> {
                        showCustomUrlInputDialog()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showCustomUrlInputDialog() {
        val input = EditText(this).apply {
            setText(getServerUrl())
            setSingleLine(true)
            setPadding(32, 24, 32, 24)
            setTextColor(Color.BLACK)
            hint = "https://example.trycloudflare.com"
        }

        AlertDialog.Builder(this)
            .setTitle("Custom Server URL")
            .setMessage("Active: $activeServerUrl ($activeServerType)\nEnter IP or Tunnel URL:")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    setServerUrl(newUrl)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIBRATION
    // ──────────────────────────────────────────────────────────────────────────
    fun triggerVibrate(durationMs: Long) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            vibrator?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    it.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    it.vibrate(durationMs)
                }
            }
        } catch (_: Exception) {}
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PICTURE-IN-PICTURE (PiP) MODE FOR CCTV & VIDEO CALLS
    // ──────────────────────────────────────────────────────────────────────────
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val currentUrl = webView.url ?: ""
            if (currentUrl.contains("cctv") || currentUrl.contains("call") || currentUrl.contains("mirror")) {
                enterPictureInPicture()
            }
        }
    }

    fun enterPictureInPicture() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val aspectRatio = android.util.Rational(16, 9)
                val params = android.app.PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
                    .build()
                enterPictureInPictureMode(params)
            } catch (e: Exception) {
                try {
                    @Suppress("DEPRECATION")
                    enterPictureInPictureMode()
                } catch (_: Exception) {}
            }
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: android.content.res.Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (isInPictureInPictureMode) {
            webView.evaluateJavascript("document.body.classList.add('pip-mode');", null)
        } else {
            webView.evaluateJavascript("document.body.classList.remove('pip-mode');", null)
        }
    }

    private fun setupPowerReceiver() {
        try {
            val filter = android.content.IntentFilter().apply {
                addAction(Intent.ACTION_POWER_CONNECTED)
                addAction(Intent.ACTION_POWER_DISCONNECTED)
            }
            powerReceiver = object : android.content.BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    val isConnected = intent?.action == Intent.ACTION_POWER_CONNECTED
                    webView.evaluateJavascript("window.onPhonePowerChanged && window.onPhonePowerChanged($isConnected);", null)
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(powerReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(powerReceiver, filter)
            }
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        try {
            networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        } catch (_: Exception) {}
        try {
            powerReceiver?.let { unregisterReceiver(it) }
        } catch (_: Exception) {}
        webView.destroy()
        executor.shutdown()
        super.onDestroy()
    }

    // ──────────────────────────────────────────────────────────────────────────
    // JAVASCRIPT BRIDGE
    // ──────────────────────────────────────────────────────────────────────────
    inner class AndroidAppBridge(private val context: Context) {
        @JavascriptInterface fun isApk(): Boolean = true
        @JavascriptInterface fun getAppVersion(): String = "6.0-AutoServer"

        @JavascriptInterface
        fun vibrate(durationMs: Long) { triggerVibrate(durationMs) }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread { Toast.makeText(context, message, Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface
        fun openServerSettings() { runOnUiThread { showServerUrlDialog() } }

        @JavascriptInterface fun getServerUrl(): String = this@MainActivity.getServerUrl()
        @JavascriptInterface fun getActiveServerType(): String = this@MainActivity.activeServerType
        @JavascriptInterface fun getActiveServerUrl(): String = this@MainActivity.activeServerUrl

        @JavascriptInterface
        fun switchNetworkMode(mode: String) {
            runOnUiThread {
                when (mode.lowercase()) {
                    "tailscale" -> {
                        setServerUrl(TAILSCALE_DEFAULT_URL)
                        Toast.makeText(context, "Switched to Tailscale P2P", Toast.LENGTH_SHORT).show()
                    }
                    "local", "wifi" -> {
                        setServerUrl(LOCAL_WIFI_DEFAULT_URL)
                        Toast.makeText(context, "Switched to Local Wi-Fi", Toast.LENGTH_SHORT).show()
                    }
                    "cloudflare", "tunnel" -> {
                        val tunnel = getCachedTunnelUrl()
                        if (!tunnel.isNullOrEmpty()) {
                            setServerUrl(tunnel)
                            Toast.makeText(context, "Switched to Cloudflare Tunnel", Toast.LENGTH_SHORT).show()
                        } else {
                            discoverAndLoadBestServer(force = true)
                        }
                    }
                    else -> discoverAndLoadBestServer(force = true)
                }
            }
        }

        @JavascriptInterface
        fun setServerUrl(url: String) { this@MainActivity.setServerUrl(url) }

        @JavascriptInterface
        fun setFullscreen(enable: Boolean) { runOnUiThread { applyFullscreen(enable) } }

        @JavascriptInterface fun isFullscreen(): Boolean = isFullscreenMode

        @JavascriptInterface
        fun enterPiP() {
            runOnUiThread {
                enterPictureInPicture()
            }
        }

        @JavascriptInterface
        fun supportsPiP(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

        @JavascriptInterface
        fun reconnect() {
            runOnUiThread {
                showLoadingOverlay("Scanning and auto-switching to best server...")
                discoverAndLoadBestServer(force = true)
            }
        }

        @JavascriptInterface
        fun setOrientation(orientation: String) {
            runOnUiThread {
                try {
                    when (orientation.lowercase()) {
                        "landscape" -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                        "portrait" -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                        "sensor", "auto" -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR
                        else -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                    }
                } catch (_: Exception) {}
            }
        }

        @JavascriptInterface
        fun downloadFile(url: String, filename: String, mimeType: String) {
            runOnUiThread {
                handleFileDownload(url, webView.settings.userAgentString, null, mimeType, filename)
            }
        }

        @JavascriptInterface
        fun saveBase64File(filename: String, base64Data: String, mimeType: String): Boolean {
            return try {
                val cleanBase64 = if (base64Data.contains(",")) {
                    base64Data.substringAfter(",")
                } else {
                    base64Data
                }
                val bytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT)
                saveBytesToLocalStorage(filename, bytes, mimeType)
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(context, "Failed to save file: ${e.message}", Toast.LENGTH_SHORT).show()
                }
                false
            }
        }

        @JavascriptInterface
        fun saveTextFileToLocal(filename: String, content: String): Boolean {
            return try {
                val bytes = content.toByteArray(Charsets.UTF_8)
                saveBytesToLocalStorage(filename, bytes, "text/plain")
            } catch (e: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun requestStoragePermission() {
            runOnUiThread {
                checkAndRequestPermissions()
            }
        }

        @JavascriptInterface
        fun hasStoragePermission(): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            }
        }

        @JavascriptInterface
        fun getStorageDirectory(): String {
            return Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath
        }

        @JavascriptInterface
        fun getClipboardText(): String {
            return try {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                clipboard?.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
            } catch (_: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun setClipboardText(text: String) {
            runOnUiThread {
                try {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                    val clip = android.content.ClipData.newPlainText("SmartRemote", text)
                    clipboard?.setPrimaryClip(clip)
                } catch (_: Exception) {}
            }
        }

        @JavascriptInterface
        fun authenticateBiometric(promptTitle: String) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                runOnUiThread {
                    try {
                        val executor = ContextCompat.getMainExecutor(context)
                        val prompt = android.hardware.biometrics.BiometricPrompt.Builder(context)
                            .setTitle(if (promptTitle.isNotEmpty()) promptTitle else "Authenticate to Kali")
                            .setNegativeButton("Cancel", executor) { _, _ ->
                                webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(false, 'Cancelled');", null)
                            }
                            .build()
                        prompt.authenticate(
                            android.os.CancellationSignal(),
                            executor,
                            object : android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                                override fun onAuthenticationSucceeded(result: android.hardware.biometrics.BiometricPrompt.AuthenticationResult?) {
                                    super.onAuthenticationSucceeded(result)
                                    webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(true, 'Success');", null)
                                }
                                override fun onAuthenticationFailed() {
                                    super.onAuthenticationFailed()
                                    webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(false, 'Failed');", null)
                                }
                            }
                        )
                    } catch (e: Exception) {
                        webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(false, '${e.message}');", null)
                    }
                }
            } else {
                webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(true, 'Bypassed (API < 28)');", null)
            }
        }
    }
}
