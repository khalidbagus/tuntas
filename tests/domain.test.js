import test from "node:test";
import assert from "node:assert/strict";
import { classifierForModel } from "../src/firebase-ai.js";
import { supportsDeviceAI } from "../src/device-ai.js";
import {
  DEMO_SEED_KEY,
  REDACTED_RECEIPT_SEED_KEY,
  REDACTED_RECEIPT_SOURCE,
  REDACTED_RECEIPT_FIXTURES,
  DEMO_WORKFLOW_SEED_KEY,
  DEMO_RENEWAL_GROUP_ID,
  isDemoMode,
  demoWorkspaceHref,
  exitDemoHref,
  buildDemoSeed,
  buildDemoWorkflowSeed,
} from "../src/demo.js";
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
