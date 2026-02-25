package com.ychatclaw.agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Iniciar serviço automaticamente após boot (opcional)
            // YChatClawService.start(context)
        }
    }
}
