export const categories = [
  "Money & Bills",
  "Home & Living",
  "Work & Study",
  "Purchases",
  "Personal Records",
  "Other",
];
export const MAX_BYTES = 8 * 1024 * 1024,
  MAX_TEXT = 16000;
export const sample = {
  title: "Household membership renewal notice",
  text: "Household membership renewal notice\nSYNTHETIC SAMPLE · HM-204\nAnnual family plan\nTotal: USD 48.00\nRenew your membership by 12 December 2026.",
};
export function validateFile(size, mime, b) {
  if (!size || size > MAX_BYTES)
    throw Error("Choose a nonempty file up to 8 MB.");
  const types = {
    "application/pdf": [37, 80, 68, 70, 45],
    "image/png": [137, 80, 78, 71, 13, 10, 26, 10],
    "image/jpeg": [255, 216, 255],
  };
  const found = Object.keys(types).find((t) =>
    types[t].every((v, i) => b[i] === v),
  );
  if (!found || (mime && mime !== found && mime !== "application/octet-stream"))
    throw Error("Choose a PDF, JPEG or PNG with a matching file format.");
  return found;
}
export function validateText(text) {
  if (!text.trim() || text.length > MAX_TEXT)
    throw Error("Paste between 1 and 16,000 characters.");
  return text;
}
export async function fingerprint(blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
const rules = [
  ["Purchases", /\b(receipt|proof of purchase)\b/i],
  ["Money & Bills", /\b(invoice|bill|statement of account)\b/i],
  [
    "Home & Living",
    /\b(lease|tenancy|renewal notice|membership renewal|policy renewal)\b/i,
  ],
  ["Work & Study", /\b(syllabus|course outline|employment offer)\b/i],
  ["Personal Records", /\b(birth certificate|passport)\b/i],
];
const months = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
function validIsoDate(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31)
    return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  )
    return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function parseUnambiguousDate(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const found = new Map();
  const addMatch = (iso, raw) => {
    if (iso && !found.has(iso)) found.set(iso, raw);
  };
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))
    addMatch(validIsoDate(Number(m[1]), Number(m[2]), Number(m[3])), m[0]);
  for (const m of text.matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?),?\s+(\d{4})\b/gi,
  ))
    addMatch(
      validIsoDate(Number(m[3]), months[m[2].toLowerCase()], Number(m[1])),
      m[0],
    );
  for (const m of text.matchAll(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi,
  ))
    addMatch(
      validIsoDate(Number(m[3]), months[m[1].toLowerCase()], Number(m[2])),
      m[0],
    );
  if (found.size !== 1) return null;
  const [[iso, raw]] = [...found.entries()];
  return { iso, raw };
}
export function formatCalendarDate(iso, locale) {
  if (typeof iso !== "string") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const formatted = validIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  if (!formatted) return iso;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}
const monthNamesPattern =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const actionDeadlineCueRe = new RegExp(
  `\\b(?:due(?:\\s+(?:date|by|on))?|deadline(?:\\s*:)?|expires?(?:\\s+on)?|on\\s+or\\s+before|no\\s+later\\s+than|(?:by|before|until)(?=\\s+(?:the\\s+)?(?:\\d|${monthNamesPattern}\\b|(?:next|this|coming|within)\\b)))\\b`,
  "i",
);
const ambiguousDateInSpanRe =
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:next|this|coming)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)\b|\bwithin\s+\d+\s+(?:days?|weeks?|months?)\b/i;
const partialNamedDateRe = new RegExp(
  `\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+${monthNamesPattern}|${monthNamesPattern}\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`,
  "i",
);
export function parseActionDueDate(quote) {
  if (typeof quote !== "string" || !quote.trim()) return null;
  const candidates = new Map();
  for (const clause of quote.split(/[.!?;]+/)) {
    const m = actionDeadlineCueRe.exec(clause);
    if (!m) continue;
    const span = clause.slice(m.index + m[0].length);
    if (ambiguousDateInSpanRe.test(span)) return null;
    const parsed = parseUnambiguousDate(span);
    if (!parsed) {
      if (partialNamedDateRe.test(span) || /\b\d{4}-\d{2}-\d{2}\b/.test(span))
        return null;
      continue;
    }
    if (!candidates.has(parsed.iso)) candidates.set(parsed.iso, parsed.raw);
  }
  if (candidates.size !== 1) return null;
  const [[iso, raw]] = [...candidates.entries()];
  return { iso, raw };
}
const actionLineRe =
  /\b(renew|renewal|pay|payment due|due by|due date|expires?)\b/i;
const negatedLineRe =
  /\b(no action|not required|already paid|payment received)\b/i;
const deadlineCueRe =
  /\b(by|before|due|until|expires?)\b|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i;
const actionVerbRe = /\b(renew|pay|submit|confirm|update|complete)\b/i;
function extractLocalFollowUp(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let best = null;
  let bestScore = 1;
  for (const line of lines) {
    if (!actionLineRe.test(line) || negatedLineRe.test(line)) continue;
    const parsed = parseActionDueDate(line);
    let score = 0;
    if (parsed) score += 4;
    if (deadlineCueRe.test(line)) score += 2;
    if (actionVerbRe.test(line)) score += 2;
    if (/\b(notice|header|summary)\b/i.test(line) && !actionVerbRe.test(line))
      score -= 1;
    if (score > bestScore) {
      bestScore = score;
      best = { line, parsed };
    }
  }
  if (!best) return undefined;
  const cleaned = best.line
    .replace(/\s+(?:by|before|on or before|until|due(?:\s+by|\s+on)?)\s+.+$/i, "")
    .replace(/[.\s]+$/, "")
    .trim();
  const title = (cleaned.length >= 3 ? cleaned : best.line).slice(0, 140);
  return {
    title,
    quote: best.line.slice(0, 320),
    dueDate: best.parsed?.iso || "",
    dueText: best.parsed?.raw || "",
  };
}
export function localClassifier({ text, name }) {
  const matches = rules.filter(([, r]) => r.test(text));
  const totals = [
    ...text.matchAll(
      /^\s*Total\s*:\s*((?:USD|IDR|EUR|GBP|Rp|\$)\s*\d[\d.,]*)\s*$/gim,
    ),
  ];
  const total = totals.length === 1 ? totals[0] : null;
  const firstLine = text.trim().split(/\r?\n/)[0] || "";
  const clear =
    matches.length === 1 &&
    matches[0][1].test(firstLine) &&
    !/\b(?:not|no|maybe|example of)\b/i.test(firstLine) &&
    new Set(totals.map((m) => m[1])).size <= 1;
  const followUp = extractLocalFollowUp(text);
  return {
    title: text.trim().split(/\r?\n/)[0]?.slice(0, 100) || name,
    category: matches.length === 1 ? matches[0][0] : "Other",
    confidence: clear ? "high" : "uncertain",
    evidence: matches.length === 1 ? text.match(matches[0][1])[0] : "",
    facts: total
      ? [{ label: "Total", value: total[1], quote: total[0].trim() }]
      : [],
    ...(followUp ? { followUp } : {}),
    mode: "Local rules",
  };
}
const bounded = (s, max) =>
  typeof s === "string" && s.trim().length > 0 && s.length <= max;
export function validateFollowUp(raw, text, { image = false } = {}) {
  if (!raw || typeof raw !== "object") return null;
  if (!bounded(raw.title, 140) || !bounded(raw.quote, 320)) return null;
  if (!image && (typeof text !== "string" || !text.includes(raw.quote)))
    return null;
  const rawDueText =
    typeof raw.dueText === "string" &&
    raw.dueText.trim() &&
    raw.quote.includes(raw.dueText.trim())
      ? raw.dueText.trim()
      : "";
  const hasDueDate =
    Object.prototype.hasOwnProperty.call(raw, "dueDate") &&
    typeof raw.dueDate === "string";
  const rawDueDate = hasDueDate ? raw.dueDate.trim() : "";
  const actionDate = parseActionDueDate(raw.quote);
  const parsedDueTextDate = rawDueText
    ? parseUnambiguousDate(rawDueText)
    : null;
  let due = "";
  if (hasDueDate && rawDueDate === "") {
    due = "";
  } else if (rawDueDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDueDate);
    const validRawDue = m
      ? validIsoDate(Number(m[1]), Number(m[2]), Number(m[3]))
      : null;
    if (
      validRawDue &&
      actionDate &&
      actionDate.iso === validRawDue &&
      (!parsedDueTextDate || parsedDueTextDate.iso === validRawDue)
    )
      due = validRawDue;
  } else if (actionDate) {
    due = actionDate.iso;
  }
  const key =
    "followup:" + raw.quote.trim().toLowerCase().replace(/\s+/g, " ");
  return {
    key,
    title: raw.title.trim(),
    quote: raw.quote,
    dueText: due ? rawDueText || actionDate?.raw || "" : "",
    due,
    visualReview: Boolean(image),
  };
}
export function validateProposal(
  raw,
  text,
  { image = false, partial = false } = {},
) {
  if (
    !raw ||
    !bounded(raw.title, 120) ||
    !categories.includes(raw.category) ||
    !["high", "uncertain"].includes(raw.confidence) ||
    typeof raw.evidence !== "string" ||
    raw.evidence.length > 320 ||
    !Array.isArray(raw.facts) ||
    raw.facts.length > 8
  )
    throw Error("The classification could not be validated.");
  let unsupported = false;
  const facts = raw.facts
    .map((f) => {
      if (
        !f ||
        !bounded(f.label, 48) ||
        !bounded(f.value, 160) ||
        !bounded(f.quote, 320)
      )
        throw Error("Invalid extracted field.");
      if (!f.quote.includes(f.value) || (!image && !text.includes(f.quote))) {
        unsupported = true;
        return null;
      }
      return { label: f.label.trim(), value: f.value, quote: f.quote };
    })
    .filter(Boolean);
  let followUp = null;
  try {
    followUp = validateFollowUp(raw.followUp, text, { image });
  } catch {
    followUp = null;
  }
  const review =
    image ||
    partial ||
    unsupported ||
    raw.confidence !== "high" ||
    raw.category === "Other" ||
    !raw.evidence.trim() ||
    !text.includes(raw.evidence);
  return {
    title: raw.title.trim(),
    category: raw.category,
    evidence: raw.evidence,
    facts,
    followUp,
    status: review ? "needs_review" : "organized",
    reason: image
      ? "Check the reading against the original image."
      : partial
        ? "Only part of the original was analyzed."
        : unsupported
          ? "An unsupported field was omitted."
          : review
            ? "Check the suggested category."
            : "",
  };
}
export function matchesQuery(doc, q) {
  const hay = [
    doc.title,
    doc.category,
    doc.name,
    doc.text,
    ...(doc.tags || []),
    ...(doc.facts || []).map((f) => f.value),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((part) => hay.includes(part));
}
