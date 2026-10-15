package com.hellisonvidal.perseus;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Exposto para a página de login como Capacitor.Plugins.PsnLogin.
 * login() abre a tela de entrada da Sony e resolve com { npsso } quando o
 * usuário termina de entrar (ou {} se ele fechar a tela).
 */
@CapacitorPlugin(name = "PsnLogin")
public class PsnLoginPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        Intent intent = new Intent(getContext(), PsnLoginActivity.class);
        startActivityForResult(call, intent, "onLoginResult");
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
