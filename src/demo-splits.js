import { getDemoMeta, setDemoMeta } from "./db.js";
import { DEMO_ACCOUNT_EMAIL } from "./demo.js";
import { normalizeEmail, SPLIT_CURRENCIES } from "./split-domain.js";

export const DEMO_SPLITS_META_KEY = "demo-splits-v1";
export const DEMO_USER_UID = "demo-user";

export function buildInitialDemoSplits() {
  const baseTs = Date.UTC(2026, 10, 22, 13, 15);
  return {
    splits: [
      {
        id: "demo-split-incoming-kfc",
        organizerUid: "demo-friend-rina",
        organizerEmail: "rina.putri@example.com",
        title: "KFC Kota Kasablanka team lunch",
        currency: "IDR",
        totalAmount: 50000,
        splitMode: "itemized",
        itemsSummary:
          "1 Lado Ijo Don (Rp19.091) · 1 Iced Matcha Latte (Rp14.545) · 1 Spaghetti Deluxe (Rp11.818) + Tax Rp4.546",
        paymentInstructions: "QRIS or BCA 8810-2244-99 a.n. Rina Putri",
        participantEmails: [DEMO_ACCOUNT_EMAIL, "budi.santoso@example.com"],
        status: "open",
        createdAt: baseTs + 60000,
        updatedAt: baseTs + 60000,
      },
      {
        id: "demo-split-outgoing-taburai",
        organizerUid: DEMO_USER_UID,
        organizerEmail: DEMO_ACCOUNT_EMAIL,
        title: "Warung Taburai handwritten dinner bill",
        currency: "IDR",
        totalAmount: 142100,
        splitMode: "itemized",
        itemsSummary:
          "1 Pkt Ayam Bakar (Rp74.600) · 1 Pkt Premium Komplit (Rp67.500)",
        paymentInstructions: "BCA 1234-5678-90 a.n. Demo User or QRIS / GoPay",
        participantEmails: ["siti.rahma@example.com"],
        status: "open",
        createdAt: baseTs,
        updatedAt: baseTs,
      },
    ],
    sharesBySplit: {
      "demo-split-incoming-kfc": [
        {
          id: "demo-share-kfc-self",
          splitId: "demo-split-incoming-kfc",
          organizerUid: "demo-friend-rina",
          participantName: "Demo User",
          participantEmail: DEMO_ACCOUNT_EMAIL,
          participantUid: "",
          amount: 16000,
          note: "1 Iced Matcha Latte + tax share",
          status: "pending",
          paymentMethod: "",
          proofSummary: "",
          proofVerifiedByAi: false,
          updatedAt: baseTs + 60000,
        },
        {
          id: "demo-share-kfc-budi",
          splitId: "demo-split-incoming-kfc",
          organizerUid: "demo-friend-rina",
          participantName: "Budi Santoso",
          participantEmail: "budi.santoso@example.com",
          participantUid: "demo-friend-budi",
          amount: 13000,
          note: "1 Spaghetti Deluxe + tax share",
          status: "confirmed",
          paymentMethod: "qris_bank_ewallet",
          proofSummary: "QRIS transfer Rp13.000 confirmed",
          proofVerifiedByAi: true,
          updatedAt: baseTs + 90000,
        },
      ],
      "demo-split-outgoing-taburai": [
        {
          id: "demo-share-taburai-siti",
          splitId: "demo-split-outgoing-taburai",
          organizerUid: DEMO_USER_UID,
          participantName: "Siti Rahma",
          participantEmail: "siti.rahma@example.com",
          participantUid: "demo-friend-siti",
          amount: 67500,
          note: "1 Pkt Premium Komplit",
          status: "paid_pending_confirm",
          paymentMethod: "qris_bank_ewallet",
          proofSummary: "Amount matched (IDR 67,500) · Ref QRIS-221126-8821",
          proofVerifiedByAi: true,
          updatedAt: baseTs + 30000,
        },
      ],
    },
  };
}

async function readDemoSplitsState() {
  const existing = await getDemoMeta(DEMO_SPLITS_META_KEY);
  if (existing && Array.isArray(existing.splits) && existing.sharesBySplit) {
    return existing;
  }
  const initial = buildInitialDemoSplits();
  await setDemoMeta(DEMO_SPLITS_META_KEY, initial);
  return initial;
}

async function writeDemoSplitsState(state) {
  await setDemoMeta(DEMO_SPLITS_META_KEY, state);
}

export async function fetchDemoSplits() {
  const state = await readDemoSplitsState();
  const outgoing = [];
  const incoming = [];
  for (const split of state.splits) {
    const shares = state.sharesBySplit[split.id] || [];
    if (split.organizerUid === DEMO_USER_UID) {
      outgoing.push({ split, shares });
    } else {
      const myShare = shares.find(
        (s) => normalizeEmail(s.participantEmail) === DEMO_ACCOUNT_EMAIL,
      );
      if (myShare) {
        incoming.push({ split, share: myShare });
      }
    }
  }
  outgoing.sort((a, b) => (b.split.createdAt || 0) - (a.split.createdAt || 0));
  incoming.sort((a, b) => (b.split.createdAt || 0) - (a.split.createdAt || 0));
  return { outgoing, incoming };
}

export async function fetchDemoSplitById(splitId) {
  if (!splitId) return null;
  const state = await readDemoSplitsState();
  const split = state.splits.find((s) => s.id === splitId);
  if (!split) return null;
  const isOrganizer = split.organizerUid === DEMO_USER_UID;
  const allShares = state.sharesBySplit[splitId] || [];
  const shares = isOrganizer
    ? allShares
    : allShares.filter(
        (s) => normalizeEmail(s.participantEmail) === DEMO_ACCOUNT_EMAIL,
      );
  return { split, shares, isOrganizer };
}

export async function createDemoSplit({
  title,
  currency,
  totalAmount,
  splitMode,
  itemsSummary = "",
  paymentInstructions = "",
  shares = [],
}) {
  const state = await readDemoSplitsState();
  const splitId = `demo-split-${crypto.randomUUID()}`;
  const now = Date.now();
  const cleanShares = shares.filter((s) => !s.isSelf);
  const participantEmails = [
    ...new Set(
      cleanShares.map((s) => normalizeEmail(s.email)).filter(Boolean),
    ),
  ].slice(0, 12);

  const split = {
    id: splitId,
    organizerUid: DEMO_USER_UID,
    organizerEmail: DEMO_ACCOUNT_EMAIL,
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

  const createdShares = cleanShares.map((s) => ({
    id: s.id || crypto.randomUUID(),
    splitId,
    organizerUid: DEMO_USER_UID,
    participantName:
      String(s.name || "Participant").trim().slice(0, 80) || "Participant",
    participantEmail: normalizeEmail(s.email),
    participantUid: "",
    amount: Math.max(0, Number(s.amount || 0)),
    note: String(s.note || "").slice(0, 240),
    status: "pending",
    paymentMethod: "",
    proofSummary: "",
    proofVerifiedByAi: false,
    updatedAt: now,
  }));

  const nextState = {
    splits: [split, ...state.splits],
    sharesBySplit: {
      ...state.sharesBySplit,
      [splitId]: createdShares,
    },
  };
  await writeDemoSplitsState(nextState);
  return { splitId, split, shares: createdShares };
}

export async function respondToDemoSplitShare(
  splitId,
  shareId,
  {
    status,
    participantUid = DEMO_USER_UID,
    paymentMethod = "",
    proofSummary = "",
    proofVerifiedByAi = false,
  },
) {
  const state = await readDemoSplitsState();
  const now = Date.now();
  const list = state.sharesBySplit[splitId] || [];
  const nextList = list.map((s) =>
    s.id === shareId
      ? {
          ...s,
          status,
          participantUid: String(participantUid || DEMO_USER_UID).slice(0, 128),
          paymentMethod: String(paymentMethod || ""),
          proofSummary: String(proofSummary || "").slice(0, 400),
          proofVerifiedByAi: Boolean(proofVerifiedByAi),
          updatedAt: now,
        }
      : s,
  );
  await writeDemoSplitsState({
    ...state,
    sharesBySplit: {
      ...state.sharesBySplit,
      [splitId]: nextList,
    },
  });
}

export async function organizerUpdateDemoShareStatus(splitId, shareId, status) {
  const state = await readDemoSplitsState();
  const now = Date.now();
  const list = state.sharesBySplit[splitId] || [];
  const nextList = list.map((s) =>
    s.id === shareId ? { ...s, status, updatedAt: now } : s,
  );
  const allConfirmed =
    nextList.length > 0 && nextList.every((s) => s.status === "confirmed");
  const nextSplits = state.splits.map((sp) => {
    if (sp.id !== splitId) return sp;
    const nextStatus = allConfirmed
      ? "settled"
      : sp.status === "settled"
        ? "open"
        : sp.status;
    return { ...sp, status: nextStatus, updatedAt: now };
  });
  await writeDemoSplitsState({
    splits: nextSplits,
    sharesBySplit: {
      ...state.sharesBySplit,
      [splitId]: nextList,
    },
  });
}
