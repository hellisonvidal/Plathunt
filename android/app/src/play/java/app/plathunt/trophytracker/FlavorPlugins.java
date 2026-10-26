package app.plathunt.trophytracker;

import com.getcapacitor.Plugin;
import java.util.Collections;
import java.util.List;

/**
 * Versão da Play Store: as atualizações vêm pela própria loja (a política do
 * Google não deixa o app se atualizar sozinho); o plugin só pergunta à loja
 * se há versão nova e abre a tela de atualização dela.
 */
final class FlavorPlugins {
    private FlavorPlugins() {}

    static List<Class<? extends Plugin>> list() {
        return Collections.singletonList(PlayUpdatePlugin.class);
    }
}
