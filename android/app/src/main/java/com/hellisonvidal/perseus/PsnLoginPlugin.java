package com.hellisonvidal.perseus;

import android.app.Activity;
import android.content.Intent;
import android.webkit.CookieManager;
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
 * - login(): abre direto o formulário de entrada da Sony e resolve com
 *   { code } (código OAuth) quando o usuário termina, ou { npsso } como
 *   reserva, ou {} se ele fechar a tela;
 * - silentLogin(): sem mostrar nada, usa o login da Sony já guardado no
 *   aparelho (cookie npsso) para pegar um código OAuth; {} se não houver;
 * - authorize({ npsso }): troca o NPSSO pelo código OAuth (login manual).
 *   A Sony entrega o código em um redirect, que o WebView não deixa ler;
 * - clearSession(): apaga o login da Sony guardado no aparelho, para que o
 *   próximo login peça usuário e senha (troca de conta).
 */
@CapacitorPlugin(name = "PsnLogin")
public class PsnLoginPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        Intent intent = new Intent(getContext(), PsnLoginActivity.class);
        startActivityForResult(call, intent, "onLoginResult");
    }

    /** Mesmo fluxo OAuth do app oficial da PlayStation. */
    static final String AUTHORIZE_URL =
        "https://ca.account.sony.com/api/authz/v3/oauth/authorize"
            + "?access_type=offline"
            + "&client_id=09515159-7237-4370-9b40-3806e67c0891"
            + "&redirect_uri=com.scee.psxandroid.scecompcall%3A%2F%2Fredirect"
            + "&response_type=code"
            + "&scope=psn%3Amobile.v2.core%20psn%3Aclientapp"
            // Formulário compacto da PlayStation (como no app oficial): vai
            // direto para usuário e senha, sem a página inicial da Sony.
            + "&service_entity=urn%3Aservice-entity%3Apsn"
            + "&ui=pr"
            + "&layout_type=popup"
            + "&service_logo=ps"
            + "&smcid=psapp%3Asignin";

    /** Login silencioso: não abre tela; resolve {} quando não há login da Sony salvo. */
    @PluginMethod
    public void silentLogin(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            CookieManager cookies = CookieManager.getInstance();
            for (String url : PsnLoginActivity.COOKIE_URLS) {
                String npsso = PsnLoginActivity.extractNpsso(cookies.getCookie(url));
                if (npsso == null) continue;
                String code = requestCode(npsso);
                if (code != null) {
                    ret.put("code", code);
                    break;
                }
            }
        } catch (Exception ignored) {
            // Sem rede ou login expirado: o app mostra o botão de entrar.
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        // O app não usa cookies próprios (os dados ficam no localStorage), então
        // apagar tudo remove só o login da Sony.
        CookieManager cookies = CookieManager.getInstance();
        cookies.removeAllCookies(removed -> {
            cookies.flush();
            call.resolve();
        });
    }

    /** Roda fora da thread principal (os plugins do Capacitor usam uma thread própria). */
    @PluginMethod
    public void authorize(PluginCall call) {
        String npsso = call.getString("npsso");
        if (npsso == null || !npsso.matches("[A-Za-z0-9]{64}")) {
            call.reject("NPSSO inválido.");
            return;
        }
        try {
            String code = requestCode(npsso);
            if (code == null) {
                call.reject("A PSN não devolveu o código de acesso. O NPSSO pode ter expirado.");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("code", code);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Não foi possível falar com a PSN.", e);
        }
    }

    /** Pede o código OAuth com o NPSSO; null se a Sony não devolver (NPSSO expirado). */
    static String requestCode(String npsso) throws Exception {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(AUTHORIZE_URL).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("Cookie", "npsso=" + npsso);
            conn.getResponseCode();
            return extractCode(conn.getHeaderField("Location"));
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
            String code = data.getStringExtra(PsnLoginActivity.EXTRA_CODE);
            String npsso = data.getStringExtra(PsnLoginActivity.EXTRA_NPSSO);
            if (code != null) ret.put("code", code);
            if (npsso != null) ret.put("npsso", npsso);
        }
        call.resolve(ret);
    }
}
