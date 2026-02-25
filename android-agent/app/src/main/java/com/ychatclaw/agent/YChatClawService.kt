package com.ychatclaw.agent

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class YChatClawService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var webSocketManager: WebSocketManager
    private lateinit var commandExecutor: CommandExecutor

    override fun onCreate() {
        super.onCreate()
        webSocketManager = WebSocketManager(this)
        commandExecutor = CommandExecutor(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        startForeground(YChatClawApplication.NOTIFICATION_ID, notification)

        serviceScope.launch {
            webSocketManager.connect()
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        webSocketManager.disconnect()
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, YChatClawApplication.CHANNEL_ID)
            .setContentTitle("YChatClaw Agent")
            .setContentText("Aguardando comandos...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    fun updateNotification(text: String) {
        val notification = NotificationCompat.Builder(this, YChatClawApplication.CHANNEL_ID)
            .setContentTitle("YChatClaw Agent")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(YChatClawApplication.NOTIFICATION_ID, notification)
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, YChatClawService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, YChatClawService::class.java)
            context.stopService(intent)
        }
    }
}
