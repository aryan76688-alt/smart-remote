package com.example.smartremote

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.ImageReader
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * SmartRemoteDaemonService: Persistent Autonomous Background Guard Service.
 * Runs 24/7 in the background with WakeLock and Foreground Notification.
 * Keeps GPS tracking, 110dB emergency siren, torch, camera snapshots,
 * and remote phone file management active even when the PC/laptop is turned OFF!
 */
class SmartRemoteDaemonService : Service(), LocationListener {

    companion object {
        const val TAG = "SmartRemoteDaemon"
        const val CHANNEL_ID = "smart_remote_guard_channel"
        const val NOTIFICATION_ID = 9110
        const val ACTION_START = "com.example.smartremote.action.START_DAEMON"
        const val ACTION_STOP = "com.example.smartremote.action.STOP_DAEMON"

        val isRunning = AtomicBoolean(false)
        val isSirenActive = AtomicBoolean(false)
        val isTorchActive = AtomicBoolean(false)
        var lastKnownServerUrl: String = "https://smart-remote.aryan76688.workers.dev"

        fun start(context: Context) {
            val intent = Intent(context, SmartRemoteDaemonService::class.java).apply {
                action = ACTION_START
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start daemon service: ${e.message}")
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, SmartRemoteDaemonService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private val executor = Executors.newFixedThreadPool(4)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var locationManager: LocationManager? = null
    private var lastLatitude: Double = 23.168191
    private var lastLongitude: Double = 72.822328
    private var lastAccuracy: Float = 10.0f
    private var lastSpeed: Float = 0.0f
    private var lastHeading: Float = 0.0f

    private var cameraManager: CameraManager? = null
    private var rearCameraId: String? = null
    private var frontCameraId: String? = null

    private var sirenAudioTrack: AudioTrack? = null
    private var sirenMediaPlayer: MediaPlayer? = null
    private val sirenThreadRunning = AtomicBoolean(false)

    private val TAILSCALE_DEFAULT_URL = "http://100.69.194.11:7070"
    private val CLOUDFLARE_WORKER_URL = "https://smart-remote.aryan76688.workers.dev"
    private val CLOUDFLARE_CUSTOM_DOMAIN_URL = "https://remote.shreeji7.com"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Creating SmartRemoteDaemonService...")
        createNotificationChannel()
        acquireLocks()
        initHardware()
        initLocation()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = createNotification("Guarding mobile services • Cloud Edge Ready")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            var fType = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    fType = fType or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                } catch (_: Exception) {}
            }
            startForeground(NOTIFICATION_ID, notification, fType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        if (isRunning.compareAndSet(false, true)) {
            startAutonomousWorkerLoop()
        }

        return START_STICKY
    }

    private fun acquireLocks() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SmartRemote:DaemonWakeLock")?.apply {
                setReferenceCounted(false)
                acquire(10 * 365 * 24 * 3600 * 1000L) // Long term
            }

            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            wifiLock = wm?.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "SmartRemote:DaemonWifiLock")?.apply {
                setReferenceCounted(false)
                acquire()
            }
            Log.i(TAG, "WakeLock and WifiLock acquired successfully.")
        } catch (e: Exception) {
            Log.w(TAG, "Could not acquire locks: ${e.message}")
        }
    }

    private fun initHardware() {
        try {
            cameraManager = getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            cameraManager?.cameraIdList?.forEach { id ->
                val chars = cameraManager?.getCameraCharacteristics(id)
                val facing = chars?.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_BACK && rearCameraId == null) {
                    rearCameraId = id
                } else if (facing == CameraCharacteristics.LENS_FACING_FRONT && frontCameraId == null) {
                    frontCameraId = id
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Hardware init error: ${e.message}")
        }
    }

    private fun initLocation() {
        try {
            locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            locationManager?.let { lm ->
                val providers = lm.getProviders(true)
                if (providers.contains(LocationManager.GPS_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 4000L, 2.0f, this, Looper.getMainLooper())
                }
                if (providers.contains(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 4000L, 2.0f, this, Looper.getMainLooper())
                }
                // Read last known
                val lastGps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                val lastNet = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                val best = lastGps ?: lastNet
                best?.let { onLocationChanged(it) }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Location init error: ${e.message}")
        }
    }

    override fun onLocationChanged(loc: Location) {
        lastLatitude = loc.latitude
        lastLongitude = loc.longitude
        lastAccuracy = loc.accuracy
        lastSpeed = loc.speed
        lastHeading = loc.bearing
    }

    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    // ──────────────────────────────────────────────────────────────────────────
    // AUTONOMOUS BACKGROUND TELEMETRY & COMMAND WORKER
    // ──────────────────────────────────────────────────────────────────────────
    private fun startAutonomousWorkerLoop() {
        executor.execute {
            Log.i(TAG, "Autonomous background worker loop started.")
            var failCount = 0

            while (isRunning.get()) {
                try {
                    // 1. Resolve active server (Probe Tailscale -> Wi-Fi -> Workers.dev)
                    val activeServer = resolveBestServer()
                    lastKnownServerUrl = activeServer

                    // 2. Report fleet telemetry & fetch actions
                    reportTelemetry(activeServer)

                    // 3. Poll and process phone file tasks
                    pollFileTasks(activeServer)

                    failCount = 0
                } catch (e: Exception) {
                    failCount++
                    Log.w(TAG, "Worker cycle warning (fails=$failCount): ${e.message}")
                }

                try {
                    Thread.sleep(2500)
                } catch (_: InterruptedException) {
                    break
                }
            }
            Log.i(TAG, "Autonomous background worker loop finished.")
        }
    }

    private fun resolveBestServer(): String {
        val candidates = ArrayList<String>()

        // 1. SharedPreferences saved URL
        val prefs = getSharedPreferences("smart_remote_prefs", Context.MODE_PRIVATE)
        val saved = prefs.getString("server_url", null)
        if (!saved.isNullOrBlank()) candidates.add(saved)

        // 2. Cloudflare Worker Edge (Always up even if laptop is off!)
        candidates.add(CLOUDFLARE_WORKER_URL)

        // 3. Tailscale IP (if laptop is on Tailscale)
        candidates.add(TAILSCALE_DEFAULT_URL)

        // 4. Custom domain
        candidates.add(CLOUDFLARE_CUSTOM_DOMAIN_URL)

        // Parallel fast ping (1500ms max)
        for (urlStr in candidates.distinct()) {
            try {
                val pingUrl = "${urlStr.trimEnd('/')}/api/system/info"
                val conn = (URL(pingUrl).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 1200
                    readTimeout = 1200
                    requestMethod = "GET"
                    instanceFollowRedirects = true
                }
                val code = conn.responseCode
                conn.disconnect()
                if (code in 200..299) {
                    return urlStr
                }
            } catch (_: Exception) {}
        }

        // Default fallback to Cloudflare Worker edge
        return CLOUDFLARE_WORKER_URL
    }

    private fun reportTelemetry(server: String) {
        val url = URL("${server.trimEnd('/')}/api/tracking/device/update")
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
            put("daemon_active", true)
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
                handleRemoteActions(server, actions)
            }
        }
        conn.disconnect()
    }

    private fun handleRemoteActions(server: String, actions: JSONObject) {
        // 1. Emergency Siren
        val shouldSiren = actions.optBoolean("siren", false)
        if (shouldSiren != isSirenActive.get()) {
            setSirenState(shouldSiren)
        }

        // 2. Torch / Flashlight Strobe
        val shouldStrobe = actions.optBoolean("strobe", false)
        if (shouldStrobe != isTorchActive.get()) {
            setTorchState(shouldStrobe)
        }

        // 3. Camera Snapshot
        val shouldCam = actions.optBoolean("camera", false)
        if (shouldCam) {
            captureBackgroundSnapshot(server)
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 🔊 110dB EMERGENCY SIREN IN BACKGROUND
    // ──────────────────────────────────────────────────────────────────────────
    private fun setSirenState(enable: Boolean) {
        isSirenActive.set(enable)
        if (enable) {
            if (sirenThreadRunning.compareAndSet(false, true)) {
                executor.execute {
                    runSirenSoundLoop()
                }
            }
        } else {
            sirenThreadRunning.set(false)
            try {
                sirenAudioTrack?.stop()
                sirenAudioTrack?.release()
                sirenAudioTrack = null
            } catch (_: Exception) {}
            try {
                sirenMediaPlayer?.stop()
                sirenMediaPlayer?.release()
                sirenMediaPlayer = null
            } catch (_: Exception) {}
        }
    }

    private fun runSirenSoundLoop() {
        val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val maxVol = am?.getStreamMaxVolume(AudioManager.STREAM_ALARM) ?: 15
        am?.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0)
        am?.setStreamVolume(AudioManager.STREAM_MUSIC, maxVol, 0)

        // Try playing system high-priority alarm sound
        try {
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            sirenMediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alarmUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                setVolume(1.0f, 1.0f)
                prepare()
                start()
            }
        } catch (_: Exception) {}

        // Parallel synthesizer wave generator (sweeps 700Hz - 1800Hz police siren)
        try {
            val sampleRate = 44100
            val buffSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
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
                .setBufferSizeInBytes(buffSize)
                .build()

            sirenAudioTrack?.play()
            val samples = ShortArray(1024)
            var phase = 0.0
            var freq = 800.0
            var ascending = true

            while (sirenThreadRunning.get() && isSirenActive.get()) {
                if (ascending) {
                    freq += 12.0
                    if (freq >= 1900.0) ascending = false
                } else {
                    freq -= 12.0
                    if (freq <= 700.0) ascending = true
                }

                for (i in samples.indices) {
                    phase += 2.0 * Math.PI * freq / sampleRate
                    if (phase > 2.0 * Math.PI) phase -= 2.0 * Math.PI
                    samples[i] = (Math.sin(phase) * 32767.0).toInt().toShort()
                }
                sirenAudioTrack?.write(samples, 0, samples.size)
            }
        } catch (_: Exception) {}
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 🔦 TORCH / FLASHLIGHT CONTROL
    // ──────────────────────────────────────────────────────────────────────────
    private fun setTorchState(enable: Boolean) {
        isTorchActive.set(enable)
        try {
            rearCameraId?.let { cid ->
                cameraManager?.setTorchMode(cid, enable)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Torch toggle error: ${e.message}")
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 📸 BACKGROUND CAMERA SNAPSHOT (WITHOUT UI)
    // ──────────────────────────────────────────────────────────────────────────
    private fun captureBackgroundSnapshot(server: String) {
        val cid = rearCameraId ?: frontCameraId ?: return
        try {
            val reader = ImageReader.newInstance(1280, 720, ImageFormat.JPEG, 2)
            reader.setOnImageAvailableListener({ ir ->
                val image = ir?.acquireLatestImage()
                if (image != null) {
                    try {
                        val planes = image.planes
                        val buffer = planes[0].buffer
                        val bytes = ByteArray(buffer.remaining())
                        buffer.get(bytes)
                        image.close()
                        reader.close()

                        // Upload JPEG to Edge server
                        executor.execute {
                            uploadCameraFrame(server, bytes)
                        }
                    } catch (_: Exception) {
                        image.close()
                    }
                }
            }, mainHandler)

            cameraManager?.openCamera(cid, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    try {
                        val builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
                            addTarget(reader.surface)
                            set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                            set(CaptureRequest.JPEG_QUALITY, 85.toByte())
                        }
                        camera.createCaptureSession(listOf(reader.surface), object : CameraCaptureSession.StateCallback() {
                            override fun onConfigured(session: CameraCaptureSession) {
                                try {
                                    session.capture(builder.build(), object : CameraCaptureSession.CaptureCallback() {
                                        override fun onCaptureCompleted(s: CameraCaptureSession, r: CaptureRequest, cr: TotalCaptureResult) {
                                            camera.close()
                                        }
                                    }, mainHandler)
                                } catch (_: Exception) {
                                    camera.close()
                                }
                            }
                            override fun onConfigureFailed(session: CameraCaptureSession) {
                                camera.close()
                            }
                        }, mainHandler)
                    } catch (_: Exception) {
                        camera.close()
                    }
                }
                override fun onDisconnected(camera: CameraDevice) { camera.close() }
                override fun onError(camera: CameraDevice, error: Int) { camera.close() }
            }, mainHandler)
        } catch (e: Exception) {
            Log.w(TAG, "Background snapshot error: ${e.message}")
        }
    }

    private fun uploadCameraFrame(server: String, jpegBytes: ByteArray) {
        try {
            val url = URL("${server.trimEnd('/')}/api/camera/phone/frame")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 4000
                readTimeout = 4000
                doOutput = true
                setRequestProperty("Content-Type", "image/jpeg")
                setRequestProperty("Content-Length", jpegBytes.size.toString())
            }
            conn.outputStream.use { it.write(jpegBytes) }
            val code = conn.responseCode
            conn.disconnect()
            Log.i(TAG, "Uploaded camera snapshot ($code), bytes: ${jpegBytes.size}")
        } catch (e: Exception) {
            Log.w(TAG, "Snapshot upload failed: ${e.message}")
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 📁 REMOTE PHONE FILE TASKS (BACKGROUND)
    // ──────────────────────────────────────────────────────────────────────────
    private fun pollFileTasks(server: String) {
        try {
            val url = URL("${server.trimEnd('/')}/api/phone-files/poll?device_id=oppo")
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
                        executor.execute { processPhoneFileTask(server, task) }
                    }
                }
            }
            conn.disconnect()
        } catch (_: Exception) {}
    }

    private fun processPhoneFileTask(server: String, task: JSONObject) {
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
                "download_file" -> {
                    val path = payload.optString("path", "")
                    val file = File(path)
                    if (file.exists()) {
                        val uploadUrl = URL("${server.trimEnd('/')}/api/phone-files/upload-file/$taskId")
                        val conn = (uploadUrl.openConnection() as HttpURLConnection).apply {
                            requestMethod = "POST"
                            doOutput = true
                            connectTimeout = 10000
                            readTimeout = 10000
                            setRequestProperty("Content-Type", "application/octet-stream")
                            setRequestProperty("Content-Length", file.length().toString())
                        }
                        FileInputStream(file).use { fis ->
                            conn.outputStream.use { os ->
                                fis.copyTo(os)
                            }
                        }
                        conn.responseCode
                        conn.disconnect()
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "File task execution error: ${e.message}")
        }
    }

    private fun sendTaskResult(server: String, taskId: String, resultData: JSONObject) {
        try {
            val url = URL("${server.trimEnd('/')}/api/phone-files/result/$taskId")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 4000
                readTimeout = 4000
                setRequestProperty("Content-Type", "application/json")
            }
            conn.outputStream.use { os ->
                os.write(resultData.toString().toByteArray())
            }
            conn.responseCode
            conn.disconnect()
        } catch (_: Exception) {}
    }

    // ──────────────────────────────────────────────────────────────────────────
    // NOTIFICATIONS & RESTART HANDLING
    // ──────────────────────────────────────────────────────────────────────────
    private fun createNotification(subtext: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Smart Remote Guard Active")
            .setContentText(subtext)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Smart Remote Background Guard",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps phone GPS tracking, 110dB siren, and file manager active 24/7"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.i(TAG, "Task removed (app swiped away). Self-resurrecting daemon...")
        val restartIntent = Intent(applicationContext, SmartRemoteDaemonService::class.java)
        val pendingIntent = PendingIntent.getService(
            applicationContext,
            1,
            restartIntent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        alarmManager?.set(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 1000,
            pendingIntent
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning.set(false)
        setSirenState(false)
        setTorchState(false)
        wakeLock?.let { if (it.isHeld) it.release() }
        wifiLock?.let { if (it.isHeld) it.release() }
        locationManager?.removeUpdates(this)
        Log.i(TAG, "SmartRemoteDaemonService destroyed.")
    }

    private fun getBatteryPct(): Int {
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        return bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 80
    }

    private fun isCharging(): Boolean {
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val status = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_STATUS) ?: -1
        return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    }

    private fun getUniqueDeviceId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "oppo-phone"
    }
}
