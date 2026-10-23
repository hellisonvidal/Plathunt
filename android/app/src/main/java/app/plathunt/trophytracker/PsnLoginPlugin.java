package app.plathunt.trophytracker;

import android.app.Activity;
import android.content.Intent;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import androidx.browser.auth.AuthTabIntent;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import java.util.ArrayList;
import java.util.List;
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
 * - login(): abre o formulário de entrada da Sony numa Auth Tab do navegador
 *   (Chrome 137+, Brave…), onde a chave de acesso (passkey) funciona e o
 *   navegador devolve o redirect só para o Plathunt. Sem navegador com Auth
 *   Tab, abre a tela antiga (WebView). Resolve com
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

    private static final String REDIRECT_SCHEME = "com.scee.psxandroid.scecompcall";
    private static final String PREFS = "psn_login";
    /** Depois de "esquecer o login da Sony", a próxima Auth Tab começa sem sessão (troca de conta). */
    private static final String PREF_FRESH = "fresh";

    @PluginMethod
    public void login(PluginCall call) {
        String browser = authTabBrowser(getContext());
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        // Depois de sair, o login precisa pedir a conta de novo: sem modo efêmero, o
        // navegador entraria direto na conta anterior, então usa a tela antiga (sem cookies).
        if (browser != null && prefs.getBoolean(PREF_FRESH, false)
                && !CustomTabsClient.isEphemeralBrowsingSupported(getContext(), browser)) {
            browser = null;
        }
        if (browser == null) {
            Intent intent = new Intent(getContext(), PsnLoginActivity.class);
            startActivityForResult(call, intent, "onLoginResult");
            return;
        }
        boolean fresh = prefs.getBoolean(PREF_FRESH, false);
        AuthTabIntent authTab = new AuthTabIntent.Builder().setEphemeralBrowsingEnabled(fresh).build();
        // O mesmo que AuthTabIntent.launch(), mas pelo resultado de atividade do Capacitor.
        Intent intent = authTab.intent;
        intent.setPackage(browser);
        intent.setData(Uri.parse(AUTHORIZE_URL));
        intent.putExtra(AuthTabIntent.EXTRA_REDIRECT_SCHEME, REDIRECT_SCHEME);
        try {
            startActivityForResult(call, intent, "onAuthTabResult");
        } catch (Exception e) {
            startActivityForResult(call, new Intent(getContext(), PsnLoginActivity.class), "onLoginResult");
        }
    }

    /** Navegador com Auth Tab: o padrão do celular, depois o Chrome, depois qualquer outro. */
    static String authTabBrowser(Context ctx) {
        try {
            List<String> browsers = new ArrayList<>();
            for (ResolveInfo info : ctx.getPackageManager().queryIntentServices(
                    new Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION), 0)) {
                if (info.serviceInfo != null && !browsers.contains(info.serviceInfo.packageName)) {
                    browsers.add(info.serviceInfo.packageName);
                }
            }
            List<String> order = new ArrayList<>();
            String preferred = CustomTabsClient.getPackageName(ctx, null);
            if (preferred != null) order.add(preferred);
            order.add("com.android.chrome");
            order.addAll(browsers);
            for (String pkg : order) {
                if (browsers.contains(pkg) && CustomTabsClient.isAuthTabSupported(ctx, pkg)) return pkg;
            }
        } catch (Exception ignored) {
            // Sem como consultar os navegadores: usa a tela antiga.
        }
        return null;
    }

    @ActivityCallback
    private void onAuthTabResult(PluginCall call, ActivityResult result) {
        JSObject ret = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() == AuthTabIntent.RESULT_OK && data != null && data.getData() != null) {
            try {
                String code = extractCode(data.getData().toString());
                if (code != null) {
                    ret.put("code", code);
                    getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(PREF_FRESH).apply();
                }
            } catch (Exception ignored) {
                // Redirect inesperado: tratado como login cancelado.
            }
        }
        call.resolve(ret);
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
        // O login da Sony na Auth Tab fica no navegador, que o app não apaga: a
        // próxima Auth Tab abre em modo efêmero (sem sessão), quando o navegador deixa.
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(PREF_FRESH, true).apply();
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
            if (code != null || npsso != null) {
                getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(PREF_FRESH).apply();
            }
        }
        call.resolve(ret);
    }
}
