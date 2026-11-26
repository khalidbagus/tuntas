import { isValidIsoDate } from "./actions-domain.js";

export function nextIsoCalendarDay(iso) {
  if (!isValidIsoDate(iso)) return "";
  const [y, m, d] = iso.trim().split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const year = String(next.getUTCFullYear()).padStart(4, "0");
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function icsFilename(action) {
  const slug =
    String(action?.title || "reminder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "reminder";
  const due = isValidIsoDate(action?.due) ? `-${action.due.trim()}` : "";
  return `tuntas-${slug}${due}.ics`;
}

function buildDescription(action, doc, groupTitle) {
  const lines = [];
  if (doc?.title) lines.push(`Source document: ${doc.title}`);
  if (groupTitle) lines.push(`Workflow group: ${groupTitle}`);
  if (action?.quote && String(action.quote).trim()) {
    lines.push(`Excerpt: ${String(action.quote).trim()}`);
  }
  lines.push("Exported from Tuntas");
  return lines.join("\n");
}

function formatUtcStamp(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

export function buildIcsEvent(
  action,
  doc = null,
  { groupTitle = "", now = new Date() } = {},
) {
  if (!action || !isValidIsoDate(action.due)) return null;
  const startIso = action.due.trim();
  const endIso = nextIsoCalendarDay(startIso);
  if (!endIso) return null;
  const start = startIso.replace(/-/g, "");
  const end = endIso.replace(/-/g, "");
  const uid = `${String(action.id || "action").replace(/[^a-zA-Z0-9._-]/g, "_")}@tuntas.app`;
  const summary = escapeIcsText(String(action.title || "Tuntas reminder").trim());
  const description = escapeIcsText(buildDescription(action, doc, groupTitle));

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tuntas//Paperwork Follow-up//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUtcStamp(now)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function buildGoogleCalendarUrl(
  action,
  doc = null,
  { groupTitle = "" } = {},
) {
  if (!action || !isValidIsoDate(action.due)) return "";
  const startIso = action.due.trim();
  const endIso = nextIsoCalendarDay(startIso);
  if (!endIso) return "";
  const dates = `${startIso.replace(/-/g, "")}/${endIso.replace(/-/g, "")}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: String(action.title || "Tuntas reminder").trim(),
    dates,
    details: buildDescription(action, doc, groupTitle),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadActionIcs(action, doc = null, opts = {}) {
  const ics = buildIcsEvent(action, doc, opts);
  if (!ics) return false;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = icsFilename(action);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
