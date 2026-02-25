package com.ychatclaw.agent

import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class WebViewActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val webView = WebView(this)
        setContentView(webView)

        val url = intent.getStringExtra("url") ?: "about:blank"
        val enableJs = intent.getBooleanExtra("enable_js", true)
        val enableLocalStorage = intent.getBooleanExtra("enable_local_storage", true)

        webView.settings.apply {
            javaScriptEnabled = enableJs
            domStorageEnabled = enableLocalStorage
            databaseEnabled = enableLocalStorage
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
        }

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = WebViewClient()
        
        webView.loadUrl(url)
    }

    override fun onBackPressed() {
        val webView = findViewById<WebView>(android.R.id.content).getChildAt(0) as? WebView
        if (webView?.canGoBack() == true) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
