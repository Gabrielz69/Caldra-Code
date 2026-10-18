/**
 * REAL-TIME DEVELOPER NOTIFICATIONS (Google Play → Pub/Sub → CALDRA).
 *
 * A notificação NÃO é fonte do estado da compra: ela apenas avisa que algo
 * mudou. O fluxo é sempre purchaseToken → consulta na Subscriptions API v2
 * → gravação do estado completo no banco.
 */

import { createFileRoute } from "@tanstack/react-router";

type PubSubPush = {
  message?: { data?: string };
};

type RtdnPayload = {
  subscriptionNotification?: { purchaseToken?: string; subscriptionId?: string };
  voidedPurchaseNotification?: { purchaseToken?: string };
  testNotification?: { version?: string };
};

export const Route = createFileRoute("/api/public/rtdn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RTDN_SHARED_SECRET"];
        if (!secret) return new Response("not configured", { status: 503 });

        const url = new URL(request.url);
        const provided = url.searchParams.get("token") ?? request.headers.get("x-rtdn-token") ?? "";
        if (provided.length !== secret.length) return new Response("unauthorized", { status: 401 });
        let same = 0;
        for (let i = 0; i < secret.length; i++)
          same |= secret.charCodeAt(i) ^ provided.charCodeAt(i);
        if (same !== 0) return new Response("unauthorized", { status: 401 });

        let payload: RtdnPayload;
        try {
          const push = (await request.json()) as PubSubPush;
          const raw = push.message?.data ? atob(push.message.data) : "{}";
          payload = JSON.parse(raw) as RtdnPayload;
        } catch {
          return new Response("bad request", { status: 400 });
        }

        if (payload.testNotification) return new Response("ok");

        const token =
          payload.subscriptionNotification?.purchaseToken ??
          payload.voidedPurchaseNotification?.purchaseToken;
        if (!token) return new Response("ok");

        const { verifyWithPlay } = await import("@/lib/subscription/play.server");
        const check = await verifyWithPlay(token);
        /* Inconclusivo: devolve 500 para o Pub/Sub reentregar. Nada é rebaixado. */
        if (!check.conclusive) return new Response("retry", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: check.status,
            entitlement: check.entitlement,
            ...(check.productId ? { product_id: check.productId } : {}),
            linked_purchase_token: check.linkedPurchaseToken,
            start_at: check.startAt,
            expires_at: check.expiresAt,
            auto_renew: check.autoRenew,
            last_verified_at: new Date().toISOString(),
            environment: check.environment,
          })
          .eq("provider", "google_play")
          .eq("purchase_token", token);

        if (error) return new Response("retry", { status: 500 });
        return new Response("ok");
      },
    },
  },
});
