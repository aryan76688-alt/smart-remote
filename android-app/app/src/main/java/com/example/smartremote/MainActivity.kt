package com.example.smartremote

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.content.pm.ActivityInfo
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
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

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

    private val RAILWAY_URL = "https://smart-remote-app-production.up.railway.app"
    private val TAILSCALE_URL = "http://100.69.194.11:7070"
    private val LOCAL_WIFI_URL = "http://192.168.31.141:7070"

    private var lastBackPressTime: Long = 0
    var defaultStatusBarHeight: Int = 0
    var isFullscreenMode: Boolean = false
    var customView: View? = null
    var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

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

    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

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

        // Immediate direct load using Railway cloud server as default
        showLoadingOverlay("Connecting to Smart Remote...\nLoading Railway Cloud...")
        discoverAndLoad()
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SMART URL LOADER
    // Priority: 1) User custom-saved URL (if set and not default)
    //           2) Railway Cloud Server (Global anywhere, anytime without VPN)
    // ──────────────────────────────────────────────────────────────────────────
    private fun discoverAndLoad() {
        val saved = getSavedUrl()
        val targetUrl = if (!saved.isNullOrBlank() && saved != RAILWAY_URL) saved else RAILWAY_URL
        mainHandler.post {
            loadUrl(targetUrl)
        }
    }

    private fun tryConnect(url: String, timeoutMs: Int = 4000): Boolean {
        return try {
            val conn = URL("$url/api/system/info").openConnection() as HttpURLConnection
            conn.connectTimeout = timeoutMs
            conn.readTimeout = timeoutMs
            conn.requestMethod = "GET"
            conn.instanceFollowRedirects = true
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            false
        }
    }

    private fun fetchLiveTunnelUrl(): String? {
        // Try to hit the backend tunnel status API via multiple bootstrap endpoints
        val bootstrapEndpoints = listOf(
            TAILSCALE_URL,
            "http://192.168.1.1:7070",   // Common home router subnet
            "http://192.168.0.1:7070",
            "http://10.0.0.1:7070"
        )

        for (base in bootstrapEndpoints) {
            try {
                val conn = URL("$base/api/tunnel/status").openConnection() as HttpURLConnection
                conn.connectTimeout = 3000
                conn.readTimeout = 3000
                conn.requestMethod = "GET"
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    conn.disconnect()
                    val json = JSONObject(body)
                    val publicUrl = json.optString("public_url", "")
                    if (publicUrl.isNotEmpty() && publicUrl != "null") {
                        return publicUrl
                    }
                } else {
                    conn.disconnect()
                }
            } catch (_: Exception) {}
        }
        return null
    }

    private fun loadUrl(url: String) {
        hideLoadingOverlay()
        webView.loadUrl(url)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PREFS HELPERS
    // ──────────────────────────────────────────────────────────────────────────
    private fun getSavedUrl(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_SERVER_URL, null)
    }

    fun getServerUrl(): String {
        return getSavedUrl() ?: RAILWAY_URL
    }

    private fun saveUrl(url: String) {
        val clean = if (!url.startsWith("http://") && !url.startsWith("https://")) "http://$url" else url
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString(KEY_SERVER_URL, clean).apply()
    }

    private fun saveTunnelCache(url: String) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString(KEY_LAST_KNOWN_TUNNEL, url).apply()
    }

    private fun getCachedTunnelUrl(): String? {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_LAST_KNOWN_TUNNEL, null)
    }

    fun setServerUrl(url: String) {
        saveUrl(url)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // UI HELPERS
    // ──────────────────────────────────────────────────────────────────────────
    private fun createLoadingOverlay(): LinearLayout {
        val tv = TextView(this).apply {
            text = "Connecting to Smart Remote...\nFinding best server..."
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 13f
            gravity = Gravity.CENTER
            id = View.generateViewId()
        }

        val logo = TextView(this).apply {
            text = "⬡ SMART REMOTE"
            setTextColor(Color.parseColor("#06b6d4"))
            textSize = 20f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
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
            tag = tv  // store ref for text update
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

    private fun updateLoadingMessage(msg: String) {
        mainHandler.post { (loadingOverlay.tag as? TextView)?.text = msg }
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
            text = "CONNECTION ERROR"
            setTextColor(Color.parseColor("#f43f5e"))
            textSize = 17f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }

        errorText = TextView(this).apply {
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(0, 20, 0, 32)
        }

        val retryBtn = Button(this).apply {
            text = "RETRY (RAILWAY CLOUD)"
            setTextColor(Color.parseColor("#020617"))
            setBackgroundColor(Color.parseColor("#06b6d4"))
            textSize = 13f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setOnClickListener {
                errorLayout.visibility = View.GONE
                saveUrl(RAILWAY_URL)
                showLoadingOverlay("Connecting to Railway Cloud...")
                loadUrl(RAILWAY_URL)
            }
        }

        val tailscaleBtn = Button(this).apply {
            text = "USE TAILSCALE VPN (100.69.194.11)"
            setTextColor(Color.parseColor("#38bdf8"))
            setBackgroundColor(Color.parseColor("#0f172a"))
            textSize = 12f
            setPadding(0, 16, 0, 16)
            setOnClickListener {
                errorLayout.visibility = View.GONE
                saveUrl(TAILSCALE_URL)
                showLoadingOverlay("Connecting to Tailscale IP...")
                loadUrl(TAILSCALE_URL)
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
        layout.addView(retryBtn)
        layout.addView(tailscaleBtn)
        layout.addView(changeUrlBtn)
        return layout
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PERMISSIONS
    // ──────────────────────────────────────────────────────────────────────────
    private fun checkAndRequestPermissions() {
        val permissions = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
            Manifest.permission.CAMERA
        )
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
        settings.userAgentString = "$defaultUa SmartRemoteMobileAndroid/5.0-Railway"
    }

    private fun setupWebViewClients() {
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread { request?.grant(request.resources) }
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
                    val failedUrl = request.url?.toString() ?: ""
                    showConnectionError("Could not connect to:\n$failedUrl\n\nCheck your internet connection or tap below to reconnect.")
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DIALOGS
    // ──────────────────────────────────────────────────────────────────────────
    fun showServerUrlDialog() {
        val input = EditText(this).apply {
            setText(getServerUrl())
            setSingleLine(true)
            setPadding(32, 24, 32, 24)
            setTextColor(Color.BLACK)
            hint = RAILWAY_URL
        }

        AlertDialog.Builder(this)
            .setTitle("Server Connection")
            .setMessage("Railway Cloud Server (Global anywhere, no VPN needed):\n$RAILWAY_URL\n\nOr enter custom Tailscale/Local IP:")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    saveUrl(newUrl)
                    errorLayout.visibility = View.GONE
                    loadUrl(getServerUrl())
                }
            }
            .setNegativeButton("Cancel", null)
            .setNeutralButton("Railway Default") { _, _ ->
                saveUrl(RAILWAY_URL)
                errorLayout.visibility = View.GONE
                loadUrl(RAILWAY_URL)
            }
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

    override fun onDestroy() {
        webView.destroy()
        executor.shutdown()
        super.onDestroy()
    }

    // ──────────────────────────────────────────────────────────────────────────
    // JAVASCRIPT BRIDGE
    // ──────────────────────────────────────────────────────────────────────────
    inner class AndroidAppBridge(private val context: Context) {
        @JavascriptInterface fun isApk(): Boolean = true
        @JavascriptInterface fun getAppVersion(): String = "5.0-GlobalAccess"

        @JavascriptInterface
        fun vibrate(durationMs: Long) { triggerVibrate(durationMs) }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread { Toast.makeText(context, message, Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface
        fun openServerSettings() { runOnUiThread { showServerUrlDialog() } }

        @JavascriptInterface fun getServerUrl(): String = this@MainActivity.getServerUrl()

        @JavascriptInterface
        fun setServerUrl(url: String) { this@MainActivity.setServerUrl(url) }

        @JavascriptInterface
        fun setFullscreen(enable: Boolean) { runOnUiThread { applyFullscreen(enable) } }

        @JavascriptInterface fun isFullscreen(): Boolean = isFullscreenMode

        @JavascriptInterface
        fun reconnect() {
            runOnUiThread {
                showLoadingOverlay("Reconnecting...")
                discoverAndLoad()
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
    }
}
