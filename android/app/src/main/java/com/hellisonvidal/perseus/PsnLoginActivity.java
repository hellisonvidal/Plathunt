package com.hellisonvidal.perseus;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Tela de login da PSN. Abre direto o formulário de entrada da Sony (o mesmo
 * fluxo OAuth do app oficial da PlayStation). Quando o usuário termina, a
 * Sony redireciona para com.scee.psxandroid.scecompcall://redirect?code=...,
 * que esta tela intercepta e devolve para o app. Se o usuário já estiver
 * logado, o redirect acontece na hora e a tela fecha sozinha.
 *
 * Como reserva, também lê o cookie "npsso" (que o app troca pelo código).
 */
public class PsnLoginActivity extends AppCompatActivity {

    static final String EXTRA_CODE = "code";
    static final String EXTRA_NPSSO = "npsso";
    private static final String REDIRECT_PREFIX = "com.scee.psxandroid.scecompcall://";
    private static final String[] COOKIE_URLS = {
        "https://ca.account.sony.com",
        "https://my.account.sony.com",
    };
    /** Espera antes de aceitar o npsso, dando tempo para o redirect com o código chegar. */
    private static final long NPSSO_GRACE_MS = 4000;
    private static final long POLL_MS = 1500;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private boolean finished = false;
    private long npssoSeenAt = 0;

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
        hint.setText("Entre com sua conta PlayStation Network");
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
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleRedirect(request.getUrl().toString());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                handleRedirect(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                checkForNpsso();
            }
        });

        webView.loadUrl(PsnLoginPlugin.AUTHORIZE_URL);
        handler.post(poll);
    }

    /** Captura o redirect final da Sony com o código OAuth. */
    private boolean handleRedirect(String url) {
        if (url == null || !url.startsWith(REDIRECT_PREFIX)) return false;
        try {
            String code = PsnLoginPlugin.extractCode(url);
            if (code != null) {
                finishWith(EXTRA_CODE, code);
                return true;
            }
        } catch (Exception ignored) {
        }
        return true; // Nunca deixa o WebView tentar abrir o esquema do app oficial.
    }

    private void checkForNpsso() {
        if (finished) return;
        CookieManager cookies = CookieManager.getInstance();
        for (String url : COOKIE_URLS) {
            String npsso = extractNpsso(cookies.getCookie(url));
            if (npsso == null) continue;
            long now = System.currentTimeMillis();
            if (npssoSeenAt == 0) npssoSeenAt = now;
            if (now - npssoSeenAt >= NPSSO_GRACE_MS) finishWith(EXTRA_NPSSO, npsso);
            return;
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

    private void finishWith(String key, String value) {
        if (finished) return;
        finished = true;
        handler.removeCallbacks(poll);
        CookieManager.getInstance().flush();
        Intent data = new Intent();
        data.putExtra(key, value);
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
