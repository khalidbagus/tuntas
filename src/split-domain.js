export const SPLIT_CURRENCIES = ["IDR", "USD", "SGD", "EUR", "GBP"];

export const CURRENCY_META = {
  IDR: { symbol: "Rp", decimals: 0 },
  USD: { symbol: "$", decimals: 2 },
  SGD: { symbol: "S$", decimals: 2 },
  EUR: { symbol: "€", decimals: 2 },
  GBP: { symbol: "£", decimals: 2 },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  const clean = email.trim().toLowerCase();
  return EMAIL_RE.test(clean) ? clean : "";
}

function roundForCurrency(value, currency = "USD") {
  const decimals = CURRENCY_META[currency]?.decimals ?? 2;
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function parseFlexibleAmount(raw, currencyHint = "") {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== "string") return 0;
  let s = raw.trim().replace(/[^\d.,]/g, "");
  if (!s) return 0;

  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // e.g. "184.000" or "1.250.000"
    return Number(s.replace(/\./g, ""));
  }
  if (/^\d{1,3}(,\d{3})+$/.test(s) && currencyHint === "IDR") {
    return Number(s.replace(/,/g, ""));
  }
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    return Number(s.replace(/,/g, ""));
  }
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d+,\d{1,2}$/.test(s)) {
    return Number(s.replace(",", "."));
  }
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function detectReceiptCurrency(doc, lang = "en") {
  const hay = [
    ...(doc?.facts || []).map((f) => `${f.label} ${f.value} ${f.quote}`),
    ...(doc?.tags || []),
    doc?.text || "",
  ].join(" ");
  if (/\bIDR\b|\bRp\.?\s*\d/i.test(hay)) return "IDR";
  if (/\bSGD\b|S\$\s*\d/i.test(hay)) return "SGD";
  if (/\bEUR\b|€\s*\d/i.test(hay)) return "EUR";
  if (/\bGBP\b|£\s*\d/i.test(hay)) return "GBP";
  if (/\bUSD\b|\$\s*\d/i.test(hay)) return "USD";
  return lang === "id" ? "IDR" : "USD";
}

export function detectReceiptTotal(doc) {
  const currency = detectReceiptCurrency(doc, "en");
  const facts = Array.isArray(doc?.facts) ? doc.facts : [];
  for (const fact of facts) {
    if (/\b(total|amount|grand total|jumlah)\b/i.test(fact.label || "")) {
      const parsed = parseFlexibleAmount(fact.value, currency);
      if (parsed > 0) return parsed;
    }
  }
  const text = String(doc?.text || "");
  const totalMatches = [
    ...text.matchAll(
      /(?:grand\s+total|total(?:\s+due|\s+amount)?)\s*[:\-]?\s*(?:IDR|USD|SGD|EUR|GBP|Rp|S\$|\$|€|£)?\s*([\d.,]+)/gi,
    ),
  ];
  if (totalMatches.length) {
    const parsed = parseFlexibleAmount(
      totalMatches[totalMatches.length - 1][1],
      currency,
    );
    if (parsed > 0) return parsed;
  }
  return 0;
}

export function formatSplitAmount(
  amount,
  currency = "USD",
  locale = "en-US",
) {
  const code = SPLIT_CURRENCIES.includes(currency) ? currency : "USD";
  const decimals = CURRENCY_META[code]?.decimals ?? 2;
  const num = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    return `${code} ${num.toFixed(decimals)}`;
  }
}

export function parseReceiptLineItems(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  const items = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (
      /^(grand\s+)?total|subtotal|tax|restaurant\s+tax|service|rounding|discount|bill\s+no|receipt\s+no|receipt\s+number|nota\s+no|order\s+date|order\s+type|date|tanggal|currency|payment|thank|jumlah|merchant|lokasi/i.test(
        line,
      )
    ) {
      continue;
    }
    const m = /^(.{2,60}?)\s+(?:IDR|USD|SGD|EUR|GBP|Rp|S\$|\$|€|£)?\s*(\d[\d.,]*)$/.exec(
      line,
    );
    if (!m) continue;
    const amount = parseFlexibleAmount(m[2]);
    if (amount > 0) {
      items.push({
        id: `item-${i + 1}`,
        name: m[1].replace(/[:\-]+$/, "").trim(),
        amount,
      });
    }
  }
  return items;
}

export function calculateShares({
  mode = "equal",
  totalAmount = 0,
  participants = [],
  items = [],
  taxOrTip = 0,
  currency = "USD",
}) {
  const cleanParticipants = (participants || []).filter(
    (p) => p && String(p.name || "").trim(),
  );
  if (!cleanParticipants.length) {
    return { shares: [], computedTotal: 0 };
  }

  const decimals = CURRENCY_META[currency]?.decimals ?? 2;
  const factor = 10 ** decimals;
  const toUnits = (v) => Math.round(Number(v || 0) * factor);
  const fromUnits = (u) => u / factor;

  if (mode === "itemized") {
    const unitMap = new Map(cleanParticipants.map((p) => [p.id, 0]));
    let itemsTotalUnits = 0;
    for (const item of items || []) {
      const priceUnits = toUnits(item.amount);
      if (priceUnits <= 0) continue;
      const assigned = (item.assigneeIds || []).filter((id) => unitMap.has(id));
      const targets = assigned.length
        ? assigned
        : cleanParticipants.map((p) => p.id);
      const base = Math.floor(priceUnits / targets.length);
      let rem = priceUnits - base * targets.length;
      for (const pid of targets) {
        const extra = rem > 0 ? 1 : 0;
        if (rem > 0) rem -= 1;
        unitMap.set(pid, (unitMap.get(pid) || 0) + base + extra);
      }
      itemsTotalUnits += priceUnits;
    }

    const extraUnits = Math.max(0, toUnits(taxOrTip));
    if (extraUnits > 0) {
      if (itemsTotalUnits > 0) {
        let distributed = 0;
        const entries = [...unitMap.entries()];
        entries.forEach(([pid, u], idx) => {
          const shareExtra =
            idx === entries.length - 1
              ? extraUnits - distributed
              : Math.round((extraUnits * u) / itemsTotalUnits);
          distributed += shareExtra;
          unitMap.set(pid, u + shareExtra);
        });
      } else {
        const base = Math.floor(extraUnits / cleanParticipants.length);
        let rem = extraUnits - base * cleanParticipants.length;
        for (const p of cleanParticipants) {
          const add = rem > 0 ? 1 : 0;
          if (rem > 0) rem -= 1;
          unitMap.set(p.id, (unitMap.get(p.id) || 0) + base + add);
        }
      }
    }

    const shares = cleanParticipants.map((p) => ({
      ...p,
      email: normalizeEmail(p.email),
      amount: roundForCurrency(fromUnits(unitMap.get(p.id) || 0), currency),
    }));
    const computedTotal = roundForCurrency(
      shares.reduce((sum, s) => sum + s.amount, 0),
      currency,
    );
    return { shares, computedTotal };
  }

  // Equal split
  const totalUnits = Math.max(0, toUnits(totalAmount));
  const base = Math.floor(totalUnits / cleanParticipants.length);
  let remainder = totalUnits - base * cleanParticipants.length;
  const nonSelfIdx = cleanParticipants.findIndex((p) => !p.isSelf);
  const anchorIdx = nonSelfIdx >= 0 ? nonSelfIdx : 0;

  const shares = cleanParticipants.map((p, idx) => {
    const bonus = idx === anchorIdx ? remainder : 0;
    return {
      ...p,
      email: normalizeEmail(p.email),
      amount: roundForCurrency(fromUnits(base + bonus), currency),
    };
  });
  const computedTotal = roundForCurrency(
    shares.reduce((sum, s) => sum + s.amount, 0),
    currency,
  );
  return { shares, computedTotal };
}

export function buildSplitInviteUrl(
  splitId,
  baseHref = (globalThis.location?.origin || "") +
    (globalThis.location?.pathname || "/"),
) {
  return `${baseHref}#/split/${splitId}`;
}

export function buildSplitShareText(
  split,
  share,
  { inviteUrl = "", locale = "en-US" } = {},
) {
  const formatted = formatSplitAmount(share.amount, split.currency, locale);
  const lines = [
    `Split bill: ${split.title}`,
    `Participant: ${share.participantName}`,
    `Your share: ${formatted}`,
  ];
  if (split.paymentInstructions) {
    lines.push(`Payment instructions: ${split.paymentInstructions}`);
  }
  if (inviteUrl) {
    lines.push(`Respond & submit proof in Tuntas: ${inviteUrl}`);
  }
  return lines.join("\n");
}

export function buildSplitMailtoHref(
  split,
  share,
  { inviteUrl = "", locale = "en-US" } = {},
) {
  const email = normalizeEmail(share.participantEmail);
  if (!email) return "";
  const formatted = formatSplitAmount(share.amount, split.currency, locale);
  const subject = `[Tuntas Split Bill] ${split.title} — ${formatted}`;
  const body = buildSplitShareText(split, share, { inviteUrl, locale });
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

export function verifyTransferProofLocally({
  text = "",
  expectedAmount = 0,
  currency = "USD",
} = {}) {
  const clean = String(text || "").trim();
  if (!clean) {
    return {
      matched: false,
      detectedAmount: 0,
      reference: "",
      summary: "",
    };
  }
  const tolerance = currency === "IDR" ? 1 : 0.05;
  const nums = [...clean.matchAll(/\d[\d.,]*/g)]
    .map((m) => parseFlexibleAmount(m[0], currency))
    .filter((n) => n > 0);
  const best = nums.find((n) => Math.abs(n - Number(expectedAmount || 0)) <= tolerance);
  const refMatch = /(?:ref(?:erence)?|trx|id|no\.?)\s*[:#-]?\s*([A-Z0-9-]{4,24})/i.exec(
    clean,
  );
  const reference = refMatch ? refMatch[1] : "";
  const detectedAmount = best ?? nums[0] ?? 0;
  const matched = Boolean(best !== undefined && expectedAmount > 0);
  const summary = [
    matched ? "Amount matched locally" : "Transfer note submitted",
    detectedAmount ? `Detected ${detectedAmount}` : "",
    reference ? `Ref ${reference}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 380);
  return {
    matched,
    detectedAmount,
    reference,
    summary,
  };
}
