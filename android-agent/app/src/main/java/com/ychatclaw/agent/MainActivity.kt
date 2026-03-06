package com.ychatclaw.agent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var serverUrlInput: EditText
    private lateinit var uuidText: TextView
    private lateinit var statusText: TextView

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            startService()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        serverUrlInput = findViewById(R.id.serverUrlInput)
        uuidText = findViewById(R.id.uuidText)
        statusText = findViewById(R.id.statusText)

        val startButton: Button = findViewById(R.id.startButton)
        val stopButton: Button = findViewById(R.id.stopButton)
        val saveButton: Button = findViewById(R.id.saveButton)

        // Carregar configurações
        loadSettings()

        startButton.setOnClickListener {
            saveSettings()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                startService()
            }
        }

        stopButton.setOnClickListener {
            YChatClawService.stop(this)
            updateStatus("Serviço parado")
        }

        saveButton.setOnClickListener {
            saveSettings()
            Toast.makeText(this, "Configurações salvas", Toast.LENGTH_SHORT).show()
        }
    }

    private fun loadSettings() {
        val prefs = getSharedPreferences("ychatclaw", MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "ws://167.86.84.197:3001")
        val uuid = DeviceIdManager(this).getOrCreateUuid()

        serverUrlInput.setText(serverUrl)
        uuidText.text = "UUID: $uuid"

        // Mostrar info do dispositivo
        val deviceInfo = findViewById<TextView>(R.id.deviceInfoText)
        deviceInfo.text = "Modelo: ${android.os.Build.MODEL}\n" +
                "Fabricante: ${android.os.Build.MANUFACTURER}\n" +
                "Android: ${android.os.Build.VERSION.RELEASE} (SDK ${android.os.Build.VERSION.SDK_INT})\n" +
                "Device ID: $uuid"
    }

    private fun saveSettings() {
        val prefs = getSharedPreferences("ychatclaw", MODE_PRIVATE)
        prefs.edit()
            .putString("server_url", serverUrlInput.text.toString())
            .apply()
    }

    private fun startService() {
        YChatClawService.start(this)
        updateStatus("Serviço iniciado")
    }

    private fun updateStatus(status: String) {
        statusText.text = "Status: $status"
    }
}
