import test from "node:test";
import assert from "node:assert/strict";
import { classifierForModel } from "../src/firebase-ai.js";
import { supportsDeviceAI } from "../src/device-ai.js";
import {
  validateFile,
  validateText,
  localClassifier,
  validateProposal,
  sample,
  MAX_BYTES,
  matchesQuery,
  fingerprint,
} from "../src/domain.js";
const base = localClassifier({ text: sample.text, name: "receipt.txt" });
test("receipt files without a confirmation; total carries its literal source", () => {
  const d = validateProposal(base, sample.text);
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
    sample.text,
  );
  assert.equal(v.facts.length, 0);
  assert.equal(v.status, "needs_review");
  for (const v of [
    validateProposal({ ...base, evidence: "random" }, sample.text),
    validateProposal(base, sample.text, { partial: true }),
    validateProposal(base, sample.text, { image: true }),
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
  const d = { ...base, text: sample.text, tags: ["stationery"] };
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
      initializeDeviceModel: async () => {},
      generateContent: async (parts) => {
        assert(parts[0].includes(sample.text));
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
    })({ text: sample.text });
    assert.equal(result.mode, mode);
    assert.equal(validateProposal(result, sample.text).category, "Purchases");
  }
});
test("malformed model JSON cannot be accepted as a classification", async () => {
  const model = {
    chromeAdapter: {},
    initializeDeviceModel: async () => {},
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
      initializeDeviceModel: async () => {},
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
      initializeDeviceModel: async () => {},
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
  assert.equal(supportsDeviceAI({ availability() {}, create() {} }), true);
});
test("device-only accepts only a reported local source", async () => {
  for (const source of ["in_cloud", undefined, "on_device"]) {
    const classify = classifierForModel(
      {
        chromeAdapter: {},
        initializeDeviceModel: async () => {},
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
