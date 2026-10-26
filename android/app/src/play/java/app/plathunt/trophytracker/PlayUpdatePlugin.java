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
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Versão da Play Store: pergunta à própria loja (In-App Updates) se há uma
 * versão mais nova publicada e abre a tela de atualização do Google Play.
 * Só funciona em apps instalados pela Play Store (inclusive teste interno).
 */
@CapacitorPlugin(name = "PlayUpdate")
public class PlayUpdatePlugin extends Plugin {

    private AppUpdateManager manager() {
        return AppUpdateManagerFactory.create(getContext());
    }

    private static boolean available(AppUpdateInfo info) {
        int a = info.updateAvailability();
        return a == UpdateAvailability.UPDATE_AVAILABLE
            || a == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
    }

    @PluginMethod
    public void check(PluginCall call) {
        manager()
            .getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                JSObject result = new JSObject();
                result.put("available", available(info));
                result.put("versionCode", info.availableVersionCode());
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject("A Play Store não respondeu: " + e.getMessage()));
    }

    @PluginMethod
    public void update(PluginCall call) {
        AppUpdateManager manager = manager();
        manager
            .getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                JSObject result = new JSObject();
                boolean started = false;
                if (available(info) && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) && getActivity() != null) {
                    manager.startUpdateFlow(info, getActivity(), AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE));
                    started = true;
                }
                result.put("started", started);
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject("A Play Store não respondeu: " + e.getMessage()));
    }
}
