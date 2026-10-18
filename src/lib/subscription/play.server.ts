/**
 * VERIFICAÇÃO NO GOOGLE PLAY — somente servidor.
 *
 * Usa a Subscriptions API v2 (`purchases.subscriptionsv2.get`), nunca a v1
 * depreciada. As credenciais da service account vivem exclusivamente em
 * segredo do servidor; jamais no frontend.
 *
 * Toda resposta é CONCLUSIVA ou INCONCLUSIVA. Falha de rede, credencial
 * ausente ou erro 5xx são INCONCLUSIVOS e nunca rebaixam ninguém.
 */

export type PlayStatus =
  "ACTIVE" | "CANCELED" | "IN_GRACE_PERIOD" | "ON_HOLD" | "PAUSED" | "EXPIRED" | "PENDING";

export type PlayVerification =
  | {
      conclusive: true;
      status: PlayStatus;
      entitlement: "PRO" | "FREE";
      productId: string;
      startAt: string | null;
      expiresAt: string | null;
      autoRenew: boolean;
      linkedPurchaseToken: string | null;
      environment: "test" | "production";
    }
  | { conclusive: false; reason: "no_credentials" | "network" | "provider_error" };

const STATE_MAP: Record<string, PlayStatus> = {
  SUBSCRIPTION_STATE_ACTIVE: "ACTIVE",
  SUBSCRIPTION_STATE_CANCELED: "CANCELED",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "IN_GRACE_PERIOD",
  SUBSCRIPTION_STATE_ON_HOLD: "ON_HOLD",
  SUBSCRIPTION_STATE_PAUSED: "PAUSED",
  SUBSCRIPTION_STATE_EXPIRED: "EXPIRED",
  SUBSCRIPTION_STATE_PENDING: "PENDING",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "EXPIRED",
  SUBSCRIPTION_STATE_UNSPECIFIED: "PENDING",
};

/** Estados que mantêm o acesso PRO enquanto a validade não passou. */
const GRANTS: PlayStatus[] = ["ACTIVE", "CANCELED", "IN_GRACE_PERIOD", "ON_HOLD", "PAUSED"];

function b64url(bytes: ArrayBuffer | string): string {
  const raw = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

/** Access token OAuth2 da service account (JWT assinado com RS256). */
async function accessToken(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${header}.${claim}`);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  const assertion = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

/** Consulta o estado atual da assinatura no Google Play. */
export async function verifyWithPlay(purchaseToken: string): Promise<PlayVerification> {
  const rawCreds = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
  const packageName = process.env["GOOGLE_PLAY_PACKAGE_NAME"];
  if (!rawCreds || !packageName) return { conclusive: false, reason: "no_credentials" };

  try {
    const creds = JSON.parse(rawCreds) as { client_email: string; private_key: string };
    const token = await accessToken(creds);
    if (!token) return { conclusive: false, reason: "provider_error" };

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName,
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (res.status >= 500) return { conclusive: false, reason: "provider_error" };
    if (!res.ok && res.status !== 404 && res.status !== 400) {
      return { conclusive: false, reason: "provider_error" };
    }

    if (res.status === 404 || res.status === 400) {
      /* Token desconhecido no Play: resposta conclusiva de que não há direito. */
      return {
        conclusive: true,
        status: "EXPIRED",
        entitlement: "FREE",
        productId: "",
        startAt: null,
        expiresAt: null,
        autoRenew: false,
        linkedPurchaseToken: null,
        environment: "production",
      };
    }

    const body = (await res.json()) as {
      subscriptionState?: string;
      startTime?: string;
      testPurchase?: unknown;
      linkedPurchaseToken?: string;
      lineItems?: {
        productId?: string;
        expiryTime?: string;
        autoRenewingPlan?: { autoRenewEnabled?: boolean };
      }[];
    };

    const status = STATE_MAP[body.subscriptionState ?? ""] ?? "PENDING";
    const line = body.lineItems?.[0];
    const expiresAt = line?.expiryTime ?? null;
    const notExpired = !expiresAt || new Date(expiresAt).getTime() > Date.now();

    return {
      conclusive: true,
      status,
      entitlement: GRANTS.includes(status) && notExpired ? "PRO" : "FREE",
      productId: line?.productId ?? "",
      startAt: body.startTime ?? null,
      expiresAt,
      autoRenew: Boolean(line?.autoRenewingPlan?.autoRenewEnabled),
      linkedPurchaseToken: body.linkedPurchaseToken ?? null,
      environment: body.testPurchase ? "test" : "production",
    };
  } catch {
    return { conclusive: false, reason: "network" };
  }
}
