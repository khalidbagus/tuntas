import test from "node:test";
import assert from "node:assert/strict";
import {
  classifierForModel,
  CLOUD_MODEL_CHAIN,
  parseModelJson,
  sanitizeModelProposal,
  runWithCloudModelFallback,
} from "../src/firebase-ai.js";
import { supportsDeviceAI } from "../src/device-ai.js";
import {
  DEMO_SEED_KEY,
  DEMO_ACCOUNT_EMAIL,
  REDACTED_RECEIPT_SEED_KEY,
  REDACTED_RECEIPT_SOURCE,
  REDACTED_RECEIPT_FIXTURES,
  DEMO_EXTRA_RECEIPTS_SEED_KEY,
  DEMO_EXTRA_RECEIPTS,
  DEMO_WORKFLOW_SEED_KEY,
  DEMO_RENEWAL_GROUP_ID,
  isDemoMode,
  demoWorkspaceHref,
  exitDemoHref,
  buildDemoSeed,
  buildDemoWorkflowSeed,
} from "../src/demo.js";
import {
  maskSensitiveText,
  redactedExportFilename,
} from "../src/privacy-redact.js";
import { buildInitialDemoSplits } from "../src/demo-splits.js";
import {
  DUE_SOON_DAYS,
  isValidIsoDate,
  toLocalIsoDate,
  calendarDaysBetween,
  getActionUrgency,
  dependencyId,
  validateDependency,
  evaluateActionStates,
  getGroupProgress,
  selectTodaysFocus,
  orderGroupActions,
  computeGroupGraphLayout,
} from "../src/actions-domain.js";
import {
  DEFAULT_LANG,
  loadLang,
  saveLang,
  localeFor,
  createTranslator,
  translateCategory,
  translateMode,
  translateRuntimeMessage,
} from "../src/i18n.js";
import { mapAuthError } from "../src/auth.js";
import {
  getCapturePrivacyStatus,
  getDocumentPrivacyMeta,
} from "../src/ai-privacy.js";
import { suggestWorkflowTemplate } from "../src/workflow-templates.js";
import {
  nextIsoCalendarDay,
  escapeIcsText,
  icsFilename,
  buildIcsEvent,
  buildGoogleCalendarUrl,
} from "../src/calendar-export.js";
import {
  SPLIT_CURRENCIES,
  detectReceiptCurrency,
  detectReceiptTotal,
  parseReceiptLineItems,
  calculateShares,
  buildSplitMailtoHref,
  verifyTransferProofLocally,
} from "../src/split-domain.js";
import {
  buildGooglePayRequest,
  createSimulatedGooglePayToken,
} from "../src/google-pay-demo.js";
import {
  tokenizeQuery,
  extractAmountsFromDoc,
  retrieveRelevantDocs,
  answerPaperworkLocally,
} from "../src/rag-local.js";
import {
  SYNC_COLLECTIONS,
  tombstoneKey,
  toRemoteDocument,
  toRemoteAction,
  toRemoteGroup,
  toRemoteDependency,
  toTombstonePayload,
  reconcileCollection,
} from "../src/sync-domain.js";
import {
  validateFile,
  validateText,
  localClassifier,
  validateProposal,
  validateFollowUp,
  parseUnambiguousDate,
  parseActionDueDate,
  formatCalendarDate,
  sample,
  MAX_BYTES,
  matchesQuery,
  fingerprint,
} from "../src/domain.js";
const receiptText =
  "Fieldnote Supply receipt\nSYNTHETIC SAMPLE · FN-024\nPaper notebook × 2\nTotal: USD 24.00\nPayment received. Thank you!";
const base = localClassifier({ text: receiptText, name: "receipt.txt" });
test("receipt files without a confirmation; total carries its literal source", () => {
  const d = validateProposal(base, receiptText);
  assert.equal(d.status, "organized");
  assert.equal(d.category, "Purchases");
  assert.deepEqual(d.facts, [
    { label: "Total", value: "USD 24.00", quote: "Total: USD 24.00" },
  ]);
});
test("ambiguous and unknown inputs require a decision", () => {
  for (const s of ["Receipt and invoice", "Meeting notes"])
    assert.equal(
      validateProposal(localClassifier({ text: s, name: "x" }), s).status,
      "needs_review",
    );
});
test("schema rejects invented categories, malformed fields and unbounded arrays", () => {
  for (const x of [
    { category: "Tax optimization" },
    { confidence: 99 },
    { facts: new Array(9).fill({}) },
    { facts: [null] },
    { title: " ".repeat(5) },
  ])
    assert.throws(() => validateProposal({ ...base, ...x }, sample.text));
});
test("unsupported facts are dropped; missing category evidence, scans and truncation cannot auto-file", () => {
  const v = validateProposal(
    {
      ...base,
      facts: [
        { label: "Warranty expires", value: "2030", quote: "expires 2030" },
      ],
    },
    receiptText,
  );
  assert.equal(v.facts.length, 0);
  assert.equal(v.status, "needs_review");
  for (const v of [
    validateProposal({ ...base, evidence: "random" }, receiptText),
    validateProposal(base, receiptText, { partial: true }),
    validateProposal(base, receiptText, { image: true }),
  ])
    assert.equal(v.status, "needs_review");
});
test("file signature, type and size are checked before persistence", () => {
  const pdf = [37, 80, 68, 70, 45];
  assert.equal(validateFile(MAX_BYTES, "", pdf), "application/pdf");
  for (const args of [
    [0, "", pdf],
    [MAX_BYTES + 1, "", pdf],
    [6, "image/png", pdf],
    [6, "", []],
  ])
    assert.throws(() => validateFile(...args));
  assert.throws(() => validateText("   "));
  assert.throws(() => validateText("a".repeat(16001)));
});
test("identical bytes have one identity, different same-name documents remain distinct", async () => {
  const h = (s) => fingerprint(new Blob([s]));
  assert.equal(await h("abc"), await h("abc"));
  assert.notEqual(await h("abc"), await h("abd"));
});
test("literal retrieval matches across title, text, category and corrected fields", () => {
  const d = { ...base, text: receiptText, tags: ["stationery"] };
  assert(matchesQuery(d, "sTaTionEry fieldnote 24.00"));
  assert(!matchesQuery(d, "electricity"));
});
test("device-only refuses unavailable local model without calling generation", async () => {
  let calls = 0;
  const classify = classifierForModel(
    {
      chromeAdapter: {},
      initializeDeviceModel: async () => {
        throw Error();
      },
      generateContent: async () => {
        calls++;
      },
    },
    { allowCloud: false, image: false, deviceSupported: true },
  );
  await assert.rejects(classify({ text: sample.text }), /on-device model/);
  assert.equal(calls, 0);
});
test("adapter reports SDK response source rather than guessing from the requested mode", async () => {
  for (const [source, mode] of [
    ["in_cloud", "Firebase · cloud"],
    ["on_device", "Firebase · on device"],
    [undefined, "Firebase · source unreported"],
  ]) {
    const model = {
      initializeDeviceModel: async () => { },
      generateContent: async (parts) => {
        assert(parts[0].includes(receiptText));
        return {
          response: {
            inferenceSource: source,
            text: () => JSON.stringify(base),
          },
        };
      },
    };
    const result = await classifierForModel(model, {
      allowCloud: true,
      image: false,
    })({ text: receiptText });
    assert.equal(result.mode, mode);
    assert.equal(validateProposal(result, receiptText).category, "Purchases");
  }
});
test("malformed model JSON cannot be accepted as a classification", async () => {
  const model = {
    chromeAdapter: {},
    initializeDeviceModel: async () => { },
    generateContent: async () => ({
      response: { inferenceSource: "on_device", text: () => "{not-json}" },
    }),
  };
  await assert.rejects(
    classifierForModel(model, {
      allowCloud: false,
      image: false,
      deviceSupported: true,
    })({
      text: sample.text,
    }),
    SyntaxError,
  );
});
test("device-only refuses missing chromeAdapter even when initializeDeviceModel resolves", async () => {
  let calls = 0;
  const classify = classifierForModel(
    {
      chromeAdapter: undefined,
      initializeDeviceModel: async () => { },
      generateContent: async () => {
        calls++;
      },
    },
    { allowCloud: false, image: false, deviceSupported: true },
  );
  await assert.rejects(classify({ text: sample.text }), /on-device model/);
  assert.equal(calls, 0);
});
test("missing SDK adapter property refuses device-only before generation", async () => {
  let calls = 0;
  const classify = classifierForModel(
    {
      initializeDeviceModel: async () => { },
      generateContent: async () => {
        calls++;
      },
    },
    { allowCloud: false, image: false, deviceSupported: true },
  );
  await assert.rejects(classify({ text: sample.text }), /on-device model/);
  assert.equal(calls, 0);
});
test("unsupported browser refuses device-only without initializing or generating", async () => {
  let calls = 0;
  const classify = classifierForModel(
    {
      chromeAdapter: {},
      initializeDeviceModel: async () => {
        calls++;
      },
      generateContent: async () => {
        calls++;
      },
    },
    { allowCloud: false, image: false, deviceSupported: false },
  );
  await assert.rejects(classify({ text: sample.text }), /on-device model/);
  assert.equal(calls, 0);
  assert.equal(supportsDeviceAI(null), false);
  assert.equal(supportsDeviceAI({ availability() { }, create() { } }), true);
});
test("device-only accepts only a reported local source", async () => {
  for (const source of ["in_cloud", undefined, "on_device"]) {
    const classify = classifierForModel(
      {
        chromeAdapter: {},
        initializeDeviceModel: async () => { },
        generateContent: async () => ({
          response: {
            inferenceSource: source,
            text: () => JSON.stringify(base),
          },
        }),
      },
      { allowCloud: false, image: false, deviceSupported: true },
    );
    if (source === "on_device")
      assert.equal(
        (await classify({ text: sample.text })).mode,
        "Firebase · on device",
      );
    else
      await assert.rejects(classify({ text: sample.text }), /on-device model/);
  }
});
test("renewal notice produces a grounded follow-up draft with unambiguous due date", () => {
  const renewal =
    "Household membership renewal notice\nAccount #HM-204\nRenew your membership by 12 December 2026.";
  const raw = localClassifier({ text: renewal, name: "renewal.txt" });
  const validated = validateProposal(raw, renewal);
  assert.equal(validated.category, "Home & Living");
  assert.equal(validated.status, "organized");
  assert.deepEqual(validated.followUp, {
    key: "followup:renew your membership by 12 december 2026.",
    title: "Renew your membership",
    quote: "Renew your membership by 12 December 2026.",
    dueText: "12 December 2026",
    due: "2026-12-12",
    visualReview: false,
  });
});
test("ambiguous, partial, or competing dates leave follow-up due blank while keeping grounded draft", () => {
  for (const line of [
    "Renew your membership by 03/04/2026.",
    "Renew your membership next Friday.",
    "Renew your membership by 12 December.",
    "Renew by 12 December 2026 or 15 December 2026.",
    "Renew by 2026-02-30.",
  ]) {
    assert.equal(parseUnambiguousDate(line), null);
    const f = validateFollowUp(
      {
        title: "Renew your membership",
        quote: line,
        dueDate: "2026-12-12",
        dueText: "12 December 2026",
      },
      line,
    );
    assert.ok(f);
    assert.equal(f.due, "");
    assert.equal(f.quote, line);
    assert.equal(f.visualReview, false);
  }
  const mismatchedDue = validateFollowUp(
    {
      title: "Renew your membership",
      quote: "Renew your membership by 12 December 2026.",
      dueDate: "2026-12-20",
    },
    "Renew your membership by 12 December 2026.",
  );
  assert.equal(mismatchedDue.due, "");
});
test("unsupported or malformed follow-up is discarded while filing still succeeds", () => {
  const renewal =
    "Household membership renewal notice\nRenew your membership by 12 December 2026.";
  const raw = localClassifier({ text: renewal, name: "renewal.txt" });
  const nonVerbatim = validateProposal(
    {
      ...raw,
      followUp: {
        title: "Pay renewal",
        quote: "Pay before December 12",
        dueDate: "2026-12-12",
      },
    },
    renewal,
  );
  assert.equal(nonVerbatim.status, "organized");
  assert.equal(nonVerbatim.followUp, null);
  const malformed = validateProposal(
    { ...raw, followUp: { title: 42, quote: null } },
    renewal,
  );
  assert.equal(malformed.status, "organized");
  assert.equal(malformed.followUp, null);
});
test("image follow-up is marked for visual review and keeps needs_review status", () => {
  const validated = validateProposal(
    {
      ...base,
      followUp: {
        title: "Renew membership",
        quote: "Renew by 12 December 2026",
        dueDate: "2026-12-12",
      },
    },
    "",
    { image: true },
  );
  assert.equal(validated.status, "needs_review");
  assert.deepEqual(validated.followUp, {
    key: "followup:renew by 12 december 2026",
    title: "Renew membership",
    quote: "Renew by 12 December 2026",
    dueText: "12 December 2026",
    due: "2026-12-12",
    visualReview: true,
  });
});
test("classifierForModel preserves optional followUp alongside SDK-reported inferenceSource", async () => {
  const text =
    "Household membership renewal notice\nRenew your membership by 12 December 2026.";
  const modelResponse = {
    title: "Household membership renewal notice",
    category: "Home & Living",
    confidence: "high",
    evidence: "renewal notice",
    facts: [],
    followUp: {
      title: "Renew membership",
      quote: "Renew your membership by 12 December 2026.",
      dueDate: "2026-12-12",
      dueText: "12 December 2026",
    },
  };
  const model = {
    chromeAdapter: {},
    initializeDeviceModel: async () => { },
    generateContent: async () => ({
      response: {
        inferenceSource: "on_device",
        text: () => JSON.stringify(modelResponse),
      },
    }),
  };
  const result = await classifierForModel(model, {
    allowCloud: false,
    image: false,
    deviceSupported: true,
  })({ text });
  assert.equal(result.mode, "Firebase · on device");
  const validated = validateProposal(result, text);
  assert.equal(validated.followUp?.due, "2026-12-12");
});
test("respects blank dueDate from model and ignores dates not tied to requested action", () => {
  const quoteValid = "Renew your membership by 12 December 2026";
  const respectedBlank = validateFollowUp(
    {
      title: "Renew your membership",
      quote: quoteValid,
      dueDate: "",
    },
    quoteValid,
  );
  assert.equal(respectedBlank.due, "");
  assert.equal(respectedBlank.dueText, "");

  const validNoDot = validateFollowUp(
    {
      title: "Renew your membership",
      quote: quoteValid,
    },
    quoteValid,
  );
  assert.equal(validNoDot.due, "2026-12-12");

  const issueOnly = "Issued on 1 December 2026. Renew your membership soon.";
  assert.equal(parseActionDueDate(issueOnly), null);
  assert.equal(
    validateFollowUp(
      {
        title: "Renew your membership",
        quote: issueOnly,
        dueDate: "2026-12-01",
      },
      issueOnly,
    ).due,
    "",
  );

  const issuePlusAmbiguous = "Issued on 1 December 2026. Renew by 03/04/2026.";
  assert.equal(parseActionDueDate(issuePlusAmbiguous), null);
  assert.equal(
    validateFollowUp(
      {
        title: "Renew your membership",
        quote: issuePlusAmbiguous,
        dueDate: "2026-12-01",
      },
      issuePlusAmbiguous,
    ).due,
    "",
  );
  assert.equal(
    validateFollowUp(
      {
        title: "Renew your membership",
        quote: issuePlusAmbiguous,
      },
      issuePlusAmbiguous,
    ).due,
    "",
  );
  assert.equal(
    localClassifier({
      text: "Household membership renewal notice\n" + issuePlusAmbiguous,
      name: "notice.txt",
    }).followUp.dueDate,
    "",
  );
});
test("sample renewal notice files with grounded follow-up and formats calendar dates without day shift", () => {
  const raw = localClassifier({ text: sample.text, name: "Sample renewal.txt" });
  const validated = validateProposal(raw, sample.text);
  assert.equal(validated.category, "Home & Living");
  assert.equal(validated.status, "organized");
  assert.equal(validated.followUp?.due, "2026-12-12");
  const expected = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 11, 12)));
  assert.equal(formatCalendarDate("2026-12-12"), expected);
});
test("demo mode query helpers detect demo=1 and preserve non-demo params on exit", () => {
  assert.equal(isDemoMode("?demo=1"), true);
  assert.equal(isDemoMode("?foo=bar&demo=1"), true);
  assert.equal(isDemoMode("?demo=0"), false);
  assert.equal(isDemoMode(""), false);
  assert.equal(demoWorkspaceHref("/"), "/?demo=1#/home");
  assert.equal(exitDemoHref("/", "?demo=1"), "/#/home");
  assert.equal(exitDemoHref("/", "?foo=1&demo=1"), "/?foo=1#/home");
});
test("demo seed builds five synthetic documents, readable originals, and linked actions", async () => {
  const { docs, originals, actions } = await buildDemoSeed();
  assert.equal(docs.length, 5);
  assert.equal(originals.length, 5);
  assert.equal(actions.length, 3);
  assert.equal(new Set(docs.map((d) => d.digest)).size, 5);

  const decoder = new TextDecoder();
  for (const doc of docs) {
    assert.equal(doc.sample, true);
    assert.equal(doc.mime, "text/plain");
    assert.equal(doc.mode, "Synthetic sample · seeded example");
    assert.ok(doc.text.includes("SYNTHETIC SAMPLE"));
    assert.ok(doc.text.includes(doc.proposal.evidence));
    for (const fact of doc.facts) {
      assert.ok(doc.text.includes(fact.quote));
      assert.ok(fact.quote.includes(fact.value));
    }
    const orig = originals.find((o) => o.id === doc.id);
    assert.ok(orig);
    assert.ok(orig.bytes instanceof ArrayBuffer);
    assert.equal(orig.bytes.byteLength, doc.size);
    assert.equal(decoder.decode(orig.bytes), doc.text);
  }

  const renewal = docs.find((d) => d.id === "demo-doc-renewal");
  assert.equal(renewal.status, "organized");
  assert.equal(renewal.category, "Home & Living");
  const renewalAction = actions.find((a) => a.documentId === renewal.id);
  assert.equal(renewalAction.done, false);
  assert.equal(renewalAction.due, "2026-12-12");

  const receipt = docs.find((d) => d.id === "demo-doc-receipt");
  assert.equal(receipt.status, "organized");
  assert.equal(receipt.category, "Purchases");
  assert.ok(matchesQuery(receipt, "Fieldnote Supply"));
  assert.ok(matchesQuery(receipt, "24.00"));

  const utility = docs.find((d) => d.id === "demo-doc-utility");
  assert.equal(utility.status, "needs_review");
  assert.ok(utility.text.includes("18 December 2026"));
  assert.ok(utility.text.includes("28 December 2026"));
  assert.ok(utility.reason.includes("Two plausible dates"));
  assert.equal(utility.followUp.due, "");
  assert.equal(
    actions.filter((a) => a.documentId === utility.id).length,
    0,
  );

  const enrollment = docs.find((d) => d.id === "demo-doc-enrollment");
  assert.equal(enrollment.status, "organized");
  const enrollmentAction = actions.find((a) => a.documentId === enrollment.id);
  assert.equal(enrollmentAction.done, false);

  const maintenance = docs.find((d) => d.id === "demo-doc-maintenance");
  assert.equal(maintenance.status, "organized");
  const maintenanceAction = actions.find(
    (a) => a.documentId === maintenance.id,
  );
  assert.equal(maintenanceAction.done, true);
});
test("redacted receipt fixtures use separate seed marker, generic titles, and searchable totals", async () => {
  assert.notEqual(REDACTED_RECEIPT_SEED_KEY, DEMO_SEED_KEY);
  assert.equal(REDACTED_RECEIPT_FIXTURES.length, 4);
  assert.deepEqual(
    REDACTED_RECEIPT_FIXTURES.map((r) => r.total),
    ["184.000", "14.000", "182.600", "51.542"],
  );
  const privateTerms = /haka|dairy\s*queen|gyukichi|ichidon|hangry|devi|rosmita|anisa|mak\s*dura/i;
  for (const r of REDACTED_RECEIPT_FIXTURES) {
    assert.match(r.name, /^sample-receipt-[1-4]\.jpg$/);
    assert.match(r.path, /^\/demo-receipts\/sample-receipt-[1-4]\.jpg$/);
    assert.equal(privateTerms.test(r.title), false);
    assert.equal(privateTerms.test(r.name), false);
  }
  const built = await buildDemoSeed(
    REDACTED_RECEIPT_FIXTURES.map((r) => {
      const quote = `${r.label} : ${r.total}`;
      return {
        id: r.id,
        created: r.created,
        title: r.title,
        name: r.name,
        blob: new Blob([new Uint8Array([255, 216, 255, 224])], {
          type: "image/jpeg",
        }),
        source: REDACTED_RECEIPT_SOURCE,
        mode: "Redacted receipt sample · fields entered manually",
        category: "Purchases",
        status: "organized",
        autoFiled: false,
        reviewed: true,
        reason: "",
        tags: ["receipt", "photo", "redacted", "IDR"],
        evidence: quote,
        text: `${r.title}\n${quote}\nCurrency: IDR`,
        facts: [{ label: "Total (IDR)", value: r.total, quote }],
      };
    }),
  );
  assert.equal(built.docs.length, 4);
  for (const r of REDACTED_RECEIPT_FIXTURES) {
    const doc = built.docs.find((d) => d.id === r.id);
    assert.equal(doc.source, REDACTED_RECEIPT_SOURCE);
    assert.equal(doc.mime, "image/jpeg");
    assert.ok(matchesQuery(doc, r.total));
    assert.ok(matchesQuery(doc, r.title.split(" ")[0]));
  }
});
test("language helpers default to English, persist selection, and format calendar dates without day shift", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  assert.equal(loadLang(storage), DEFAULT_LANG);
  saveLang("id", storage);
  assert.equal(loadLang(storage), "id");
  assert.equal(loadLang({ getItem: () => "fr" }), "en");
  assert.equal(localeFor("en"), "en-US");
  assert.equal(localeFor("id"), "id-ID");

  const expectedEn = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 11, 12)));
  const expectedId = new Intl.DateTimeFormat("id-ID", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 11, 12)));
  assert.equal(formatCalendarDate("2026-12-12", localeFor("en")), expectedEn);
  assert.equal(formatCalendarDate("2026-12-12", localeFor("id")), expectedId);

  const tId = createTranslator("id");
  assert.equal(tId("documentCount", { n: 1 }), "1 dokumen");
  assert.equal(tId("documentCount", { n: 4 }), "4 dokumen");
  assert.equal(translateCategory("Purchases", "id"), "Belanja");
  assert.equal(translateMode("Local rules", "id"), "Aturan lokal");
  assert.equal(
    translateRuntimeMessage("Filing saved.", "id"),
    "Pengarsipan disimpan.",
  );
  assert.equal(
    translateRuntimeMessage("Custom user text", "id"),
    "Custom user text",
  );
});

test("urgency thresholds and local calendar formatting avoid UTC day shifts", () => {
  const lateNightLocal = new Date(2026, 10, 22, 23, 45, 0);
  assert.equal(toLocalIsoDate(lateNightLocal), "2026-11-22");
  assert.equal(isValidIsoDate("2026-11-22"), true);
  assert.equal(isValidIsoDate("2026-02-30"), false);
  assert.equal(isValidIsoDate(""), false);
  assert.equal(DUE_SOON_DAYS, 7);
  assert.equal(calendarDaysBetween("2026-11-22", "2026-11-21"), -1);
  assert.equal(calendarDaysBetween("2026-11-22", "2026-11-29"), 7);

  const today = "2026-11-22";
  assert.equal(getActionUrgency({ done: false, due: "2026-11-21" }, today), "overdue");
  assert.equal(getActionUrgency({ done: false, due: "2026-11-22" }, today), "due_today");
  assert.equal(getActionUrgency({ done: false, due: "2026-11-23" }, today), "due_soon");
  assert.equal(getActionUrgency({ done: false, due: "2026-11-29" }, today), "due_soon");
  assert.equal(getActionUrgency({ done: false, due: "2026-11-30" }, today), "upcoming");
  assert.equal(getActionUrgency({ done: false, due: "" }, today), "no_due_date");
  assert.equal(getActionUrgency({ done: true, due: "2026-11-01" }, today), "completed");
});

test("dependency validation blocks missing, self, cross-group, duplicate, and cyclic links", () => {
  const actions = [
    { id: "a", groupId: "g1", done: false },
    { id: "b", groupId: "g1", done: false },
    { id: "c", groupId: "g1", done: false },
    { id: "other", groupId: "g2", done: false },
    { id: "solo", done: false },
  ];
  const deps = [
    { id: dependencyId("a", "b"), prerequisiteActionId: "a", dependentActionId: "b" },
    { id: dependencyId("b", "c"), prerequisiteActionId: "b", dependentActionId: "c" },
  ];

  assert.equal(validateDependency(actions, deps, "a", "missing").code, "missing");
  assert.equal(validateDependency(actions, deps, "a", "a").code, "self");
  assert.equal(validateDependency(actions, deps, "a", "other").code, "cross_group");
  assert.equal(validateDependency(actions, deps, "a", "solo").code, "cross_group");
  assert.equal(validateDependency(actions, deps, "a", "b").code, "duplicate");
  assert.equal(validateDependency(actions, deps, "b", "a").code, "cycle");
  assert.equal(validateDependency(actions, deps, "c", "a").code, "cycle");

  const valid = validateDependency(actions, deps, "a", "c");
  assert.equal(valid.ok, true);
  assert.equal(valid.id, "a->c");
});

test("readiness transitions: waiting to ready, reopening prerequisite without reversing completed dependents", () => {
  const baseActions = [
    { id: "a", groupId: "g1", done: false },
    { id: "b", groupId: "g1", done: false },
    { id: "c", groupId: "g1", done: true },
  ];
  const deps = [
    { id: "a->b", prerequisiteActionId: "a", dependentActionId: "b" },
    { id: "a->c", prerequisiteActionId: "a", dependentActionId: "c" },
    { id: "dangling->b", prerequisiteActionId: "missing", dependentActionId: "b" },
  ];

  let states = evaluateActionStates(baseActions, deps);
  assert.equal(states.get("a").readiness, "ready");
  assert.equal(states.get("b").readiness, "waiting");
  assert.equal(states.get("c").readiness, "completed");

  const aDone = baseActions.map((x) => (x.id === "a" ? { ...x, done: true } : x));
  states = evaluateActionStates(aDone, deps);
  assert.equal(states.get("b").readiness, "ready");
  assert.equal(getGroupProgress("g1", aDone, states).completed, 2);
  assert.equal(getGroupProgress("g1", aDone, states).total, 3);

  // Reopen A: unfinished B returns to waiting, completed C stays completed.
  states = evaluateActionStates(baseActions, deps);
  assert.equal(states.get("b").readiness, "waiting");
  assert.equal(states.get("c").readiness, "completed");
});

test("Today's Focus ranks ready actions by urgency and explains waiting or empty states", () => {
  const today = "2026-11-22";
  const groups = [{ id: "g1", title: "Renewal" }];
  assert.equal(selectTodaysFocus([], groups, [], today).kind, "empty");
  assert.equal(
    selectTodaysFocus([{ id: "1", done: true }], groups, [], today).kind,
    "all_done",
  );

  const actions = [
    { id: "waiting-overdue", groupId: "g1", done: false, due: "2026-11-01", created: 1 },
    { id: "no-date", done: false, due: "", created: 2 },
    { id: "upcoming", done: false, due: "2026-12-10", created: 3 },
    { id: "due-soon", done: false, due: "2026-11-25", created: 4 },
    { id: "due-today", done: false, due: "2026-11-22", created: 5 },
    { id: "ready-overdue", groupId: "g1", done: false, due: "2026-11-20", created: 6 },
  ];
  const deps = [
    { id: "ready-overdue->waiting-overdue", prerequisiteActionId: "ready-overdue", dependentActionId: "waiting-overdue" },
  ];

  const first = selectTodaysFocus(actions, groups, deps, today);
  assert.equal(first.kind, "action");
  assert.equal(first.action.id, "ready-overdue");
  assert.equal(first.urgency, "overdue");
  assert.equal(first.group?.title, "Renewal");

  const afterFirstDone = actions.filter(
    (a) => a.id !== "ready-overdue" && a.id !== "waiting-overdue",
  );
  assert.equal(selectTodaysFocus(afterFirstDone, groups, deps, today).action.id, "due-today");
  const afterDueToday = afterFirstDone.filter((a) => a.id !== "due-today");
  assert.equal(selectTodaysFocus(afterDueToday, groups, deps, today).action.id, "due-soon");
  const afterDueSoon = afterDueToday.filter((a) => a.id !== "due-soon");
  assert.equal(selectTodaysFocus(afterDueSoon, groups, deps, today).action.id, "upcoming");
  const afterUpcoming = afterDueSoon.filter((a) => a.id !== "upcoming");
  assert.equal(selectTodaysFocus(afterUpcoming, groups, deps, today).action.id, "no-date");

  const onlyWaiting = [
    { id: "p", groupId: "g1", done: false, due: "" },
    { id: "w", groupId: "g1", done: false, due: "2026-11-01" },
  ];
  const waitingFocus = selectTodaysFocus(
    onlyWaiting.filter((a) => a.id === "w"),
    groups,
    [],
    today,
  );
  assert.equal(waitingFocus.kind, "action");

  // Simulate two actions where the only open one waits on a separate open prerequisite? Wait:
  // If prerequisite is open, prerequisite is Ready. A pure waiting-only open state occurs only if corrupted/cyclic,
  // or when testing evaluateActionStates; verify orderGroupActions and computeGroupGraphLayout as well.
  const ordered = orderGroupActions(
    [
      { id: "step2", groupId: "g1", title: "Step 2", due: "2026-11-01", created: 1 },
      { id: "step1", groupId: "g1", title: "Step 1", due: "2026-12-01", created: 2 },
    ],
    [{ id: "step1->step2", prerequisiteActionId: "step1", dependentActionId: "step2" }],
  );
  assert.deepEqual(ordered.map((a) => a.id), ["step1", "step2"]);

  const layout = computeGroupGraphLayout(ordered, [
    { id: "step1->step2", prerequisiteActionId: "step1", dependentActionId: "step2" },
  ]);
  assert.equal(layout.nodes.length, 2);
  assert.equal(layout.edges.length, 1);
  assert.ok(layout.nodes[0].x < layout.nodes[1].x);
  assert.match(layout.edges[0].path, /^M /);
});

test("demo connected workflow seed defines 3-step renewal group across documents", () => {
  const wf = buildDemoWorkflowSeed();
  assert.ok(DEMO_WORKFLOW_SEED_KEY);
  assert.equal(wf.groups.length, 1);
  assert.equal(wf.groups[0].id, DEMO_RENEWAL_GROUP_ID);
  assert.equal(wf.actions.length, 3);
  assert.equal(wf.dependencies.length, 2);
  assert.deepEqual(
    wf.actions.map((a) => a.title),
    ["Prepare address proof", "Submit renewal", "Verify confirmation"],
  );
  assert.equal(wf.actions[0].documentId, "demo-doc-utility");
  assert.equal(wf.actions[1].documentId, "demo-doc-renewal");
  assert.equal(wf.actions[2].due, "");

  const tEn = createTranslator("en");
  const tId = createTranslator("id");
  for (const key of [
    "allDocuments",
    "todaysFocusHeading",
    "viewConnections",
    "newGroup",
    "urgencyOverdue",
    "urgencyDueToday",
    "urgencyDueSoon",
    "evidenceHeading",
    "filterNoDueDate",
    "deleteDocument",
    "confirmDeleteDocument",
    "deleteDocumentConfirmBody",
  ]) {
    assert.notEqual(tEn(key), key);
    assert.notEqual(tId(key), key);
    assert.notEqual(tEn(key), tId(key));
  }
  assert.match(tEn("deleteDocumentConfirmWithActions", { count: 2 }), /2 linked follow-ups/);
  assert.match(tId("deleteDocumentConfirmWithActions", { count: 2 }), /2 tindak lanjut/);
  assert.equal(translateRuntimeMessage("Document deleted.", "id"), "Dokumen dihapus.");
  assert.equal(
    translateRuntimeMessage("The document could not be deleted. Try again.", "id"),
    "Dokumen tidak dapat dihapus. Coba lagi.",
  );
});

test("sync-domain sanitizers strip local-only fields and enforce progress schema", () => {
  assert.deepEqual(SYNC_COLLECTIONS, [
    "documents",
    "actionGroups",
    "actions",
    "actionDependencies",
  ]);
  assert.equal(tombstoneKey("documents", "d1"), "documents:d1");

  const doc = toRemoteDocument({
    id: "d1",
    title: "Electricity bill",
    name: "bill.pdf",
    category: "Money & Bills",
    tags: ["utility", "paid", ""],
    status: "organized",
    created: 1000,
    updatedAt: 2000,
    text: "SECRET FULL TEXT",
    evidence: "SECRET EVIDENCE",
    facts: [{ label: "Total", value: "USD 48", quote: "Total: USD 48" }],
    reason: "Private reason",
    digest: "sha256:abc",
    mime: "application/pdf",
    size: 9001,
  });
  assert.deepEqual(Object.keys(doc).sort(), [
    "category",
    "created",
    "deleted",
    "deletedAt",
    "id",
    "status",
    "tags",
    "title",
    "updatedAt",
  ]);
  assert.equal(doc.text, undefined);
  assert.equal(doc.evidence, undefined);
  assert.equal(doc.facts, undefined);
  assert.deepEqual(doc.tags, ["utility", "paid"]);
  assert.equal(doc.deleted, false);

  const act = toRemoteAction({
    id: "a1",
    documentId: "d1",
    title: "Pay invoice",
    due: "2026-12-12",
    done: true,
    groupId: "g1",
    quote: "SECRET QUOTE",
    suggestionKey: "k1",
    created: 1000,
    updatedAt: 2500,
  });
  assert.deepEqual(Object.keys(act).sort(), [
    "created",
    "deleted",
    "deletedAt",
    "documentId",
    "done",
    "due",
    "groupId",
    "id",
    "title",
    "updatedAt",
  ]);
  assert.equal(act.quote, undefined);

  const grp = toRemoteGroup({ id: "g1", title: "Home", created: 100, updated: 200 });
  assert.equal(grp.updatedAt, 200);
  const dep = toRemoteDependency({
    id: "a1->a2",
    prerequisiteActionId: "a1",
    dependentActionId: "a2",
    created: 300,
  });
  assert.equal(dep.deleted, false);

  const docTomb = toTombstonePayload("documents", "d1", 5000, {
    title: "Old doc",
    category: "Other",
    created: 1000,
  });
  assert.equal(docTomb.deleted, true);
  assert.equal(docTomb.deletedAt, 5000);
  assert.equal(docTomb.text, undefined);
});

test("reconcileCollection preserves local-only fields, merges LWW edits, and prevents resurrection via tombstones", () => {
  const sameDeviceMerge = reconcileCollection({
    collection: "documents",
    localRecords: [
      {
        id: "d1",
        title: "Old title",
        category: "Other",
        tags: ["a"],
        status: "needs_review",
        created: 1000,
        updatedAt: 1500,
        text: "Original kept locally",
        facts: [{ label: "Ref", value: "123" }],
        remoteOnly: false,
        _dirty: false,
      },
    ],
    remoteRecords: [
      {
        id: "d1",
        title: "Updated from phone",
        category: "Money & Bills",
        tags: ["a", "b"],
        status: "organized",
        created: 1000,
        updatedAt: 3000,
        deleted: false,
        deletedAt: null,
      },
      {
        id: "d2",
        title: "Created on phone",
        category: "Work & Study",
        tags: [],
        status: "organized",
        created: 2000,
        updatedAt: 2500,
        deleted: false,
        deletedAt: null,
      },
    ],
    localTombstones: [],
  });

  assert.equal(sameDeviceMerge.localUpserts.length, 2);
  const mergedLocal = sameDeviceMerge.localUpserts.find((r) => r.id === "d1");
  assert.equal(mergedLocal.title, "Updated from phone");
  assert.equal(mergedLocal.text, "Original kept locally");
  assert.equal(mergedLocal.remoteOnly, false);

  const pulledRemoteOnly = sameDeviceMerge.localUpserts.find((r) => r.id === "d2");
  assert.equal(pulledRemoteOnly.remoteOnly, true);
  assert.equal(pulledRemoteOnly.text, "");

  // Stale offline device has local dirty edit on d-del, but remote already has permanent tombstone
  const staleResurrectionBlocked = reconcileCollection({
    collection: "documents",
    localRecords: [
      {
        id: "d-del",
        title: "Stale edit",
        category: "Other",
        status: "organized",
        created: 1000,
        updatedAt: 99999,
        _dirty: true,
      },
    ],
    remoteRecords: [
      {
        id: "d-del",
        title: "Deleted document",
        category: "Other",
        tags: [],
        status: "organized",
        created: 1000,
        updatedAt: 5000,
        deleted: true,
        deletedAt: 5000,
      },
    ],
    localTombstones: [],
  });
  assert.deepEqual(staleResurrectionBlocked.localDeletes, ["d-del"]);
  assert.deepEqual(staleResurrectionBlocked.remoteUpserts, []);

  // Re-linked dependency with strictly newer timestamp survives earlier remote tombstone
  const relinkPlan = reconcileCollection({
    collection: "actionDependencies",
    localRecords: [
      {
        id: "a1->a2",
        prerequisiteActionId: "a1",
        dependentActionId: "a2",
        created: 1000,
        updatedAt: 6000,
        _dirty: true,
      },
    ],
    remoteRecords: [
      {
        id: "a1->a2",
        prerequisiteActionId: "a1",
        dependentActionId: "a2",
        created: 1000,
        updatedAt: 4000,
        deleted: true,
        deletedAt: 4000,
      },
    ],
    localTombstones: [],
  });
  assert.equal(relinkPlan.remoteUpserts.length, 1);
  assert.equal(relinkPlan.localDeletes.length, 0);
});

test("auth error mapping, demo return routing, and account/sync i18n coverage", () => {
  assert.equal(mapAuthError({ code: "auth/popup-closed-by-user" }), "authErrorPopupClosed");
  assert.equal(mapAuthError({ code: "auth/popup-blocked" }), "authErrorPopupBlocked");
  assert.equal(
    mapAuthError({ code: "auth/account-exists-with-different-credential" }),
    "authErrorDifferentCredential",
  );
  assert.equal(mapAuthError({ code: "auth/email-already-in-use" }), "authErrorEmailInUse");
  assert.equal(mapAuthError({ code: "auth/unknown" }), "authErrorGeneric");

  assert.equal(demoWorkspaceHref("/", "/account"), "/?demo=1&from=%2Faccount#/home");
  assert.equal(exitDemoHref("/", "?demo=1&from=%2Faccount"), "/#/account");
  assert.equal(exitDemoHref("/", "?demo=1&from=http://evil.example"), "/#/home");

  const tEn = createTranslator("en");
  const tId = createTranslator("id");
  for (const key of [
    "navAccount",
    "continueWithGoogle",
    "continueOnThisDevice",
    "enableSync",
    "disableSync",
    "syncStatusOff",
    "syncStatusPending",
    "syncStatusSynced",
    "syncStatusFailed",
    "originalUnavailableOnDevice",
    "importAndEnableSync",
  ]) {
    assert.notEqual(tEn(key), key);
    assert.notEqual(tId(key), key);
    assert.notEqual(tEn(key), tId(key));
  }
  assert.match(tEn("importPromptBody", { docs: 2, actions: 3 }), /2 local document.*3 follow-up/);
  assert.match(tId("importPromptBody", { docs: 2, actions: 3 }), /2 dokumen lokal.*3 tindak lanjut/);
});

test("demo identity, standalone login return routing, and Hybrid AI privacy metadata", () => {
  assert.equal(DEMO_ACCOUNT_EMAIL, "demo@example.com");
  assert.equal(demoWorkspaceHref("/", "/login"), "/?demo=1&from=%2Flogin#/home");
  assert.equal(exitDemoHref("/", "?demo=1&from=%2Flogin"), "/#/login");

  assert.deepEqual(
    getCapturePrivacyStatus({
      mode: "rules",
      configured: true,
      deviceSupported: false,
      consent: false,
    }),
    {
      tone: "green",
      iconKey: "shield",
      badgeKey: "privacyBadgeLocalRules",
      detailKey: "privacyDetailRulesConnected",
    },
  );
  assert.equal(
    getCapturePrivacyStatus({
      mode: "device",
      configured: true,
      deviceSupported: true,
      consent: false,
    }).badgeKey,
    "privacyBadgeOnDevice",
  );
  assert.equal(
    getCapturePrivacyStatus({
      mode: "hybrid",
      configured: true,
      deviceSupported: true,
      consent: false,
    }).detailKey,
    "privacyDetailHybridNeedsConsent",
  );
  assert.equal(
    getCapturePrivacyStatus({
      mode: "hybrid",
      configured: true,
      deviceSupported: false,
      consent: true,
    }).detailKey,
    "privacyDetailCloudConsented",
  );

  assert.equal(getDocumentPrivacyMeta("Firebase · on device").labelKey, "privacyDocOnDevice");
  assert.equal(getDocumentPrivacyMeta("Firebase · cloud").labelKey, "privacyDocCloud");
  assert.equal(getDocumentPrivacyMeta("Local rules").labelKey, "privacyDocLocalRules");
  assert.equal(getDocumentPrivacyMeta("Manual filing").labelKey, "privacyDocManual");
  assert.equal(getDocumentPrivacyMeta("Firebase · unsuccessful").labelKey, "privacyDocRetry");
  assert.equal(getDocumentPrivacyMeta("Synced progress").labelKey, "privacyDocSynced");
  assert.equal(getDocumentPrivacyMeta("Synthetic sample · seeded example").labelKey, "");
});

test("workflow templates match all 5 categories in EN/ID, clamp titles, and return null for unmatched Other", () => {
  const cases = [
    ["Money & Bills", "bill-payment", 3],
    ["Home & Living", "membership-renewal", 3],
    ["Work & Study", "work-study-submission", 3],
    ["Purchases", "purchase-warranty", 3],
    ["Personal Records", "personal-record-check", 2],
  ];
  for (const [category, expectedId, expectedSteps] of cases) {
    const longTitle = `${category} document ` + "X".repeat(90);
    const tplEn = suggestWorkflowTemplate(
      {
        title: longTitle,
        category,
        tags: [],
        text: "",
        followUp: { due: "2026-12-20" },
      },
      "en",
    );
    const tplId = suggestWorkflowTemplate(
      {
        title: category,
        category,
        tags: [],
        text: "",
        followUp: { due: "2026-12-20" },
      },
      "id",
    );
    assert.equal(tplEn.id, expectedId);
    assert.equal(tplEn.steps.length, expectedSteps);
    assert.ok(tplEn.groupTitle.length <= 80);
    assert.equal(tplEn.steps[1].due, "2026-12-20");
    assert.notEqual(tplEn.label, tplId.label);
    assert.notEqual(tplEn.steps[0].title, tplId.steps[0].title);
  }

  assert.equal(
    suggestWorkflowTemplate({ title: "Random memo", category: "Other", text: "Notes", tags: [] }),
    null,
  );
  assert.equal(
    suggestWorkflowTemplate({
      title: "Faktur listrik",
      category: "Other",
      text: "Tagihan bulan November",
      tags: [],
    })?.id,
    "bill-payment",
  );
});

test("calendar export builds RFC 5545 .ics events and Google Calendar links accurately", () => {
  assert.equal(nextIsoCalendarDay("2026-12-31"), "2027-01-01");
  assert.equal(nextIsoCalendarDay("2028-02-28"), "2028-02-29");
  assert.equal(nextIsoCalendarDay("invalid"), "");
  assert.equal(escapeIcsText("Pay, bill; now\nLine 2\\end"), "Pay\\, bill\\; now\\nLine 2\\\\end");

  const action = {
    id: "act-1",
    title: "Pay water invoice, #1",
    due: "2026-12-31",
    quote: "Total due: USD 30.00",
  };
  const doc = { title: "City water bill" };
  assert.equal(icsFilename(action), "tuntas-pay-water-invoice-1-2026-12-31.ics");

  const ics = buildIcsEvent(action, doc, {
    groupTitle: "Monthly bills",
    now: new Date(Date.UTC(2026, 10, 26, 12, 0, 0)),
  });
  assert.ok(ics.includes("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261231\r\n"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20270101\r\n"));
  assert.ok(ics.includes("SUMMARY:Pay water invoice\\, #1\r\n"));
  assert.ok(ics.includes("UID:act-1@tuntas.app\r\n"));

  const gcal = buildGoogleCalendarUrl(action, doc, { groupTitle: "Monthly bills" });
  const parsed = new URL(gcal);
  assert.equal(parsed.origin, "https://calendar.google.com");
  assert.equal(parsed.searchParams.get("action"), "TEMPLATE");
  assert.equal(parsed.searchParams.get("text"), "Pay water invoice, #1");
  assert.equal(parsed.searchParams.get("dates"), "20261231/20270101");

  assert.equal(buildIcsEvent({ id: "a2", title: "No date", due: "" }), null);
  assert.equal(buildGoogleCalendarUrl({ id: "a2", title: "No date", due: "" }), "");
});

test("split-domain detects IDR/USD totals, splits equally and itemized with exact sum, builds mailto, and verifies proof", () => {
  assert.deepEqual(SPLIT_CURRENCIES, ["IDR", "USD", "SGD", "EUR", "GBP"]);

  const idrDoc = {
    tags: ["receipt", "IDR"],
    facts: [{ label: "Total (IDR)", value: "184.000", quote: "Grand Total : 184.000" }],
    text: "Restaurant dinner receipt\nGrand Total : 184.000\nCurrency: IDR",
  };
  assert.equal(detectReceiptCurrency(idrDoc, "en"), "IDR");
  assert.equal(detectReceiptTotal(idrDoc), 184000);

  const usdDoc = {
    tags: ["receipt"],
    facts: [{ label: "Total", value: "USD 100.00", quote: "Total: USD 100.00" }],
    text: "Dinner\nTotal: USD 100.00",
  };
  assert.equal(detectReceiptCurrency(usdDoc, "en"), "USD");
  assert.equal(detectReceiptTotal(usdDoc), 100);

  // Equal split of 100 across 3 sums to exactly 100.00
  const eq = calculateShares({
    mode: "equal",
    totalAmount: 100,
    currency: "USD",
    participants: [
      { id: "self", name: "Me", email: "", isSelf: true },
      { id: "p1", name: "Alice", email: "ALICE@Example.com", isSelf: false },
      { id: "p2", name: "Bob", email: "bob@example.com", isSelf: false },
    ],
  });
  assert.equal(eq.computedTotal, 100);
  assert.equal(eq.shares.find((s) => s.id === "p1").email, "alice@example.com");

  // Itemized split with shared dish + tax
  const itemSplit = calculateShares({
    mode: "itemized",
    currency: "IDR",
    participants: [
      { id: "self", name: "Me", email: "", isSelf: true },
      { id: "p1", name: "Budi", email: "budi@example.com", isSelf: false },
    ],
    items: [
      { id: "i1", name: "Nasi Goreng", amount: 50000, assigneeIds: ["self"] },
      { id: "i2", name: "Satay", amount: 60000, assigneeIds: ["p1"] },
      { id: "i3", name: "Shared Tea", amount: 20000, assigneeIds: ["self", "p1"] },
    ],
    taxOrTip: 13000,
  });
  assert.equal(itemSplit.computedTotal, 143000);

  const mailto = buildSplitMailtoHref(
    {
      id: "sp-1",
      title: "Dinner",
      currency: "USD",
      paymentInstructions: "Venmo @me",
    },
    { participantName: "Bob", participantEmail: "bob@example.com", amount: 33.34 },
    { inviteUrl: "https://tuntas.app/#/split/sp-1", locale: "en-US" },
  );
  assert.ok(mailto.startsWith("mailto:bob%40example.com?subject="));
  assert.ok(decodeURIComponent(mailto).includes("https://tuntas.app/#/split/sp-1"));

  const proofOk = verifyTransferProofLocally({
    text: "Transfer successful Rp 92.000 Ref TRX-8821",
    expectedAmount: 92000,
    currency: "IDR",
  });
  assert.equal(proofOk.matched, true);
  assert.equal(proofOk.reference, "TRX-8821");

  const gpayReq = buildGooglePayRequest({ amount: 50, currency: "USD" });
  assert.equal(gpayReq.transactionInfo.totalPrice, "50.00");
  assert.equal(gpayReq.transactionInfo.currencyCode, "USD");
  const sim = createSimulatedGooglePayToken({ amount: 50, currency: "USD" });
  assert.equal(sim.ok, true);
  assert.match(sim.tokenPreview, /^GPay-SIM-/);
});

test("rag-local retrieves relevant docs and computes exact multi-receipt totals in EN and ID", () => {
  const docs = [
    {
      id: "d1",
      title: "Restaurant dinner receipt",
      category: "Purchases",
      tags: ["receipt", "IDR"],
      facts: [{ label: "Total (IDR)", value: "184.000", quote: "Grand Total : 184.000" }],
      text: "Restaurant dinner receipt\nGrand Total : 184.000\nCurrency: IDR",
      created: 2000,
    },
    {
      id: "d2",
      title: "Ice cream counter receipt",
      category: "Purchases",
      tags: ["receipt", "IDR"],
      facts: [{ label: "Total (IDR)", value: "14.000", quote: "Grand Total : 14.000" }],
      text: "Ice cream counter receipt\nGrand Total : 14.000\nCurrency: IDR",
      created: 1500,
    },
    {
      id: "d3",
      title: "Household membership renewal notice",
      category: "Home & Living",
      tags: ["renewal", "membership"],
      facts: [{ label: "Total", value: "USD 48.00", quote: "Total: USD 48.00" }],
      text: "Household membership renewal notice\nRenew your membership by 12 December 2026.",
      followUp: { due: "2026-12-12" },
      created: 1000,
    },
  ];
  const actions = [
    { id: "a1", documentId: "d3", title: "Submit renewal", due: "2026-12-12", done: false },
  ];

  assert.deepEqual(tokenizeQuery("How much did I spend on receipts?"), ["spend", "receipts"]);
  assert.equal(extractAmountsFromDoc(docs[0])[0].amount, 184000);
  assert.equal(retrieveRelevantDocs(docs, actions, "membership renew")[0].doc.id, "d3");

  const spendEn = answerPaperworkLocally(docs, actions, "How much did I spend on receipts?", "en");
  assert.match(spendEn.answer, /198[.,]000/);
  assert.equal(spendEn.citations.length, 2);

  const renewEn = answerPaperworkLocally(docs, actions, "When does household membership renew?", "en");
  assert.match(renewEn.answer, /2026-12-12/);
  assert.equal(renewEn.citations[0].docId, "d3");

  const renewId = answerPaperworkLocally(docs, actions, "Kapan keanggotaan rumah tangga diperpanjang?", "id");
  assert.match(renewId.answer, /2026-12-12/);
});

test("DEMO_EXTRA_RECEIPTS and buildInitialDemoSplits provide redacted itemized receipts and interactive split states", () => {
  assert.notEqual(DEMO_EXTRA_RECEIPTS_SEED_KEY, DEMO_SEED_KEY);
  assert.equal(DEMO_EXTRA_RECEIPTS.length, 5);

  const privateTerms = /annisaa|nurfitria|imelda|6285697282503|02961117n26a024|100035254/i;
  for (const r of DEMO_EXTRA_RECEIPTS) {
    assert.equal(privateTerms.test(r.title), false);
    assert.equal(privateTerms.test(r.text), false);
    assert.equal(detectReceiptCurrency(r, "en"), "IDR");
    assert.ok(detectReceiptTotal(r) > 0);
  }

  const kfc = DEMO_EXTRA_RECEIPTS.find((r) => r.id === "demo-doc-kfc-receipt");
  assert.equal(detectReceiptTotal(kfc), 50000);
  const kfcItems = parseReceiptLineItems(kfc.text);
  assert.equal(kfcItems.length, 3);
  assert.deepEqual(
    kfcItems.map((i) => i.amount),
    [19091, 14545, 11818],
  );

  const taburai = DEMO_EXTRA_RECEIPTS.find((r) => r.id === "demo-doc-taburai-receipt");
  assert.equal(detectReceiptTotal(taburai), 142100);
  const taburaiItems = parseReceiptLineItems(taburai.text);
  assert.equal(taburaiItems.length, 2);
  assert.deepEqual(
    taburaiItems.map((i) => i.amount),
    [74600, 67500],
  );

  const initial = buildInitialDemoSplits();
  assert.equal(initial.splits.length, 2);
  const incoming = initial.splits.find((s) => s.id === "demo-split-incoming-kfc");
  assert.ok(incoming);
  assert.ok(incoming.participantEmails.includes(DEMO_ACCOUNT_EMAIL));
  const myIncomingShare = initial.sharesBySplit[incoming.id].find(
    (sh) => sh.participantEmail === DEMO_ACCOUNT_EMAIL,
  );
  assert.equal(myIncomingShare.status, "pending");
  assert.equal(myIncomingShare.amount, 16000);

  const outgoing = initial.splits.find((s) => s.id === "demo-split-outgoing-taburai");
  assert.ok(outgoing);
  assert.equal(outgoing.organizerEmail, DEMO_ACCOUNT_EMAIL);
  assert.equal(initial.sharesBySplit[outgoing.id][0].status, "paid_pending_confirm");
});

test("Firebase AI cloud model chain falls back, parses fenced JSON, and sanitizes >8 facts & blank values", async () => {
  assert.deepEqual(CLOUD_MODEL_CHAIN, [
    "gemini-4-hydrogen",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
  ]);

  const fenced = "```json\n{\"title\":\"BCA Transfer\",\"category\":\"Money & Bills\"}\n```";
  assert.equal(parseModelJson(fenced).title, "BCA Transfer");

  // Simulate dense 11-fact BCA transfer slip with a blank Description row
  const bcaRaw = {
    title: "myBCA transfer receipt",
    category: "Money & Bills",
    confidence: "high",
    evidence: "Transfer to BCA Virtual Account",
    facts: [
      { label: "Status", value: "Successful", quote: "Status : Successful" },
      { label: "Transaction Date", value: "26 Nov 2026 11:44:28", quote: "Transaction Date : 26 Nov 2026 11:44:28" },
      { label: "Description", value: "", quote: "Description :" },
      { label: "Transfer Type", value: "Transfer to BCA Virtual Account", quote: "Transfer Type : Transfer to BCA Virtual Account" },
      { label: "Source of Fund", value: "6290xxxx80", quote: "Source of Fund : 6290xxxx80" },
      { label: "Pay Amount", value: "IDR 200,000.00", quote: "Pay Amount : IDR 200,000.00" },
      { label: "Total Payment", value: "IDR 200,000.00", quote: "Total Payment : IDR 200,000.00" },
      { label: "Reference No.", value: "9527120261126114428226TVA8987119800", quote: "Reference No. : 9527120261126114428226TVA8987119800" },
      { label: "NPWP", value: "0013084496091000", quote: "NPWP: 0013084496091000" },
      { label: "Company", value: "PT VISIONET INTERNASIONAL", quote: "Company/Product Name : PT VISIONET INTERNASIONAL" },
      { label: "Bank", value: "PT BANK CENTRAL ASIA TBK", quote: "PT BANK CENTRAL ASIA TBK." },
    ],
  };
  const sanitized = sanitizeModelProposal(bcaRaw);
  assert.equal(sanitized.facts.length, 8);
  assert.equal(
    sanitized.facts.some((f) => f.label === "Description"),
    false,
  );
  const validated = validateProposal(sanitized, "", { image: true });
  assert.equal(validated.facts.length, 8);
  assert.equal(validated.status, "needs_review");

  // Fallback tries gemini-4-hydrogen then gemini-3.8-flash
  const tried = [];
  const res = await runWithCloudModelFallback(
    [
      { name: "gemini-4-hydrogen", model: { id: 1 } },
      { name: "gemini-3.8-flash", model: { id: 2 } },
      { name: "gemini-3.5-flash-lite", model: { id: 3 } },
    ],
    async (m, name) => {
      tried.push(name);
      if (name === "gemini-4-hydrogen") throw Error("429 Resource exhausted");
      return `ok:${m.id}`;
    },
    { allowCloud: true },
  );
  assert.equal(res, "ok:2");
  assert.deepEqual(tried, ["gemini-4-hydrogen", "gemini-3.8-flash"]);

  // App Check / 403 error does not retry
  const deniedTried = [];
  await assert.rejects(
    runWithCloudModelFallback(
      [
        { name: "gemini-4-hydrogen", model: { id: 1 } },
        { name: "gemini-3.8-flash", model: { id: 2 } },
      ],
      async (_m, name) => {
        deniedTried.push(name);
        throw Error("403 App Check token invalid");
      },
      { allowCloud: true },
    ),
    /App Check/,
  );
  assert.deepEqual(deniedTried, ["gemini-4-hydrogen"]);
});

test("privacy-redact masks emails, phones, and account IDs while preserving amounts and dates", async () => {
  const sampleTransfer = [
    "BCA Virtual Account Transfer",
    "Date: 26 Nov 2026",
    "Account No: 39358085697282503",
    "Source: 6290xxxx80",
    "NPWP: 00.130.844.9-609.000",
    "Phone: +62 856-9728-2503",
    "Email: alice.putri@example.com",
    "Pay Amount: IDR 200,000.00",
  ].join("\n");

  const masked = maskSensitiveText(sampleTransfer);
  assert.equal(masked.counts.emails, 1);
  assert.equal(masked.counts.phones, 1);
  assert.equal(masked.counts.accounts, 3);
  assert.equal(masked.counts.total, 5);
  assert.ok(masked.text.includes("[EMAIL]"));
  assert.ok(masked.text.includes("[PHONE]"));
  assert.ok(masked.text.includes("[ACCOUNT_ID]"));
  assert.ok(masked.text.includes("Date: 26 Nov 2026"));
  assert.ok(masked.text.includes("IDR 200,000.00"));
  assert.equal(masked.text.includes("alice.putri@example.com"), false);
  assert.equal(masked.text.includes("39358085697282503"), false);

  assert.equal(redactedExportFilename("sample-receipt-1.jpg", "jpg"), "sample-receipt-1-redacted.jpg");
  assert.equal(redactedExportFilename("birchline notice.pdf", "txt"), "birchline-notice-redacted.txt");

  let sentPrompt = "";
  const classify = classifierForModel(
    {
      initializeDeviceModel: async () => {},
      generateContent: async (parts) => {
        sentPrompt = parts[0];
        return {
          response: {
            inferenceSource: "in_cloud",
            text: () =>
              JSON.stringify({
                title: "BCA Transfer",
                category: "Money & Bills",
                confidence: "high",
                evidence: "Pay Amount: IDR 200,000.00",
                facts: [],
              }),
          },
        };
      },
    },
    { allowCloud: true, image: false, maskPii: true },
  );
  await classify({ text: sampleTransfer });
  assert.ok(sentPrompt.includes("[EMAIL]"));
  assert.ok(sentPrompt.includes("[ACCOUNT_ID]"));
  assert.equal(sentPrompt.includes("alice.putri@example.com"), false);
});
