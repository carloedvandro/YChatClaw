package com.ychatclaw.agent

import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.ValueCallback
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.ByteArrayOutputStream

class WebViewActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
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
            userAgentString = "Mozilla/5.0 (Linux; Android ${android.os.Build.VERSION.RELEASE}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        }

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                currentUrl = url ?: ""
                currentTitle = view?.title ?: ""
            }
        }

        // Registrar interface JavaScript para comunicação
        webView.addJavascriptInterface(WebAutomationBridge(), "YChatClaw")
        
        webView.loadUrl(url)

        // Registrar esta instância para acesso global
        activeInstance = this
    }

    override fun onDestroy() {
        super.onDestroy()
        if (activeInstance == this) activeInstance = null
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    // === Métodos de automação acessíveis remotamente ===

    fun navigateTo(url: String, callback: (JSONObject) -> Unit) {
        handler.post {
            webView.loadUrl(url)
            // Esperar carregar
            handler.postDelayed({
                callback(JSONObject().apply {
                    put("success", true)
                    put("url", webView.url ?: url)
                    put("title", webView.title ?: "")
                })
            }, 3000)
        }
    }

    fun clickElement(selector: String, callback: (JSONObject) -> Unit) {
        handler.post {
            val js = """
                (function() {
                    var el = document.querySelector('$selector');
                    if (el) { el.click(); return JSON.stringify({success:true, tag:el.tagName}); }
                    return JSON.stringify({success:false, error:'Elemento nao encontrado: $selector'});
                })()
            """.trimIndent()
            webView.evaluateJavascript(js) { result ->
                try {
                    val clean = result?.replace("\\\"", "\"")?.trim('"') ?: "{}"
                    callback(JSONObject(clean))
                } catch (e: Exception) {
                    callback(JSONObject().put("success", false).put("error", e.message))
                }
            }
        }
    }

    fun typeText(selector: String, text: String, callback: (JSONObject) -> Unit) {
        handler.post {
            val escapedText = text.replace("'", "\\'").replace("\"", "\\\"")
            val js = """
                (function() {
                    var el = document.querySelector('$selector');
                    if (el) {
                        el.focus();
                        el.value = '$escapedText';
                        el.dispatchEvent(new Event('input', {bubbles:true}));
                        el.dispatchEvent(new Event('change', {bubbles:true}));
                        return JSON.stringify({success:true});
                    }
                    return JSON.stringify({success:false, error:'Campo nao encontrado: $selector'});
                })()
            """.trimIndent()
            webView.evaluateJavascript(js) { result ->
                try {
                    val clean = result?.replace("\\\"", "\"")?.trim('"') ?: "{}"
                    callback(JSONObject(clean))
                } catch (e: Exception) {
                    callback(JSONObject().put("success", false).put("error", e.message))
                }
            }
        }
    }

    fun getPageContent(callback: (JSONObject) -> Unit) {
        handler.post {
            val js = """
                (function() {
                    var inputs = Array.from(document.querySelectorAll('input,textarea,select')).slice(0,20).map(function(i){
                        return {type:i.type||i.tagName.toLowerCase(),name:i.name||'',id:i.id||'',placeholder:i.placeholder||'',value:(i.value||'').substring(0,100)};
                    });
                    var buttons = Array.from(document.querySelectorAll('button,input[type=submit]')).slice(0,20).map(function(b){
                        return {text:(b.innerText||b.value||'').trim().substring(0,100),id:b.id||'',className:(b.className||'').substring(0,50)};
                    });
                    var links = Array.from(document.querySelectorAll('a[href]')).slice(0,20).map(function(a){
                        return {text:(a.innerText||'').trim().substring(0,80),href:a.href||''};
                    });
                    var checkboxes = Array.from(document.querySelectorAll('input[type=checkbox]')).slice(0,20).map(function(c){
                        return {name:c.name||'',id:c.id||'',checked:c.checked,label:(c.closest('label')||{}).innerText||''};
                    });
                    return JSON.stringify({
                        success:true, title:document.title, url:location.href,
                        text:(document.body.innerText||'').substring(0,2000),
                        inputs:inputs, buttons:buttons, links:links, checkboxes:checkboxes
                    });
                })()
            """.trimIndent()
            webView.evaluateJavascript(js) { result ->
                try {
                    val clean = result?.replace("\\\"", "\"")?.trim('"')?.replace("\\n", "\n") ?: "{}"
                    callback(JSONObject(clean))
                } catch (e: Exception) {
                    callback(JSONObject().put("success", false).put("error", e.message))
                }
            }
        }
    }

    fun captureScreenshot(callback: (JSONObject) -> Unit) {
        handler.post {
            try {
                val bitmap = Bitmap.createBitmap(webView.width, webView.height, Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(bitmap)
                webView.draw(canvas)
                val stream = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, 70, stream)
                val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
                bitmap.recycle()
                callback(JSONObject().apply {
                    put("success", true)
                    put("screenshot", "data:image/jpeg;base64,$base64")
                })
            } catch (e: Exception) {
                callback(JSONObject().put("success", false).put("error", e.message))
            }
        }
    }

    fun executeJS(script: String, callback: (JSONObject) -> Unit) {
        handler.post {
            webView.evaluateJavascript(script) { result ->
                callback(JSONObject().apply {
                    put("success", true)
                    put("result", result ?: "null")
                })
            }
        }
    }

    fun selectOption(selector: String, value: String, callback: (JSONObject) -> Unit) {
        handler.post {
            val js = """
                (function() {
                    var el = document.querySelector('$selector');
                    if (el && el.tagName === 'SELECT') {
                        el.value = '$value';
                        el.dispatchEvent(new Event('change', {bubbles:true}));
                        return JSON.stringify({success:true, value:'$value'});
                    }
                    return JSON.stringify({success:false, error:'Select nao encontrado: $selector'});
                })()
            """.trimIndent()
            webView.evaluateJavascript(js) { result ->
                try {
                    val clean = result?.replace("\\\"", "\"")?.trim('"') ?: "{}"
                    callback(JSONObject(clean))
                } catch (e: Exception) {
                    callback(JSONObject().put("success", false).put("error", e.message))
                }
            }
        }
    }

    fun toggleCheckbox(selector: String, checked: Boolean, callback: (JSONObject) -> Unit) {
        handler.post {
            val js = """
                (function() {
                    var el = document.querySelector('$selector');
                    if (el && el.type === 'checkbox') {
                        if (el.checked !== $checked) el.click();
                        return JSON.stringify({success:true, checked:el.checked});
                    }
                    return JSON.stringify({success:false, error:'Checkbox nao encontrado: $selector'});
                })()
            """.trimIndent()
            webView.evaluateJavascript(js) { result ->
                try {
                    val clean = result?.replace("\\\"", "\"")?.trim('"') ?: "{}"
                    callback(JSONObject(clean))
                } catch (e: Exception) {
                    callback(JSONObject().put("success", false).put("error", e.message))
                }
            }
        }
    }

    // Bridge para JavaScript chamar Kotlin
    inner class WebAutomationBridge {
        @JavascriptInterface
        fun onEvent(eventJson: String) {
            println("WebView Event: $eventJson")
        }
    }

    companion object {
        var activeInstance: WebViewActivity? = null
        var currentUrl: String = ""
        var currentTitle: String = ""
    }
}
