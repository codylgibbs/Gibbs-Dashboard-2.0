package com.gibbs.dashboard2

import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.web_view)
    WebView.setWebContentsDebuggingEnabled(true)
    
    val settings = webView.settings
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.allowFileAccess = true
    settings.allowContentAccess = true
    // These help with CORS from file:// but are less effective for fetch()
    settings.allowFileAccessFromFileURLs = true
    settings.allowUniversalAccessFromFileURLs = true
    
    settings.mediaPlaybackRequiresUserGesture = false
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

    // Configure AssetLoader to handle both /assets/ and /www/ paths if needed
    val assetLoader = WebViewAssetLoader.Builder()
      .setDomain("appassets.androidplatform.net")
      .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
      .addPathHandler("/www/", WebViewAssetLoader.AssetsPathHandler(this))
      .build()

    webView.webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
      ): WebResourceResponse? {
        return assetLoader.shouldInterceptRequest(request.url)
      }
    }

    // Point to the index.html inside the assets/www folder
    webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
  }

  override fun onBackPressed() {
    if (webView.canGoBack()) {
      webView.goBack()
    } else {
      super.onBackPressed()
    }
  }
}
