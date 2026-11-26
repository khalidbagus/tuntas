import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
} from "firebase/firestore";

const PROJECT_ID = "demo-tuntas-dev";
const RULES = fs.readFileSync("firestore.rules", "utf8");

let testEnv;

function validDoc(id = "doc-1", overrides = {}) {
  return {
    id,
    title: "Electricity bill",
    category: "Money & Bills",
    tags: ["utility", "bill"],
    status: "organized",
    created: 1000,
    updatedAt: 2000,
    deleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function validAction(id = "act-1", overrides = {}) {
  return {
    id,
    documentId: "doc-1",
    title: "Pay invoice",
    due: "2026-12-12",
    done: false,
    groupId: "grp-1",
    created: 1000,
    updatedAt: 2000,
    deleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function validGroup(id = "grp-1", overrides = {}) {
  return {
    id,
    title: "Utilities",
    created: 1000,
    updated: 2000,
    updatedAt: 2000,
    deleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function validDep(id = "act-1->act-2", overrides = {}) {
  return {
    id,
    prerequisiteActionId: "act-1",
    dependentActionId: "act-2",
    created: 1000,
    updatedAt: 2000,
    deleted: false,
    deletedAt: null,
    ...overrides,
  };
}

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: RULES,
    },
  });
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

test.after(async () => {
  if (testEnv) await testEnv.cleanup();
});

test("denies unauthenticated access to all user sync paths and fallback paths", async () => {
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonDb, "users", "alice", "settings", "sync")));
  await assertFails(
    setDoc(doc(anonDb, "users", "alice", "settings", "sync"), {
      enabled: true,
      updatedAt: 1000,
    }),
  );
  await assertFails(getDocs(collection(anonDb, "users", "alice", "documents")));
  await assertFails(
    setDoc(doc(anonDb, "users", "alice", "documents", "doc-1"), validDoc("doc-1")),
  );
  await assertFails(getDoc(doc(anonDb, "users", "alice")));
  await assertFails(
    setDoc(doc(anonDb, "public", "anything"), { ok: true }),
  );
});

test("denies cross-user reads and writes even when authenticated", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, "users", "alice", "settings", "sync"), {
      enabled: true,
      updatedAt: 1000,
    });
    await setDoc(
      doc(adminDb, "users", "alice", "documents", "doc-1"),
      validDoc("doc-1"),
    );
    await setDoc(
      doc(adminDb, "users", "alice", "actions", "act-1"),
      validAction("act-1"),
    );
    await setDoc(
      doc(adminDb, "users", "alice", "actionGroups", "grp-1"),
      validGroup("grp-1"),
    );
    await setDoc(
      doc(adminDb, "users", "alice", "actionDependencies", "act-1->act-2"),
      validDep("act-1->act-2"),
    );
  });

  const bobDb = testEnv.authenticatedContext("bob").firestore();
  await assertFails(getDoc(doc(bobDb, "users", "alice", "settings", "sync")));
  await assertFails(getDoc(doc(bobDb, "users", "alice", "documents", "doc-1")));
  await assertFails(getDocs(collection(bobDb, "users", "alice", "actions")));
  await assertFails(
    getDocs(collection(bobDb, "users", "alice", "actionGroups")),
  );
  await assertFails(
    getDocs(collection(bobDb, "users", "alice", "actionDependencies")),
  );
  await assertFails(
    setDoc(doc(bobDb, "users", "alice", "documents", "doc-2"), validDoc("doc-2")),
  );
  await assertFails(
    updateDoc(doc(bobDb, "users", "alice", "actions", "act-1"), {
      done: true,
      updatedAt: 3000,
    }),
  );
});

test("allows authenticated owner to read and write valid progress records", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore();

  await assertSucceeds(
    setDoc(doc(aliceDb, "users", "alice", "settings", "sync"), {
      enabled: true,
      updatedAt: 1500,
    }),
  );
  await assertSucceeds(
    setDoc(doc(aliceDb, "users", "alice", "documents", "doc-1"), validDoc("doc-1")),
  );
  await assertSucceeds(
    setDoc(
      doc(aliceDb, "users", "alice", "actionGroups", "grp-1"),
      validGroup("grp-1"),
    ),
  );
  await assertSucceeds(
    setDoc(
      doc(aliceDb, "users", "alice", "actions", "act-1"),
      validAction("act-1"),
    ),
  );
  await assertSucceeds(
    setDoc(
      doc(aliceDb, "users", "alice", "actionDependencies", "act-1->act-2"),
      validDep("act-1->act-2"),
    ),
  );

  const snap = await assertSucceeds(
    getDoc(doc(aliceDb, "users", "alice", "documents", "doc-1")),
  );
  assert.equal(snap.data().title, "Electricity bill");
});

test("rejects local-only fields, invalid enums, mismatched IDs, and hard deletes", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore();

  // Forbidden local-only content on documents
  await assertFails(
    setDoc(doc(aliceDb, "users", "alice", "documents", "doc-bad-text"), {
      ...validDoc("doc-bad-text"),
      text: "Sensitive extracted body",
    }),
  );
  await assertFails(
    setDoc(doc(aliceDb, "users", "alice", "documents", "doc-bad-bytes"), {
      ...validDoc("doc-bad-bytes"),
      bytes: "base64...",
    }),
  );
  await assertFails(
    setDoc(doc(aliceDb, "users", "alice", "documents", "doc-bad-facts"), {
      ...validDoc("doc-bad-facts"),
      facts: [{ label: "Total", value: "USD 10" }],
    }),
  );

  // Forbidden local-only quote on action
  await assertFails(
    setDoc(doc(aliceDb, "users", "alice", "actions", "act-bad-quote"), {
      ...validAction("act-bad-quote"),
      quote: "Pay by Dec 12",
    }),
  );

  // Mismatched document ID and invalid category enum
  await assertFails(
    setDoc(
      doc(aliceDb, "users", "alice", "documents", "doc-mismatch"),
      validDoc("other-id"),
    ),
  );
  await assertFails(
    setDoc(doc(aliceDb, "users", "alice", "documents", "doc-bad-cat"), {
      ...validDoc("doc-bad-cat"),
      category: "Secret",
    }),
  );

  // Self-referential dependency and unlisted setting doc ID
  await assertFails(
    setDoc(
      doc(aliceDb, "users", "alice", "actionDependencies", "act-1->act-1"),
      validDep("act-1->act-1", {
        prerequisiteActionId: "act-1",
        dependentActionId: "act-1",
      }),
    ),
  );
  await assertFails(
    setDoc(doc(aliceDb, "users", "alice", "settings", "other"), {
      enabled: true,
      updatedAt: 1000,
    }),
  );

  // Hard deletes are denied even for owner
  await assertSucceeds(
    setDoc(doc(aliceDb, "users", "alice", "documents", "doc-1"), validDoc("doc-1")),
  );
  await assertFails(deleteDoc(doc(aliceDb, "users", "alice", "documents", "doc-1")));
});

test("enforces permanent tombstones on documents/actions/groups and timestamp check on dependencies", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore();

  const docRef = doc(aliceDb, "users", "alice", "documents", "doc-1");
  await assertSucceeds(setDoc(docRef, validDoc("doc-1")));
  await assertSucceeds(
    setDoc(
      docRef,
      validDoc("doc-1", { deleted: true, deletedAt: 3000, updatedAt: 3000 }),
    ),
  );
  // Stale client cannot resurrect a deleted document
  await assertFails(
    setDoc(
      docRef,
      validDoc("doc-1", { deleted: false, deletedAt: null, updatedAt: 4000 }),
    ),
  );

  const actRef = doc(aliceDb, "users", "alice", "actions", "act-1");
  await assertSucceeds(setDoc(actRef, validAction("act-1")));
  await assertSucceeds(
    setDoc(
      actRef,
      validAction("act-1", { deleted: true, deletedAt: 3000, updatedAt: 3000 }),
    ),
  );
  await assertFails(
    setDoc(
      actRef,
      validAction("act-1", { deleted: false, deletedAt: null, updatedAt: 4000 }),
    ),
  );

  const depRef = doc(aliceDb, "users", "alice", "actionDependencies", "act-1->act-2");
  await assertSucceeds(setDoc(depRef, validDep("act-1->act-2", { updatedAt: 1000 })));
  await assertSucceeds(
    setDoc(
      depRef,
      validDep("act-1->act-2", { deleted: true, deletedAt: 3000, updatedAt: 3000 }),
    ),
  );
  // Older timestamp cannot resurrect deleted dependency
  await assertFails(
    setDoc(
      depRef,
      validDep("act-1->act-2", { deleted: false, deletedAt: null, updatedAt: 2500 }),
    ),
  );
  // Strictly newer re-link is allowed
  await assertSucceeds(
    setDoc(
      depRef,
      validDep("act-1->act-2", { deleted: false, deletedAt: null, updatedAt: 3500 }),
    ),
  );
});

function validSplit(id = "sp-1", overrides = {}) {
  return {
    id,
    organizerUid: "alice",
    organizerEmail: "alice@example.com",
    title: "Dinner receipt",
    currency: "USD",
    totalAmount: 60,
    splitMode: "equal",
    itemsSummary: "",
    paymentInstructions: "BCA 123456",
    participantEmails: ["bob@example.com"],
    status: "open",
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function validShare(id = "sh-bob", splitId = "sp-1", overrides = {}) {
  return {
    id,
    splitId,
    organizerUid: "alice",
    participantName: "Bob",
    participantEmail: "bob@example.com",
    participantUid: "",
    amount: 30,
    note: "",
    status: "pending",
    paymentMethod: "",
    proofSummary: "",
    proofVerifiedByAi: false,
    updatedAt: 1000,
    ...overrides,
  };
}

test("splits & shares rules allow organizer + invited participant, block self-confirm, third-parties, and deletes", async () => {
  const anonDb = testEnv.unauthenticatedContext().firestore();
  const aliceDb = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
  const bobDb = testEnv.authenticatedContext("bob", { email: "bob@example.com" }).firestore();
  const charlieDb = testEnv.authenticatedContext("charlie", { email: "charlie@example.com" }).firestore();

  // Organizer creates split and share
  await assertSucceeds(setDoc(doc(aliceDb, "splits", "sp-1"), validSplit("sp-1")));
  await assertSucceeds(setDoc(doc(aliceDb, "splits", "sp-1", "shares", "sh-bob"), validShare("sh-bob", "sp-1")));

  // Unauthenticated & unrelated third party denied
  await assertFails(getDoc(doc(anonDb, "splits", "sp-1")));
  await assertFails(getDoc(doc(charlieDb, "splits", "sp-1")));
  await assertFails(getDoc(doc(charlieDb, "splits", "sp-1", "shares", "sh-bob")));

  // Invited participant Bob can read split & own share, accept & submit proof
  await assertSucceeds(getDoc(doc(bobDb, "splits", "sp-1")));
  await assertSucceeds(getDoc(doc(bobDb, "splits", "sp-1", "shares", "sh-bob")));
  await assertSucceeds(
    updateDoc(doc(bobDb, "splits", "sp-1", "shares", "sh-bob"), {
      status: "accepted",
      participantUid: "bob",
      updatedAt: 2000,
    }),
  );
  await assertSucceeds(
    updateDoc(doc(bobDb, "splits", "sp-1", "shares", "sh-bob"), {
      status: "paid_pending_confirm",
      paymentMethod: "qris_bank_ewallet",
      proofSummary: "Transfer USD 30.00 Ref TRX-1",
      proofVerifiedByAi: false,
      updatedAt: 2500,
    }),
  );

  // Participant cannot self-confirm or alter amount
  await assertFails(
    updateDoc(doc(bobDb, "splits", "sp-1", "shares", "sh-bob"), {
      status: "confirmed",
      updatedAt: 3000,
    }),
  );
  await assertFails(
    updateDoc(doc(bobDb, "splits", "sp-1", "shares", "sh-bob"), {
      amount: 1,
      updatedAt: 3000,
    }),
  );

  // Organizer can confirm payment received & settle split; hard deletes denied
  await assertSucceeds(
    updateDoc(doc(aliceDb, "splits", "sp-1", "shares", "sh-bob"), {
      status: "confirmed",
      updatedAt: 3500,
    }),
  );
  await assertSucceeds(
    updateDoc(doc(aliceDb, "splits", "sp-1"), {
      status: "settled",
      updatedAt: 3500,
    }),
  );
  await assertFails(deleteDoc(doc(aliceDb, "splits", "sp-1")));
  await assertFails(deleteDoc(doc(aliceDb, "splits", "sp-1", "shares", "sh-bob")));
});
