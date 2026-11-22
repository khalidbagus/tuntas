import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase-app.js";
import {
  SYNC_COLLECTIONS,
  reconcileCollection,
} from "./sync-domain.js";
import {
  applyRemoteSyncBatch,
  getActiveWorkspaceUid,
  getSyncMeta,
  getSyncSnapshot,
  setSyncMeta,
} from "./db.js";

const inFlightByUid = new Map();
const rerunByUid = new Map();

function userSyncSettingsRef(db, uid) {
  return doc(db, "users", uid, "settings", "sync");
}

function userCollectionRef(db, uid, colName) {
  return collection(db, "users", uid, colName);
}

export async function checkRemoteSyncEnabled(uid) {
  if (!uid) return false;
  try {
    const db = getFirebaseDb();
    const snap = await getDoc(userSyncSettingsRef(db, uid));
    return snap.exists() && snap.data()?.enabled === true;
  } catch {
    return false;
  }
}

export async function enableProgressSync(uid) {
  if (!uid) throw Error("Sign in first.");
  await setSyncMeta({ enabled: true, status: "pending", lastError: "" }, uid);
  const db = getFirebaseDb();
  if (navigator.onLine) {
    await setDoc(
      userSyncSettingsRef(db, uid),
      { enabled: true, updatedAt: Date.now() },
      { merge: true },
    );
  }
  return runSyncCycle(uid);
}

export async function disableProgressSync(uid) {
  if (!uid) return;
  await setSyncMeta({ enabled: false, status: "off", lastError: "" }, uid);
  if (navigator.onLine) {
    try {
      const db = getFirebaseDb();
      await setDoc(
        userSyncSettingsRef(db, uid),
        { enabled: false, updatedAt: Date.now() },
        { merge: true },
      );
    } catch {
      // Keep local opt-out active even if offline.
    }
  }
}

async function commitRemoteWrites(db, uid, writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    for (const item of writes.slice(i, i + 400)) {
      const ref = doc(db, "users", uid, item.collection, item.id);
      batch.set(ref, item.payload);
    }
    await batch.commit();
  }
}

async function executeSyncCycle(uid) {
  if (!uid || getActiveWorkspaceUid() !== uid) return null;
  const meta = await getSyncMeta(uid);
  if (!meta.enabled) return meta;

  if (!navigator.onLine) {
    await setSyncMeta({ status: "pending", lastError: "" }, uid);
    return getSyncMeta(uid);
  }

  try {
    const db = getFirebaseDb();
    await setDoc(
      userSyncSettingsRef(db, uid),
      { enabled: true, updatedAt: Date.now() },
      { merge: true },
    );

    // 1. Pull remote state first so remote tombstones always win before any push.
    const remoteSnapshots = await Promise.all(
      SYNC_COLLECTIONS.map((col) =>
        getDocs(userCollectionRef(db, uid, col)).then((snap) => [
          col,
          snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        ]),
      ),
    );
    if (getActiveWorkspaceUid() !== uid) return null;

    const remoteByCol = new Map(remoteSnapshots);
    const localSnap = await getSyncSnapshot(uid);
    if (getActiveWorkspaceUid() !== uid) return null;

    const upserts = {};
    const deletes = {};
    const syncedIds = {};
    const syncedTombstones = [];
    const remoteWrites = [];

    for (const col of SYNC_COLLECTIONS) {
      const plan = reconcileCollection({
        collection: col,
        localRecords: localSnap[col] || [],
        remoteRecords: remoteByCol.get(col) || [],
        localTombstones: localSnap.tombstones || [],
      });

      upserts[col] = plan.localUpserts;
      deletes[col] = plan.localDeletes;

      const cleanIds = [];
      for (const payload of plan.remoteUpserts) {
        remoteWrites.push({ collection: col, id: payload.id, payload });
        cleanIds.push({ id: payload.id, updatedAt: payload.updatedAt });
      }
      for (const id of plan.syncedLocalIds) {
        const localRec = (localSnap[col] || []).find((r) => r.id === id);
        cleanIds.push({
          id,
          updatedAt: Number(localRec?.updatedAt || localRec?.created || 0),
        });
      }
      syncedIds[col] = cleanIds;

      for (const tomb of plan.remoteTombstones) {
        remoteWrites.push({
          collection: col,
          id: tomb.id,
          payload: tomb.payload,
        });
        syncedTombstones.push(tomb.key);
      }
      syncedTombstones.push(...plan.syncedTombstoneKeys);
    }

    if (remoteWrites.length) {
      await commitRemoteWrites(db, uid, remoteWrites);
    }
    if (getActiveWorkspaceUid() !== uid) return null;

    await applyRemoteSyncBatch(
      {
        upserts,
        deletes,
        syncedIds,
        syncedTombstones: [...new Set(syncedTombstones)],
      },
      uid,
    );

    const now = Date.now();
    await setSyncMeta(
      {
        enabled: true,
        status: "synced",
        lastSyncedAt: now,
        lastError: "",
      },
      uid,
    );
    return getSyncMeta(uid);
  } catch (err) {
    if (getActiveWorkspaceUid() !== uid) return null;
    const offlineNow = !navigator.onLine;
    await setSyncMeta(
      {
        status: offlineNow ? "pending" : "failed",
        lastError: offlineNow ? "" : err?.message || "Sync failed.",
      },
      uid,
    );
    return getSyncMeta(uid);
  }
}

export async function runSyncCycle(uid) {
  if (!uid || getActiveWorkspaceUid() !== uid) return null;
  if (inFlightByUid.has(uid)) {
    rerunByUid.set(uid, true);
    return inFlightByUid.get(uid);
  }
  const promise = (async () => {
    let result = await executeSyncCycle(uid);
    while (rerunByUid.get(uid)) {
      rerunByUid.set(uid, false);
      if (getActiveWorkspaceUid() !== uid) break;
      result = await executeSyncCycle(uid);
    }
    return result;
  })().finally(() => {
    inFlightByUid.delete(uid);
    rerunByUid.delete(uid);
  });
  inFlightByUid.set(uid, promise);
  return promise;
}

export function subscribeProgressSync(uid, onUpdate) {
  if (!uid) return () => {};
  const db = getFirebaseDb();
  let timer = null;
  const trigger = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (getActiveWorkspaceUid() !== uid) return;
      const meta = await runSyncCycle(uid);
      if (getActiveWorkspaceUid() === uid) {
        onUpdate(meta);
      }
    }, 120);
  };

  const unsubscribers = SYNC_COLLECTIONS.map((col) =>
    onSnapshot(
      userCollectionRef(db, uid, col),
      () => trigger(),
      async (err) => {
        if (getActiveWorkspaceUid() !== uid) return;
        await setSyncMeta(
          {
            status: navigator.onLine ? "failed" : "pending",
            lastError: navigator.onLine
              ? err?.message || "Sync listener error."
              : "",
          },
          uid,
        );
        onUpdate(await getSyncMeta(uid));
      },
    ),
  );

  return () => {
    clearTimeout(timer);
    for (const unsub of unsubscribers) unsub();
  };
}
