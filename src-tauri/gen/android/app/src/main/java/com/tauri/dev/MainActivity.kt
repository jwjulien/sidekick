package com.tauri.dev

import android.content.Intent
import android.net.Uri
import android.nfc.NfcAdapter
import android.nfc.NdefMessage
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    handleNfcIntent(intent)
    setIntent(intent)
    super.onCreate(savedInstanceState)
    Log.d("NFC-DEBUG", "[MainActivity onCreate] Intent action: ${intent?.action}, data: ${intent?.data}")
  }

  override fun onNewIntent(intent: Intent) {
    Log.d("NFC-DEBUG", "[MainActivity onNewIntent] Incoming intent action: ${intent.action}, data: ${intent.data}")
    handleNfcIntent(intent)
    setIntent(intent)
    super.onNewIntent(intent)
  }

  private fun handleNfcIntent(intent: Intent?) {
    if (intent == null) return
    val action = intent.action
    Log.d("NFC-DEBUG", "[MainActivity handleNfcIntent] Intercepted action: $action, data: ${intent.data}")
    if (NfcAdapter.ACTION_NDEF_DISCOVERED == action ||
        NfcAdapter.ACTION_TECH_DISCOVERED == action ||
        NfcAdapter.ACTION_TAG_DISCOVERED == action) {
      
      var ndefMsg: NdefMessage? = null

      // Method 1: Check EXTRA_NDEF_MESSAGES
      val rawMsgs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES, NdefMessage::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
      }

      if (rawMsgs != null && rawMsgs.isNotEmpty()) {
        ndefMsg = rawMsgs[0] as? NdefMessage
        Log.d("NFC-DEBUG", "[MainActivity handleNfcIntent] Found ndefMsg from EXTRA_NDEF_MESSAGES")
      }

      // Method 2: If EXTRA_NDEF_MESSAGES is null, read Ndef from EXTRA_TAG (for TAG_DISCOVERED / TECH_DISCOVERED)
      if (ndefMsg == null) {
        val tag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
        }
        if (tag != null) {
          Log.d("NFC-DEBUG", "[MainActivity handleNfcIntent] Found tag in EXTRA_TAG, attempting Ndef.get(tag)")
          try {
            val ndef = Ndef.get(tag)
            if (ndef != null) {
              ndef.connect()
              ndefMsg = ndef.cachedNdefMessage ?: ndef.ndefMessage
              ndef.close()
              Log.d("NFC-DEBUG", "[MainActivity handleNfcIntent] Successfully read NdefMessage directly from tag")
            }
          } catch (e: Exception) {
            Log.w("NFC-DEBUG", "[MainActivity handleNfcIntent] Direct Ndef read exception: ${e.message}")
          }
        }
      }

      if (ndefMsg != null && ndefMsg.records.isNotEmpty()) {
        val record = ndefMsg.records[0]
        val payload = record.payload
        if (payload != null && payload.isNotEmpty()) {
          val prefixCode = payload[0].toInt()
          val prefix = when (prefixCode) {
            0x00 -> ""
            0x01 -> "http://www."
            0x02 -> "https://www."
            0x03 -> "http://"
            0x04 -> "https://"
            else -> ""
          }
          val body = String(payload, 1, payload.size - 1, Charsets.UTF_8)
          val fullUrl = prefix + body
          Log.d("NFC-DEBUG", "[MainActivity handleNfcIntent] Decoded NDEF payload URL: '$fullUrl'")
          if (fullUrl.startsWith("fuse://")) {
            Log.d("NFC-DEBUG", "[MainActivity handleNfcIntent] Intercepted fuse URI: '$fullUrl'")
            dispatchUrlToWebView(fullUrl)
          }
        }
      } else if (intent.data != null) {
        Log.d("NFC-DEBUG", "[MainActivity handleNfcIntent] Intercepted existing intent data: ${intent.data}")
        dispatchUrlToWebView(intent.data.toString())
      }
    }
  }

  private fun dispatchUrlToWebView(url: String) {
    this.runOnUiThread {
      try {
        val parsedId = url.substringAfterLast("/")
        val action = if (url.contains("location")) "location" else if (url.contains("part")) "part" else "resolve"
        val targetRoute = if (action == "location") "/storage?location=$parsedId" else if (action == "part") "/parts/$parsedId" else "/scan?resolve=$parsedId"
        
        val js = """
          (function() {
            var detail = { rawUrl: '$url', scheme: 'fuse', action: '$action', id: '$parsedId', targetRoute: '$targetRoute' };
            console.log('[NFC-DEBUG] [Native Direct Dispatch] Triggering event in WebView:', detail);
            var evt = new CustomEvent('sidekick:nfc-scanned', { detail: detail, cancelable: true });
            var handled = !window.dispatchEvent(evt);
            if (!handled) {
              console.log('[NFC-DEBUG] [Native Direct Dispatch] Fallback routing to targetRoute:', '$targetRoute');
              if (window.location.pathname + window.location.search !== '$targetRoute') {
                window.history.pushState({}, '', '$targetRoute');
              }
            }
          })();
        """.trimIndent()

        var currentClass: Class<*>? = this.javaClass
        var webView: android.webkit.WebView? = null
        while (currentClass != null && webView == null) {
          for (field in currentClass.declaredFields) {
            if (android.webkit.WebView::class.java.isAssignableFrom(field.type)) {
              field.isAccessible = true
              webView = field.get(this) as? android.webkit.WebView
              if (webView != null) break
            }
          }
          currentClass = currentClass.superclass
        }

        if (webView != null) {
          webView.evaluateJavascript(js, null)
          Log.d("NFC-DEBUG", "[MainActivity dispatchUrlToWebView] Successfully evaluated JS in WebView for URL: '$url'")
        } else {
          Log.w("NFC-DEBUG", "[MainActivity dispatchUrlToWebView] Could not locate WebView instance on TauriActivity")
        }
      } catch (e: Exception) {
        Log.w("NFC-DEBUG", "[MainActivity dispatchUrlToWebView] Error evaluating JS: ${e.message}")
      }
    }
  }
}
