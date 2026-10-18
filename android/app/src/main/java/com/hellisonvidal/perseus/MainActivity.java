package com.hellisonvidal.perseus;

import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.WebViewListener;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Limites do zoom de texto (em %), para a fonte do sistema não quebrar o layout. */
    private static final int MIN_TEXT_ZOOM = 85;
    private static final int MAX_TEXT_ZOOM = 115;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PsnLoginPlugin.class);
        // Atualização por dentro do app: só na versão do GitHub (src/github).
        for (Class<? extends com.getcapacitor.Plugin> plugin : FlavorPlugins.list()) registerPlugin(plugin);
        registerPlugin(ExternalBrowserPlugin.class);
        super.onCreate(savedInstanceState);
        applyTextZoom();
        disableForcedDarkening();
        // Avisa a página se o sistema está no modo escuro (tema "Automático") a cada carregamento.
        try {
            if (getBridge() != null) {
                getBridge().addWebViewListener(new WebViewListener() {
                    @Override
                    public void onPageLoaded(WebView webView) {
                        publishSystemTheme();
                        lastInsets = null;
                        publishInsets();
                    }
                });
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    // Barras do sistema mudam com rotação, tela dividida ou gestos/botões.
                    webView.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> publishInsets());
                }
            }
        } catch (RuntimeException ignored) {
        }
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // O usuário trocou claro/escuro com o app aberto (ou girou a tela).
        publishSystemTheme();
        publishInsets();
    }

    private String lastInsets = null;

    /**
     * No Android 15+ o app ocupa a tela toda, por baixo da barra de status e da
     * barra de navegação. Alguns WebViews não informam essas áreas pelo CSS
     * (env(safe-area-inset-*)), e os menus ficavam por cima do conteúdo e das
     * barras. Aqui o app mede quanto das barras cobre o WebView e passa para
     * a página em --tm-inset-top / -bottom / -left / -right (styles.css).
     */
    private void publishInsets() {
        try {
            if (getBridge() == null) return;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(webView);
            if (insets == null) return;
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            int[] location = new int[2];
            webView.getLocationOnScreen(location);
            int screenHeight = webView.getRootView().getHeight();
            int screenWidth = webView.getRootView().getWidth();
            int top = Math.max(0, bars.top - location[1]);
            int bottom = Math.max(0, location[1] + webView.getHeight() - (screenHeight - bars.bottom));
            // Com o celular deitado, o recorte da câmera e os botões ficam nas laterais.
            int left = Math.max(0, bars.left - location[0]);
            int right = Math.max(0, location[0] + webView.getWidth() - (screenWidth - bars.right));
            float density = getResources().getDisplayMetrics().density;
            String css = Math.round(top / density) + "px," + Math.round(bottom / density) + "px,"
                + Math.round(left / density) + "px," + Math.round(right / density) + "px";
            if (css.equals(lastInsets)) return;
            lastInsets = css;
            String[] parts = css.split(",");
            webView.post(() -> webView.evaluateJavascript(
                "document.documentElement.style.setProperty('--tm-inset-top','" + parts[0] + "');"
                    + "document.documentElement.style.setProperty('--tm-inset-bottom','" + parts[1] + "');"
                    + "document.documentElement.style.setProperty('--tm-inset-left','" + parts[2] + "');"
                    + "document.documentElement.style.setProperty('--tm-inset-right','" + parts[3] + "');",
                null));
        } catch (RuntimeException ignored) {
        }
    }

    /**
     * Com o escurecimento automático desligado, WebViews mais antigos sempre
     * respondem "claro" para prefers-color-scheme. Por isso o app informa o
     * modo do sistema diretamente: window.__tmSystemDark e o evento
     * "tm-system-theme" (lib/theme.ts).
     */
    private void publishSystemTheme() {
        try {
            if (getBridge() == null) return;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            boolean dark = mode == Configuration.UI_MODE_NIGHT_YES;
            webView.post(() -> webView.evaluateJavascript(
                "window.__tmSystemDark=" + dark + ";window.dispatchEvent(new Event('tm-system-theme'));", null));
        } catch (RuntimeException ignored) {
        }
    }

    /**
     * Com o modo escuro do Android (ou o "escurecer apps" de algumas marcas),
     * o WebView pode recolorir a página sozinho, e os temas do app apareciam
     * com cores erradas (principalmente os claros). O app tem os próprios
     * temas, então esse escurecimento automático fica desligado.
     */
    @SuppressWarnings("deprecation")
    private void disableForcedDarkening() {
        try {
            if (getBridge() == null) return;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.getSettings(), false);
            }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                WebSettingsCompat.setForceDark(webView.getSettings(), WebSettingsCompat.FORCE_DARK_OFF);
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                webView.setForceDarkAllowed(false);
            }
        } catch (RuntimeException ignored) {
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        publishSystemTheme();
        // O usuário pode ter mudado o tamanho da fonte do Android com o app aberto.
        applyTextZoom();
    }

    /**
     * A interface já se ajusta à largura da tela (styles.css). O tamanho de
     * fonte do Android ainda é respeitado, mas dentro de uma faixa: em 200% os
     * textos não cabem nos cartões e nas abas.
     */
    private void applyTextZoom() {
        // Nunca pode derrubar a abertura do app: se o WebView ainda não existir
        // (ou o aparelho recusar o ajuste), segue com o tamanho padrão.
        try {
            if (getBridge() == null) return;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            float scale = getResources().getConfiguration().fontScale;
            int zoom = Math.round(scale * 100);
            webView.getSettings().setTextZoom(Math.max(MIN_TEXT_ZOOM, Math.min(MAX_TEXT_ZOOM, zoom)));
        } catch (RuntimeException ignored) {
        }
    }
}
