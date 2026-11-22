import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  firebaseAuthConfig,
  firebaseAuthConfigured,
  useEmulators,
  authEmulatorUrl,
  firestoreEmulatorHost,
} from "./firebase-settings.js";

let authInstance = null;
let dbInstance = null;

export function getFirebaseApp() {
  if (!firebaseAuthConfigured) {
    throw Error("Firebase is not configured in this browser.");
  }
  return getApps().length ? getApp() : initializeApp(firebaseAuthConfig);
}

export function getFirebaseAuth() {
  if (!authInstance) {
    const app = getFirebaseApp();
    authInstance = getAuth(app);
    if (useEmulators) {
      connectAuthEmulator(authInstance, authEmulatorUrl, {
        disableWarnings: true,
      });
    }
  }
  return authInstance;
}

export function getFirebaseDb() {
  if (!dbInstance) {
    const app = getFirebaseApp();
    try {
      dbInstance = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        ...(useEmulators ? { experimentalForceLongPolling: true } : {}),
      });
    } catch {
      dbInstance = getFirestore(app);
    }
    if (useEmulators) {
      const [host, portText] = firestoreEmulatorHost.split(":");
      connectFirestoreEmulator(
        dbInstance,
        host || "127.0.0.1",
        Number(portText) || 8080,
      );
    }
  }
  return dbInstance;
}
