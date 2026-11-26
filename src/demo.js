import { fingerprint, validateFile } from "./domain.js";

export const PERSONAL_DB_NAME = "tuntas-workspace-v1";
export const DEMO_DB_NAME = "tuntas-demo-workspace-v1";
export const DEMO_ACCOUNT_EMAIL = "demo@example.com";
export const DEMO_SEED_KEY = "demo-seed-v1";
export const REDACTED_RECEIPT_SEED_KEY = "demo-redacted-receipts-v1";
export const REDACTED_RECEIPT_SOURCE = "Redacted receipt sample";
export const LOCAL_RECEIPT_SEED_KEY = "demo-local-receipts-v1";
export const LOCAL_RECEIPT_EXPANSION_SEED_KEY = "demo-local-receipts-5-8-v1";
export const LOCAL_RECEIPT_SOURCE = "Photographed receipt";
export const DEMO_EXTRA_RECEIPTS_SEED_KEY = "demo-extra-receipts-v1";
export const DEMO_WORKFLOW_SEED_KEY = "demo-connected-workflow-v1";
export const DEMO_RENEWAL_GROUP_ID = "demo-group-household-renewal";

export function isDemoMode(search = globalThis.location?.search ?? "") {
  return new URLSearchParams(search).get("demo") === "1";
}

export function demoWorkspaceHref(
  pathname = globalThis.location?.pathname ?? "/",
  fromRoute = "",
) {
  const params = new URLSearchParams();
  params.set("demo", "1");
  if (
    fromRoute &&
    fromRoute !== "/home" &&
    /^\/[a-z0-9/_-]*$/i.test(fromRoute)
  ) {
    params.set("from", fromRoute);
  }
  return `${pathname}?${params.toString()}#/home`;
}

export function exitDemoHref(
  pathname = globalThis.location?.pathname ?? "/",
  search = globalThis.location?.search ?? "",
) {
  const params = new URLSearchParams(search);
  const rawFrom = params.get("from") || "";
  const targetRoute = /^\/[a-z0-9/_-]*$/i.test(rawFrom) ? rawFrom : "/home";
  params.delete("demo");
  params.delete("receipts");
  params.delete("from");
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}#${targetRoute}`;
}

export const DEMO_FIXTURES = [
  {
    id: "demo-doc-renewal",
    created: Date.UTC(2026, 10, 22, 9, 0),
    title: "Household membership renewal notice",
    name: "Household renewal sample.txt",
    category: "Home & Living",
    status: "organized",
    autoFiled: true,
    reviewed: false,
    reason: "",
    tags: ["renewal", "membership", "synthetic"],
    evidence: "renewal notice",
    text: "Household membership renewal notice\nSYNTHETIC SAMPLE · HM-204\nAnnual family plan\nTotal: USD 48.00\nRenew your membership by 12 December 2026.",
    facts: [
      { label: "Total", value: "USD 48.00", quote: "Total: USD 48.00" },
      {
        label: "Reference",
        value: "HM-204",
        quote: "SYNTHETIC SAMPLE · HM-204",
      },
    ],
    followUp: {
      key: "followup:renew your membership by 12 december 2026.",
      title: "Renew household membership",
      quote: "Renew your membership by 12 December 2026.",
      dueText: "12 December 2026",
      due: "2026-12-12",
      visualReview: false,
    },
    action: {
      id: "demo-action-renewal",
      title: "Submit renewal",
      due: "2026-12-12",
      done: false,
      created: Date.UTC(2026, 10, 22, 9, 5),
      groupId: DEMO_RENEWAL_GROUP_ID,
    },
  },
  {
    id: "demo-doc-utility",
    created: Date.UTC(2026, 10, 21, 15, 30),
    title: "Northgrid Water & Power billing notice",
    name: "Utility notice sample.txt",
    category: "Money & Bills",
    status: "needs_review",
    autoFiled: false,
    reviewed: false,
    reason:
      "Two plausible dates appear in the notice (18 December 2026 autopay draft and 28 December 2026 payment due date). Check the original before filing or setting a due date.",
    tags: ["utilities", "review", "synthetic"],
    evidence: "billing notice",
    text: "Northgrid Water & Power billing notice\nSYNTHETIC SAMPLE · NG-418\nAccount: Northgrid Residential 418\nEstimated amount: USD 64.50\nScheduled meter check: 18 December 2026.\nPayment due date: 28 December 2026 (autopay draft on 18 December 2026 or final payment by 28 December 2026).",
    facts: [
      {
        label: "Provider",
        value: "Northgrid Water & Power",
        quote: "Northgrid Water & Power billing notice",
      },
      {
        label: "Amount",
        value: "USD 64.50",
        quote: "Estimated amount: USD 64.50",
      },
    ],
    followUp: {
      key: "followup:payment due date: 28 december 2026 (autopay draft on 18 december 2026 or final payment by 28 december 2026).",
      title: "Confirm utility payment date",
      quote:
        "Payment due date: 28 December 2026 (autopay draft on 18 December 2026 or final payment by 28 December 2026).",
      dueText: "",
      due: "",
      visualReview: false,
    },
    action: null,
  },
  {
    id: "demo-doc-receipt",
    created: Date.UTC(2026, 10, 20, 11, 15),
    title: "Fieldnote Supply notebook receipt",
    name: "Fieldnote Supply receipt sample.txt",
    category: "Purchases",
    status: "organized",
    autoFiled: true,
    reviewed: false,
    reason: "",
    tags: ["stationery", "receipt", "synthetic"],
    evidence: "receipt",
    text: "Fieldnote Supply receipt\nSYNTHETIC SAMPLE · FN-024\nMerchant: Fieldnote Supply\nPaper notebook × 2\nTotal: USD 24.00\nPayment received. Thank you!",
    facts: [
      {
        label: "Merchant",
        value: "Fieldnote Supply",
        quote: "Merchant: Fieldnote Supply",
      },
      { label: "Total", value: "USD 24.00", quote: "Total: USD 24.00" },
    ],
    followUp: null,
    action: null,
  },
  {
    id: "demo-doc-enrollment",
    created: Date.UTC(2026, 10, 19, 14, 0),
    title: "Student enrollment confirmation notice",
    name: "Student enrollment sample.txt",
    category: "Work & Study",
    status: "organized",
    autoFiled: false,
    reviewed: true,
    reason: "",
    tags: ["enrollment", "study", "synthetic"],
    evidence: "Course outline",
    text: "Student enrollment confirmation notice\nSYNTHETIC SAMPLE · ST-109\nCourse outline: Civic Data Studio · Spring Term\nStatus: Provisional enrollment recorded\nSubmit signed course outline and ID verification before 8 January 2027.",
    facts: [
      {
        label: "Course",
        value: "Civic Data Studio",
        quote: "Course outline: Civic Data Studio · Spring Term",
      },
      {
        label: "Reference",
        value: "ST-109",
        quote: "SYNTHETIC SAMPLE · ST-109",
      },
    ],
    followUp: {
      key: "followup:submit signed course outline and id verification before 8 january 2027.",
      title: "Submit signed course outline and ID verification",
      quote:
        "Submit signed course outline and ID verification before 8 January 2027.",
      dueText: "8 January 2027",
      due: "2027-01-08",
      visualReview: false,
    },
    action: {
      id: "demo-action-enrollment",
      title: "Submit signed course outline and ID verification",
      due: "2027-01-08",
      done: false,
      created: Date.UTC(2026, 10, 19, 14, 10),
    },
  },
  {
    id: "demo-doc-maintenance",
    created: Date.UTC(2026, 10, 18, 10, 0),
    title: "Building water filter maintenance notice",
    name: "Maintenance notice sample.txt",
    category: "Home & Living",
    status: "organized",
    autoFiled: false,
    reviewed: true,
    reason: "",
    tags: ["maintenance", "apartment", "synthetic"],
    evidence: "Tenancy",
    text: "Building water filter maintenance notice\nSYNTHETIC SAMPLE · BM-312\nTenancy block B · Annual filter check\nConfirm hallway access window with building desk by 10 November 2026.",
    facts: [
      {
        label: "Unit",
        value: "Tenancy block B",
        quote: "Tenancy block B · Annual filter check",
      },
      {
        label: "Reference",
        value: "BM-312",
        quote: "SYNTHETIC SAMPLE · BM-312",
      },
    ],
    followUp: {
      key: "followup:confirm hallway access window with building desk by 10 november 2026.",
      title: "Confirm hallway access window with building desk",
      quote:
        "Confirm hallway access window with building desk by 10 November 2026.",
      dueText: "10 November 2026",
      due: "2026-11-10",
      visualReview: false,
    },
    action: {
      id: "demo-action-maintenance",
      title: "Confirm hallway access window with building desk",
      due: "2026-11-10",
      done: true,
      created: Date.UTC(2026, 10, 18, 10, 15),
    },
  },
];

export const REDACTED_RECEIPT_FIXTURES = [
  {
    id: "demo-doc-redacted-receipt-1",
    number: 1,
    name: "sample-receipt-1.jpg",
    path: "/demo-receipts/sample-receipt-1.jpg",
    title: "Restaurant dinner receipt",
    label: "Grand Total",
    total: "184.000",
    created: Date.UTC(2026, 10, 17, 12, 0),
  },
  {
    id: "demo-doc-redacted-receipt-2",
    number: 2,
    name: "sample-receipt-2.jpg",
    path: "/demo-receipts/sample-receipt-2.jpg",
    title: "Ice cream counter receipt",
    label: "Grand Total",
    total: "14.000",
    created: Date.UTC(2026, 10, 16, 12, 0),
  },
  {
    id: "demo-doc-redacted-receipt-3",
    number: 3,
    name: "sample-receipt-3.jpg",
    path: "/demo-receipts/sample-receipt-3.jpg",
    title: "Rice bowl takeaway bill",
    label: "Grand Total",
    total: "182.600",
    created: Date.UTC(2026, 10, 15, 12, 0),
  },
  {
    id: "demo-doc-redacted-receipt-4",
    number: 4,
    name: "sample-receipt-4.jpg",
    path: "/demo-receipts/sample-receipt-4.jpg",
    title: "Delivery meal receipt",
    label: "Total",
    total: "51.542",
    created: Date.UTC(2026, 10, 14, 12, 0),
  },
];

export async function loadRedactedReceiptFixtures() {
  return Promise.all(
    REDACTED_RECEIPT_FIXTURES.map(async (receipt) => {
      const response = await fetch(receipt.path);
      if (!response.ok) throw Error(`Could not load ${receipt.name}.`);
      const blob = await response.blob();
      validateFile(
        blob.size,
        "image/jpeg",
        new Uint8Array(await blob.slice(0, 8).arrayBuffer()),
      );
      const quote = `${receipt.label} : ${receipt.total}`;
    return {
      id: receipt.id,
      created: receipt.created,
      title: receipt.title,
      name: receipt.name,
      blob,
      source: REDACTED_RECEIPT_SOURCE,
      mode: "Redacted receipt sample · fields entered manually",
      category: "Purchases",
      status: "organized",
      autoFiled: false,
      reviewed: true,
      reason: "",
      tags: ["receipt", "photo", "redacted", "IDR"],
      evidence: quote,
      text: `${receipt.title}\n${quote}\nCurrency: IDR`,
      facts: [{ label: "Total (IDR)", value: receipt.total, quote }],
    };
  }),
  );
}

export const DEMO_EXTRA_RECEIPTS = [
  {
    id: "demo-doc-kfc-receipt",
    path: "/demo-documents/digital_receipt_1.pdf",
    mime: "application/pdf",
    name: "digital_receipt_1.pdf",
    title: "KFC Kota Kasablanka order receipt",
    total: "50.000",
    created: Date.UTC(2026, 10, 22, 13, 10),
    tags: ["receipt", "pdf", "food", "QRIS", "IDR"],
    evidence: "TOTAL : Rp50.000",
    text: [
      "KFC Kota Kasablanka order receipt",
      "ORDER TYPE : Dine-In",
      "ORDER DATE : 17 Nov 2026",
      "1 Lado Ijo Don Rp19.091",
      "1 Iced Matcha Latte Rp14.545",
      "1 Spaghetti Deluxe Rp11.818",
      "Restaurant Tax (10%) : Rp4.545",
      "Rounding : Rp1",
      "TOTAL : Rp50.000",
      "PAYMENT : Paid By QRIS",
      "Currency: IDR",
    ].join("\n"),
    facts: [
      { label: "Merchant", value: "KFC Kota Kasablanka", quote: "KFC Kota Kasablanka order receipt" },
      { label: "Total (IDR)", value: "50.000", quote: "TOTAL : Rp50.000" },
      { label: "Payment", value: "Paid By QRIS", quote: "PAYMENT : Paid By QRIS" },
    ],
  },
  {
    id: "demo-doc-asics-receipt",
    path: "/demo-receipts/receipt_5.jpeg",
    mime: "image/jpeg",
    name: "receipt_5.jpeg",
    title: "ASICS Kota Kasablanka shoe receipt",
    total: "1.359.200",
    created: Date.UTC(2026, 10, 22, 11, 35),
    tags: ["receipt", "photo", "shoes", "shopping", "IDR"],
    evidence: "Grand Total : Rp1.359.200",
    text: [
      "ASICS Kota Kasablanka shoe receipt",
      "Merchant: ASICS Kota Kasablanka",
      "Date: 27 Jun 2026",
      "ASI GEL CHALLENGER 15 (A/W, WH) Rp1.359.200",
      "Discount: -Rp339.800",
      "Grand Total : Rp1.359.200",
      "Payment: GPAY",
      "Currency: IDR",
    ].join("\n"),
    facts: [
      { label: "Merchant", value: "ASICS Kota Kasablanka", quote: "Merchant: ASICS Kota Kasablanka" },
      { label: "Item", value: "ASI GEL CHALLENGER 15 (A/W, WH)", quote: "ASI GEL CHALLENGER 15 (A/W, WH) Rp1.359.200" },
      { label: "Total (IDR)", value: "1.359.200", quote: "Grand Total : Rp1.359.200" },
    ],
  },
  {
    id: "demo-doc-jiwa-receipt",
    path: "/demo-receipts/receipt_6.jpeg",
    mime: "image/jpeg",
    name: "receipt_6.jpeg",
    title: "Kopi Janji Jiwa takeaway coffee receipt",
    total: "23.000",
    created: Date.UTC(2026, 10, 22, 14, 35),
    tags: ["receipt", "photo", "coffee", "takeaway", "IDR"],
    evidence: "Total Pembayaran : Rp23.000",
    text: [
      "Kopi Janji Jiwa takeaway coffee receipt",
      "Lokasi Outlet: MALL KOTA KASABLANKA",
      "Date: 22 Nov 2026",
      "1x Sahabat Caramel Latte Large (Cup 1) Rp11.500",
      "1x Sahabat Caramel Latte Large (Cup 2) Rp11.500",
      "Total Pembayaran : Rp23.000",
      "Payment: OVO + Jiwa Point",
      "Currency: IDR",
    ].join("\n"),
    facts: [
      { label: "Merchant", value: "Mall Kota Kasablanka (Jiwa+)", quote: "Lokasi Outlet: MALL KOTA KASABLANKA" },
      { label: "Item", value: "1x B1G1 Large Sahabat Series", quote: "1x Sahabat Caramel Latte Large (Cup 1) Rp11.500" },
      { label: "Total (IDR)", value: "23.000", quote: "Total Pembayaran : Rp23.000" },
    ],
  },
  {
    id: "demo-doc-taburai-receipt",
    path: "/demo-receipts/receipt_7.jpeg",
    mime: "image/jpeg",
    name: "receipt_7.jpeg",
    title: "Warung Taburai handwritten dinner bill",
    total: "142.100",
    created: Date.UTC(2026, 10, 22, 19, 15),
    tags: ["receipt", "photo", "restaurant", "dinner", "IDR"],
    evidence: "Jumlah Rp. 142.100",
    text: [
      "Warung Taburai handwritten dinner bill",
      "Merchant: Warung Taburai · Nota No. 08916",
      "Date: 22 Nov 2026",
      "1 Pkt Ayam Bakar Rp74.600",
      "1 Pkt Premium Komplit Rp67.500",
      "Jumlah Rp. 142.100",
      "Currency: IDR",
    ].join("\n"),
    facts: [
      { label: "Merchant", value: "Warung Taburai", quote: "Merchant: Warung Taburai · Nota No. 08916" },
      { label: "Total (IDR)", value: "142.100", quote: "Jumlah Rp. 142.100" },
    ],
  },
  {
    id: "demo-doc-haus-receipt",
    path: "/demo-receipts/receipt_8.jpeg",
    mime: "image/jpeg",
    name: "receipt_8.jpeg",
    title: "Haus! Tebet milk tea receipt",
    total: "66.000",
    created: Date.UTC(2026, 10, 22, 21, 46),
    tags: ["receipt", "photo", "drinks", "tea", "IDR"],
    evidence: "Grand Total : 66.000",
    text: [
      "Haus! Tebet milk tea receipt",
      "Merchant: Haus! JKT - Tebet (GrabFood)",
      "Date: 22 Nov 2026",
      "1x Jasmine Green Milk Tea Rp32.000",
      "1x Osmanthus Oolong Milk Tea Rp34.000",
      "Grand Total : 66.000",
      "Currency: IDR",
    ].join("\n"),
    facts: [
      { label: "Merchant", value: "Haus! JKT - Tebet", quote: "Merchant: Haus! JKT - Tebet (GrabFood)" },
      { label: "Total (IDR)", value: "66.000", quote: "Grand Total : 66.000" },
    ],
  },
];

export async function loadExtraDemoReceiptFixtures() {
  return Promise.all(
    DEMO_EXTRA_RECEIPTS.map(async (receipt) => {
      const response = await fetch(receipt.path);
      if (!response.ok) throw Error(`Could not load ${receipt.name}.`);
      const blob = await response.blob();
      validateFile(
        blob.size,
        receipt.mime,
        new Uint8Array(await blob.slice(0, 8).arrayBuffer()),
      );
      return {
        id: receipt.id,
        created: receipt.created,
        title: receipt.title,
        name: receipt.name,
        blob,
        source: "Demo sample",
        mode: "Demo receipt sample · fields entered manually",
        category: "Purchases",
        status: "organized",
        autoFiled: false,
        reviewed: true,
        reason: "",
        tags: [...receipt.tags],
        evidence: receipt.evidence,
        text: receipt.text,
        facts: receipt.facts.map((f) => ({ ...f })),
      };
    }),
  );
}

export async function loadLocalReceiptFixtures(numbers) {
  if (
    !import.meta.env?.DEV ||
    !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
    new URLSearchParams(location.search).get("receipts") !== "1"
  ) {
    return [];
  }

  const base = "/__tuntas_demo_receipts/";
  const manifest = await fetch(base + "manifest.json");
  if (manifest.status === 404) return [];
  if (!manifest.ok) throw Error("Could not load the local receipt manifest.");
  const receipts = (await manifest.json()).filter((receipt) =>
    numbers.includes(receipt.number),
  );
  return Promise.all(receipts.map(async (receipt) => {
    const { number, title, label, total } = receipt;
    const name = `receipt_${number}.jpeg`;
    const response = await fetch(base + name);
    if (!response.ok) throw Error(`Could not load ${name}.`);
    const blob = await response.blob();
    validateFile(
      blob.size,
      "image/jpeg",
      new Uint8Array(await blob.slice(0, 8).arrayBuffer()),
    );
    const quote = `${label} : ${total}`;
    return {
      id: `demo-doc-photo-receipt-${number}`,
      created: Date.UTC(2026, 10, 17 - number),
      title,
      name,
      blob,
      source: LOCAL_RECEIPT_SOURCE,
      mode: "Photographed receipt · sample fields entered manually",
      category: "Purchases",
      status: "organized",
      autoFiled: false,
      reviewed: true,
      reason: "",
      tags: ["receipt", "photo", "IDR"],
      evidence: quote,
      text: `${title}\n${quote}\nCurrency: IDR`,
      facts: [{ label: "Total (IDR)", value: total, quote }],
    };
  }));
}

export async function buildDemoSeed(fixtures = DEMO_FIXTURES) {
  const docs = [];
  const originals = [];
  const actions = [];

  for (const fixture of fixtures) {
    const blob = fixture.blob ?? new Blob([fixture.text], { type: "text/plain" });
    const mode = fixture.mode ?? "Synthetic sample · seeded example";
    const [digest, bytes] = await Promise.all([
      fingerprint(blob),
      blob.arrayBuffer(),
    ]);
    docs.push({
      id: fixture.id,
      digest,
      created: fixture.created,
      status: fixture.status,
      title: fixture.title,
      name: fixture.name,
      mime: blob.type,
      size: bytes.byteLength,
      source: fixture.source ?? "Demo sample",
      sample: true,
      category: fixture.category,
      tags: [...fixture.tags],
      facts: fixture.facts.map((f) => ({ ...f })),
      text: fixture.text,
      mode,
      reason: fixture.reason,
      reviewed: fixture.reviewed,
      autoFiled: fixture.autoFiled,
      proposal: {
        title: fixture.title,
        category: fixture.category,
        evidence: fixture.evidence,
        facts: fixture.facts.map((f) => ({ ...f })),
        mode,
      },
      followUp: fixture.followUp ? { ...fixture.followUp } : null,
      ...(fixture.followUp ? { followUpDismissed: false } : {}),
    });
    originals.push({
      id: fixture.id,
      bytes,
      type: blob.type,
    });
    if (fixture.action) {
      actions.push({
        id: fixture.action.id,
        documentId: fixture.id,
        title: fixture.action.title,
        due: fixture.action.due,
        done: fixture.action.done,
        created: fixture.action.created,
        ...(fixture.action.groupId ? { groupId: fixture.action.groupId } : {}),
        suggestionKey: fixture.followUp.key,
        quote: fixture.followUp.quote,
      });
    }
  }

  return { docs, originals, actions };
}

export function buildDemoWorkflowSeed() {
  const groupCreated = Date.UTC(2026, 10, 22, 9, 0);
  return {
    groups: [
      {
        id: DEMO_RENEWAL_GROUP_ID,
        title: "Household membership renewal",
        created: groupCreated,
        updated: groupCreated,
      },
    ],
    actions: [
      {
        id: "demo-action-renewal-address",
        documentId: "demo-doc-utility",
        title: "Prepare address proof",
        due: "2026-11-26",
        done: false,
        created: Date.UTC(2026, 10, 22, 9, 2),
        groupId: DEMO_RENEWAL_GROUP_ID,
        quote: "Account: Northgrid Residential 418",
      },
      {
        id: "demo-action-renewal",
        documentId: "demo-doc-renewal",
        title: "Submit renewal",
        due: "2026-12-12",
        done: false,
        created: Date.UTC(2026, 10, 22, 9, 5),
        groupId: DEMO_RENEWAL_GROUP_ID,
        suggestionKey: "followup:renew your membership by 12 december 2026.",
        quote: "Renew your membership by 12 December 2026.",
      },
      {
        id: "demo-action-renewal-verify",
        documentId: "demo-doc-renewal",
        title: "Verify confirmation",
        due: "",
        done: false,
        created: Date.UTC(2026, 10, 22, 9, 8),
        groupId: DEMO_RENEWAL_GROUP_ID,
        quote: "Annual family plan",
      },
    ],
    dependencies: [
      {
        id: "demo-action-renewal-address->demo-action-renewal",
        prerequisiteActionId: "demo-action-renewal-address",
        dependentActionId: "demo-action-renewal",
        created: Date.UTC(2026, 10, 22, 9, 9),
      },
      {
        id: "demo-action-renewal->demo-action-renewal-verify",
        prerequisiteActionId: "demo-action-renewal",
        dependentActionId: "demo-action-renewal-verify",
        created: Date.UTC(2026, 10, 22, 9, 10),
      },
    ],
  };
}
