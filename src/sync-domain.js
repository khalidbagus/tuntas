import { categories } from "./domain.js";
import { isValidIsoDate } from "./actions-domain.js";

export const SYNC_COLLECTIONS = [
  "documents",
  "actionGroups",
  "actions",
  "actionDependencies",
];

const VALID_STATUSES = new Set([
  "pending",
  "processing",
  "needs_review",
  "organized",
  "error",
]);

export function tombstoneKey(collection, id) {
  return `${collection}:${id}`;
}

export function toRemoteDocument(doc) {
  const created = Number(doc.created || Date.now());
  const updatedAt = Number(doc.updatedAt || created);
  return {
    id: String(doc.id),
    title: String(doc.title || doc.name || "Untitled document")
      .trim()
      .slice(0, 120) || "Untitled document",
    category: categories.includes(doc.category) ? doc.category : "Other",
    tags: Array.isArray(doc.tags)
      ? doc.tags
          .map((t) => String(t).trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 10)
      : [],
    status: VALID_STATUSES.has(doc.status) ? doc.status : "needs_review",
    created,
    updatedAt,
    deleted: false,
    deletedAt: null,
  };
}

export function toRemoteAction(action) {
  const created = Number(action.created || Date.now());
  const updatedAt = Number(action.updatedAt || created);
  const due =
    typeof action.due === "string" && isValidIsoDate(action.due)
      ? action.due.trim()
      : "";
  return {
    id: String(action.id),
    documentId: String(action.documentId || "").slice(0, 120),
    title: String(action.title || "Follow-up").trim().slice(0, 140) || "Follow-up",
    due,
    done: Boolean(action.done),
    groupId: String(action.groupId || "").slice(0, 80),
    created,
    updatedAt,
    deleted: false,
    deletedAt: null,
  };
}

export function toRemoteGroup(group) {
  const created = Number(group.created || Date.now());
  const updated = Number(group.updated || created);
  const updatedAt = Number(group.updatedAt || updated);
  return {
    id: String(group.id),
    title: String(group.title || "Group").trim().slice(0, 80) || "Group",
    created,
    updated,
    updatedAt,
    deleted: false,
    deletedAt: null,
  };
}

export function toRemoteDependency(dep) {
  const created = Number(dep.created || Date.now());
  const updatedAt = Number(dep.updatedAt || created);
  return {
    id: String(dep.id),
    prerequisiteActionId: String(dep.prerequisiteActionId || "").slice(0, 120),
    dependentActionId: String(dep.dependentActionId || "").slice(0, 120),
    created,
    updatedAt,
    deleted: false,
    deletedAt: null,
  };
}

export function toRemoteRecord(collection, record) {
  if (collection === "documents") return toRemoteDocument(record);
  if (collection === "actions") return toRemoteAction(record);
  if (collection === "actionGroups") return toRemoteGroup(record);
  if (collection === "actionDependencies") return toRemoteDependency(record);
  throw Error(`Unknown sync collection: ${collection}`);
}

export function toTombstonePayload(
  collection,
  id,
  deletedAt = Date.now(),
  fallback = {},
) {
  const ts = Number(deletedAt || Date.now());
  const created = Number(fallback?.created || ts);
  if (collection === "documents") {
    return {
      id: String(id),
      title: String(fallback?.title || "Deleted document").slice(0, 120),
      category: categories.includes(fallback?.category)
        ? fallback.category
        : "Other",
      tags: [],
      status: "organized",
      created,
      updatedAt: ts,
      deleted: true,
      deletedAt: ts,
    };
  }
  if (collection === "actions") {
    return {
      id: String(id),
      documentId: String(fallback?.documentId || "").slice(0, 120),
      title: String(fallback?.title || "Deleted action").slice(0, 140),
      due: "",
      done: Boolean(fallback?.done),
      groupId: String(fallback?.groupId || "").slice(0, 80),
      created,
      updatedAt: ts,
      deleted: true,
      deletedAt: ts,
    };
  }
  if (collection === "actionGroups") {
    return {
      id: String(id),
      title: String(fallback?.title || "Deleted group").slice(0, 80),
      created,
      updated: ts,
      updatedAt: ts,
      deleted: true,
      deletedAt: ts,
    };
  }
  if (collection === "actionDependencies") {
    const parts = String(id).split("->");
    const prerequisiteActionId =
      String(fallback?.prerequisiteActionId || parts[0] || "removed-a").slice(
        0,
        120,
      );
    let dependentActionId =
      String(fallback?.dependentActionId || parts[1] || "removed-b").slice(
        0,
        120,
      );
    if (dependentActionId === prerequisiteActionId) {
      dependentActionId = `${dependentActionId}-dep`.slice(0, 120);
    }
    return {
      id: String(id),
      prerequisiteActionId,
      dependentActionId,
      created,
      updatedAt: ts,
      deleted: true,
      deletedAt: ts,
    };
  }
  throw Error(`Unknown sync collection: ${collection}`);
}

function mergeRemoteIntoLocal(collection, remote, existingLocal = null) {
  if (collection === "documents") {
    const base = toRemoteDocument(remote);
    if (existingLocal) {
      return {
        ...existingLocal,
        title: base.title,
        category: base.category,
        tags: base.tags,
        status: base.status,
        updatedAt: base.updatedAt,
        _dirty: false,
        _synced: true,
      };
    }
    return {
      id: base.id,
      digest: `remote:${base.id}`,
      created: base.created,
      updatedAt: base.updatedAt,
      status: base.status,
      title: base.title,
      name: base.title,
      mime: "application/octet-stream",
      size: 0,
      source: "Synced progress",
      sample: false,
      category: base.category,
      tags: base.tags,
      facts: [],
      text: "",
      mode: "Synced progress",
      reason: "",
      reviewed: base.status === "organized",
      autoFiled: false,
      remoteOnly: true,
      _dirty: false,
      _synced: true,
    };
  }

  if (collection === "actions") {
    const base = toRemoteAction(remote);
    const merged = existingLocal
      ? {
          ...existingLocal,
          documentId: base.documentId,
          title: base.title,
          due: base.due,
          done: base.done,
          updatedAt: base.updatedAt,
          _dirty: false,
          _synced: true,
        }
      : {
          ...base,
          _dirty: false,
          _synced: true,
        };
    if (base.groupId) merged.groupId = base.groupId;
    else delete merged.groupId;
    return merged;
  }

  if (collection === "actionGroups") {
    const base = toRemoteGroup(remote);
    return existingLocal
      ? {
          ...existingLocal,
          title: base.title,
          updated: base.updated,
          updatedAt: base.updatedAt,
          _dirty: false,
          _synced: true,
        }
      : {
          ...base,
          _dirty: false,
          _synced: true,
        };
  }

  if (collection === "actionDependencies") {
    const base = toRemoteDependency(remote);
    return {
      ...(existingLocal || {}),
      ...base,
      _dirty: false,
      _synced: true,
    };
  }

  throw Error(`Unknown sync collection: ${collection}`);
}

export function reconcileCollection({
  collection,
  localRecords = [],
  remoteRecords = [],
  localTombstones = [],
}) {
  const localById = new Map(localRecords.map((r) => [r.id, r]));
  const remoteById = new Map(remoteRecords.map((r) => [r.id, r]));
  const tombById = new Map(
    localTombstones
      .filter((t) => t.collection === collection)
      .map((t) => [t.id, t]),
  );

  const allIds = new Set([
    ...localById.keys(),
    ...remoteById.keys(),
    ...tombById.keys(),
  ]);

  const localUpserts = [];
  const localDeletes = [];
  const remoteUpserts = [];
  const remoteTombstones = [];
  const syncedLocalIds = [];
  const syncedTombstoneKeys = [];

  for (const id of allIds) {
    const local = localById.get(id);
    const remote = remoteById.get(id);
    const localTomb = tombById.get(id);

    // 1. Remote tombstone handling (delete-wins for documents, actions, groups; timestamped for re-linked deps)
    if (remote?.deleted === true) {
      const remoteDeletedAt = Number(remote.deletedAt || remote.updatedAt || 0);
      if (
        collection === "actionDependencies" &&
        local &&
        !localTomb &&
        Number(local.updatedAt || local.created || 0) > remoteDeletedAt
      ) {
        remoteUpserts.push(toRemoteRecord(collection, local));
      } else {
        if (local) localDeletes.push(id);
        if (localTomb && !localTomb.synced) {
          syncedTombstoneKeys.push(localTomb.key);
        }
      }
      continue;
    }

    // 2. Local tombstone handling
    if (localTomb) {
      const localDeletedAt = Number(localTomb.deletedAt || 0);
      if (
        collection === "actionDependencies" &&
        remote &&
        !remote.deleted &&
        Number(remote.updatedAt || remote.created || 0) > localDeletedAt
      ) {
        localUpserts.push(mergeRemoteIntoLocal(collection, remote, local));
        syncedTombstoneKeys.push(localTomb.key);
      } else {
        if (local) localDeletes.push(id);
        if (!remote || !localTomb.synced) {
          remoteTombstones.push({
            id,
            key: localTomb.key,
            payload: toTombstonePayload(
              collection,
              id,
              localDeletedAt,
              localTomb.fallback || remote,
            ),
          });
        }
      }
      continue;
    }

    // 3. Both sides live (or only one side has the record)
    if (local && !remote) {
      remoteUpserts.push(toRemoteRecord(collection, local));
      continue;
    }

    if (!local && remote) {
      localUpserts.push(mergeRemoteIntoLocal(collection, remote, null));
      continue;
    }

    if (local && remote) {
      const localTs = Number(local.updatedAt || local.created || 0);
      const remoteTs = Number(remote.updatedAt || remote.created || 0);
      if (local._dirty && localTs >= remoteTs) {
        remoteUpserts.push(toRemoteRecord(collection, local));
      } else if (remoteTs > localTs) {
        localUpserts.push(mergeRemoteIntoLocal(collection, remote, local));
      } else if (local._dirty) {
        syncedLocalIds.push(id);
      }
    }
  }

  return {
    localUpserts,
    localDeletes,
    remoteUpserts,
    remoteTombstones,
    syncedLocalIds,
    syncedTombstoneKeys,
  };
}
