import { isValidIsoDate } from "./actions-domain.js";
import { normalizeLang } from "./i18n.js";

const TEMPLATE_DEFS = [
  {
    id: "bill-payment",
    category: "Money & Bills",
    pattern: /\b(invoice|bill|statement of account|tagihan|faktur)\b/i,
    label: {
      en: "Bill payment checklist",
      id: "Daftar periksa pembayaran tagihan",
    },
    steps: [
      {
        key: "verify-amount",
        title: {
          en: "Verify bill amount and reference",
          id: "Periksa nominal dan nomor referensi tagihan",
        },
      },
      {
        key: "pay-bill",
        useDocDue: true,
        title: {
          en: "Pay bill before due date",
          id: "Bayar tagihan sebelum jatuh tempo",
        },
      },
      {
        key: "save-receipt",
        title: {
          en: "Save payment confirmation",
          id: "Simpan bukti pembayaran",
        },
      },
    ],
    links: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    id: "membership-renewal",
    category: "Home & Living",
    pattern: /\b(renewal|renew|membership|lease|tenancy|perpanjangan|sewa)\b/i,
    label: {
      en: "Renewal checklist",
      id: "Daftar periksa perpanjangan",
    },
    steps: [
      {
        key: "review-terms",
        title: {
          en: "Review renewal terms and total",
          id: "Tinjau ketentuan dan biaya perpanjangan",
        },
      },
      {
        key: "submit-renewal",
        useDocDue: true,
        title: {
          en: "Submit renewal before deadline",
          id: "Kirim perpanjangan sebelum tenggat",
        },
      },
      {
        key: "confirm-renewal",
        title: {
          en: "Confirm renewal receipt",
          id: "Konfirmasi tanda terima perpanjangan",
        },
      },
    ],
    links: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    id: "work-study-submission",
    category: "Work & Study",
    pattern:
      /\b(enrollment|syllabus|course|reimbursement|claim|workshop|training|offer|kursus|beasiswa)\b/i,
    label: {
      en: "Submission & approval checklist",
      id: "Daftar periksa pengajuan & persetujuan",
    },
    steps: [
      {
        key: "gather-docs",
        title: {
          en: "Gather required documents and ID",
          id: "Siapkan dokumen pendukung dan identitas",
        },
      },
      {
        key: "submit-form",
        useDocDue: true,
        title: {
          en: "Submit form or claim",
          id: "Kirim formulir atau klaim",
        },
      },
      {
        key: "confirm-approval",
        title: {
          en: "Confirm approval received",
          id: "Konfirmasi persetujuan diterima",
        },
      },
    ],
    links: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    id: "purchase-warranty",
    category: "Purchases",
    pattern: /\b(receipt|warranty|return|order|struk|garansi)\b/i,
    label: {
      en: "Purchase & warranty checklist",
      id: "Daftar periksa pembelian & garansi",
    },
    steps: [
      {
        key: "check-items",
        title: {
          en: "Check receipt items and total",
          id: "Periksa daftar barang dan total struk",
        },
      },
      {
        key: "confirm-warranty",
        useDocDue: true,
        title: {
          en: "Confirm return or warranty window",
          id: "Catat batas retur atau masa garansi",
        },
      },
      {
        key: "archive-proof",
        title: {
          en: "Archive proof of purchase",
          id: "Arsipkan bukti pembelian",
        },
      },
    ],
    links: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    id: "personal-record-check",
    category: "Personal Records",
    pattern: /\b(passport|certificate|policy|id card|ktp|paspor)\b/i,
    label: {
      en: "Personal record check",
      id: "Pemeriksaan dokumen pribadi",
    },
    steps: [
      {
        key: "verify-details",
        title: {
          en: "Verify personal details and reference number",
          id: "Periksa data pribadi dan nomor referensi",
        },
      },
      {
        key: "note-expiry",
        useDocDue: true,
        title: {
          en: "Note expiry or renewal date",
          id: "Catat tanggal berlaku atau perpanjangan",
        },
      },
    ],
    links: [[0, 1]],
  },
];

function clampGroupTitle(raw) {
  const clean = String(raw || "").trim();
  if (clean.length <= 80) return clean;
  return clean.slice(0, 79).trimEnd() + "…";
}

export function suggestWorkflowTemplate(doc, lang = "en") {
  if (!doc || typeof doc !== "object") return null;
  const activeLang = normalizeLang(lang);
  const hay = [doc.title, doc.text, ...(doc.tags || [])].join(" ");
  let def = TEMPLATE_DEFS.find((item) => item.category === doc.category) || null;
  if (!def && doc.category === "Other") {
    def = TEMPLATE_DEFS.find((item) => item.pattern.test(hay)) || null;
  }
  if (!def) return null;

  const docDue = isValidIsoDate(doc.followUp?.due)
    ? doc.followUp.due.trim()
    : "";
  const baseTitle = String(doc.title || "").trim() || def.label[activeLang];
  const groupTitle = clampGroupTitle(baseTitle);

  return {
    id: def.id,
    label: def.label[activeLang],
    groupTitle,
    steps: def.steps.map((step) => ({
      key: step.key,
      title: step.title[activeLang].slice(0, 140),
      due: step.useDocDue ? docDue : "",
    })),
    links: def.links.map(([from, to]) => [from, to]),
  };
}
