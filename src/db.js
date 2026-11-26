import { openDB } from "idb";
import { fingerprint } from "./domain.js";
import {
  dependencyId,
  isValidIsoDate,
  validateDependency,
} from "./actions-domain.js";
import { formatSplitAmount } from "./split-domain.js";
import { tombstoneKey } from "./sync-domain.js";
import {
  PERSONAL_DB_NAME,
  DEMO_DB_NAME,
  DEMO_SEED_KEY,
  REDACTED_RECEIPT_SEED_KEY,
  LOCAL_RECEIPT_SEED_KEY,
  LOCAL_RECEIPT_EXPANSION_SEED_KEY,
  DEMO_EXTRA_RECEIPTS_SEED_KEY,
  DEMO_WORKFLOW_SEED_KEY,
  isDemoMode,
  buildDemoSeed,
  buildDemoWorkflowSeed,
  loadRedactedReceiptFixtures,
  loadLocalReceiptFixtures,
  loadExtraDemoReceiptFixtures,
} from "./demo.js";
import {
  DEMO_EXPANSION_SEED_KEY,
  buildExpandedDemoSeed,
} from "./demo-expansion.js";

const databases = new Map();
let activeWorkspaceUid = "";

export function userDbName(uid) {
  return `tuntas-user-${uid}-v1`;
}

export function setActiveWorkspaceUid(uid) {
  activeWorkspaceUid = typeof uid === "string" ? uid.trim() : "";
}

export function getActiveWorkspaceUid() {
  return activeWorkspaceUid;
}

function resolveDbName(demo = isDemoMode(), uid = activeWorkspaceUid) {
  if (demo) return DEMO_DB_NAME;
  if (uid) return userDbName(uid);
  return PERSONAL_DB_NAME;
}

function openWorkspaceDB(name) {
  if (!databases.has(name)) {
    const isDemoDb = name === DEMO_DB_NAME;
    databases.set(
      name,
      openDB(name, 3, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            const docs = db.createObjectStore("documents", { keyPath: "id" });
            docs.createIndex("digest", "digest", { unique: true });
            db.createObjectStore("originals");
            db.createObjectStore("actions", { keyPath: "id" });
            if (isDemoDb) {
              db.createObjectStore("meta", { keyPath: "key" });
            }
          }
          if (oldVersion < 2) {
            if (!db.objectStoreNames.contains("actionGroups")) {
              db.createObjectStore("actionGroups", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("actionDependencies")) {
              const deps = db.createObjectStore("actionDependencies", {
                keyPath: "id",
              });
              deps.createIndex("byPrerequisite", "prerequisiteActionId", {
                unique: false,
              });
              deps.createIndex("byDependent", "dependentActionId", {
                unique: false,
              });
            }
          }
          if (oldVersion < 3) {
            if (!db.objectStoreNames.contains("tombstones")) {
              const tombstones = db.createObjectStore("tombstones", {
                keyPath: "key",
              });
              tombstones.createIndex("byCollection", "collection", {
                unique: false,
              });
            }
            if (!db.objectStoreNames.contains("syncMeta")) {
              db.createObjectStore("syncMeta", { keyPath: "key" });
            }
          }
        },
      }),
    );
  }
  return databases.get(name);
}

function getDB(demo = isDemoMode(), uid = activeWorkspaceUid) {
  return openWorkspaceDB(resolveDbName(demo, uid));
}

let seedPromise = null;

async function seedDemoBatch(database, key, build, onlyWhenEmpty = false) {
  if (await database.get("meta", key)) return false;
  const seed = await build();
  if (!seed.docs.length) return false;
  const stores = ["meta", "documents", "originals", "actions"];
  if (seed.groups) stores.push("actionGroups", "actionDependencies");
  const tx = database.transaction(stores, "readwrite");
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
    if (
      seed.groups &&
      seed.actions.every((action) => inserted.has(action.documentId))
    ) {
      const groups = tx.objectStore("actionGroups");
      const dependencies = tx.objectStore("actionDependencies");
      for (const group of seed.groups) await groups.add(group);
      for (const action of seed.actions) await actions.add(action);
      for (const dependency of seed.dependencies)
        await dependencies.add(dependency);
    } else if (!seed.groups) {
      for (const action of seed.actions) {
        if (inserted.has(action.documentId)) await actions.add(action);
      }
    }
  }
  await meta.put({ key, seededAt: Date.now(), version: 1 });
  await tx.done;
  return inserted.size > 0;
}

async function seedDemoWorkflow(database) {
  if (await database.get("meta", DEMO_WORKFLOW_SEED_KEY)) return false;
  const workflow = buildDemoWorkflowSeed();
  const tx = database.transaction(
    ["meta", "documents", "actions", "actionGroups", "actionDependencies"],
    "readwrite",
  );
  const meta = tx.objectStore("meta");
  if (await meta.get(DEMO_WORKFLOW_SEED_KEY)) {
    await tx.done;
    return false;
  }

  const documents = tx.objectStore("documents");
  const hasRequiredDocs =
    (await documents.getKey("demo-doc-renewal")) &&
    (await documents.getKey("demo-doc-utility"));

  let changed = false;
  if (hasRequiredDocs) {
    const groups = tx.objectStore("actionGroups");
    for (const group of workflow.groups) {
      if (!(await groups.getKey(group.id))) {
        await groups.add(group);
        changed = true;
      }
    }

    const actions = tx.objectStore("actions");
    for (const action of workflow.actions) {
      const existing = await actions.get(action.id);
      if (!existing) {
        await actions.add(action);
        changed = true;
      } else if (!existing.groupId && action.groupId) {
        await actions.put({ ...existing, groupId: action.groupId });
        changed = true;
      }
    }

    const deps = tx.objectStore("actionDependencies");
    for (const dep of workflow.dependencies) {
      if (!(await deps.getKey(dep.id))) {
        await deps.add(dep);
        changed = true;
      }
    }
  }

  await meta.put({
    key: DEMO_WORKFLOW_SEED_KEY,
    seededAt: Date.now(),
    version: 2,
  });
  await tx.done;
  return changed;
}

export function ensureDemoSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const database = await getDB(true, "");
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
        async () => buildDemoSeed(await loadLocalReceiptFixtures([1, 2, 3, 4])),
      );
      const morePhotosSeeded = await seedDemoBatch(
        database,
        LOCAL_RECEIPT_EXPANSION_SEED_KEY,
        async () => buildDemoSeed(await loadLocalReceiptFixtures([5, 6, 7, 8])),
      );
      const workflowSeeded = await seedDemoWorkflow(database);
      const expandedSeeded = await seedDemoBatch(
        database,
        DEMO_EXPANSION_SEED_KEY,
        buildExpandedDemoSeed,
      );
      const extraReceiptsSeeded = await seedDemoBatch(
        database,
        DEMO_EXTRA_RECEIPTS_SEED_KEY,
        async () => buildDemoSeed(await loadExtraDemoReceiptFixtures()),
      );
      return {
        seeded:
          seeded ||
          redactedSeeded ||
          photosSeeded ||
          morePhotosSeeded ||
          workflowSeeded ||
          expandedSeeded ||
          extraReceiptsSeeded,
      };
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

export async function getDemoMeta(key) {
  if (!key) return null;
  const database = await getDB(true, "");
  const entry = await database.get("meta", key);
  return entry ? entry.value ?? entry : null;
}

export async function setDemoMeta(key, value) {
  if (!key) return;
  const database = await getDB(true, "");
  await database.put("meta", {
    key,
    value,
    updatedAt: Date.now(),
  });
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
  const now = Date.now();
  const doc = {
    id: crypto.randomUUID(),
    digest,
    created: now,
    updatedAt: now,
    _dirty: true,
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
  if (!prev) {
    await tx.done;
    throw Error("Document not found.");
  }
  const doc = {
    ...prev,
    ...fields,
    updatedAt: Date.now(),
    _dirty: true,
  };
  await tx.store.put(doc);
  await tx.done;
  return doc;
}

export async function deleteDocument(id) {
  const database = await getDB();
  const tx = database.transaction(
    ["documents", "originals", "actions", "actionDependencies", "tombstones"],
    "readwrite",
  );
  const docsStore = tx.objectStore("documents");
  const originalsStore = tx.objectStore("originals");
  const actionsStore = tx.objectStore("actions");
  const depsStore = tx.objectStore("actionDependencies");
  const tombstonesStore = tx.objectStore("tombstones");

  const existingDoc = await docsStore.get(id);
  if (!existingDoc) {
    await tx.done;
    throw Error("Document not found.");
  }

  const now = Date.now();
  await docsStore.delete(id);
  await originalsStore.delete(id);
  await tombstonesStore.put({
    key: tombstoneKey("documents", id),
    collection: "documents",
    id,
    deletedAt: now,
    fallback: {
      title: existingDoc.title,
      category: existingDoc.category,
      created: existingDoc.created,
    },
    synced: false,
  });

  const allActions = await actionsStore.getAll();
  const removedActionIds = [];
  for (const action of allActions) {
    if (action.documentId === id) {
      removedActionIds.push(action.id);
      await actionsStore.delete(action.id);
      await tombstonesStore.put({
        key: tombstoneKey("actions", action.id),
        collection: "actions",
        id: action.id,
        deletedAt: now,
        fallback: {
          documentId: action.documentId,
          title: action.title,
          done: action.done,
          groupId: action.groupId || "",
          created: action.created,
        },
        synced: false,
      });
    }
  }

  if (removedActionIds.length) {
    const prereqIndex = depsStore.index("byPrerequisite");
    const depIndex = depsStore.index("byDependent");
    const depKeys = new Set();
    for (const actionId of removedActionIds) {
      const [pKeys, dKeys] = await Promise.all([
        prereqIndex.getAllKeys(actionId),
        depIndex.getAllKeys(actionId),
      ]);
      for (const key of pKeys) depKeys.add(key);
      for (const key of dKeys) depKeys.add(key);
    }
    for (const key of depKeys) {
      const existingDep = await depsStore.get(key);
      await depsStore.delete(key);
      await tombstonesStore.put({
        key: tombstoneKey("actionDependencies", key),
        collection: "actionDependencies",
        id: key,
        deletedAt: now,
        fallback: existingDep || {},
        synced: false,
      });
    }
  }

  await tx.done;
  return { deletedId: id, removedActionCount: removedActionIds.length };
}

export const original = async (id) => {
  const stored = await (await getDB()).get("originals", id);
  return stored instanceof Blob || !stored
    ? stored
    : new Blob([stored.bytes], { type: stored.type });
};

export async function snapshot() {
  const database = await getDB();
  const [docs, actions, groups, dependencies] = await Promise.all([
    database.getAll("documents"),
    database.getAll("actions"),
    database.getAll("actionGroups"),
    database.getAll("actionDependencies"),
  ]);
  return {
    docs: docs.sort((a, b) => b.created - a.created),
    actions: actions.sort((a, b) => b.created - a.created),
    groups: groups.sort((a, b) => (a.created || 0) - (b.created || 0)),
    dependencies: dependencies.sort(
      (a, b) => (a.created || 0) - (b.created || 0),
    ),
  };
}

export async function addAction(
  documentId,
  title,
  due,
  { suggestionKey = "", quote = "", groupId = "" } = {},
) {
  if (!title.trim() || title.length > 140)
    throw Error("Give your action a short title.");
  const normalizedDue = typeof due === "string" ? due.trim() : "";
  if (normalizedDue && !isValidIsoDate(normalizedDue))
    throw Error("Choose a valid calendar date.");
  const normalizedGroupId = typeof groupId === "string" ? groupId.trim() : "";
  const database = await getDB(),
    tx = database.transaction(
      ["documents", "actions", "actionGroups"],
      "readwrite",
    );
  if (!(await tx.objectStore("documents").get(documentId)))
    throw Error("The source is missing.");
  if (
    normalizedGroupId &&
    !(await tx.objectStore("actionGroups").get(normalizedGroupId))
  ) {
    throw Error("Group not found.");
  }
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
  const now = Date.now();
  const action = {
    id: crypto.randomUUID(),
    documentId,
    title: title.trim(),
    due: normalizedDue,
    done: false,
    created: now,
    updatedAt: now,
    _dirty: true,
    ...(normalizedGroupId ? { groupId: normalizedGroupId } : {}),
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
  if (a) {
    await tx.store.put({
      ...a,
      done: !a.done,
      updatedAt: Date.now(),
      _dirty: true,
    });
  }
  await tx.done;
}

export async function updateAction(id, fields) {
  const database = await getDB();
  const tx = database.transaction(
    ["actions", "actionGroups", "actionDependencies", "tombstones"],
    "readwrite",
  );
  const actionsStore = tx.objectStore("actions");
  const groupsStore = tx.objectStore("actionGroups");
  const depsStore = tx.objectStore("actionDependencies");
  const tombstonesStore = tx.objectStore("tombstones");

  const prev = await actionsStore.get(id);
  if (!prev) {
    await tx.done;
    throw Error("Action not found.");
  }

  const now = Date.now();
  const next = { ...prev, updatedAt: now, _dirty: true };
  if (Object.prototype.hasOwnProperty.call(fields, "title")) {
    const title = String(fields.title ?? "").trim();
    if (!title || title.length > 140)
      throw Error("Give your action a short title.");
    next.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(fields, "due")) {
    const due = String(fields.due ?? "").trim();
    if (due && !isValidIsoDate(due))
      throw Error("Choose a valid calendar date.");
    next.due = due;
  }
  if (Object.prototype.hasOwnProperty.call(fields, "done")) {
    next.done = Boolean(fields.done);
  }
  let groupChanged = false;
  if (Object.prototype.hasOwnProperty.call(fields, "groupId")) {
    const nextGroupId = String(fields.groupId ?? "").trim();
    if (nextGroupId && !(await groupsStore.get(nextGroupId))) {
      throw Error("Group not found.");
    }
    const prevGroupId = prev.groupId || "";
    groupChanged = prevGroupId !== nextGroupId;
    if (nextGroupId) next.groupId = nextGroupId;
    else delete next.groupId;
  }

  await actionsStore.put(next);
  if (groupChanged) {
    const [prereqKeys, depKeys] = await Promise.all([
      depsStore.index("byPrerequisite").getAllKeys(id),
      depsStore.index("byDependent").getAllKeys(id),
    ]);
    for (const key of new Set([...prereqKeys, ...depKeys])) {
      const existingDep = await depsStore.get(key);
      await depsStore.delete(key);
      await tombstonesStore.put({
        key: tombstoneKey("actionDependencies", key),
        collection: "actionDependencies",
        id: key,
        deletedAt: now,
        fallback: existingDep || {},
        synced: false,
      });
    }
  }
  await tx.done;
  return next;
}

export async function createGroup(title) {
  const clean = String(title ?? "").trim();
  if (!clean || clean.length > 80)
    throw Error("Give your group a short name.");
  const now = Date.now();
  const group = {
    id: crypto.randomUUID(),
    title: clean,
    created: now,
    updated: now,
    updatedAt: now,
    _dirty: true,
  };
  const database = await getDB();
  await database.add("actionGroups", group);
  return group;
}

export async function renameGroup(id, title) {
  const clean = String(title ?? "").trim();
  if (!clean || clean.length > 80)
    throw Error("Give your group a short name.");
  const database = await getDB();
  const tx = database.transaction("actionGroups", "readwrite");
  const prev = await tx.store.get(id);
  if (!prev) {
    await tx.done;
    throw Error("Group not found.");
  }
  const now = Date.now();
  const updated = {
    ...prev,
    title: clean,
    updated: now,
    updatedAt: now,
    _dirty: true,
  };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteGroup(id) {
  const database = await getDB();
  const tx = database.transaction(
    ["actions", "actionGroups", "actionDependencies", "tombstones"],
    "readwrite",
  );
  const groupsStore = tx.objectStore("actionGroups");
  const actionsStore = tx.objectStore("actions");
  const depsStore = tx.objectStore("actionDependencies");
  const tombstonesStore = tx.objectStore("tombstones");

  const existingGroup = await groupsStore.get(id);
  if (!existingGroup) {
    await tx.done;
    return;
  }
  const now = Date.now();
  await groupsStore.delete(id);
  await tombstonesStore.put({
    key: tombstoneKey("actionGroups", id),
    collection: "actionGroups",
    id,
    deletedAt: now,
    fallback: { title: existingGroup.title, created: existingGroup.created },
    synced: false,
  });

  const memberIds = new Set();
  const allActions = await actionsStore.getAll();
  for (const action of allActions) {
    if (action.groupId === id) {
      memberIds.add(action.id);
      const next = { ...action, updatedAt: now, _dirty: true };
      delete next.groupId;
      await actionsStore.put(next);
    }
  }

  if (memberIds.size) {
    const allDeps = await depsStore.getAll();
    for (const dep of allDeps) {
      if (
        memberIds.has(dep.prerequisiteActionId) ||
        memberIds.has(dep.dependentActionId)
      ) {
        await depsStore.delete(dep.id);
        await tombstonesStore.put({
          key: tombstoneKey("actionDependencies", dep.id),
          collection: "actionDependencies",
          id: dep.id,
          deletedAt: now,
          fallback: dep,
          synced: false,
        });
      }
    }
  }
  await tx.done;
}

export async function addDependency(prerequisiteActionId, dependentActionId) {
  const database = await getDB();
  const tx = database.transaction(
    ["actions", "actionDependencies", "tombstones"],
    "readwrite",
  );
  const [actions, dependencies] = await Promise.all([
    tx.objectStore("actions").getAll(),
    tx.objectStore("actionDependencies").getAll(),
  ]);
  const check = validateDependency(
    actions,
    dependencies,
    prerequisiteActionId,
    dependentActionId,
  );
  if (!check.ok) {
    await tx.done;
    throw Error(check.message);
  }
  const now = Date.now();
  const record = {
    id: check.id,
    prerequisiteActionId,
    dependentActionId,
    created: now,
    updatedAt: now,
    _dirty: true,
  };
  await tx.objectStore("actionDependencies").add(record);
  await tx
    .objectStore("tombstones")
    .delete(tombstoneKey("actionDependencies", check.id));
  await tx.done;
  return record;
}

export async function removeDependency(id) {
  const database = await getDB();
  const tx = database.transaction(
    ["actionDependencies", "tombstones"],
    "readwrite",
  );
  const depsStore = tx.objectStore("actionDependencies");
  const existing = await depsStore.get(id);
  await depsStore.delete(id);
  await tx.objectStore("tombstones").put({
    key: tombstoneKey("actionDependencies", id),
    collection: "actionDependencies",
    id,
    deletedAt: Date.now(),
    fallback: existing || {},
    synced: false,
  });
  await tx.done;
}

export async function getSyncMeta(uid = activeWorkspaceUid) {
  const database = await getDB(false, uid);
  const [state, docs, actions, groups, deps, tombstones] = await Promise.all([
    database.get("syncMeta", "state"),
    database.getAll("documents"),
    database.getAll("actions"),
    database.getAll("actionGroups"),
    database.getAll("actionDependencies"),
    database.getAll("tombstones"),
  ]);
  const pendingCount =
    docs.filter((r) => r._dirty).length +
    actions.filter((r) => r._dirty).length +
    groups.filter((r) => r._dirty).length +
    deps.filter((r) => r._dirty).length +
    tombstones.filter((t) => !t.synced).length;
  return {
    enabled: Boolean(state?.enabled),
    status: state?.status || "off",
    lastSyncedAt: state?.lastSyncedAt || null,
    lastError: state?.lastError || "",
    localImportedAt: state?.localImportedAt || null,
    pendingCount,
  };
}

export async function setSyncMeta(patch, uid = activeWorkspaceUid) {
  const database = await getDB(false, uid);
  const tx = database.transaction("syncMeta", "readwrite");
  const prev = (await tx.store.get("state")) || { key: "state" };
  const next = { ...prev, ...patch, key: "state" };
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function getSyncSnapshot(uid = activeWorkspaceUid) {
  const database = await getDB(false, uid);
  const [documents, actions, actionGroups, actionDependencies, tombstones] =
    await Promise.all([
      database.getAll("documents"),
      database.getAll("actions"),
      database.getAll("actionGroups"),
      database.getAll("actionDependencies"),
      database.getAll("tombstones"),
    ]);
  return {
    documents,
    actions,
    actionGroups,
    actionDependencies,
    tombstones,
  };
}

export async function applyRemoteSyncBatch(
  { upserts = {}, deletes = {}, syncedIds = {}, syncedTombstones = [] },
  uid = activeWorkspaceUid,
) {
  const database = await getDB(false, uid);
  const tx = database.transaction(
    [
      "documents",
      "originals",
      "actions",
      "actionGroups",
      "actionDependencies",
      "tombstones",
    ],
    "readwrite",
  );
  const stores = {
    documents: tx.objectStore("documents"),
    originals: tx.objectStore("originals"),
    actions: tx.objectStore("actions"),
    actionGroups: tx.objectStore("actionGroups"),
    actionDependencies: tx.objectStore("actionDependencies"),
    tombstones: tx.objectStore("tombstones"),
  };

  for (const col of [
    "documents",
    "actionGroups",
    "actions",
    "actionDependencies",
  ]) {
    for (const record of upserts[col] || []) {
      const current = await stores[col].get(record.id);
      if (
        !current ||
        !current._dirty ||
        Number(record.updatedAt || 0) >= Number(current.updatedAt || 0)
      ) {
        await stores[col].put(record);
      }
    }
  }

  const deletedDocIds = new Set(deletes.documents || []);
  for (const docId of deletedDocIds) {
    await stores.documents.delete(docId);
    await stores.originals.delete(docId);
  }

  const deletedGroupIds = new Set(deletes.actionGroups || []);
  for (const groupId of deletedGroupIds) {
    await stores.actionGroups.delete(groupId);
  }

  const deletedActionIds = new Set(deletes.actions || []);
  if (deletedDocIds.size || deletedGroupIds.size) {
    for (const action of await stores.actions.getAll()) {
      if (deletedDocIds.has(action.documentId)) {
        deletedActionIds.add(action.id);
      } else if (action.groupId && deletedGroupIds.has(action.groupId)) {
        const next = { ...action };
        delete next.groupId;
        await stores.actions.put(next);
      }
    }
  }

  for (const actionId of deletedActionIds) {
    await stores.actions.delete(actionId);
  }

  for (const depId of deletes.actionDependencies || []) {
    await stores.actionDependencies.delete(depId);
  }

  if (deletedActionIds.size) {
    for (const dep of await stores.actionDependencies.getAll()) {
      if (
        deletedActionIds.has(dep.prerequisiteActionId) ||
        deletedActionIds.has(dep.dependentActionId)
      ) {
        await stores.actionDependencies.delete(dep.id);
      }
    }
  }

  for (const col of [
    "documents",
    "actionGroups",
    "actions",
    "actionDependencies",
  ]) {
    for (const entry of syncedIds[col] || []) {
      const current = await stores[col].get(entry.id);
      if (
        current &&
        Number(current.updatedAt || current.created || 0) <=
          Number(entry.updatedAt || 0)
      ) {
        await stores[col].put({
          ...current,
          _dirty: false,
          _synced: true,
        });
      }
    }
  }

  for (const key of syncedTombstones) {
    const tomb = await stores.tombstones.get(key);
    if (tomb && !tomb.synced) {
      await stores.tombstones.put({ ...tomb, synced: true });
    }
  }

  await tx.done;
}

export async function getLocalWorkspaceSummary(uid = activeWorkspaceUid) {
  const localDb = await openWorkspaceDB(PERSONAL_DB_NAME);
  const [localDocs, localActions, localGroups] = await Promise.all([
    localDb.getAll("documents"),
    localDb.getAll("actions"),
    localDb.getAll("actionGroups"),
  ]);

  if (!uid) {
    return {
      totalDocs: localDocs.length,
      totalActions: localActions.length,
      totalGroups: localGroups.length,
      unimportedDocs: 0,
      unimportedActions: 0,
      unimportedGroups: 0,
    };
  }

  const userDb = await openWorkspaceDB(userDbName(uid));
  const [userDocs, userActions, userGroups, tombstones] = await Promise.all([
    userDb.getAll("documents"),
    userDb.getAll("actions"),
    userDb.getAll("actionGroups"),
    userDb.getAll("tombstones"),
  ]);
  const docIds = new Set(userDocs.map((d) => d.id));
  const docDigests = new Set(userDocs.map((d) => d.digest));
  const actionIds = new Set(userActions.map((a) => a.id));
  const groupIds = new Set(userGroups.map((g) => g.id));
  const tombKeys = new Set(tombstones.map((t) => t.key));

  const unimportedDocs = localDocs.filter(
    (d) =>
      !docIds.has(d.id) &&
      !docDigests.has(d.digest) &&
      !tombKeys.has(tombstoneKey("documents", d.id)),
  ).length;
  const unimportedActions = localActions.filter(
    (a) =>
      !actionIds.has(a.id) && !tombKeys.has(tombstoneKey("actions", a.id)),
  ).length;
  const unimportedGroups = localGroups.filter(
    (g) =>
      !groupIds.has(g.id) &&
      !tombKeys.has(tombstoneKey("actionGroups", g.id)),
  ).length;

  return {
    totalDocs: localDocs.length,
    totalActions: localActions.length,
    totalGroups: localGroups.length,
    unimportedDocs,
    unimportedActions,
    unimportedGroups,
  };
}

export async function importLocalWorkspaceIntoCurrent(uid = activeWorkspaceUid) {
  if (!uid) throw Error("Sign in before importing local records.");
  const localDb = await openWorkspaceDB(PERSONAL_DB_NAME);
  const [
    localDocs,
    localActions,
    localGroups,
    localDeps,
    rawOriginals,
  ] = await Promise.all([
    localDb.getAll("documents"),
    localDb.getAll("actions"),
    localDb.getAll("actionGroups"),
    localDb.getAll("actionDependencies"),
    (async () => {
      const tx = localDb.transaction("originals", "readonly");
      const keys = await tx.store.getAllKeys();
      const entries = await Promise.all(
        keys.map(async (k) => [k, await tx.store.get(k)]),
      );
      await tx.done;
      return entries;
    })(),
  ]);

  const localOriginals = new Map(
    await Promise.all(
      rawOriginals.map(async ([k, orig]) => [
        k,
        orig instanceof Blob
          ? { bytes: await orig.arrayBuffer(), type: orig.type }
          : orig,
      ]),
    ),
  );

  const userDb = await openWorkspaceDB(userDbName(uid));
  const tx = userDb.transaction(
    [
      "documents",
      "originals",
      "actions",
      "actionGroups",
      "actionDependencies",
      "tombstones",
      "syncMeta",
    ],
    "readwrite",
  );
  const docsStore = tx.objectStore("documents");
  const origStore = tx.objectStore("originals");
  const actionsStore = tx.objectStore("actions");
  const groupsStore = tx.objectStore("actionGroups");
  const depsStore = tx.objectStore("actionDependencies");
  const tombStore = tx.objectStore("tombstones");
  const metaStore = tx.objectStore("syncMeta");

  const now = Date.now();
  const importedDocIdMap = new Map();
  let importedDocs = 0;
  let importedActions = 0;
  let importedGroups = 0;

  for (const g of localGroups) {
    if (
      !(await groupsStore.getKey(g.id)) &&
      !(await tombStore.getKey(tombstoneKey("actionGroups", g.id)))
    ) {
      await groupsStore.add({
        ...g,
        updatedAt: g.updatedAt || g.updated || g.created || now,
        _dirty: true,
      });
      importedGroups += 1;
    }
  }

  for (const d of localDocs) {
    if (await tombStore.getKey(tombstoneKey("documents", d.id))) continue;
    const existingById = await docsStore.get(d.id);
    const existingByDigest = await docsStore.index("digest").get(d.digest);
    if (existingById) {
      importedDocIdMap.set(d.id, existingById.id);
      continue;
    }
    if (existingByDigest) {
      importedDocIdMap.set(d.id, existingByDigest.id);
      // Upgrade a remote-only metadata copy with the local original if available.
      if (existingByDigest.remoteOnly && !(await origStore.getKey(existingByDigest.id))) {
        const orig = localOriginals.get(d.id);
        if (orig) {
          await origStore.put(orig, existingByDigest.id);
          await docsStore.put({
            ...existingByDigest,
            name: d.name,
            mime: d.mime,
            size: d.size,
            text: d.text,
            facts: d.facts,
            proposal: d.proposal,
            followUp: d.followUp,
            remoteOnly: false,
          });
        }
      }
      continue;
    }

    await docsStore.add({
      ...d,
      updatedAt: d.updatedAt || d.created || now,
      _dirty: true,
    });
    const orig = localOriginals.get(d.id);
    if (orig) {
      await origStore.put(orig, d.id);
    }
    importedDocIdMap.set(d.id, d.id);
    importedDocs += 1;
  }

  for (const a of localActions) {
    if (await tombStore.getKey(tombstoneKey("actions", a.id))) continue;
    if (await actionsStore.getKey(a.id)) continue;
    const targetDocId = importedDocIdMap.get(a.documentId);
    if (!targetDocId || !(await docsStore.getKey(targetDocId))) continue;
    const targetGroupId =
      a.groupId && (await groupsStore.getKey(a.groupId)) ? a.groupId : "";
    const imported = {
      ...a,
      documentId: targetDocId,
      updatedAt: a.updatedAt || a.created || now,
      _dirty: true,
    };
    if (targetGroupId) imported.groupId = targetGroupId;
    else delete imported.groupId;
    await actionsStore.add(imported);
    importedActions += 1;
  }

  for (const dep of localDeps) {
    if (await tombStore.getKey(tombstoneKey("actionDependencies", dep.id)))
      continue;
    if (await depsStore.getKey(dep.id)) continue;
    if (
      (await actionsStore.getKey(dep.prerequisiteActionId)) &&
      (await actionsStore.getKey(dep.dependentActionId))
    ) {
      await depsStore.add({
        ...dep,
        updatedAt: dep.updatedAt || dep.created || now,
        _dirty: true,
      });
    }
  }

  const prevMeta = (await metaStore.get("state")) || { key: "state" };
  await metaStore.put({ ...prevMeta, key: "state", localImportedAt: now });
  await tx.done;

  return { importedDocs, importedActions, importedGroups };
}

export async function applyWorkflowTemplate(documentId, template) {
  if (!template || !template.id || !Array.isArray(template.steps) || !template.steps.length) {
    throw Error("Invalid workflow template.");
  }
  const cleanGroupTitle = String(template.groupTitle ?? "").trim().slice(0, 80);
  if (!cleanGroupTitle) throw Error("Give your group a short name.");

  const database = await getDB();
  const tx = database.transaction(
    ["documents", "actionGroups", "actions", "actionDependencies"],
    "readwrite",
  );
  const docsStore = tx.objectStore("documents");
  const groupsStore = tx.objectStore("actionGroups");
  const actionsStore = tx.objectStore("actions");
  const depsStore = tx.objectStore("actionDependencies");

  const doc = await docsStore.get(documentId);
  if (!doc) {
    await tx.done;
    throw Error("Document not found.");
  }

  const appliedIds = Array.isArray(doc.appliedTemplateIds)
    ? doc.appliedTemplateIds
    : [];
  const appliedGroups =
    doc.appliedTemplateGroupIds && typeof doc.appliedTemplateGroupIds === "object"
      ? doc.appliedTemplateGroupIds
      : {};
  if (appliedIds.includes(template.id)) {
    await tx.done;
    return {
      created: false,
      groupId: appliedGroups[template.id] || "",
      actionCount: 0,
      dependencyCount: 0,
    };
  }

  const now = Date.now();
  const group = {
    id: crypto.randomUUID(),
    title: cleanGroupTitle,
    created: now,
    updated: now,
    updatedAt: now,
    _dirty: true,
  };
  await groupsStore.add(group);

  const quote = String(doc.followUp?.quote || doc.proposal?.evidence || "").slice(
    0,
    320,
  );
  const createdActions = [];
  for (let idx = 0; idx < template.steps.length; idx += 1) {
    const step = template.steps[idx];
    const cleanTitle = String(step?.title ?? "").trim().slice(0, 140);
    if (!cleanTitle) continue;
    const due =
      typeof step?.due === "string" && isValidIsoDate(step.due)
        ? step.due.trim()
        : "";
    const stepTs = now + idx;
    const action = {
      id: crypto.randomUUID(),
      documentId,
      title: cleanTitle,
      due,
      done: false,
      created: stepTs,
      updatedAt: stepTs,
      _dirty: true,
      groupId: group.id,
      suggestionKey: `template:${template.id}:${step.key || idx}`,
      ...(quote ? { quote } : {}),
    };
    await actionsStore.add(action);
    createdActions.push(action);
  }

  let dependencyCount = 0;
  for (const pair of template.links || []) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const prereq = createdActions[pair[0]];
    const dependent = createdActions[pair[1]];
    if (!prereq || !dependent || prereq.id === dependent.id) continue;
    const depRecord = {
      id: dependencyId(prereq.id, dependent.id),
      prerequisiteActionId: prereq.id,
      dependentActionId: dependent.id,
      created: now,
      updatedAt: now,
      _dirty: true,
    };
    await depsStore.add(depRecord);
    dependencyCount += 1;
  }

  await docsStore.put({
    ...doc,
    appliedTemplateIds: [...appliedIds, template.id],
    appliedTemplateGroupIds: { ...appliedGroups, [template.id]: group.id },
    updatedAt: now,
    _dirty: true,
  });

  await tx.done;
  return {
    created: true,
    groupId: group.id,
    actionCount: createdActions.length,
    dependencyCount,
  };
}

export async function createSplitActionWorkflow(
  documentId,
  { groupTitle, currency = "USD", locale = "en-US", shares = [], splitId = "" },
) {
  const cleanTitle = String(groupTitle ?? "").trim().slice(0, 80);
  if (!cleanTitle) throw Error("Give your group a short name.");
  const nonSelf = (shares || []).filter((s) => !s.isSelf);
  if (!nonSelf.length) throw Error("Add at least one other participant.");

  const database = await getDB();
  const tx = database.transaction(
    ["documents", "actionGroups", "actions", "actionDependencies"],
    "readwrite",
  );
  const docsStore = tx.objectStore("documents");
  const groupsStore = tx.objectStore("actionGroups");
  const actionsStore = tx.objectStore("actions");
  const depsStore = tx.objectStore("actionDependencies");

  const doc = await docsStore.get(documentId);
  if (!doc) {
    await tx.done;
    throw Error("Document not found.");
  }

  const now = Date.now();
  const group = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    created: now,
    updated: now,
    updatedAt: now,
    _dirty: true,
  };
  await groupsStore.add(group);

  const collectActions = [];
  for (let idx = 0; idx < nonSelf.length; idx += 1) {
    const share = nonSelf[idx];
    const formatted = formatSplitAmount(share.amount, currency, locale);
    const title = `Collect ${formatted} from ${String(share.name || "Friend").trim()}`.slice(
      0,
      140,
    );
    const quoteParts = [
      share.email ? `Email: ${share.email}` : "",
      share.note ? share.note : "",
    ].filter(Boolean);
    const stepTs = now + idx;
    const act = {
      id: crypto.randomUUID(),
      documentId,
      title,
      due: "",
      done: false,
      created: stepTs,
      updatedAt: stepTs,
      _dirty: true,
      groupId: group.id,
      ...(splitId ? { splitId } : {}),
      ...(share.id ? { splitShareId: share.id } : {}),
      ...(quoteParts.length ? { quote: quoteParts.join(" · ").slice(0, 320) } : {}),
    };
    await actionsStore.add(act);
    collectActions.push(act);
  }

  const finalTs = now + nonSelf.length;
  const finalAction = {
    id: crypto.randomUUID(),
    documentId,
    title: "All split shares settled",
    due: "",
    done: false,
    created: finalTs,
    updatedAt: finalTs,
    _dirty: true,
    groupId: group.id,
    ...(splitId ? { splitId } : {}),
  };
  await actionsStore.add(finalAction);

  for (const act of collectActions) {
    await depsStore.add({
      id: dependencyId(act.id, finalAction.id),
      prerequisiteActionId: act.id,
      dependentActionId: finalAction.id,
      created: now,
      updatedAt: now,
      _dirty: true,
    });
  }

  if (splitId) {
    await docsStore.put({
      ...doc,
      splitId,
      updatedAt: now,
      _dirty: true,
    });
  }

  await tx.done;
  return {
    groupId: group.id,
    actionCount: collectActions.length + 1,
    finalActionId: finalAction.id,
  };
}

export async function markSplitShareActionDone(splitId, shareId) {
  if (!splitId || !shareId) return false;
  const database = await getDB();
  const tx = database.transaction("actions", "readwrite");
  const all = await tx.store.getAll();
  const target = all.find(
    (a) => a.splitId === splitId && a.splitShareId === shareId,
  );
  let updated = false;
  if (target && !target.done) {
    await tx.store.put({
      ...target,
      done: true,
      updatedAt: Date.now(),
      _dirty: true,
    });
    updated = true;
  }
  await tx.done;
  return updated;
}
