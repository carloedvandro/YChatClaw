package com.ychatclaw.agent

import android.content.Context
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

class WebSocketManager(private val context: Context) {

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()
    
    private val deviceIdManager = DeviceIdManager(context)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 10
    private val reconnectDelayMs = 5000L

    fun connect() {
        val serverUrl = getServerUrl()
        val request = Request.Builder().url(serverUrl).build()
        
        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                println("WebSocket conectado")
                reconnectAttempts = 0
                registerDevice()
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                println("WebSocket fechando: $reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                println("WebSocket fechado: $reason")
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                println("WebSocket erro: ${t.message}")
                scheduleReconnect()
            }
        }

        webSocket = client.newWebSocket(request, listener)
    }

    fun disconnect() {
        webSocket?.close(1000, "Serviço encerrado")
        scope.cancel()
    }

    private fun registerDevice() {
        val uuid = deviceIdManager.getOrCreateUuid()
        val deviceName = android.os.Build.MODEL
        
        val message = JSONObject().apply {
            put("type", "register")
            put("uuid", uuid)
            put("name", deviceName)
            put("metadata", JSONObject().apply {
                put("model", android.os.Build.MODEL)
                put("manufacturer", android.os.Build.MANUFACTURER)
                put("android_version", android.os.Build.VERSION.RELEASE)
            })
        }

        webSocket?.send(message.toString())
    }

    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val type = json.getString("type")

            when (type) {
                "registered" -> {
                    println("Dispositivo registrado: ${json.getString("deviceId")}")
                }
                "command" -> {
                    val commandId = json.getString("commandId")
                    val commandName = json.getString("commandName")
                    val params = json.optJSONObject("params") ?: JSONObject()
                    executeCommand(commandId, commandName, params)
                }
                "heartbeat_ack" -> {
                    // Heartbeat confirmado
                }
                "error" -> {
                    println("Erro: ${json.getString("message")}")
                }
            }
        } catch (e: Exception) {
            println("Erro ao processar mensagem: ${e.message}")
        }
    }

    private fun executeCommand(commandId: String, commandName: String, params: JSONObject) {
        scope.launch {
            val executor = CommandExecutor(context)
            val result = executor.execute(commandName, params)
            
            val response = JSONObject().apply {
                put("type", "command_result")
                put("commandId", commandId)
                if (result.success) {
                    put("result", result.data)
                } else {
                    put("error", result.error)
                }
            }
            
            webSocket?.send(response.toString())
        }
    }

    private fun startHeartbeat() {
        scope.launch {
            while (isActive) {
                delay(30000) // 30 segundos
                val heartbeat = JSONObject().apply {
                    put("type", "heartbeat")
                    put("deviceId", deviceIdManager.getOrCreateUuid())
                }
                webSocket?.send(heartbeat.toString())
            }
        }
    }

    private fun scheduleReconnect() {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++
            println("Reconectando em ${reconnectDelayMs}ms (tentativa $reconnectAttempts/$maxReconnectAttempts)")
            
            scope.launch {
                delay(reconnectDelayMs)
                connect()
            }
        } else {
            println("Máximo de tentativas de reconexão atingido")
        }
    }

    private fun getServerUrl(): String {
        val prefs = context.getSharedPreferences("ychatclaw", Context.MODE_PRIVATE)
        return prefs.getString("server_url", "ws://SEU_SERVIDOR:3001") ?: "ws://SEU_SERVIDOR:3001"
    }

    fun setServerUrl(url: String) {
        val prefs = context.getSharedPreferences("ychatclaw", Context.MODE_PRIVATE)
        prefs.edit().putString("server_url", url).apply()
    }
}

class DeviceIdManager(private val context: Context) {
    
    fun getOrCreateUuid(): String {
        val prefs = context.getSharedPreferences("ychatclaw", Context.MODE_PRIVATE)
        var uuid = prefs.getString("device_uuid", null)
        
        if (uuid == null) {
            uuid = UUID.randomUUID().toString()
            prefs.edit().putString("device_uuid", uuid).apply()
        }
        
        return uuid
    }
}

data class CommandResult(
    val success: Boolean,
    val data: JSONObject? = null,
    val error: String? = null
)
