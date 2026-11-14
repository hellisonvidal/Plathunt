package app.plathunt.trophytracker;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Compra única do Plathunt Pro pelo Google Play Billing (só na versão da Play
 * Store). O produto é cadastrado na Play Console (Monetizar → Produtos no app)
 * com o id passado pelo app ("plathunt_pro").
 *
 * - status: se o produto existe na loja (e o preço) e se já foi comprado.
 * - buy: abre a tela de compra do Google Play; o resultado volta na mesma chamada.
 *
 * Toda compra concluída é confirmada (acknowledge); sem isso o Google
 * reembolsa em 3 dias.
 */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin {

    private BillingClient client;
    /** Compra em andamento: resolvida quando o Google Play devolve o resultado. */
    private PluginCall pendingBuy;
    private String pendingProduct;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this::onPurchasesUpdated)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
        super.handleOnDestroy();
    }

    /** Conecta ao Google Play (se preciso) e segue; sem conexão, rejeita a chamada. */
    private void connected(PluginCall call, Runnable next) {
        if (client.isReady()) {
            next.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) next.run();
                else call.reject("Google Play indisponível: " + result.getDebugMessage(), String.valueOf(result.getResponseCode()));
            }

            @Override
            public void onBillingServiceDisconnected() {
                // A reconexão automática tenta de novo na próxima chamada.
            }
        });
    }

    private void productDetails(String productId, PluginCall call, ProductCallback done) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()))
            .build();
        client.queryProductDetailsAsync(params, (result, details) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Google Play: " + result.getDebugMessage(), String.valueOf(result.getResponseCode()));
                return;
            }
            List<ProductDetails> list = details.getProductDetailsList();
            done.run(list == null || list.isEmpty() ? null : list.get(0));
        });
    }

    private interface ProductCallback {
        void run(ProductDetails details);
    }

    /** Confirma a compra (obrigatório) e diz se ela libera o produto. */
    private boolean owns(Purchase p, String productId) {
        if (!p.getProducts().contains(productId)) return false;
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return false;
        if (!p.isAcknowledged()) {
            client.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                r -> {}
            );
        }
        return true;
    }

    @PluginMethod
    public void status(PluginCall call) {
        String productId = call.getString("productId", "plathunt_pro");
        connected(call, () -> productDetails(productId, call, details -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
            client.queryPurchasesAsync(params, (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Google Play: " + result.getDebugMessage(), String.valueOf(result.getResponseCode()));
                    return;
                }
                boolean owned = false;
                boolean pending = false;
                for (Purchase p : purchases) {
                    if (owns(p, productId)) owned = true;
                    else if (p.getProducts().contains(productId) && p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
                }
                JSObject out = new JSObject();
                out.put("available", details != null);
                out.put("owned", owned);
                out.put("pending", pending);
                ProductDetails.OneTimePurchaseOfferDetails offer = details == null ? null : details.getOneTimePurchaseOfferDetails();
                if (offer != null) out.put("price", offer.getFormattedPrice());
                call.resolve(out);
            });
        }));
    }

    @PluginMethod
    public void buy(PluginCall call) {
        String productId = call.getString("productId", "plathunt_pro");
        if (pendingBuy != null) {
            call.reject("Já existe uma compra em andamento.");
            return;
        }
        connected(call, () -> productDetails(productId, call, details -> {
            if (details == null) {
                call.reject("Produto não encontrado na Play Store.", "unavailable");
                return;
            }
            if (getActivity() == null) {
                call.reject("App em segundo plano.");
                return;
            }
            List<BillingFlowParams.ProductDetailsParams> products = new ArrayList<>();
            products.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build());
            pendingBuy = call;
            pendingProduct = productId;
            getActivity().runOnUiThread(() -> {
                BillingResult r = client.launchBillingFlow(
                    getActivity(),
                    BillingFlowParams.newBuilder().setProductDetailsParamsList(products).build()
                );
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) finishBuy(r, null);
            });
        }));
    }

    private void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        finishBuy(result, purchases);
    }

    private void finishBuy(BillingResult result, List<Purchase> purchases) {
        PluginCall call = pendingBuy;
        String productId = pendingProduct;
        pendingBuy = null;
        pendingProduct = null;
        boolean owned = false;
        boolean pending = false;
        if (purchases != null && productId != null) {
            for (Purchase p : purchases) {
                if (owns(p, productId)) owned = true;
                else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
            }
        }
        int code = result.getResponseCode();
        JSObject out = new JSObject();
        out.put("owned", owned || code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED);
        out.put("pending", pending);
        out.put("cancelled", code == BillingClient.BillingResponseCode.USER_CANCELED);
        // Compra feita fora de uma chamada (ex.: pagamento pendente que caiu depois): avisa o app.
        notifyListeners("purchase", out);
        if (call == null) return;
        if (code == BillingClient.BillingResponseCode.OK
            || code == BillingClient.BillingResponseCode.USER_CANCELED
            || code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            call.resolve(out);
        } else {
            call.reject("Google Play: " + result.getDebugMessage(), String.valueOf(code));
        }
    }
}
