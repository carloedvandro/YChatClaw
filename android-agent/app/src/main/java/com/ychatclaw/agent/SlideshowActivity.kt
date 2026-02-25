package com.ychatclaw.agent

import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import org.json.JSONArray

class SlideshowActivity : AppCompatActivity() {

    private lateinit var imageView: ImageView
    private val handler = Handler(Looper.getMainLooper())
    private var images: List<String> = emptyList()
    private var currentIndex = 0
    private var intervalMs = 5000
    private var slideshowRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        imageView = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        setContentView(imageView)

        // Carregar imagens do intent
        val imagesJson = intent.getStringExtra("images") ?: "[]"
        intervalMs = intent.getIntExtra("interval", 5000)

        try {
            val jsonArray = JSONArray(imagesJson)
            images = (0 until jsonArray.length()).map { jsonArray.getString(it) }
        } catch (e: Exception) {
            finish()
            return
        }

        if (images.isEmpty()) {
            finish()
            return
        }

        startSlideshow()
    }

    private fun startSlideshow() {
        showImage(0)

        slideshowRunnable = object : Runnable {
            override fun run() {
                currentIndex = (currentIndex + 1) % images.size
                showImage(currentIndex)
                handler.postDelayed(this, intervalMs.toLong())
            }
        }

        handler.postDelayed(slideshowRunnable!!, intervalMs.toLong())
    }

    private fun showImage(index: Int) {
        val imageUrl = images[index]
        Glide.with(this)
            .load(Uri.parse(imageUrl))
            .placeholder(android.R.drawable.ic_menu_gallery)
            .error(android.R.drawable.ic_menu_close_clear_cancel)
            .into(imageView)
    }

    override fun onDestroy() {
        super.onDestroy()
        slideshowRunnable?.let { handler.removeCallbacks(it) }
    }

    override fun onBackPressed() {
        finish()
    }
}
