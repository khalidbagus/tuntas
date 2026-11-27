const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ID_PHONE_RE = /(?<!\d)(?:\+62|62|0)8\d(?:[\s.-]?\d){7,11}\b/g;
const INTL_PHONE_RE =
  /(?<!\w)\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
const NPWP_RE = /\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b/g;
const MASKED_ACCT_RE = /\b\d{4}[xX*]{3,6}\d{2,4}\b/g;
const CARD_GROUP_RE = /\b(?:\d{4}[\s-]){3}\d{4}\b/g;
const LONG_ID_RE = /(?<![\d.,])\b\d{10,24}\b(?![\d.,])/g;
const CURRENCY_PREFIX_RE = /(?:rp\.?|idr|usd|sgd|eur|gbp|\$|€|£)\s*$/i;

export function maskSensitiveText(
  rawText,
  { emails = true, phones = true, accounts = true } = {},
) {
  if (typeof rawText !== "string" || !rawText) {
    return {
      text: rawText || "",
      counts: { emails: 0, phones: 0, accounts: 0, total: 0 },
    };
  }

  let out = rawText;
  let emailCount = 0;
  let phoneCount = 0;
  let accountCount = 0;

  if (emails) {
    out = out.replace(EMAIL_RE, () => {
      emailCount += 1;
      return "[EMAIL]";
    });
  }

  if (phones) {
    out = out.replace(ID_PHONE_RE, () => {
      phoneCount += 1;
      return "[PHONE]";
    });
    out = out.replace(INTL_PHONE_RE, () => {
      phoneCount += 1;
      return "[PHONE]";
    });
  }

  if (accounts) {
    for (const re of [NPWP_RE, MASKED_ACCT_RE, CARD_GROUP_RE]) {
      out = out.replace(re, () => {
        accountCount += 1;
        return "[ACCOUNT_ID]";
      });
    }
    out = out.replace(LONG_ID_RE, (match, offset, full) => {
      const before = full.slice(Math.max(0, offset - 12), offset);
      if (CURRENCY_PREFIX_RE.test(before)) return match;
      accountCount += 1;
      return "[ACCOUNT_ID]";
    });
  }

  return {
    text: out,
    counts: {
      emails: emailCount,
      phones: phoneCount,
      accounts: accountCount,
      total: emailCount + phoneCount + accountCount,
    },
  };
}

export function redactedExportFilename(originalName = "document", ext = "txt") {
  const cleanName = String(originalName || "document").trim();
  const stem = cleanName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const cleanExt = String(ext || "txt").replace(/^\./, "").toLowerCase();
  return `${stem || "document"}-redacted.${cleanExt}`;
}

export function renderRedactedImageBlob(
  imgEl,
  boxes = [],
  mimeType = "image/jpeg",
) {
  return new Promise((resolve, reject) => {
    if (!imgEl || !imgEl.naturalWidth || !imgEl.naturalHeight) {
      reject(Error("Image is not ready for redaction."));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(Error("Canvas context unavailable."));
      return;
    }
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e293b";
    for (const b of boxes || []) {
      const x = Math.round(Math.max(0, Math.min(1, b.x)) * canvas.width);
      const y = Math.round(Math.max(0, Math.min(1, b.y)) * canvas.height);
      const w = Math.round(Math.max(0, Math.min(1, b.w)) * canvas.width);
      const h = Math.round(Math.max(0, Math.min(1, b.h)) * canvas.height);
      if (w > 0 && h > 0) ctx.fillRect(x, y, w, h);
    }
    const outType = mimeType === "image/png" ? "image/png" : "image/jpeg";
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(Error("Could not encode redacted image."));
          return;
        }
        resolve(blob);
      },
      outType,
      outType === "image/jpeg" ? 0.9 : undefined,
    );
  });
}
