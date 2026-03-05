package com.ychatclaw.agent

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import kotlin.coroutines.resume

class CommandExecutor(private val context: Context) {

    suspend fun execute(commandName: String, params: JSONObject): CommandResult {
        return when (commandName) {
            // Comandos básicos
            "open_app" -> openApp(params)
            "open_url" -> openUrl(params)
            "open_webview" -> openWebView(params)
            "play_video" -> playVideo(params)
            "display_image" -> displayImage(params)
            "slideshow" -> slideshow(params)
            "get_device_info" -> getDeviceInfo()

            // Comandos de automação web via WebView
            "web_navigate" -> webNavigate(params)
            "web_click" -> webClick(params)
            "web_type" -> webType(params)
            "web_screenshot" -> webScreenshot()
            "web_get_content" -> webGetContent()
            "web_select" -> webSelect(params)
            "web_checkbox" -> webCheckbox(params)
            "web_execute_js" -> webExecuteJs(params)
            "web_login" -> webLogin(params)

            else -> CommandResult(false, error = "Comando desconhecido: $commandName")
        }
    }

    // === Comandos básicos ===

    private fun openApp(params: JSONObject): CommandResult {
        val packageName = params.optString("package_name")
        if (packageName.isEmpty()) {
            return CommandResult(false, error = "package_name é obrigatório")
        }

        val intent = context.packageManager.getLaunchIntentForPackage(packageName)
        return if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            CommandResult(true, data = JSONObject().put("package", packageName))
        } else {
            CommandResult(false, error = "Aplicativo não encontrado: $packageName")
        }
    }

    private fun openUrl(params: JSONObject): CommandResult {
        val url = params.optString("url")
        if (url.isEmpty()) {
            return CommandResult(false, error = "url é obrigatório")
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)

        return CommandResult(true, data = JSONObject().put("url", url))
    }

    private fun openWebView(params: JSONObject): CommandResult {
        val url = params.optString("url")
        if (url.isEmpty()) {
            return CommandResult(false, error = "url é obrigatório")
        }

        val intent = Intent(context, WebViewActivity::class.java).apply {
            putExtra("url", url)
            putExtra("enable_js", params.optBoolean("enable_js", true))
            putExtra("enable_local_storage", params.optBoolean("enable_local_storage", true))
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)

        return CommandResult(true, data = JSONObject().put("url", url))
    }

    private fun playVideo(params: JSONObject): CommandResult {
        val videoUrl = params.optString("video_url")
        if (videoUrl.isEmpty()) {
            return CommandResult(false, error = "video_url é obrigatório")
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse(videoUrl), "video/*")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)

        return CommandResult(true, data = JSONObject().put("video_url", videoUrl))
    }

    private fun displayImage(params: JSONObject): CommandResult {
        val imageUrl = params.optString("image_url")
        if (imageUrl.isEmpty()) {
            return CommandResult(false, error = "image_url é obrigatório")
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse(imageUrl), "image/*")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)

        return CommandResult(true, data = JSONObject().put("image_url", imageUrl))
    }

    private fun slideshow(params: JSONObject): CommandResult {
        val images = params.optJSONArray("images")
        if (images == null || images.length() == 0) {
            return CommandResult(false, error = "images é obrigatório")
        }

        val intent = Intent(context, SlideshowActivity::class.java).apply {
            putExtra("images", images.toString())
            putExtra("interval", params.optInt("interval", 5000))
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)

        return CommandResult(true, data = JSONObject().put("count", images.length()))
    }

    private fun getDeviceInfo(): CommandResult {
        val info = JSONObject().apply {
            put("model", android.os.Build.MODEL)
            put("manufacturer", android.os.Build.MANUFACTURER)
            put("android_version", android.os.Build.VERSION.RELEASE)
            put("sdk_int", android.os.Build.VERSION.SDK_INT)
            put("device", android.os.Build.DEVICE)
            put("product", android.os.Build.PRODUCT)
            put("webview_active", WebViewActivity.activeInstance != null)
            put("webview_url", WebViewActivity.currentUrl)
            put("webview_title", WebViewActivity.currentTitle)
        }
        return CommandResult(true, data = info)
    }

    // === Comandos de automação web via WebView ===

    private fun ensureWebView(): WebViewActivity? {
        return WebViewActivity.activeInstance
    }

    private suspend fun webNavigate(params: JSONObject): CommandResult {
        val url = params.optString("url")
        if (url.isEmpty()) return CommandResult(false, error = "url é obrigatório")

        val wv = ensureWebView()
        if (wv == null) {
            // Abrir WebView primeiro
            openWebView(JSONObject().put("url", url))
            return CommandResult(true, data = JSONObject().put("url", url).put("action", "opened_new_webview"))
        }

        return suspendCancellableCoroutine { cont ->
            wv.navigateTo(url) { result ->
                if (result.optBoolean("success")) {
                    cont.resume(CommandResult(true, data = result))
                } else {
                    cont.resume(CommandResult(false, error = result.optString("error")))
                }
            }
        }
    }

    private suspend fun webClick(params: JSONObject): CommandResult {
        val selector = params.optString("selector")
        if (selector.isEmpty()) return CommandResult(false, error = "selector é obrigatório")

        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto. Use open_webview primeiro.")

        return suspendCancellableCoroutine { cont ->
            wv.clickElement(selector) { result ->
                if (result.optBoolean("success")) {
                    cont.resume(CommandResult(true, data = result))
                } else {
                    cont.resume(CommandResult(false, error = result.optString("error")))
                }
            }
        }
    }

    private suspend fun webType(params: JSONObject): CommandResult {
        val selector = params.optString("selector")
        val text = params.optString("text")
        if (selector.isEmpty() || text.isEmpty()) return CommandResult(false, error = "selector e text são obrigatórios")

        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto. Use open_webview primeiro.")

        return suspendCancellableCoroutine { cont ->
            wv.typeText(selector, text) { result ->
                if (result.optBoolean("success")) {
                    cont.resume(CommandResult(true, data = result))
                } else {
                    cont.resume(CommandResult(false, error = result.optString("error")))
                }
            }
        }
    }

    private suspend fun webScreenshot(): CommandResult {
        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto.")

        return suspendCancellableCoroutine { cont ->
            wv.captureScreenshot { result ->
                if (result.optBoolean("success")) {
                    cont.resume(CommandResult(true, data = result))
                } else {
                    cont.resume(CommandResult(false, error = result.optString("error")))
                }
            }
        }
    }

    private suspend fun webGetContent(): CommandResult {
        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto.")

        return suspendCancellableCoroutine { cont ->
            wv.getPageContent { result ->
                if (result.optBoolean("success")) {
                    cont.resume(CommandResult(true, data = result))
                } else {
                    cont.resume(CommandResult(false, error = result.optString("error")))
                }
            }
        }
    }

    private suspend fun webSelect(params: JSONObject): CommandResult {
        val selector = params.optString("selector")
        val value = params.optString("value")
        if (selector.isEmpty() || value.isEmpty()) return CommandResult(false, error = "selector e value são obrigatórios")

        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto.")

        return suspendCancellableCoroutine { cont ->
            wv.selectOption(selector, value) { result ->
                if (result.optBoolean("success")) {
                    cont.resume(CommandResult(true, data = result))
                } else {
                    cont.resume(CommandResult(false, error = result.optString("error")))
                }
            }
        }
    }

    private suspend fun webCheckbox(params: JSONObject): CommandResult {
        val selector = params.optString("selector")
        val checked = params.optBoolean("checked", true)

        if (selector.isEmpty()) return CommandResult(false, error = "selector é obrigatório")

        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto.")

        return suspendCancellableCoroutine { cont ->
            wv.toggleCheckbox(selector, checked) { result ->
                if (result.optBoolean("success")) {
                    cont.resume(CommandResult(true, data = result))
                } else {
                    cont.resume(CommandResult(false, error = result.optString("error")))
                }
            }
        }
    }

    private suspend fun webExecuteJs(params: JSONObject): CommandResult {
        val script = params.optString("script")
        if (script.isEmpty()) return CommandResult(false, error = "script é obrigatório")

        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto.")

        return suspendCancellableCoroutine { cont ->
            wv.executeJS(script) { result ->
                cont.resume(CommandResult(true, data = result))
            }
        }
    }

    private suspend fun webLogin(params: JSONObject): CommandResult {
        val url = params.optString("url")
        val username = params.optString("username")
        val password = params.optString("password")
        val usernameSelector = params.optString("username_selector", "input[name='username'], input[type='email'], #username, #email")
        val passwordSelector = params.optString("password_selector", "input[name='password'], input[type='password'], #password")
        val submitSelector = params.optString("submit_selector", "button[type='submit'], input[type='submit'], #login-btn")

        if (url.isEmpty() || username.isEmpty() || password.isEmpty()) {
            return CommandResult(false, error = "url, username e password são obrigatórios")
        }

        // Navegar para URL de login
        val navResult = webNavigate(JSONObject().put("url", url))
        if (!navResult.success) return navResult

        // Aguardar carregamento
        kotlinx.coroutines.delay(2000)

        val wv = ensureWebView() ?: return CommandResult(false, error = "WebView não está aberto.")

        // Preencher username
        val userResult = suspendCancellableCoroutine<CommandResult> { cont ->
            wv.typeText(usernameSelector, username) { result ->
                cont.resume(CommandResult(result.optBoolean("success"), data = result))
            }
        }
        if (!userResult.success) return CommandResult(false, error = "Erro ao preencher usuário: ${userResult.error}")

        // Preencher password
        val passResult = suspendCancellableCoroutine<CommandResult> { cont ->
            wv.typeText(passwordSelector, password) { result ->
                cont.resume(CommandResult(result.optBoolean("success"), data = result))
            }
        }
        if (!passResult.success) return CommandResult(false, error = "Erro ao preencher senha: ${passResult.error}")

        // Clicar submit
        kotlinx.coroutines.delay(500)
        val clickResult = suspendCancellableCoroutine<CommandResult> { cont ->
            wv.clickElement(submitSelector) { result ->
                cont.resume(CommandResult(result.optBoolean("success"), data = result))
            }
        }

        kotlinx.coroutines.delay(3000)

        return CommandResult(true, data = JSONObject().apply {
            put("url", WebViewActivity.currentUrl)
            put("title", WebViewActivity.currentTitle)
            put("loggedIn", true)
        })
    }
}
