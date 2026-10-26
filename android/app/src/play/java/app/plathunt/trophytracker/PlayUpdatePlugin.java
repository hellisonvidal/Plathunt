package app.plathunt.trophytracker;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Versão da Play Store: pergunta à própria loja (In-App Updates) se há uma
 * versão mais nova publicada e abre a janela "Atualização disponível" do
 * Google Play. No modo flexível (padrão) o download corre em segundo plano
 * enquanto o app continua aberto; ao terminar, o evento "downloaded" avisa o
 * app, que oferece reiniciar (complete). Só funciona em apps instalados pela
 * Play Store (inclusive teste interno/fechado).
 */
@CapacitorPlugin(name = "PlayUpdate")
public class PlayUpdatePlugin extends Plugin {

    private AppUpdateManager manager;
    private final InstallStateUpdatedListener listener = state -> {
        if (state.installStatus() == InstallStatus.DOWNLOADED) notifyListeners("downloaded", new JSObject());
    };

    @Override
    public void load() {
        manager = AppUpdateManagerFactory.create(getContext());
        manager.registerListener(listener);
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) manager.unregisterListener(listener);
        super.handleOnDestroy();
    }

    private static boolean available(AppUpdateInfo info) {
        int a = info.updateAvailability();
        return a == UpdateAvailability.UPDATE_AVAILABLE
            || a == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
    }

    @PluginMethod
    public void check(PluginCall call) {
        manager
            .getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                JSObject result = new JSObject();
                result.put("available", available(info));
                result.put("versionCode", info.availableVersionCode());
                // Baixada pelo modo flexível e esperando reiniciar o app.
                result.put("downloaded", info.installStatus() == InstallStatus.DOWNLOADED);
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject("A Play Store não respondeu: " + e.getMessage()));
    }

    /** Abre a janela do Google Play; flexível quando a loja deixa, senão a de tela cheia. */
    @PluginMethod
    public void update(PluginCall call) {
        boolean preferImmediate = "immediate".equals(call.getString("type"));
        manager
            .getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                JSObject result = new JSObject();
                Integer type = null;
                if (available(info) && getActivity() != null) {
                    boolean flexible = info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);
                    boolean immediate = info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);
                    if (flexible && !(preferImmediate && immediate)) type = AppUpdateType.FLEXIBLE;
                    else if (immediate) type = AppUpdateType.IMMEDIATE;
                }
                if (type != null) {
                    manager.startUpdateFlow(info, getActivity(), AppUpdateOptions.defaultOptions(type));
                }
                result.put("started", type != null);
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject("A Play Store não respondeu: " + e.getMessage()));
    }

    /** Instala a versão já baixada (o app reinicia). */
    @PluginMethod
    public void complete(PluginCall call) {
        manager.completeUpdate();
        call.resolve();
    }
}
