import { stage, change, original } from "./db.js";
import { extract } from "./extract.js";
import {
  localClassifier,
  validateProposal,
  validateFile,
  validateText,
} from "./domain.js";
export { firebaseConfigured as configured } from "./firebase-settings.js";
export async function intake({ file, text, sample = false, source }) {
  let blob, name, mime;
  if (file) {
    mime = validateFile(
      file.size,
      file.type,
      new Uint8Array(await file.slice(0, 8).arrayBuffer()),
    );
    blob = file.slice(0, file.size, mime);
    name = file.name;
  } else {
    validateText(text);
    mime = "text/plain";
    blob = new Blob([text], { type: mime });
    name = sample ? "Sample renewal.txt" : "Pasted text.txt";
  }
  return stage(blob, { name, mime, size: blob.size, source, sample });
}
function deadline(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, r) => {
      timer = setTimeout(() => r(Error("Analysis timed out.")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
export async function processDocument(
  doc,
  classifier,
  onStage,
  usingAI = false,
) {
  let read;
  try {
    await change(doc.id, { status: "processing", reason: "" });
    onStage("Reading original");
    const blob = await original(doc.id);
    read = await extract(blob, doc.mime);
    await change(doc.id, { text: read.text });
    if (read.image && !usingAI)
      throw Error(
        "This image needs a visual review. Local rules do not read images.",
      );
    onStage(
      usingAI ? "Waiting for Firebase AI" : "Checking local filing rules",
    );
    const proposed = await deadline(
      Promise.resolve(classifier({ ...read, blob, name: doc.name })),
      90000,
    );
    const result = validateProposal(proposed, read.text, read);
    return change(doc.id, {
      ...result,
      mode: proposed.mode,
      proposal: { ...result, mode: proposed.mode },
      reviewed: false,
      autoFiled: result.status === "organized",
      ...(result.followUp ? { followUpDismissed: false } : {}),
    });
  } catch (e) {
    if (usingAI) console.error("[Tuntas AI]", e);
    const rawMsg = String(e?.message || e || "");
    let message = rawMsg;
    if (usingAI && read && !rawMsg.startsWith("The on-device model")) {
      if (
        /app[\s-]?check|recaptcha|permission_denied|api[_\s-]?key|unauthenticated|forbidden|\b401\b|\b403\b/i.test(
          rawMsg,
        )
      ) {
        message =
          "Firebase AI access was blocked (App Check or API permission). Retry or file manually.";
      } else if (/\b429\b|resource_exhausted|quota/i.test(rawMsg)) {
        message =
          "Firebase AI is temporarily rate-limited. Wait a moment and retry, or file manually.";
      } else if (/timed out|timeout|aborted/i.test(rawMsg)) {
        message = "AI analysis timed out. Retry or file manually.";
      } else {
        message = read.image
          ? "AI analysis did not finish with a usable result. Retry or file manually."
          : "AI analysis did not finish with a usable result. Retry, choose local rules, or file manually.";
      }
    }
    return change(doc.id, {
      status: "error",
      reason: message,
      mode: usingAI ? "Firebase · unsuccessful" : "Local rules",
      autoFiled: false,
    });
  }
}
export { localClassifier };
