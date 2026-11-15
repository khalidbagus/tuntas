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
  title: "Fieldnote Supply receipt",
  text: "Fieldnote Supply receipt\nSYNTHETIC SAMPLE · FN-024\nPaper notebook × 2\nTotal: USD 24.00\nPayment received. Thank you!",
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
  ["Home & Living", /\b(lease|tenancy)\b/i],
  ["Work & Study", /\b(syllabus|course outline|employment offer)\b/i],
  ["Personal Records", /\b(birth certificate|passport)\b/i],
];
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
  return {
    title: text.trim().split(/\r?\n/)[0]?.slice(0, 100) || name,
    category: matches.length === 1 ? matches[0][0] : "Other",
    confidence: clear ? "high" : "uncertain",
    evidence: matches.length === 1 ? text.match(matches[0][1])[0] : "",
    facts: total
      ? [{ label: "Total", value: total[1], quote: total[0].trim() }]
      : [],
    mode: "Local rules",
  };
}
const bounded = (s, max) =>
  typeof s === "string" && s.trim().length > 0 && s.length <= max;
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
