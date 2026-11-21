import test from "node:test";
import assert from "node:assert/strict";
import { classifierForModel } from "../src/firebase-ai.js";
import { supportsDeviceAI } from "../src/device-ai.js";
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
