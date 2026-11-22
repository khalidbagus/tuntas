import { openDB } from "idb";
import { fingerprint } from "./domain.js";
import {
  PERSONAL_DB_NAME,
  DEMO_DB_NAME,
  DEMO_SEED_KEY,
  REDACTED_RECEIPT_SEED_KEY,
  LOCAL_RECEIPT_SEED_KEY,
  isDemoMode,
  buildDemoSeed,
  loadRedactedReceiptFixtures,
  loadLocalReceiptFixtures,
} from "./demo.js";

const databases = new Map();

function getDB(demo = isDemoMode()) {
  const name = demo ? DEMO_DB_NAME : PERSONAL_DB_NAME;
  if (!databases.has(name)) {
    databases.set(
      name,
      openDB(name, 1, {
        upgrade(db) {
          const docs = db.createObjectStore("documents", { keyPath: "id" });
          docs.createIndex("digest", "digest", { unique: true });
          db.createObjectStore("originals");
          db.createObjectStore("actions", { keyPath: "id" });
          if (demo) {
            db.createObjectStore("meta", { keyPath: "key" });
          }
        },
      }),
    );
  }
  return databases.get(name);
}

let seedPromise = null;

async function seedDemoBatch(database, key, build, onlyWhenEmpty = false) {
  if (await database.get("meta", key)) return false;
  const seed = await build();
  if (!seed.docs.length) return false;
  const tx = database.transaction(
    ["meta", "documents", "originals", "actions"],
    "readwrite",
  );
  const meta = tx.objectStore("meta");
  if (await meta.get(key)) {
    await tx.done;
    return false;
  }

  const documents = tx.objectStore("documents");
  const originals = tx.objectStore("originals");
  const actions = tx.objectStore("actions");
  const inserted = new Set();
  if (!onlyWhenEmpty || (await documents.count()) === 0) {
    for (const [index, doc] of seed.docs.entries()) {
      const existing =
        (await documents.getKey(doc.id)) ||
        (await documents.index("digest").getKey(doc.digest));
      if (existing) continue;
      const { bytes, type } = seed.originals[index];
      await documents.add(doc);
      await originals.add({ bytes, type }, doc.id);
      inserted.add(doc.id);
    }
    for (const action of seed.actions) {
      if (inserted.has(action.documentId)) await actions.add(action);
    }
  }
  await meta.put({ key, seededAt: Date.now(), version: 1 });
  await tx.done;
  return inserted.size > 0;
}

export function ensureDemoSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const database = await getDB(true);
      const seeded = await seedDemoBatch(
        database,
        DEMO_SEED_KEY,
        buildDemoSeed,
        true,
      );
      const redactedSeeded = await seedDemoBatch(
        database,
        REDACTED_RECEIPT_SEED_KEY,
        async () => buildDemoSeed(await loadRedactedReceiptFixtures()),
      );
      const photosSeeded = await seedDemoBatch(
        database,
        LOCAL_RECEIPT_SEED_KEY,
        async () => buildDemoSeed(await loadLocalReceiptFixtures()),
      );
      return { seeded: seeded || redactedSeeded || photosSeeded };
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

export async function stage(blob, meta) {
  const [digest, bytes] = await Promise.all([
      fingerprint(blob),
      blob.arrayBuffer(),
    ]),
    database = await getDB(),
    tx = database.transaction(["documents", "originals"], "readwrite"),
    docs = tx.objectStore("documents");
  const prior = await docs.index("digest").get(digest);
  if (prior) {
    await tx.done;
    return { doc: prior, duplicate: true };
  }
  if ((await docs.count()) >= 300) {
    await tx.done;
    throw Error("This browser workspace is full (300 documents).");
  }
  const doc = {
    id: crypto.randomUUID(),
    digest,
    created: Date.now(),
    status: "pending",
    title: meta.name,
    category: "Other",
    facts: [],
    tags: [],
    mode: "Not analyzed",
    ...meta,
  };
  await docs.add(doc);
  await tx.objectStore("originals").add({ bytes, type: blob.type }, doc.id);
  await tx.done;
  return { doc, duplicate: false };
}
export async function change(id, fields) {
  const database = await getDB(),
    tx = database.transaction("documents", "readwrite"),
    prev = await tx.store.get(id);
  if (!prev) throw Error("Document not found.");
  const doc = { ...prev, ...fields };
  await tx.store.put(doc);
  await tx.done;
  return doc;
}
export const original = async (id) => {
  const stored = await (await getDB()).get("originals", id);
  return stored instanceof Blob || !stored
    ? stored
    : new Blob([stored.bytes], { type: stored.type });
};
export async function snapshot() {
  const database = await getDB();
  const [docs, actions] = await Promise.all([
    database.getAll("documents"),
    database.getAll("actions"),
  ]);
  return {
    docs: docs.sort((a, b) => b.created - a.created),
    actions: actions.sort((a, b) => b.created - a.created),
  };
}
export async function addAction(
  documentId,
  title,
  due,
  { suggestionKey = "", quote = "" } = {},
) {
  if (!title.trim() || title.length > 140)
    throw Error("Give your action a short title.");
  const database = await getDB(),
    tx = database.transaction(["documents", "actions"], "readwrite");
  if (!(await tx.objectStore("documents").get(documentId)))
    throw Error("The source is missing.");
  const store = tx.objectStore("actions");
  if (suggestionKey) {
    const existing = (await store.getAll()).find(
      (a) => a.documentId === documentId && a.suggestionKey === suggestionKey,
    );
    if (existing) {
      await tx.done;
      return { action: existing, created: false };
    }
  }
  const action = {
    id: crypto.randomUUID(),
    documentId,
    title: title.trim(),
    due: due || "",
    done: false,
    created: Date.now(),
    ...(suggestionKey ? { suggestionKey } : {}),
    ...(quote ? { quote } : {}),
  };
  await store.add(action);
  await tx.done;
  return { action, created: true };
}
export async function toggleAction(id) {
  const tx = (await getDB()).transaction("actions", "readwrite");
  const a = await tx.store.get(id);
  if (a) await tx.store.put({ ...a, done: !a.done });
  await tx.done;
}
