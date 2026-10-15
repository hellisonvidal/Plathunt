package com.hellisonvidal.perseus;

import android.app.Activity;
import android.content.Intent;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Login da PSN feito no próprio celular (sem servidor):
 * - login(): abre a tela de entrada da Sony e resolve com { npsso } quando o
 *   usuário termina de entrar (ou {} se ele fechar a tela);
 * - authorize({ npsso }): troca o NPSSO pelo código OAuth. A Sony entrega o
 *   código em um redirect, que o WebView não deixa ler, por isso é nativo.
 */
@CapacitorPlugin(name = "PsnLogin")
public class PsnLoginPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        Intent intent = new Intent(getContext(), PsnLoginActivity.class);
        startActivityForResult(call, intent, "onLoginResult");
    }

    private static final String AUTHORIZE_URL =
        "https://ca.account.sony.com/api/authz/v3/oauth/authorize"
            + "?access_type=offline"
            + "&client_id=09515159-7237-4370-9b40-3806e67c0891"
            + "&redirect_uri=com.scee.psxandroid.scecompcall%3A%2F%2Fredirect"
            + "&response_type=code"
            + "&scope=psn%3Amobile.v2.core%20psn%3Aclientapp";

    /** Roda fora da thread principal (os plugins do Capacitor usam uma thread própria). */
    @PluginMethod
    public void authorize(PluginCall call) {
        String npsso = call.getString("npsso");
        if (npsso == null || !npsso.matches("[A-Za-z0-9]{64}")) {
            call.reject("NPSSO inválido.");
            return;
        }
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(AUTHORIZE_URL).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("Cookie", "npsso=" + npsso);
            int status = conn.getResponseCode();
            String code = extractCode(conn.getHeaderField("Location"));
            if (code == null) {
                call.reject("A PSN não devolveu o código de acesso (HTTP " + status + "). O NPSSO pode ter expirado.");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("code", code);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Não foi possível falar com a PSN.", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** Extrai "code" de "com.scee.psxandroid.scecompcall://redirect/?code=v3.XXX&cid=...". */
    static String extractCode(String location) throws Exception {
        if (location == null) return null;
        int q = location.indexOf('?');
        if (q < 0) return null;
        for (String pair : location.substring(q + 1).split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2 && kv[0].equals("code") && !kv[1].isEmpty()) {
                return URLDecoder.decode(kv[1], "UTF-8");
            }
        }
        return null;
    }

    @ActivityCallback
    private void onLoginResult(PluginCall call, ActivityResult result) {
        JSObject ret = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
            String npsso = data.getStringExtra(PsnLoginActivity.EXTRA_NPSSO);
            if (npsso != null) ret.put("npsso", npsso);
        }
        call.resolve(ret);
    }
}
