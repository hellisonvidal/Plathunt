package com.hellisonvidal.plathunt;

import com.getcapacitor.Plugin;
import java.util.Collections;
import java.util.List;

/**
 * Plugins só da versão do GitHub (APK instalado por fora da loja): a
 * atualização por dentro do app baixa o APK novo da Release e abre o instalador.
 */
final class FlavorPlugins {
    private FlavorPlugins() {}

    static List<Class<? extends Plugin>> list() {
        return Collections.singletonList(AppUpdaterPlugin.class);
    }
}
