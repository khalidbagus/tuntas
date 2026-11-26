import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase-app.js";
import { normalizeEmail, SPLIT_CURRENCIES } from "./split-domain.js";

export async function createSharedSplit({
  organizerUid,
  organizerEmail,
  title,
  currency,
  totalAmount,
  splitMode,
  itemsSummary = "",
  paymentInstructions = "",
  shares = [],
}) {
  if (!organizerUid) throw Error("Sign in first.");
  const db = getFirebaseDb();
  const splitId = crypto.randomUUID();
  const now = Date.now();
  const cleanShares = shares.filter((s) => !s.isSelf);
  const participantEmails = [
    ...new Set(
      cleanShares.map((s) => normalizeEmail(s.email)).filter(Boolean),
    ),
  ].slice(0, 12);

  const split = {
    id: splitId,
    organizerUid,
    organizerEmail: normalizeEmail(organizerEmail) || String(organizerEmail || "").slice(0, 120),
    title: String(title || "Split bill").trim().slice(0, 120) || "Split bill",
    currency: SPLIT_CURRENCIES.includes(currency) ? currency : "USD",
    totalAmount: Math.max(0.01, Number(totalAmount || 0)),
    splitMode: splitMode === "itemized" ? "itemized" : "equal",
    itemsSummary: String(itemsSummary || "").slice(0, 1000),
    paymentInstructions: String(paymentInstructions || "").slice(0, 500),
    participantEmails,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, "splits", splitId), split);

  const createdShares = [];
  if (cleanShares.length > 0) {
    const batch = writeBatch(db);
    for (const s of cleanShares) {
      const shareId = s.id || crypto.randomUUID();
      const share = {
        id: shareId,
        splitId,
        organizerUid,
        participantName: String(s.name || "Participant").trim().slice(0, 80) || "Participant",
        participantEmail: normalizeEmail(s.email),
        participantUid: "",
        amount: Math.max(0, Number(s.amount || 0)),
        note: String(s.note || "").slice(0, 240),
        status: "pending",
        paymentMethod: "",
        proofSummary: "",
        proofVerifiedByAi: false,
        updatedAt: now,
      };
      batch.set(doc(db, "splits", splitId, "shares", shareId), share);
      createdShares.push(share);
    }
    await batch.commit();
  }
  return { splitId, split, shares: createdShares };
}

export async function fetchSplitById(splitId, uid, email) {
  if (!splitId || !uid) return null;
  const db = getFirebaseDb();
  const splitSnap = await getDoc(doc(db, "splits", splitId));
  if (!splitSnap.exists()) return null;
  const split = { id: splitSnap.id, ...splitSnap.data() };
  const isOrganizer = split.organizerUid === uid;
  const emailLower = normalizeEmail(email);

  const sharesRef = collection(db, "splits", splitId, "shares");
  const sharesQuery = isOrganizer
    ? query(sharesRef, where("organizerUid", "==", uid))
    : query(sharesRef, where("participantEmail", "==", emailLower));

  const sharesSnap = await getDocs(sharesQuery);
  const shares = sharesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { split, shares, isOrganizer };
}

export async function fetchUserSplits(uid, email) {
  if (!uid) return { outgoing: [], incoming: [] };
  const db = getFirebaseDb();
  const splitsRef = collection(db, "splits");
  const emailLower = normalizeEmail(email);

  const [outSnap, inSnap] = await Promise.all([
    getDocs(query(splitsRef, where("organizerUid", "==", uid))),
    emailLower
      ? getDocs(
          query(splitsRef, where("participantEmails", "array-contains", emailLower)),
        )
      : Promise.resolve({ docs: [] }),
  ]);

  const outgoing = await Promise.all(
    outSnap.docs.map(async (d) => {
      const split = { id: d.id, ...d.data() };
      const sharesSnap = await getDocs(
        query(
          collection(db, "splits", split.id, "shares"),
          where("organizerUid", "==", uid),
        ),
      );
      return {
        split,
        shares: sharesSnap.docs.map((s) => ({ id: s.id, ...s.data() })),
      };
    }),
  );

  const seenOut = new Set(outgoing.map((o) => o.split.id));
  const incoming = (
    await Promise.all(
      inSnap.docs
        .filter((d) => !seenOut.has(d.id))
        .map(async (d) => {
          const split = { id: d.id, ...d.data() };
          const sharesSnap = await getDocs(
            query(
              collection(db, "splits", split.id, "shares"),
              where("participantEmail", "==", emailLower),
            ),
          );
          const share = sharesSnap.docs[0]
            ? { id: sharesSnap.docs[0].id, ...sharesSnap.docs[0].data() }
            : null;
          return share ? { split, share } : null;
        }),
    )
  ).filter(Boolean);

  outgoing.sort((a, b) => (b.split.createdAt || 0) - (a.split.createdAt || 0));
  incoming.sort((a, b) => (b.split.createdAt || 0) - (a.split.createdAt || 0));
  return { outgoing, incoming };
}

export async function respondToSplitShare(
  splitId,
  shareId,
  {
    status,
    participantUid,
    paymentMethod = "",
    proofSummary = "",
    proofVerifiedByAi = false,
  },
) {
  const db = getFirebaseDb();
  const ref = doc(db, "splits", splitId, "shares", shareId);
  await updateDoc(ref, {
    status,
    participantUid: String(participantUid || "").slice(0, 128),
    paymentMethod: String(paymentMethod || ""),
    proofSummary: String(proofSummary || "").slice(0, 400),
    proofVerifiedByAi: Boolean(proofVerifiedByAi),
    updatedAt: Date.now(),
  });
}

export async function organizerUpdateShareStatus(splitId, shareId, status) {
  const db = getFirebaseDb();
  const now = Date.now();
  await updateDoc(doc(db, "splits", splitId, "shares", shareId), {
    status,
    updatedAt: now,
  });

  // Check if all shares for this split are now confirmed -> settle parent split
  const splitSnap = await getDoc(doc(db, "splits", splitId));
  if (splitSnap.exists()) {
    const split = splitSnap.data();
    const sharesSnap = await getDocs(
      query(
        collection(db, "splits", splitId, "shares"),
        where("organizerUid", "==", split.organizerUid),
      ),
    );
    const allShares = sharesSnap.docs.map((d) => d.data());
    if (allShares.length && allShares.every((s) => s.status === "confirmed")) {
      await updateDoc(doc(db, "splits", splitId), {
        status: "settled",
        updatedAt: now,
      });
    } else if (split.status === "settled") {
      await updateDoc(doc(db, "splits", splitId), {
        status: "open",
        updatedAt: now,
      });
    }
  }
}

export async function updateSplitStatus(splitId, status) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "splits", splitId), {
    status,
    updatedAt: Date.now(),
  });
}
