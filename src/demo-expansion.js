import { buildDemoSeed } from "./demo.js";
import { dependencyId, toLocalIsoDate } from "./actions-domain.js";
import { validateFile } from "./domain.js";

export const DEMO_EXPANSION_SEED_KEY = "demo-paperwork-examples-v1";

const groupId = "demo-group-training-claim";
const approvalId = "demo-doc-training-approval";
const invoiceId = "demo-doc-training-invoice";
const approvalActionId = "demo-action-training-approval";
const invoiceActionId = "demo-action-training-invoice";
const submitActionId = "demo-action-training-submit";
const verifyActionId = "demo-action-training-verify";

const approvalQuote = "Training expense approved up to IDR 750.000.";
const invoiceQuote = "Check the invoice total and reference before submitting your claim.";
const claimQuote = "Attach the written approval and matching invoice to your claim.";
const confirmQuote = "Keep the reimbursement confirmation with this approval.";
const volunteerQuote = "Konfirmasi kehadiran melalui meja panitia.";

export async function buildExpandedDemoSeed(now = new Date()) {
  const response = await fetch("/demo-documents/birchline-policy-letter.pdf");
  if (!response.ok) throw Error("Could not load the sample policy letter.");
  const policy = await response.blob();
  validateFile(
    policy.size,
    "application/pdf",
    new Uint8Array(await policy.slice(0, 8).arrayBuffer()),
  );

  const fixtures = [
    {
      id: approvalId,
      created: Date.UTC(2026, 10, 22, 8, 30),
      title: "Training reimbursement approval",
      name: "Training reimbursement approval.txt",
      category: "Work & Study",
      status: "organized",
      reviewed: true,
      autoFiled: false,
      reason: "",
      tags: ["training", "reimbursement", "synthetic"],
      evidence: approvalQuote,
      text: [
        "Training reimbursement approval",
        "SYNTHETIC SAMPLE · Cedarbridge Skills Lab",
        "Approval reference: TR-608",
        approvalQuote,
        claimQuote,
        confirmQuote,
      ].join("\n"),
      facts: [
        {
          label: "Approval reference",
          value: "TR-608",
          quote: "Approval reference: TR-608",
        },
        { label: "Approved limit", value: "IDR 750.000", quote: approvalQuote },
      ],
    },
    {
      id: invoiceId,
      created: Date.UTC(2026, 10, 22, 8, 35),
      title: "Cedarbridge workshop invoice",
      name: "Cedarbridge workshop invoice.txt",
      category: "Money & Bills",
      status: "organized",
      reviewed: false,
      autoFiled: true,
      reason: "",
      tags: ["invoice", "training", "reimbursement", "synthetic"],
      evidence: "Invoice total: IDR 625.000",
      text: [
        "Cedarbridge workshop invoice",
        "SYNTHETIC SAMPLE · Cedarbridge Skills Lab",
        "Approval reference: TR-608",
        "Invoice total: IDR 625.000",
        invoiceQuote,
      ].join("\n"),
      facts: [
        {
          label: "Invoice total",
          value: "IDR 625.000",
          quote: "Invoice total: IDR 625.000",
        },
        {
          label: "Approval reference",
          value: "TR-608",
          quote: "Approval reference: TR-608",
        },
      ],
    },
    {
      id: "demo-doc-birchline-policy",
      created: Date.UTC(2026, 10, 20, 8, 30),
      title: "Birchline policy confirmation",
      name: "birchline-policy-letter.pdf",
      blob: policy,
      category: "Personal Records",
      status: "organized",
      reviewed: true,
      autoFiled: false,
      reason: "",
      tags: ["insurance", "policy", "synthetic"],
      evidence: "Policy reference: BL-2048",
      text: [
        "Birchline policy confirmation",
        "Synthetic sample - fictional provider and policy",
        "Provider: Birchline Mutual",
        "Policy reference: BL-2048",
        "Coverage: Personal belongings",
        "Status: Policy active",
        "Keep this letter with your personal records.",
      ].join("\n"),
      facts: [
        {
          label: "Policy reference",
          value: "BL-2048",
          quote: "Policy reference: BL-2048",
        },
        {
          label: "Coverage",
          value: "Personal belongings",
          quote: "Coverage: Personal belongings",
        },
      ],
    },
    {
      id: "demo-doc-volunteer-briefing",
      created: Date.UTC(2026, 10, 19, 8, 30),
      title: "Undangan pengarahan relawan",
      name: "Undangan pengarahan relawan.txt",
      category: "Other",
      status: "organized",
      reviewed: true,
      autoFiled: false,
      reason: "",
      tags: ["relawan", "komunitas", "synthetic"],
      evidence: volunteerQuote,
      text: [
        "Undangan pengarahan relawan",
        "CONTOH FIKTIF · Komunitas Taman Pagi",
        "Lokasi: Balai Warga Taman Pagi",
        volunteerQuote,
      ].join("\n"),
      facts: [
        {
          label: "Lokasi",
          value: "Balai Warga Taman Pagi",
          quote: "Lokasi: Balai Warga Taman Pagi",
        },
      ],
      followUp: {
        key: `followup:${volunteerQuote.toLowerCase()}`,
        title: "Konfirmasi kehadiran relawan",
        quote: volunteerQuote,
        dueText: "",
        due: "",
        visualReview: false,
      },
    },
    {
      id: "demo-doc-courtyard-note",
      created: Date.UTC(2026, 10, 21, 9, 0),
      title: "Courtyard room booking note",
      name: "Courtyard room booking note.txt",
      category: "Other",
      status: "needs_review",
      reviewed: false,
      autoFiled: false,
      reason: "The note mentions a building room booking and a workshop. Check the original and choose a category before filing.",
      tags: ["booking", "workshop", "synthetic"],
      evidence: "Room booked for the neighborhood repair workshop.",
      text: [
        "Courtyard room booking note",
        "SYNTHETIC SAMPLE · West Courtyard Residents",
        "Room booked for the neighborhood repair workshop.",
        "Location: Courtyard common room",
      ].join("\n"),
      facts: [
        {
          label: "Location",
          value: "Courtyard common room",
          quote: "Location: Courtyard common room",
        },
      ],
    },
  ];

  // New workspaces get useful urgency examples on the day the samples are installed.
  const today = toLocalIsoDate(now);
  const yesterday = toLocalIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  const created = fixtures[0].created;
  const steps = [
    {
      id: approvalActionId,
      documentId: approvalId,
      title: "Save training approval",
      quote: approvalQuote,
      due: "",
      done: true,
    },
    {
      id: invoiceActionId,
      documentId: invoiceId,
      title: "Check workshop invoice",
      quote: invoiceQuote,
      due: yesterday,
      done: false,
    },
    {
      id: submitActionId,
      documentId: approvalId,
      title: "Submit reimbursement claim",
      quote: claimQuote,
      due: today,
      done: false,
    },
    {
      id: verifyActionId,
      documentId: approvalId,
      title: "Confirm reimbursement arrived",
      quote: confirmQuote,
      due: "",
      done: false,
    },
  ];

  return {
    ...(await buildDemoSeed(fixtures)),
    groups: [
      { id: groupId, title: "Training reimbursement", created, updated: created },
    ],
    actions: steps.map((step, index) => ({
      ...step,
      groupId,
      created: created + index,
    })),
    dependencies: [
      [approvalActionId, submitActionId],
      [invoiceActionId, submitActionId],
      [submitActionId, verifyActionId],
    ].map(([prerequisiteActionId, dependentActionId]) => ({
      id: dependencyId(prerequisiteActionId, dependentActionId),
      prerequisiteActionId,
      dependentActionId,
      created,
    })),
  };
}
