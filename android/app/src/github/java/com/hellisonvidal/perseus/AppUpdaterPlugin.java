package com.hellisonvidal.perseus;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.List;

/**
 * Atualização do app por dentro dele: baixa o APK da Release do GitHub para o
 * cache do app (com progresso) e abre o instalador do Android.
 *
 * Antes o download ia para o navegador, que costumava travar no fim (o GitHub
 * redireciona para outro servidor e o Chrome segura arquivos .apk).
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    /** Só aceita downloads das Releases do GitHub. */
    private static final List<String> ALLOWED_HOSTS = Arrays.asList(
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com"
    );
    private static final String APK_MIME = "application/vnd.android.package-archive";

    private volatile boolean downloading = false;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !isAllowed(url)) {
            call.reject("Endereço de atualização inválido.");
            return;
        }
        if (downloading) {
            call.reject("Já existe um download em andamento.");
            return;
        }
        downloading = true;
        new Thread(() -> {
            try {
                File apk = download(url);
                call.resolve(install(apk));
            } catch (Exception e) {
                call.reject("Não foi possível baixar a atualização: " + e.getMessage(), e);
            } finally {
                downloading = false;
            }
        }).start();
    }

    private static boolean isAllowed(String url) {
        try {
            Uri uri = Uri.parse(url);
            return "https".equals(uri.getScheme()) && ALLOWED_HOSTS.contains(uri.getHost());
        } catch (Exception e) {
            return false;
        }
    }

    private File download(String url) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("sem espaço no aparelho");
        File target = new File(dir, "PlayStation-Trophy-Mania.apk");
        File partial = new File(dir, "PlayStation-Trophy-Mania.apk.part");

        HttpURLConnection conn = open(url);
        try {
            long total = conn.getContentLengthLong();
            long done = 0;
            int lastPercent = -1;
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(partial)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    done += read;
                    int percent = total > 0 ? (int) (done * 100 / total) : -1;
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        progress.put("downloaded", done);
                        progress.put("total", total);
                        notifyListeners("progress", progress);
                    }
                }
                out.flush();
            }
            if (total > 0 && done != total) throw new Exception("download incompleto (" + done + " de " + total + " bytes)");
        } finally {
            conn.disconnect();
        }
        if (target.exists() && !target.delete()) throw new Exception("não foi possível substituir o arquivo antigo");
        if (!partial.renameTo(target)) throw new Exception("não foi possível salvar o arquivo");
        return target;
    }

    /** Abre a conexão seguindo redirecionamentos (o GitHub manda para outro servidor). */
    private static HttpURLConnection open(String url) throws Exception {
        String current = url;
        for (int i = 0; i < 6; i++) {
            if (!isAllowed(current)) throw new Exception("redirecionamento para servidor desconhecido");
            HttpURLConnection conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("Accept", "application/octet-stream");
            int status = conn.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null) throw new Exception("redirecionamento sem destino");
                current = new URL(new URL(current), location).toString();
                continue;
            }
            if (status != 200) {
                conn.disconnect();
                throw new Exception("o servidor respondeu " + status);
            }
            return conn;
        }
        throw new Exception("redirecionamentos demais");
    }

    private JSObject install(File apk) {
        JSObject result = new JSObject();
        // Android 8+: o usuário precisa autorizar este app a instalar outros apps.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            result.put("status", "permission-needed");
            return result;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, APK_MIME);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        result.put("status", "installing");
        return result;
    }
}
