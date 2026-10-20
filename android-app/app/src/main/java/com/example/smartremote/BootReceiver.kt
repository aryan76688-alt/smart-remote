package com.example.smartremote

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.util.Log

/**
 * Autostarts SmartRemote background guard service when phone boots or when network connectivity changes.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.i("SmartRemoteBoot", "Received system broadcast action: $action")

        val isBoot = action == Intent.ACTION_BOOT_COMPLETED ||
                action == "android.intent.action.LOCKED_BOOT_COMPLETED" ||
                action == "android.intent.action.QUICKBOOT_POWERON" ||
                action == "com.htc.intent.action.QUICKBOOT_POWERON" ||
                action == Intent.ACTION_MY_PACKAGE_REPLACED ||
                action == Intent.ACTION_USER_PRESENT

        val isNetwork = action == ConnectivityManager.CONNECTIVITY_ACTION ||
                action == "android.net.wifi.WIFI_STATE_CHANGED" ||
                action == "android.net.wifi.STATE_CHANGE"

        if (isBoot || isNetwork) {
            try {
                // 1. Immediately start the 24/7 foreground daemon service
                SmartRemoteDaemonService.start(context)
                Log.i("SmartRemoteBoot", "Successfully started SmartRemoteDaemonService on $action")
            } catch (e: Exception) {
                Log.e("SmartRemoteBoot", "Error starting SmartRemoteDaemonService: ${e.message}")
            }
        }
    }
}
