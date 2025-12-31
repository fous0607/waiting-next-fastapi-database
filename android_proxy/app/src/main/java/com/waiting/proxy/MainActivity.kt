package com.waiting.proxy

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Bundle
import android.text.format.Formatter
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private var server: PrintProxyServer? = null
    private lateinit var statusText: TextView
    private lateinit var ipText: TextView
    private lateinit var btnToggle: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.text_status)
        ipText = findViewById(R.id.text_ip)
        btnToggle = findViewById(R.id.btn_toggle)

        btnToggle.setOnClickListener {
            if (server != null && server!!.isAlive) {
                stopServer()
            } else {
                startServer()
            }
        }
        
        // Auto-start server on launch
        startServer()
    }

    private fun startServer() {
        try {
            server = PrintProxyServer(8000)
            server?.start()
            statusText.text = "Status: RUNNING"
            statusText.setTextColor(getColor(android.R.color.holo_green_dark))
            btnToggle.text = "STOP SERVER"
            
            val ip = getLocalIpAddress()
            ipText.text = "Proxy IP: $ip"
            
        } catch (e: IOException) {
            e.printStackTrace()
            statusText.text = "Status: ERROR ${e.message}"
            statusText.setTextColor(getColor(android.R.color.holo_red_dark))
        }
    }

    private fun stopServer() {
        server?.stop()
        statusText.text = "Status: STOPPED"
        statusText.setTextColor(getColor(android.R.color.holo_red_dark))
        btnToggle.text = "START SERVER"
    }

    private fun getLocalIpAddress(): String {
        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        return Formatter.formatIpAddress(wifiManager.connectionInfo.ipAddress)
    }

    override fun onDestroy() {
        super.onDestroy()
        server?.stop()
    }
}
