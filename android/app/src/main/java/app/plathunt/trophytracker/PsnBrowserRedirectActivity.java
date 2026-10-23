package app.plathunt.trophytracker;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Recebe o retorno do login da Sony feito no navegador
 * (com.scee.psxandroid.scecompcall://redirect/?code=…), entrega o código ao
 * PsnLoginPlugin e volta para o app, fechando a aba do navegador.
 */
public class PsnBrowserRedirectActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String code = null;
        try {
            if (getIntent() != null && getIntent().getData() != null) {
                code = PsnLoginPlugin.extractCode(getIntent().getData().toString());
            }
        } catch (Exception ignored) {
            // Endereço inesperado: o login é tratado como cancelado.
        }
        PsnLoginPlugin.deliverBrowserCode(code);
        Intent main = new Intent(this, MainActivity.class);
        main.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(main);
        finish();
    }
}
