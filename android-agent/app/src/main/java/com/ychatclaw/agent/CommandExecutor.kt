package com.ychatclaw.agent

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import org.json.JSONObject

class CommandExecutor(private val context: Context) {

    fun execute(commandName: String, params: JSONObject): CommandResult {
        return when (commandName) {
            "open_app" -> openApp(params)
            "open_url" -> openUrl(params)
            "open_webview" -> openWebView(params)
            "play_video" -> playVideo(params)
            "display_image" -> displayImage(params)
            "slideshow" -> slideshow(params)
            "input_text" -> inputText(params)
            "capture_screenshot" -> captureScreenshot(params)
            else -> CommandResult(false, error = "Comando desconhecido: $commandName")
        }
    }

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

        // Abrir WebView em uma nova Activity
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

        // Implementar slideshow
        val intent = Intent(context, SlideshowActivity::class.java).apply {
            putExtra("images", images.toString())
            putExtra("interval", params.optInt("interval", 5000))
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)

        return CommandResult(true, data = JSONObject().put("count", images.length()))
    }

    private fun inputText(params: JSONObject): CommandResult {
        val text = params.optString("text")
        if (text.isEmpty()) {
            return CommandResult(false, error = "text é obrigatório")
        }

        // Inserir texto via AccessibilityService (requer permissão)
        return CommandResult(false, error = "input_text requer AccessibilityService")
    }

    private fun captureScreenshot(params: JSONObject): CommandResult {
        // Captura de tela via MediaProjection (requer permissão)
        return CommandResult(false, error = "capture_screenshot requer MediaProjection")
    }
}
