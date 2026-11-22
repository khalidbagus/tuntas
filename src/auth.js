import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase-app.js";

const AUTH_ERROR_KEYS = {
  "auth/popup-closed-by-user": "authErrorPopupClosed",
  "auth/cancelled-popup-request": "authErrorPopupClosed",
  "auth/popup-blocked": "authErrorPopupBlocked",
  "auth/account-exists-with-different-credential":
    "authErrorDifferentCredential",
  "auth/email-already-in-use": "authErrorEmailInUse",
  "auth/invalid-credential": "authErrorInvalidCredentials",
  "auth/wrong-password": "authErrorInvalidCredentials",
  "auth/user-not-found": "authErrorInvalidCredentials",
  "auth/weak-password": "authErrorWeakPassword",
  "auth/invalid-email": "authErrorInvalidEmail",
  "auth/too-many-requests": "authErrorTooManyRequests",
  "auth/network-request-failed": "authErrorNetwork",
  "auth/unauthorized-domain": "authErrorUnauthorizedDomain",
  "auth/requires-recent-login": "authErrorRecentLogin",
};

export function mapAuthError(error) {
  const code = error?.code || "";
  return AUTH_ERROR_KEYS[code] || "authErrorGeneric";
}

export function observeAuth(onChange) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, onChange);
}

export async function signInEmail(email, password) {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  return credential.user;
}

export async function signUpEmail(email, password) {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  let verificationSent = false;
  try {
    await sendEmailVerification(credential.user);
    verificationSent = true;
  } catch {
    verificationSent = false;
  }
  return { user: credential.user, verificationSent };
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function requestPasswordReset(email) {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail() {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) throw Error("Not signed in.");
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentUser() {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser;
}

export async function signOutAccount() {
  const auth = getFirebaseAuth();
  await signOut(auth);
}
