import { openDB } from "idb";
import { fingerprint } from "./domain.js";
const db = openDB("tuntas-workspace-v1", 1, {
  upgrade(db) {
    const docs = db.createObjectStore("documents", { keyPath: "id" });
    docs.createIndex("digest", "digest", { unique: true });
    db.createObjectStore("originals");
    db.createObjectStore("actions", { keyPath: "id" });
  },
});
export async function stage(blob, meta) {
  const [digest, bytes] = await Promise.all([
      fingerprint(blob),
      blob.arrayBuffer(),
    ]),
    database = await db,
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
  const database = await db,
    tx = database.transaction("documents", "readwrite"),
    prev = await tx.store.get(id);
  if (!prev) throw Error("Document not found.");
  const doc = { ...prev, ...fields };
  await tx.store.put(doc);
  await tx.done;
  return doc;
}
export const original = async (id) => {
  const stored = await (await db).get("originals", id);
  return stored instanceof Blob || !stored
    ? stored
    : new Blob([stored.bytes], { type: stored.type });
};
export async function snapshot() {
  const database = await db;
  const [docs, actions] = await Promise.all([
    database.getAll("documents"),
    database.getAll("actions"),
  ]);
  return {
    docs: docs.sort((a, b) => b.created - a.created),
    actions: actions.sort((a, b) => b.created - a.created),
  };
}
export async function addAction(documentId, title, due) {
  if (!title.trim() || title.length > 140)
    throw Error("Give your action a short title.");
  const database = await db,
    tx = database.transaction(["documents", "actions"], "readwrite");
  if (!(await tx.objectStore("documents").get(documentId)))
    throw Error("The source is missing.");
  await tx
    .objectStore("actions")
    .add({
      id: crypto.randomUUID(),
      documentId,
      title: title.trim(),
      due,
      done: false,
      created: Date.now(),
    });
  await tx.done;
}
export async function toggleAction(id) {
  const tx = (await db).transaction("actions", "readwrite");
  const a = await tx.store.get(id);
  if (a) await tx.store.put({ ...a, done: !a.done });
  await tx.done;
}
