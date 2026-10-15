package com.hellisonvidal.perseus;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Tela de login da PSN. Carrega a página oficial da Sony e, assim que o
 * usuário entra, lê o cookie "npsso" e devolve para o app. O usuário nunca
 * precisa copiar nada.
 */
public class PsnLoginActivity extends AppCompatActivity {

    static final String EXTRA_NPSSO = "npsso";
    private static final String START_URL = "https://my.playstation.com/";
    private static final String[] COOKIE_URLS = {
        "https://ca.account.sony.com",
        "https://my.account.sony.com",
        "https://www.playstation.com",
    };
    private static final long POLL_MS = 1500;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private boolean finished = false;

    private final Runnable poll = new Runnable() {
        @Override
        public void run() {
            checkForNpsso();
            if (!finished) handler.postDelayed(this, POLL_MS);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0b0f1a"));

        TextView hint = new TextView(this);
        hint.setText("Entre na sua conta PSN. Esta tela fecha sozinha quando terminar.");
        hint.setTextColor(Color.parseColor("#e8ecf5"));
        hint.setGravity(Gravity.CENTER);
        int pad = (int) (12 * getResources().getDisplayMetrics().density);
        hint.setPadding(pad, pad, pad, pad);
        root.addView(hint, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        webView = new WebView(this);
        root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // A Sony pode recusar o login em WebViews identificadas como tal.
        settings.setUserAgentString(settings.getUserAgentString().replace("; wv", "").replace(" Version/4.0", ""));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                checkForNpsso();
            }
        });

        webView.loadUrl(START_URL);
        handler.post(poll);
    }

    private void checkForNpsso() {
        if (finished) return;
        CookieManager cookies = CookieManager.getInstance();
        for (String url : COOKIE_URLS) {
            String npsso = extractNpsso(cookies.getCookie(url));
            if (npsso != null) {
                finishWith(npsso);
                return;
            }
        }
    }

    /** Lê o valor de "npsso" de um header de cookies ("a=1; npsso=xyz; b=2"). */
    static String extractNpsso(String cookieHeader) {
        if (cookieHeader == null) return null;
        for (String part : cookieHeader.split(";")) {
            String[] kv = part.trim().split("=", 2);
            if (kv.length == 2 && kv[0].equals("npsso") && kv[1].matches("[A-Za-z0-9]{64}")) {
                return kv[1];
            }
        }
        return null;
    }

    private void finishWith(String npsso) {
        finished = true;
        handler.removeCallbacks(poll);
        CookieManager.getInstance().flush();
        Intent data = new Intent();
        data.putExtra(EXTRA_NPSSO, npsso);
        setResult(RESULT_OK, data);
        finish();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(poll);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
