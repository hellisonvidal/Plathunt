package com.hellisonvidal.perseus;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Limites do zoom de texto (em %), para a fonte do sistema não quebrar o layout. */
    private static final int MIN_TEXT_ZOOM = 85;
    private static final int MAX_TEXT_ZOOM = 115;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PsnLoginPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        applyTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
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
