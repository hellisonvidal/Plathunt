package app.plathunt.trophytracker;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
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
    static final String[] COOKIE_URLS = {
        "https://ca.account.sony.com",
        "https://my.account.sony.com",
    };
    /** Espera antes de aceitar o npsso, dando tempo para o redirect com o código chegar. */
    private static final long NPSSO_GRACE_MS = 4000;
    private static final long POLL_MS = 1500;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private ProgressBar spinner;
    /** Tempo máximo com a tela de carregamento antes de mostrar a página como estiver. */
    private static final long REVEAL_TIMEOUT_MS = 8000;
    private final Runnable reveal = this::showWebView;
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

        // Só o formulário da Sony, em tela cheia. Enquanto os redirects da Sony
        // carregam, fica um indicador de progresso no lugar da página.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0b0f1a"));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0b0f1a"));
        webView.setVisibility(View.INVISIBLE);
        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        spinner = new ProgressBar(this);
        root.addView(spinner, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Gerenciador de senhas do Android (ex.: Google): oferece salvar o e-mail e a
        // senha da Sony e preenche sozinho no próximo login. O app não guarda a senha.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
        }
        // A Sony pode recusar o login em WebViews identificadas como tal.
        settings.setUserAgentString(settings.getUserAgentString().replace("; wv", "").replace(" Version/4.0", ""));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (handleRedirect(request.getUrl().toString())) return true;
                // A tela de login só navega nas páginas da Sony; qualquer outro
                // endereço abre no navegador, fora da tela onde se digita a senha.
                if (request.isForMainFrame() && !isSonyPage(request.getUrl())) {
                    openOutside(request.getUrl());
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                handleRedirect(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                checkForNpsso();
                // Mostra a página quando ela termina de carregar e não é um
                // passo intermediário (o redirect final fecha a tela sozinho).
                if (!finished && url != null && !url.startsWith(REDIRECT_PREFIX) && !url.contains("/oauth/authorize")) {
                    handler.postDelayed(reveal, 300);
                }
            }
        });

        webView.loadUrl(PsnLoginPlugin.AUTHORIZE_URL);
        handler.post(poll);
        handler.postDelayed(reveal, REVEAL_TIMEOUT_MS);
    }

    /** Domínios da Sony usados no login (inclui "Esqueci a senha" e verificação em duas etapas). */
    private static final String[] SONY_DOMAINS = {
        "sony.com", "playstation.com", "playstation.net", "sonyentertainmentnetwork.com"
    };

    static boolean isSonyPage(Uri uri) {
        String host = uri.getHost();
        if (!"https".equals(uri.getScheme()) || host == null) return false;
        host = host.toLowerCase(java.util.Locale.ROOT);
        for (String domain : SONY_DOMAINS) {
            if (host.equals(domain) || host.endsWith("." + domain)) return true;
        }
        return false;
    }

    private void openOutside(Uri uri) {
        if (!"https".equals(uri.getScheme())) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (RuntimeException ignored) {
        }
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

    private void showWebView() {
        if (finished || webView == null) return;
        spinner.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
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
        handler.removeCallbacks(reveal);
        CookieManager.getInstance().flush();
        Intent data = new Intent();
        data.putExtra(key, value);
        setResult(RESULT_OK, data);
        finish();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(poll);
        handler.removeCallbacks(reveal);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
