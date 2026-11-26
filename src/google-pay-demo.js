import { CURRENCY_META, SPLIT_CURRENCIES } from "./split-domain.js";

export const GOOGLE_PAY_SCRIPT_URL = "https://pay.google.com/gp/p/js/pay.js";

let scriptPromise = null;

export function isGooglePayLoaded() {
  return Boolean(globalThis.google?.payments?.api?.PaymentsClient);
}

export function loadGooglePayScript() {
  if (isGooglePayLoaded()) return Promise.resolve(true);
  if (typeof document === "undefined") {
    return Promise.reject(Error("Google Pay requires a browser environment."));
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${GOOGLE_PAY_SCRIPT_URL}"]`,
      );
      if (existing) {
        const timer = setTimeout(
          () => reject(Error("Google Pay script timed out.")),
          5000,
        );
        existing.addEventListener("load", () => {
          clearTimeout(timer);
          resolve(isGooglePayLoaded());
        });
        existing.addEventListener("error", () => {
          clearTimeout(timer);
          scriptPromise = null;
          reject(Error("Google Pay script unavailable."));
        });
        return;
      }
      const script = document.createElement("script");
      script.src = GOOGLE_PAY_SCRIPT_URL;
      script.async = true;
      const timer = setTimeout(() => {
        scriptPromise = null;
        reject(Error("Google Pay script timed out."));
      }, 5000);
      script.onload = () => {
        clearTimeout(timer);
        if (isGooglePayLoaded()) resolve(true);
        else reject(Error("Google Pay API unavailable."));
      };
      script.onerror = () => {
        clearTimeout(timer);
        scriptPromise = null;
        reject(Error("Google Pay script could not be loaded."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function buildGooglePayRequest({
  amount = 0,
  currency = "USD",
  merchantName = "Tuntas Split Bill (Sandbox Demo)",
} = {}) {
  const code = SPLIT_CURRENCIES.includes(currency) ? currency : "USD";
  const decimals = CURRENCY_META[code]?.decimals ?? 2;
  const totalPrice = Math.max(0, Number(amount || 0)).toFixed(decimals);
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: "CARD",
        parameters: {
          allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
          allowedCardNetworks: ["MASTERCARD", "VISA"],
        },
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: {
            gateway: "example",
            gatewayMerchantId: "exampleGatewayMerchantId",
          },
        },
      },
    ],
    merchantInfo: {
      merchantName,
    },
    transactionInfo: {
      totalPriceStatus: "FINAL",
      totalPrice,
      currencyCode: code,
    },
  };
}

export async function runGooglePaySandbox({
  amount = 0,
  currency = "USD",
  merchantName = "Tuntas Split Bill (Sandbox Demo)",
} = {}) {
  try {
    await loadGooglePayScript();
    const client = new globalThis.google.payments.api.PaymentsClient({
      environment: "TEST",
    });
    const req = buildGooglePayRequest({ amount, currency, merchantName });
    const ready = await client.isReadyToPay({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: req.allowedPaymentMethods,
    });
    if (!ready?.result) {
      return {
        ok: false,
        unavailable: true,
        reason: "Google Pay TEST sheet is not ready in this browser.",
      };
    }
    await client.loadPaymentData(req);
    const tokenPreview = `GPay-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return {
      ok: true,
      mode: "google_pay_test_sheet",
      tokenPreview,
      summary: `Google Pay Sandbox Demo · ${tokenPreview} · ${currency} ${amount}`,
    };
  } catch (err) {
    if (err?.statusCode === "CANCELED") {
      return { ok: false, canceled: true, reason: "canceled" };
    }
    return {
      ok: false,
      unavailable: true,
      reason: err?.message || "Google Pay TEST sheet unavailable.",
    };
  }
}

export function createSimulatedGooglePayToken({
  amount = 0,
  currency = "USD",
} = {}) {
  const code = SPLIT_CURRENCIES.includes(currency) ? currency : "USD";
  const decimals = CURRENCY_META[code]?.decimals ?? 2;
  const formatted = Number(amount || 0).toFixed(decimals);
  const tokenPreview = `GPay-SIM-${Date.now().toString(36).toUpperCase()}`;
  return {
    ok: true,
    mode: "google_pay_simulated",
    tokenPreview,
    summary: `Google Pay Sandbox Demo · Simulated test token (${tokenPreview}) · ${code} ${formatted}`,
  };
}
