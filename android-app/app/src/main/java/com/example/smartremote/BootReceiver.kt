package com.example.smartremote

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log

/**
 * Autostarts SmartRemote when phone boots or when network connectivity (Wi-Fi / Mobile Data) changes.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.i("SmartRemoteBoot", "Received system broadcast action: $action")

        val isBoot = action == Intent.ACTION_BOOT_COMPLETED ||
                action == "android.intent.action.LOCKED_BOOT_COMPLETED" ||
                action == "android.intent.action.QUICKBOOT_POWERON" ||
                action == "com.htc.intent.action.QUICKBOOT_POWERON" ||
                action == Intent.ACTION_MY_PACKAGE_REPLACED

        val isNetwork = action == ConnectivityManager.CONNECTIVITY_ACTION ||
                action == "android.net.wifi.WIFI_STATE_CHANGED" ||
                action == "android.net.wifi.STATE_CHANGE"

        if (isBoot || isNetwork) {
            try {
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    putExtra("autostart_trigger", action)
                }
                context.startActivity(launchIntent)
                Log.i("SmartRemoteBoot", "Successfully dispatched autostart Intent for $action")
            } catch (e: Exception) {
                Log.e("SmartRemoteBoot", "Error launching MainActivity from BootReceiver: ${e.message}")
            }
        }
    }
}
