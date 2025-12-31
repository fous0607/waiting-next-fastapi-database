package com.waiting.proxy

import android.util.Log
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.io.OutputStream
import java.net.Socket

class PrintProxyServer(port: Int) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        if (session.method == Method.OPTIONS) {
            val response = newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, "")
            addCorsHeaders(response)
            return response
        }

        if (session.uri == "/print" && session.method == Method.POST) {
            return try {
                val map = HashMap<String, String>()
                session.parseBody(map)
                val jsonBody = map["postData"] ?: return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "Missing body")
                
                Log.d("PrintProxy", "Received Body: $jsonBody")
                val json = JSONObject(jsonBody)
                
                val ip = json.getString("ip")
                val port = json.optInt("port", 9100)
                val dataArray = json.getJSONArray("data")
                
                val bytes = ByteArray(dataArray.length())
                for (i in 0 until dataArray.length()) {
                    bytes[i] = dataArray.getInt(i).toByte()
                }

                sendToPrinter(ip, port, bytes)
                
                val response = newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"success\"}")
                addCorsHeaders(response)
                return response
                
            } catch (e: Exception) {
                Log.e("PrintProxy", "Error processing request", e)
                val response = newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Error: ${e.message}")
                addCorsHeaders(response)
                return response
            }
        }
        
        if (session.uri == "/") {
             return newFixedLengthResponse("Waiting Print Proxy is Running!")
        }

        return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not Found")
    }

    private fun sendToPrinter(ip: String, port: Int, data: ByteArray) {
        Log.d("PrintProxy", "Connecting to Printer $ip:$port")
        Socket(ip, port).use { socket ->
            val out: OutputStream = socket.getOutputStream()
            out.write(data)
            out.flush()
        }
        Log.d("PrintProxy", "Data sent successfully")
    }

    private fun addCorsHeaders(response: Response) {
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        response.addHeader("Access-Control-Allow-Headers", "*")
    }
}
