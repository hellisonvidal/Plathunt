package com.hellisonvidal.perseus;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * Abre um endereço direto no navegador, sem passar pelos apps que "capturam"
 * links. O app da PlayStation captura os links da PlayStation Store e abre
 * na tela inicial dele, em vez de no jogo; no navegador, a página do jogo
 * escolhido abre sempre (e de lá dá para comprar ou mandar para o console).
 */
@CapacitorPlugin(name = "ExternalBrowser")
public class ExternalBrowserPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Endereço inválido.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        String browser = browserPackage();
        if (browser != null) intent.setPackage(browser);
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            // Sem navegador identificado: abre do jeito normal do Android.
            try {
                intent.setPackage(null);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (ActivityNotFoundException again) {
                call.reject("Nenhum navegador encontrado.");
            }
        }
    }

    /**
     * Navegador do aparelho: o padrão, se houver um; senão o Chrome ou o
     * primeiro navegador instalado. Nunca o app da PlayStation.
     */
    private String browserPackage() {
        PackageManager pm = getContext().getPackageManager();
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.example.com/"));
        probe.addCategory(Intent.CATEGORY_BROWSABLE);
        ResolveInfo preferred = pm.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY);
        if (preferred != null && preferred.activityInfo != null && isBrowser(preferred.activityInfo.packageName)) {
            return preferred.activityInfo.packageName;
        }
        List<ResolveInfo> all = pm.queryIntentActivities(probe, PackageManager.MATCH_ALL);
        String first = null;
        for (ResolveInfo info : all) {
            String pkg = info.activityInfo != null ? info.activityInfo.packageName : null;
            if (!isBrowser(pkg)) continue;
            if ("com.android.chrome".equals(pkg)) return pkg;
            if (first == null) first = pkg;
        }
        return first;
    }

    /** "android" é a tela de escolha de app (não há padrão); o app da PlayStation não é navegador. */
    private static boolean isBrowser(String pkg) {
        return pkg != null && !pkg.equals("android") && !pkg.startsWith("com.scee.psxandroid") && !pkg.startsWith("com.playstation");
    }
}
