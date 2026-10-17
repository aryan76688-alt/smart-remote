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
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CaptureRequest
import androidx.core.app.ActivityCompat
import android.media.AudioManager
import android.media.ToneGenerator
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.media.RingtoneManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.graphics.PixelFormat
import android.graphics.ImageFormat
import android.os.BatteryManager
import android.provider.Settings
import android.text.format.Formatter
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.*
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.File
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import org.json.JSONArray
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
    private val CLOUDFLARE_CUSTOM_DOMAIN_URL = "https://remote.shreeji7.com"
    private val CLOUDFLARE_CUSTOM_ALIAS_URL = "https://smart-remote.shreeji7.com"
    private val CLOUDFLARE_WORKER_URL = "https://smart-remote.aryan76688.workers.dev"
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

    private var locationManager: LocationManager? = null
    private var lastLatitude: Double = 23.168191
    private var lastLongitude: Double = 72.822328
    private var lastAccuracy: Float = 10.0f
    private var lastSpeed: Float = 0.0f
    private var lastHeading: Float = 0.0f
    private var toneGenerator: ToneGenerator? = null
    private val isSirenRunning = AtomicBoolean(false)
    private var sirenPlayer: MediaPlayer? = null
    private var sirenAudioTrack: AudioTrack? = null
    private val isStrobeRunning = AtomicBoolean(false)
    private var cameraManager: CameraManager? = null
    private var rearCameraId: String? = null
    private var uniqueDeviceId: String? = null
    private val isLocationTrackingStarted = AtomicBoolean(false)

    // Mobile mic native streaming
    private val isNativeAudioStreaming = AtomicBoolean(false)
    private var nativeAudioRecord: AudioRecord? = null

    // Mobile camera native streaming
    private val isNativeCameraStreaming = AtomicBoolean(false)
    private var nativeCameraDevice: CameraDevice? = null
    private var nativeCameraSession: CameraCaptureSession? = null
    private var nativeCameraReader: ImageReader? = null
    private var currentCameraFacing = CameraCharacteristics.LENS_FACING_BACK
    private val latestCameraJpeg = java.util.concurrent.atomic.AtomicReference<ByteArray?>()

    // Mobile screen mirroring
    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var screenImageReader: ImageReader? = null
    private val isScreenMirrorActive = AtomicBoolean(false)

    private fun getUniqueDeviceId(): String {
        return "oppo"
    }

    private fun registerLocationListeners() {
        try {
            locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            val hasFine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val hasCoarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (hasFine || hasCoarse) {
                val listener = object : LocationListener {
                    override fun onLocationChanged(loc: Location) {
                        val isAhmedabadIsp = (loc.latitude in 23.00..23.09 && loc.longitude in 72.50..72.63)
                        if (isAhmedabadIsp && loc.provider != LocationManager.GPS_PROVIDER) {
                            lastLatitude = 23.168191
                            lastLongitude = 72.822328
                            lastAccuracy = 10.0f
                        } else {
                            lastLatitude = loc.latitude
                            lastLongitude = loc.longitude
                            lastAccuracy = loc.accuracy
                        }
                        lastSpeed = loc.speed * 3.6f
                        lastHeading = loc.bearing
                    }
                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                    override fun onProviderEnabled(provider: String) {}
                    override fun onProviderDisabled(provider: String) {}
                }
                try {
                    locationManager?.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 0.5f, listener)
                } catch (_: Exception) {}
                try {
                    locationManager?.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000L, 0.5f, listener)
                } catch (_: Exception) {}
                try {
                    locationManager?.requestLocationUpdates(LocationManager.PASSIVE_PROVIDER, 2000L, 0.5f, listener)
                } catch (_: Exception) {}
                val lastKnown = try {
                    locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                        ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                } catch (_: Exception) { null }
                lastKnown?.let {
                    val isAhmedabadIsp = (it.latitude in 23.00..23.09 && it.longitude in 72.50..72.63)
                    if (isAhmedabadIsp && it.provider != LocationManager.GPS_PROVIDER) {
                        lastLatitude = 23.168191
                        lastLongitude = 72.822328
                        lastAccuracy = 10.0f
                    } else {
                        lastLatitude = it.latitude
                        lastLongitude = it.longitude
                        lastAccuracy = it.accuracy
                    }
                }
            }
        } catch (_: Exception) {}
    }

    private fun setupLocationTracking() {
        registerLocationListeners()

        try {
            cameraManager = getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            cameraManager?.cameraIdList?.firstOrNull()?.let {
                rearCameraId = it
            }
        } catch (_: Exception) {}

        if (isLocationTrackingStarted.compareAndSet(false, true)) {
            executor.execute {
                while (!isDestroyed && !isFinishing) {
                    try {
                        Thread.sleep(2500)
                        reportFleetTelemetry()
                        pollAndProcessPhoneFileTasks()
                    } catch (_: Exception) {}
                }
            }
        }
    }

    private fun reportFleetTelemetry() {
        try {
            val server = activeServerUrl
            if (server.isEmpty()) return
            val url = URL("$server/api/tracking/device/update")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 3000
                readTimeout = 3000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            val json = JSONObject().apply {
                put("device_id", getUniqueDeviceId())
                put("name", "Oppo Mobile Phone (${Build.MODEL})".trim())
                put("model", Build.MODEL)
                put("role", "mobile")
                put("lat", lastLatitude)
                put("lng", lastLongitude)
                put("accuracy", lastAccuracy)
                put("battery", getBatteryPct())
                put("is_charging", isCharging())
                put("speed", lastSpeed)
                put("heading", lastHeading)
            }
            conn.outputStream.use { os ->
                os.write(json.toString().toByteArray())
            }
            val respCode = conn.responseCode
            if (respCode == 200) {
                val respText = conn.inputStream.bufferedReader().use { it.readText() }
                val respJson = JSONObject(respText)
                val actions = respJson.optJSONObject("actions")
                if (actions != null) {
                    val shouldSiren = actions.optBoolean("siren", false)
                    if (shouldSiren != isSirenRunning.get()) {
                        playSirenAlarm(shouldSiren)
                    }
                    val shouldStrobe = actions.optBoolean("strobe", false)
                    if (shouldStrobe != isStrobeRunning.get()) {
                        setFlashlightStrobe(shouldStrobe)
                    }
                    val shouldCam = actions.optBoolean("camera", false)
                    if (shouldCam != isNativeCameraStreaming.get()) {
                        toggleNativeCameraStreaming(shouldCam)
                    }
                    val shouldMic = actions.optBoolean("mic", false)
                    if (shouldMic != isNativeAudioStreaming.get()) {
                        toggleNativeAudioStreaming(shouldMic)
                    }
                    val shouldMirror = actions.optBoolean("mirror", false)
                    if (shouldMirror && !isScreenMirrorActive.get()) {
                        runOnUiThread { startMobileScreenMirror() }
                    } else if (!shouldMirror && isScreenMirrorActive.get()) {
                        runOnUiThread { stopScreenCapture() }
                    }
                }
            }
            conn.disconnect()
        } catch (_: Exception) {}
    }

    private fun pollAndProcessPhoneFileTasks() {
        try {
            val server = activeServerUrl
            if (server.isEmpty()) return
            val url = URL("$server/api/phone-files/poll?device_id=oppo")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 3000
                readTimeout = 3000
            }
            if (conn.responseCode == 200) {
                val respText = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(respText)
                if (json.optBoolean("has_task", false)) {
                    val task = json.optJSONObject("task")
                    if (task != null) {
                        executor.execute { executeRemotePhoneTask(server, task) }
                    }
                }
            }
            conn.disconnect()
        } catch (_: Exception) {}
    }

    private fun executeRemotePhoneTask(server: String, task: JSONObject) {
        try {
            val taskId = task.optString("task_id")
            val action = task.optString("action")
            val payload = task.optJSONObject("payload") ?: JSONObject()

            when (action) {
                "get_storage" -> {
                    val res = PhoneFileManager.getStorageStats()
                    sendTaskResult(server, taskId, res)
                }
                "list_dir" -> {
                    val path = payload.optString("path", "")
                    val res = PhoneFileManager.listDirectory(path)
                    sendTaskResult(server, taskId, res)
                }
                "read_file" -> {
                    val path = payload.optString("path", "")
                    val res = PhoneFileManager.readFile(path)
                    sendTaskResult(server, taskId, res)
                }
                "delete_item" -> {
                    val path = payload.optString("path", "")
                    val ok = PhoneFileManager.deleteItem(path)
                    val res = JSONObject().apply {
                        put("success", ok)
                        put("path", path)
                    }
                    sendTaskResult(server, taskId, res)
                }
                "create_item" -> {
                    val path = payload.optString("path", "")
                    val isDir = payload.optBoolean("is_directory", false)
                    val ok = PhoneFileManager.createItem(path, isDir)
                    val res = JSONObject().apply {
                        put("success", ok)
                        put("path", path)
                    }
                    sendTaskResult(server, taskId, res)
                }
                "write_file" -> {
                    val path = payload.optString("path", "")
                    val content = payload.optString("content", "")
                    val ok = PhoneFileManager.writeFile(path, content)
                    val res = JSONObject().apply {
                        put("success", ok)
                        put("path", path)
                    }
                    sendTaskResult(server, taskId, res)
                }
                "download_file" -> {
                    val path = payload.optString("path", "")
                    val file = File(path)
                    if (file.exists()) {
                        val uploadUrl = URL("$server/api/phone-files/upload-file/$taskId")
                        val conn = (uploadUrl.openConnection() as HttpURLConnection).apply {
                            requestMethod = "POST"
                            connectTimeout = 8000
                            readTimeout = 15000
                            doOutput = true
                            setRequestProperty("Content-Type", "application/octet-stream")
                        }
                        conn.outputStream.use { os ->
                            if (file.isDirectory) {
                                PhoneFileManager.exportToZip(listOf(file.absolutePath), os)
                            } else {
                                FileInputStream(file).use { it.copyTo(os) }
                            }
                        }
                        conn.responseCode
                        conn.disconnect()
                    } else {
                        sendTaskResult(server, taskId, JSONObject().apply {
                            put("success", false)
                            put("error", "File not found")
                        })
                    }
                }
                "bulk_download_zip" -> {
                    val pathsJson = payload.optJSONArray("paths") ?: JSONArray()
                    val pathList = mutableListOf<String>()
                    for (i in 0 until pathsJson.length()) {
                        pathList.add(pathsJson.getString(i))
                    }
                    val uploadUrl = URL("$server/api/phone-files/upload-file/$taskId")
                    val conn = (uploadUrl.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 8000
                        readTimeout = 25000
                        doOutput = true
                        setRequestProperty("Content-Type", "application/zip")
                    }
                    conn.outputStream.use { os ->
                        PhoneFileManager.exportToZip(pathList, os)
                    }
                    conn.responseCode
                    conn.disconnect()
                }
                "pull_upload" -> {
                    val fileId = payload.optString("file_id")
                    val targetPath = payload.optString("target_path")
                    val downloadUrl = URL("$server/api/phone-files/staged-file/$fileId")
                    val conn = (downloadUrl.openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 5000
                        readTimeout = 15000
                    }
                    if (conn.responseCode == 200) {
                        val destFile = File(targetPath)
                        destFile.parentFile?.mkdirs()
                        conn.inputStream.use { input ->
                            FileOutputStream(destFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                        sendTaskResult(server, taskId, JSONObject().apply {
                            put("success", true)
                            put("path", targetPath)
                        })
                    } else {
                        sendTaskResult(server, taskId, JSONObject().apply {
                            put("success", false)
                            put("error", "Failed to download staged file: ${conn.responseCode}")
                        })
                    }
                    conn.disconnect()
                }
            }
        } catch (_: Exception) {}
    }

    private fun sendTaskResult(server: String, taskId: String, result: JSONObject) {
        try {
            val url = URL("$server/api/phone-files/result/$taskId")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 3000
                readTimeout = 3000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            conn.outputStream.use { os ->
                os.write(result.toString().toByteArray(Charsets.UTF_8))
            }
            conn.responseCode
            conn.disconnect()
        } catch (_: Exception) {}
    }

    private fun getBatteryPct(): Int {
        return try {
            val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 80
        } catch (_: Exception) { 80 }
    }

    private fun isCharging(): Boolean {
        return try {
            val intent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        } catch (_: Exception) { false }
    }

    fun playSirenAlarm(enable: Boolean) {
        if (enable) {
            if (isSirenRunning.getAndSet(true)) return
            executor.execute {
                try {
                    val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                    val maxAlarmVol = am?.getStreamMaxVolume(AudioManager.STREAM_ALARM) ?: 15
                    am?.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarmVol, 0)
                    val maxMusicVol = am?.getStreamMaxVolume(AudioManager.STREAM_MUSIC) ?: 15
                    am?.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusicVol, 0)

                    // 1. Hardware ToneGenerator (Built-in, zero dependency, works on all Oppo phones)
                    executor.execute {
                        try {
                            toneGenerator = ToneGenerator(AudioManager.STREAM_ALARM, 100)
                            while (isSirenRunning.get()) {
                                toneGenerator?.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 400)
                                Thread.sleep(450)
                                if (!isSirenRunning.get()) break
                                toneGenerator?.startTone(ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE, 400)
                                Thread.sleep(450)
                            }
                        } catch (_: Exception) {} finally {
                            try { toneGenerator?.release() } catch (_: Exception) {}
                            toneGenerator = null
                        }
                    }

                    // 2. Continuous Haptic Vibration
                    val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    val vibPattern = longArrayOf(0, 400, 200, 400, 200)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator?.vibrate(VibrationEffect.createWaveform(vibPattern, 0))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator?.vibrate(vibPattern, 0)
                    }

                    // 3. RingtoneManager system alarm player
                    try {
                        val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                        if (alarmUri != null) {
                            sirenPlayer = MediaPlayer().apply {
                                setAudioAttributes(
                                    AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_ALARM)
                                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                        .build()
                                    )
                                setDataSource(this@MainActivity, alarmUri)
                                isLooping = true
                                setVolume(1.0f, 1.0f)
                                prepare()
                                start()
                            }
                        }
                    } catch (_: Exception) {}

                    // 4. Synthesize loud 44100Hz square siren wave via AudioTrack
                    try {
                        val sampleRate = 44100
                        var bufSize = AudioTrack.getMinBufferSize(
                            sampleRate,
                            AudioFormat.CHANNEL_OUT_MONO,
                            AudioFormat.ENCODING_PCM_16BIT
                        )
                        if (bufSize <= 0) bufSize = 4096
                        sirenAudioTrack = AudioTrack.Builder()
                            .setAudioAttributes(
                                AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_ALARM)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build()
                            )
                            .setAudioFormat(
                                AudioFormat.Builder()
                                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                    .setSampleRate(sampleRate)
                                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                    .build()
                            )
                            .setBufferSizeInBytes(bufSize * 2)
                            .build()
                        sirenAudioTrack?.play()

                        val buffer = ShortArray(sampleRate / 4)
                        var freq = 850.0
                        var phase = 0.0
                        while (isSirenRunning.get()) {
                            freq = if (freq == 850.0) 1350.0 else 850.0
                            val delta = 2.0 * Math.PI * freq / sampleRate
                            for (i in buffer.indices) {
                                buffer[i] = (Math.sin(phase) * 32767).toInt().toShort()
                                phase += delta
                            }
                            sirenAudioTrack?.write(buffer, 0, buffer.size)
                        }
                    } catch (_: Exception) {}

                } catch (_: Exception) {}
            }
        } else {
            isSirenRunning.set(false)
            try {
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                vibrator?.cancel()
            } catch (_: Exception) {}
            try { toneGenerator?.stopTone(); toneGenerator?.release() } catch (_: Exception) {}
            toneGenerator = null
            try { sirenPlayer?.stop(); sirenPlayer?.release() } catch (_: Exception) {}
            sirenPlayer = null
            try { sirenAudioTrack?.stop(); sirenAudioTrack?.release() } catch (_: Exception) {}
            sirenAudioTrack = null
        }
    }

    fun setFlashlightStrobe(enable: Boolean) {
        if (enable) {
            if (isStrobeRunning.getAndSet(true)) return
            executor.execute {
                try {
                    val camId = rearCameraId ?: return@execute
                    var on = false
                    while (isStrobeRunning.get()) {
                        on = !on
                        cameraManager?.setTorchMode(camId, on)
                        Thread.sleep(120)
                    }
                    cameraManager?.setTorchMode(camId, false)
                } catch (_: Exception) {} finally {
                    isStrobeRunning.set(false)
                }
            }
        } else {
            isStrobeRunning.set(false)
            try {
                rearCameraId?.let { cameraManager?.setTorchMode(it, false) }
            } catch (_: Exception) {}
        }
    }

    fun toggleNativeAudioStreaming(enable: Boolean) {
        if (enable) {
            if (isNativeAudioStreaming.getAndSet(true)) return
            executor.execute {
                var record: AudioRecord? = null
                try {
                    val sampleRate = 16000
                    val minBuf = AudioRecord.getMinBufferSize(
                        sampleRate,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT
                    )
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 1012)
                        isNativeAudioStreaming.set(false)
                        return@execute
                    }
                    record = AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        sampleRate,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        Math.max(minBuf * 4, 12800)
                    )
                    nativeAudioRecord = record
                    record.startRecording()
                    // 200ms batch buffer: 16000 * 2 * 0.2 = 6400 bytes
                    val batchSize = 6400
                    val buf = ByteArray(batchSize)
                    while (isNativeAudioStreaming.get() && !isDestroyed) {
                        var offset = 0
                        while (offset < batchSize && isNativeAudioStreaming.get() && !isDestroyed) {
                            val readBytes = record.read(buf, offset, batchSize - offset)
                            if (readBytes > 0) {
                                offset += readBytes
                            } else {
                                break
                            }
                        }
                        if (offset > 0) {
                            val srv = activeServerUrl
                            if (srv.isNotEmpty()) {
                                try {
                                    val conn = (URL("$srv/api/camera/phone/audio-chunk").openConnection() as HttpURLConnection).apply {
                                        requestMethod = "POST"
                                        connectTimeout = 1500
                                        readTimeout = 1500
                                        doOutput = true
                                        setRequestProperty("Content-Type", "application/octet-stream")
                                    }
                                    conn.outputStream.use { it.write(buf, 0, offset) }
                                    conn.responseCode
                                    conn.disconnect()
                                } catch (_: Exception) {}
                            }
                        }
                    }
                } catch (_: Exception) {} finally {
                    try { record?.stop(); record?.release() } catch (_: Exception) {}
                    nativeAudioRecord = null
                    isNativeAudioStreaming.set(false)
                }
            }
        } else {
            isNativeAudioStreaming.set(false)
            try { nativeAudioRecord?.stop(); nativeAudioRecord?.release() } catch (_: Exception) {}
            nativeAudioRecord = null
        }
    }

    fun flipCamera() {
        currentCameraFacing = if (currentCameraFacing == CameraCharacteristics.LENS_FACING_BACK) {
            CameraCharacteristics.LENS_FACING_FRONT
        } else {
            CameraCharacteristics.LENS_FACING_BACK
        }
        if (isNativeCameraStreaming.get()) {
            toggleNativeCameraStreaming(false)
            mainHandler.postDelayed({ toggleNativeCameraStreaming(true) }, 250)
        }
    }

    fun toggleNativeCameraStreaming(enable: Boolean) {
        if (enable) {
            if (isNativeCameraStreaming.getAndSet(true)) return
            runOnUiThread {
                try {
                    val cm = getSystemService(Context.CAMERA_SERVICE) as? CameraManager
                    if (cm == null) {
                        isNativeCameraStreaming.set(false)
                        return@runOnUiThread
                    }
                    var selectedCamId: String? = null
                    for (id in cm.cameraIdList) {
                        val chars = cm.getCameraCharacteristics(id)
                        val facing = chars.get(CameraCharacteristics.LENS_FACING) as? Int
                        if (facing != null && facing == currentCameraFacing) {
                            selectedCamId = id
                            break
                        }
                    }
                    if (selectedCamId == null) {
                        selectedCamId = cm.cameraIdList.firstOrNull()
                    }
                    if (selectedCamId == null) {
                        isNativeCameraStreaming.set(false)
                        return@runOnUiThread
                    }
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 1013)
                        isNativeCameraStreaming.set(false)
                        return@runOnUiThread
                    }

                    nativeCameraReader = ImageReader.newInstance(640, 480, ImageFormat.JPEG, 2).apply {
                        setOnImageAvailableListener({ reader ->
                            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                            try {
                                val buffer = image.planes[0].buffer
                                val bytes = ByteArray(buffer.remaining())
                                buffer.get(bytes)
                                image.close()
                                latestCameraJpeg.set(bytes)
                            } catch (_: Exception) {
                                try { image.close() } catch (_: Exception) {}
                            }
                        }, mainHandler)
                    }

                    // Single persistent frame dispatcher worker thread
                    executor.execute {
                        while (isNativeCameraStreaming.get() && !isDestroyed) {
                            try {
                                val bytes = latestCameraJpeg.getAndSet(null)
                                if (bytes != null) {
                                    val srv = activeServerUrl
                                    if (srv.isNotEmpty()) {
                                        val conn = (URL("$srv/api/camera/phone/frame").openConnection() as HttpURLConnection).apply {
                                            requestMethod = "POST"
                                            connectTimeout = 1500
                                            readTimeout = 1500
                                            doOutput = true
                                            setRequestProperty("Content-Type", "image/jpeg")
                                            setRequestProperty("X-Camera-Facing", if (currentCameraFacing == CameraCharacteristics.LENS_FACING_FRONT) "front" else "back")
                                            setRequestProperty("X-Camera-Torch", if (isStrobeRunning.get()) "1" else "0")
                                        }
                                        conn.outputStream.use { it.write(bytes) }
                                        conn.responseCode
                                        conn.disconnect()
                                    }
                                }
                                Thread.sleep(50) // ~20 FPS rate
                            } catch (_: Exception) {
                                Thread.sleep(50)
                            }
                        }
                    }

                    cm.openCamera(selectedCamId, object : CameraDevice.StateCallback() {
                        override fun onOpened(camera: CameraDevice) {
                            nativeCameraDevice = camera
                            try {
                                val readerSurface = nativeCameraReader?.surface ?: return
                                camera.createCaptureSession(listOf(readerSurface), object : CameraCaptureSession.StateCallback() {
                                    override fun onConfigured(session: CameraCaptureSession) {
                                        nativeCameraSession = session
                                        try {
                                            val req = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                                                addTarget(readerSurface)
                                                set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                                            }
                                            session.setRepeatingRequest(req.build(), null, mainHandler)
                                        } catch (_: Exception) {}
                                    }
                                    override fun onConfigureFailed(session: CameraCaptureSession) {
                                        isNativeCameraStreaming.set(false)
                                    }
                                }, mainHandler)
                            } catch (_: Exception) {
                                isNativeCameraStreaming.set(false)
                            }
                        }
                        override fun onDisconnected(camera: CameraDevice) {
                            camera.close()
                            nativeCameraDevice = null
                            isNativeCameraStreaming.set(false)
                        }
                        override fun onError(camera: CameraDevice, error: Int) {
                            camera.close()
                            nativeCameraDevice = null
                            isNativeCameraStreaming.set(false)
                        }
                    }, mainHandler)
                } catch (_: Exception) {
                    isNativeCameraStreaming.set(false)
                }
            }
        } else {
            isNativeCameraStreaming.set(false)
            runOnUiThread {
                try { nativeCameraSession?.close() } catch (_: Exception) {}
                nativeCameraSession = null
                try { nativeCameraDevice?.close() } catch (_: Exception) {}
                nativeCameraDevice = null
                try { nativeCameraReader?.close() } catch (_: Exception) {}
                nativeCameraReader = null
                latestCameraJpeg.set(null)
            }
        }
    }

    private fun startScreenCaptureLoop() {
        val dm = resources.displayMetrics
        val width = 540
        val height = 960
        val dpi = dm.densityDpi

        screenImageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "SmartRemoteScreen",
            width, height, dpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            screenImageReader?.surface, null, null
        )

        isScreenMirrorActive.set(true)
        executor.execute {
            var lastPost = 0L
            while (isScreenMirrorActive.get() && !isDestroyed) {
                try {
                    val now = System.currentTimeMillis()
                    if (now - lastPost > 65) { // ~15 FPS
                        val img = screenImageReader?.acquireLatestImage()
                        if (img != null) {
                            val planes = img.planes
                            val buffer = planes[0].buffer
                            val pixelStride = planes[0].pixelStride
                            val rowStride = planes[0].rowStride
                            val rowPadding = rowStride - pixelStride * width

                            val bitmap = Bitmap.createBitmap(
                                width + rowPadding / pixelStride,
                                height, Bitmap.Config.ARGB_8888
                            )
                            bitmap.copyPixelsFromBuffer(buffer)
                            img.close()

                            val cropped = if (rowPadding == 0) bitmap else Bitmap.createBitmap(bitmap, 0, 0, width, height)
                            val bos = java.io.ByteArrayOutputStream()
                            cropped.compress(Bitmap.CompressFormat.JPEG, 65, bos)
                            val jpegBytes = bos.toByteArray()
                            if (cropped != bitmap) bitmap.recycle()
                            cropped.recycle()

                            val srv = activeServerUrl
                            if (srv.isNotEmpty()) {
                                val conn = (URL("$srv/api/remote/screen/mobile/frame").openConnection() as HttpURLConnection).apply {
                                    requestMethod = "POST"
                                    connectTimeout = 1200
                                    readTimeout = 1200
                                    doOutput = true
                                    setRequestProperty("Content-Type", "image/jpeg")
                                }
                                conn.outputStream.use { it.write(jpegBytes) }
                                conn.responseCode
                                conn.disconnect()
                            }
                            lastPost = now
                        }
                    }
                    Thread.sleep(25)
                } catch (_: Exception) {}
            }
        }
    }

    fun startMobileScreenMirror() {
        runOnUiThread {
            try {
                this.mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
                this.mediaProjectionManager?.let {
                    this.mediaProjectionLauncher.launch(it.createScreenCaptureIntent())
                }
            } catch (e: Exception) {
                Toast.makeText(this, "Mirror error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun stopScreenCapture() {
        isScreenMirrorActive.set(false)
        try { virtualDisplay?.release() } catch (_: Exception) {}
        virtualDisplay = null
        try { screenImageReader?.close() } catch (_: Exception) {}
        screenImageReader = null
        try { mediaProjection?.stop() } catch (_: Exception) {}
        mediaProjection = null
        try { ScreenCaptureService.stop(this) } catch (_: Exception) {}
    }


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
        val grantedLoc = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (grantedLoc) {
            setupLocationTracking()
            Toast.makeText(this, "Location tracking active on Tactical Radar.", Toast.LENGTH_SHORT).show()
        }
    }

    val mediaProjectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK && result.data != null) {
            try {
                ScreenCaptureService.start(this)
                mainHandler.postDelayed({
                    try {
                        mediaProjection = mediaProjectionManager?.getMediaProjection(result.resultCode, result.data!!)
                        mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                            override fun onStop() {
                                runOnUiThread { stopScreenCapture() }
                            }
                        }, mainHandler)
                        startScreenCaptureLoop()
                        Toast.makeText(this, "Mobile Screen Mirroring Live!", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        isScreenMirrorActive.set(false)
                        ScreenCaptureService.stop(this)
                        Toast.makeText(this, "Projection error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }, 350)
            } catch (e: Exception) {
                isScreenMirrorActive.set(false)
                Toast.makeText(this, "Screen capture service failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        } else {
            isScreenMirrorActive.set(false)
            ScreenCaptureService.stop(this)
            Toast.makeText(this, "Screen capture permission denied", Toast.LENGTH_SHORT).show()
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
        setupLocationTracking()

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
        val bridge = AndroidAppBridge(this)
        webView.addJavascriptInterface(bridge, "AndroidBridge")
        webView.addJavascriptInterface(bridge, "AndroidApp")

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
        try {
            connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    mainHandler.post {
                        android.util.Log.i("SmartRemoteNet", "Network available (Wi-Fi or Mobile Data). Re-syncing telemetry.")
                        registerLocationListeners()
                        executor.execute { reportFleetTelemetry() }
                        if (errorLayout.visibility == View.VISIBLE) {
                            discoverAndLoadBestServer(force = true)
                        }
                    }
                }

                override fun onLost(network: Network) {
                    mainHandler.post {
                        android.util.Log.i("SmartRemoteNet", "Network lost. Waiting for alternative connection...")
                    }
                }
            }
            networkCallback?.let {
                connectivityManager?.registerNetworkCallback(request, it)
            }
        } catch (e: Exception) {
            android.util.Log.e("SmartRemoteNet", "Error registering network callback: ${e.message}")
        }
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

                // 4. Cloudflare Worker Edge (https://smart-remote.aryan76688.workers.dev) - Direct global access
                candidateList.add(
                    ServerCandidate(
                        id = "cloudflare_worker",
                        name = "Cloudflare Worker Edge",
                        url = CLOUDFLARE_WORKER_URL,
                        priorityBonusMs = -25L
                    )
                )
                candidateList.add(
                    ServerCandidate(
                        id = "cloudflare_custom",
                        name = "Cloudflare Custom (remote.shreeji7.com)",
                        url = CLOUDFLARE_CUSTOM_DOMAIN_URL,
                        priorityBonusMs = -10L
                    )
                )
                candidateList.add(
                    ServerCandidate(
                        id = "cloudflare_custom_alias",
                        name = "Cloudflare Custom (smart-remote.shreeji7.com)",
                        url = CLOUDFLARE_CUSTOM_ALIAS_URL,
                        priorityBonusMs = -10L
                    )
                )

                // 5. Cached Cloudflare Tunnel URL from SharedPreferences
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

                // 6. Live Cloudflare URL discovery via GitHub repo
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
                        // Also discover any additional custom domains from JSON
                        val extraArr = ghJson.optJSONArray("additional_domains")
                        if (extraArr != null) {
                            for (i in 0 until extraArr.length()) {
                                val d = extraArr.optString(i, "").trim()
                                if (d.startsWith("https://") && candidateList.none { it.url == d }) {
                                    candidateList.add(
                                        ServerCandidate(
                                            id = "cf_extra_$i",
                                            name = "Cloudflare (${d.replace("https://", "")})",
                                            url = d,
                                            priorityBonusMs = -5L
                                        )
                                    )
                                }
                            }
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
                            chosenCandidate.id == "cloudflare_custom" || chosenCandidate.id == "cloudflare_custom_alias" -> "🌐 Cloudflare Custom Domain"
                            chosenCandidate.id == "cloudflare_worker" -> "⚡ Cloudflare Worker Edge"
                            chosenCandidate.id.startsWith("cloudflare") || chosenCandidate.id.startsWith("cf_") -> "🌐 Cloudflare Tunnel"
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
                                "• Custom Domain: $CLOUDFLARE_CUSTOM_DOMAIN_URL\n" +
                                "• Custom Alias: $CLOUDFLARE_CUSTOM_ALIAS_URL\n" +
                                "• Worker Edge: $CLOUDFLARE_WORKER_URL\n" +
                                "• Local Wi-Fi ($LOCAL_WIFI_DEFAULT_URL)\n" +
                                "• Cloudflare Quick Tunnel\n\n" +
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
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
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
        settings.setGeolocationEnabled(true)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        val defaultUa = settings.userAgentString
        settings.userAgentString = "$defaultUa SmartRemoteMobileAndroid/6.0-AutoServer"
    }

    private fun setupWebViewClients() {
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread { request?.grant(request.resources) }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
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

        @JavascriptInterface fun isPhoneStorageAvailable(): Boolean = true
        @JavascriptInterface fun hasAllFilesAccess(): Boolean = PhoneFileManager.hasAllFilesAccess()

        @JavascriptInterface
        fun requestAllFilesAccess() {
            runOnUiThread {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                            data = Uri.parse("package:${context.packageName}")
                        }
                        context.startActivity(intent)
                    } else {
                        checkAndRequestPermissions()
                    }
                } catch (_: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                        context.startActivity(intent)
                    } catch (_: Exception) {
                        checkAndRequestPermissions()
                    }
                }
            }
        }

        @JavascriptInterface
        fun listPhoneFiles(path: String): String {
            return PhoneFileManager.listDirectory(path).toString()
        }

        @JavascriptInterface
        fun readPhoneFile(path: String): String {
            return PhoneFileManager.readFile(path).toString()
        }

        @JavascriptInterface
        fun getPhoneStorageStats(): String {
            return PhoneFileManager.getStorageStats().toString()
        }

        @JavascriptInterface
        fun deletePhoneFile(path: String): Boolean {
            return PhoneFileManager.deleteItem(path)
        }

        @JavascriptInterface
        fun createPhoneItem(path: String, isDir: Boolean): Boolean {
            return PhoneFileManager.createItem(path, isDir)
        }

        @JavascriptInterface
        fun writePhoneFile(path: String, content: String): Boolean {
            return PhoneFileManager.writeFile(path, content)
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

        @JavascriptInterface
        fun triggerSirenAlarm(enable: Boolean) {
            runOnUiThread {
                this@MainActivity.playSirenAlarm(enable)
            }
        }

        @JavascriptInterface
        fun setFlashlightStrobe(enable: Boolean) {
            runOnUiThread {
                this@MainActivity.setFlashlightStrobe(enable)
            }
        }

        @JavascriptInterface
        fun getDeviceModel(): String = Build.MODEL

        @JavascriptInterface
        fun getBatteryLevel(): Int = this@MainActivity.getBatteryPct()

        @JavascriptInterface
        fun isBatteryCharging(): Boolean = this@MainActivity.isCharging()

        @JavascriptInterface
        fun getFleetDeviceId(): String = this@MainActivity.getUniqueDeviceId()

        @JavascriptInterface
        fun getLastLocation(): String {
            val obj = JSONObject().apply {
                put("lat", lastLatitude)
                put("lng", lastLongitude)
                put("accuracy", lastAccuracy)
                put("speed", lastSpeed)
            }
            return obj.toString()
        }

        @JavascriptInterface
        fun requestLocationPermission() {
            runOnUiThread {
                checkAndRequestPermissions()
            }
        }

        @JavascriptInterface
        fun hasLocationPermission(): Boolean {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }

        @JavascriptInterface
        fun startMobileScreenMirror() {
            this@MainActivity.startMobileScreenMirror()
        }

        @JavascriptInterface
        fun stopMobileScreenMirror() {
            runOnUiThread { this@MainActivity.stopScreenCapture() }
        }

        @JavascriptInterface
        fun isMobileScreenMirrorActive(): Boolean = this@MainActivity.isScreenMirrorActive.get()

        @JavascriptInterface
        fun startNativeCameraStreaming() {
            runOnUiThread { this@MainActivity.toggleNativeCameraStreaming(true) }
        }

        @JavascriptInterface
        fun stopNativeCameraStreaming() {
            runOnUiThread { this@MainActivity.toggleNativeCameraStreaming(false) }
        }

        @JavascriptInterface
        fun isNativeCameraStreaming(): Boolean = this@MainActivity.isNativeCameraStreaming.get()

        @JavascriptInterface
        fun flipNativeCamera() {
            runOnUiThread { this@MainActivity.flipCamera() }
        }

        @JavascriptInterface
        fun startNativeAudioStreaming() {
            runOnUiThread { this@MainActivity.toggleNativeAudioStreaming(true) }
        }

        @JavascriptInterface
        fun stopNativeAudioStreaming() {
            runOnUiThread { this@MainActivity.toggleNativeAudioStreaming(false) }
        }

        @JavascriptInterface
        fun isNativeAudioStreaming(): Boolean = this@MainActivity.isNativeAudioStreaming.get()
    }
}
