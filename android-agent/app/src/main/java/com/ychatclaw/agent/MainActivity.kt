package com.ychatclaw.agent

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var serverUrlInput: EditText
    private lateinit var uuidText: TextView
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
            YChatClawService.start(this)
            updateStatus("Serviço iniciado")
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
        val serverUrl = prefs.getString("server_url", "ws://SEU_SERVIDOR:3001")
        val uuid = DeviceIdManager(this).getOrCreateUuid()

        serverUrlInput.setText(serverUrl)
        uuidText.text = "UUID: $uuid"
    }

    private fun saveSettings() {
        val prefs = getSharedPreferences("ychatclaw", MODE_PRIVATE)
        prefs.edit()
            .putString("server_url", serverUrlInput.text.toString())
            .apply()
    }

    private fun updateStatus(status: String) {
        statusText.text = "Status: $status"
    }
}
