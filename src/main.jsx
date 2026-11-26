import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { supportsDeviceAI } from "./device-ai.js";
import {
  House,
  Inbox,
  LibraryBig,
  ListChecks,
  Plus,
  Search,
  Monitor,
  ChevronRight,
  PanelLeft,
  ScanLine,
  AlertCircle,
  X,
  Check,
  Folder,
  WifiOff,
  Globe,
  User,
} from "lucide-react";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/plus-jakarta-sans";
import "./style.css";
import {
  Home,
  Library,
  InboxPage,
  Empty,
  navTo,
  pathFor,
} from "./ui.jsx";
import { Actions } from "./actions-view.jsx";
import { AccountPage } from "./account-view.jsx";
import { AuthEntryScreen } from "./auth-entry.jsx";
import { Capture, Detail } from "./forms.jsx";
import { SplitDetailPage } from "./split-view.jsx";
import { fetchUserSplits } from "./splits-service.js";
import {
  snapshot,
  change,
  deleteDocument,
  addAction,
  toggleAction,
  updateAction,
  createGroup,
  renameGroup,
  deleteGroup,
  addDependency,
  removeDependency,
  applyWorkflowTemplate,
  createSplitActionWorkflow,
  markSplitShareActionDone,
  ensureDemoSeeded,
  setActiveWorkspaceUid,
  getSyncMeta,
  setSyncMeta,
  getLocalWorkspaceSummary,
  importLocalWorkspaceIntoCurrent,
} from "./db.js";
import {
  msUntilNextLocalMidnight,
  toLocalIsoDate,
} from "./actions-domain.js";
import {
  DEMO_ACCOUNT_EMAIL,
  isDemoMode,
  exitDemoHref,
  LOCAL_RECEIPT_SOURCE,
} from "./demo.js";
import { firebaseAuthConfigured } from "./firebase-settings.js";
import {
  observeAuth,
  signInEmail,
  signUpEmail,
  signInWithGoogle,
  requestPasswordReset,
  resendVerificationEmail,
  reloadCurrentUser,
  signOutAccount,
  mapAuthError,
} from "./auth.js";
import {
  checkRemoteSyncEnabled,
  enableProgressSync,
  disableProgressSync,
  runSyncCycle,
  subscribeProgressSync,
} from "./sync.js";
import {
  configured,
  localClassifier,
  intake,
  processDocument,
} from "./engine.js";
import { sample } from "./domain.js";
import { LangContext } from "./lang.js";
import {
  LANGUAGES,
  loadLang,
  saveLang,
  createTranslator,
  translateRuntimeMessage,
} from "./i18n.js";
const items = [
  ["home", "navHome", House],
  ["inbox", "navInbox", Inbox],
  ["library", "navLibrary", LibraryBig],
  ["actions", "navActions", ListChecks],
];
const defaultSyncMeta = {
  enabled: false,
  status: "off",
  lastSyncedAt: null,
  lastError: "",
  localImportedAt: null,
  pendingCount: 0,
};
const defaultLocalSummary = {
  totalDocs: 0,
  totalActions: 0,
  totalGroups: 0,
  unimportedDocs: 0,
  unimportedActions: 0,
  unimportedGroups: 0,
};
const snapshotUser = (u) =>
  u
    ? {
        uid: u.uid,
        email: u.email || "",
        emailVerified: Boolean(u.emailVerified),
        displayName: u.displayName || "",
        providerData: Array.isArray(u.providerData) ? [...u.providerData] : [],
      }
    : null;
const LOCAL_GUEST_STORAGE_KEY = "tuntas-local-guest-v1";
const loadLocalGuestMode = () => {
  try {
    return globalThis.localStorage?.getItem?.(LOCAL_GUEST_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};
const saveLocalGuestMode = (enabled) => {
  try {
    if (enabled) {
      globalThis.localStorage?.setItem?.(LOCAL_GUEST_STORAGE_KEY, "1");
    } else {
      globalThis.localStorage?.removeItem?.(LOCAL_GUEST_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts.
  }
};
const readRoute = () => location.hash.slice(1) || "/home";
function App() {
  const demoMode = isDemoMode();
  const [lang, setLang] = useState(() => loadLang());
  const t = createTranslator(lang);
  const [route, setRoute] = useState(readRoute),
    [data, setData] = useState({
      docs: [],
      actions: [],
      groups: [],
      dependencies: [],
    }),
    [todayIso, setTodayIso] = useState(() => toLocalIsoDate()),
    [loaded, setLoaded] = useState(false),
    [loadFailed, setLoadFailed] = useState(false),
    [notice, setNotice] = useState(null),
    [busy, setBusy] = useState(""),
    [user, setUser] = useState(null),
    [authChecked, setAuthChecked] = useState(
      () => demoMode || !firebaseAuthConfigured,
    ),
    [localGuestMode, setLocalGuestMode] = useState(() => loadLocalGuestMode()),
    [syncMeta, setSyncMeta] = useState(defaultSyncMeta),
    [remoteSyncDetected, setRemoteSyncDetected] = useState(false),
    [localSummary, setLocalSummary] = useState(defaultLocalSummary),
    [splitsData, setSplitsData] = useState({ outgoing: [], incoming: [] }),
    running = useRef(false),
    userRef = useRef(null),
    syncUnsubRef = useRef(null);
  const hasLocalReceipts = demoMode && data.docs.some(
    (doc) => doc.source === LOCAL_RECEIPT_SOURCE,
  );
  const [kind, setKind] = useState("file"),
    [file, setFile] = useState(null),
    [text, setText] = useState(""),
    [mode, setMode] = useState(
      configured ? (supportsDeviceAI() ? "device" : "hybrid") : "rules",
    ),
    [consent, setConsent] = useState(false),
    [ai, setAI] = useState(null);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  const inputRef = useRef(null),
    searchFocus = useRef(false),
    quickFile = useRef(null),
    quickCamera = useRef(null);
  const [page, id] = route.replace(/^\//, "").split("/"),
    showAuthLoading = !demoMode && firebaseAuthConfigured && !authChecked,
    showStandaloneAuth =
      !demoMode &&
      !user &&
      ((firebaseAuthConfigured &&
        authChecked &&
        (!localGuestMode || page === "login" || page === "account")) ||
        (!firebaseAuthConfigured && page === "login")),
    activeItem = items.find(([p]) => p === page),
    active = activeItem
      ? t(activeItem[1])
      : t(
          {
            capture: "pageCapture",
            document: "pageDocument",
            account: "pageAccount",
            login: "authTabSignIn",
            split: "splitBillKicker",
          }[page] || "pageFallback",
        );
  const doc = data.docs.find((d) => d.id === id);
  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);
  useEffect(() => {
    setConsent(false);
  }, [kind, file, text, mode]);
  const refresh = async (uidOverride) => {
    const uid =
      uidOverride !== undefined
        ? uidOverride
        : demoMode
          ? ""
          : userRef.current?.uid || "";
    setData(await snapshot());
    if (!demoMode && uid) {
      const [meta, summary] = await Promise.all([
        getSyncMeta(uid),
        getLocalWorkspaceSummary(uid),
      ]);
      setSyncMeta(meta);
      setLocalSummary(summary);
    } else {
      setSyncMeta(defaultSyncMeta);
      setLocalSummary(defaultLocalSummary);
    }
    setLoaded(true);
  };
  const syncAfterWrite = async () => {
    if (demoMode) return;
    const uid = userRef.current?.uid || "";
    if (!uid) return;
    const meta = await getSyncMeta(uid);
    setSyncMeta(meta);
    if (meta.enabled) {
      const next = await runSyncCycle(uid);
      if (next && userRef.current?.uid === uid) {
        setSyncMeta(next);
        setData(await snapshot());
        setLocalSummary(await getLocalWorkspaceSummary(uid));
      }
    }
  };
  const attachSyncSubscription = (uid, isAlive) => {
    syncUnsubRef.current?.();
    syncUnsubRef.current = subscribeProgressSync(uid, async (updatedMeta) => {
      if (!isAlive() || userRef.current?.uid !== uid) return;
      if (updatedMeta) setSyncMeta(updatedMeta);
      setData(await snapshot());
      setLocalSummary(await getLocalWorkspaceSummary(uid));
    });
  };
  const say = (message, bad = false) => setNotice({ message, bad });
  const refreshSplits = async (u = userRef.current) => {
    if (demoMode || !firebaseAuthConfigured || !u?.uid || !navigator.onLine) {
      setSplitsData({ outgoing: [], incoming: [] });
      return;
    }
    try {
      const next = await fetchUserSplits(u.uid, u.email);
      if (userRef.current?.uid === u.uid) {
        setSplitsData(next);
      }
    } catch {
      // Non-fatal if splits cannot be read offline
    }
  };
  useEffect(() => {
    let alive = true;
    let authUnsub = () => {};
    const detachSync = () => {
      syncUnsubRef.current?.();
      syncUnsubRef.current = null;
    };
    const activateUid = async (nextUser) => {
      const nextUid = demoMode ? "" : nextUser?.uid || "";
      const prevUid = userRef.current?.uid || "";
      if (prevUid !== nextUid) detachSync();
      userRef.current = demoMode ? null : snapshotUser(nextUser);
      setUser(userRef.current);
      setActiveWorkspaceUid(nextUid);
      setRemoteSyncDetected(false);

      if (!alive) return;
      if (!demoMode && nextUser) {
        saveLocalGuestMode(false);
        setLocalGuestMode(false);
        const currentPage = readRoute().replace(/^\//, "").split("/")[0];
        if (currentPage === "login") navTo("/home");
      }
      if (demoMode) await ensureDemoSeeded();
      await refresh(nextUid);
      if (!alive) return;
      setAuthChecked(true);

      if (!demoMode && nextUid) {
        refreshSplits(userRef.current).catch(() => {});
        const currentMeta = await getSyncMeta(nextUid);
        if (!alive || userRef.current?.uid !== nextUid) return;
        if (currentMeta.enabled) {
          attachSyncSubscription(nextUid, () => alive);
          if (navigator.onLine) {
            const synced = await runSyncCycle(nextUid);
            if (alive && userRef.current?.uid === nextUid && synced) {
              setSyncMeta(synced);
              await refresh(nextUid);
            }
          }
        } else if (navigator.onLine) {
          const remoteEnabled = await checkRemoteSyncEnabled(nextUid);
          if (alive && userRef.current?.uid === nextUid) {
            setRemoteSyncDetected(remoteEnabled);
          }
        }
      }
    };

    if (demoMode || !firebaseAuthConfigured) {
      activateUid(null).catch(() => {
        if (!alive) return;
        setAuthChecked(true);
        setLoadFailed(true);
        say(
          "Browser storage is unavailable. Allow site storage and reload.",
          true,
        );
      });
    } else {
      authUnsub = observeAuth((nextUser) => {
        if (!alive) return;
        activateUid(nextUser).catch(() => {
          if (!alive) return;
          setAuthChecked(true);
          setLoadFailed(true);
          say(
            "Browser storage is unavailable. Allow site storage and reload.",
            true,
          );
        });
      });
    }

    const update = () => {
      setRoute(readRoute());
      setConsent(false);
      window.scrollTo(0, 0);
    };
    const net = async () => {
        const isOnline = navigator.onLine;
        setOnline(isOnline);
        const uid = demoMode ? "" : userRef.current?.uid || "";
        if (isOnline && uid) {
          try {
            const meta = await getSyncMeta(uid);
            if (meta.enabled && alive && userRef.current?.uid === uid) {
              const next = await runSyncCycle(uid);
              if (next && alive && userRef.current?.uid === uid) {
                setSyncMeta(next);
                await refresh(uid);
              }
            }
          } catch {
            // Sync failure reflected via syncMeta state.
          }
        }
      },
      key = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          goSearch();
        }
      };
    window.addEventListener("hashchange", update);
    // A hash navigation can occur between the initial render and this effect.
    // Reconcile after subscribing so that early links cannot leave a stale page.
    update();
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener("keydown", key);
    return () => {
      alive = false;
      authUnsub();
      detachSync();
      window.removeEventListener("hashchange", update);
      window.removeEventListener("keydown", key);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, []);
  useEffect(() => {
    let timerId;
    const syncDate = () => {
      const next = toLocalIsoDate();
      setTodayIso((prev) => (prev === next ? prev : next));
    };
    const scheduleMidnight = () => {
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        syncDate();
        scheduleMidnight();
      }, msUntilNextLocalMidnight());
    };
    scheduleMidnight();
    window.addEventListener("focus", syncDate);
    document.addEventListener("visibilitychange", syncDate);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener("focus", syncDate);
      document.removeEventListener("visibilitychange", syncDate);
    };
  }, []);
  useEffect(() => {
    if (configured && (page === "capture" || page === "document" || page === "split"))
      import("./firebase-ai.js")
        .then(setAI)
        .catch(() =>
          say("Firebase AI could not load. You can use local rules.", true),
        );
  }, [page]);
  useEffect(() => {
    if (page === "actions" && !demoMode && firebaseAuthConfigured && user && online) {
      refreshSplits(user);
    }
  }, [page, user?.uid, online, demoMode]);
  useEffect(() => {
    if (showAuthLoading) return;
    if (!loaded && !showStandaloneAuth) return;
    document.title =
      (showStandaloneAuth ? t("authEntryTitle") : active) +
      (demoMode
        ? ` · ${t("sampleWorkspace")} · ${t("appTitleSuffix")}`
        : ` · ${t("appTitleSuffix")}`);
  }, [loaded, showAuthLoading, showStandaloneAuth, demoMode, active, lang]);
  useEffect(() => {
    if (showAuthLoading) return;
    if (!loaded && !showStandaloneAuth) return;
    if (searchFocus.current && page === "library" && !showStandaloneAuth) {
      inputRef.current?.focus();
      searchFocus.current = false;
    } else document.querySelector("h1")?.focus({ preventScroll: true });
  }, [route, loaded, showAuthLoading, showStandaloneAuth]);
  const goSearch = () => {
    if (readRoute() === "/library") inputRef.current?.focus();
    else {
      searchFocus.current = true;
      navTo("/library");
    }
  };
  const modeProps = { mode, setMode, consent, setConsent },
    ready =
      mode === "rules" || (!!ai && (mode !== "hybrid" || (consent && online)));
  async function work({ payload, existing, sampleRun = false }) {
    if (running.current || loadFailed) return;
    const useAI = !sampleRun && mode !== "rules";
    if (useAI && !ready) {
      say("Choose an available processing method first.", true);
      return;
    }
    running.current = true;
    setBusy("Saving original");
    setNotice(null);
    let classify = localClassifier,
      initError = false;
    if (useAI) {
      try {
        classify = ai.prepareAI({
          allowCloud: mode === "hybrid" && consent,
          image: (existing?.mime || payload?.file?.type || "").startsWith(
            "image/",
          ),
        });
      } catch {
        initError = true;
      }
    }
    try {
      let current = existing;
      if (!current) {
        const staged = await intake(payload);
        current = staged.doc;
        if (staged.duplicate) {
          await refresh();
          navTo(pathFor(current));
          say("Already captured. Opened the existing original.");
          return;
        }
      }
      if (initError)
        classify = () => {
          throw Error("Firebase initialization failed.");
        };
      const result = await processDocument(current, classify, setBusy, useAI);
      await refresh();
      setFile(null);
      setText("");
      navTo(pathFor(result));
      say(
        result.status === "organized"
          ? "Filed in Library. You can undo this filing."
          : result.status === "error"
            ? "Original saved. Processing needs attention."
            : "Original saved. Check the suggested details.",
        result.status === "error",
      );
      syncAfterWrite().catch(() => {});
    } catch (e) {
      if (!existing) setFile(null);
      say(
        e?.name === "QuotaExceededError"
          ? "Storage is full. Your document could not be saved."
          : e.message || "Could not save the document.",
        true,
      );
    } finally {
      setBusy("");
      running.current = false;
      setConsent(false);
    }
  }
  function selectFile(f, k) {
    if (!f) return;
    setFile(f);
    setKind(k);
    navTo("/capture");
  }
  function onCapture(k) {
    if (k === "text") {
      setKind(k);
      navTo("/capture");
    } else (k === "camera" ? quickCamera : quickFile).current?.click();
  }
  async function mutation(fn, message) {
    try {
      await fn();
      await refresh();
      if (message) say(message);
      syncAfterWrite().catch(() => {});
      return true;
    } catch {
      say("The change could not be saved. Try again.", true);
      return false;
    }
  }
  const nav = (p, labelKey, Icon) => (
    <a
      key={p}
      aria-current={page === p ? "page" : undefined}
      className={page === p ? "nav-item selected" : "nav-item"}
      href={"#/" + p}
    >
      <Icon size={19} aria-hidden="true" />
      <span>{t(labelKey)}</span>
      {p === "inbox" && data.docs.some((d) => d.status !== "organized") && (
        <b className="nav-count">
          {data.docs.filter((d) => d.status !== "organized").length}
        </b>
      )}
    </a>
  );
  const captureLink = (
    <a
      href="#/capture"
      aria-current={page === "capture" ? "page" : undefined}
      className="capture-link"
    >
      <Plus size={18} aria-hidden="true" /> {t("navCapture")}
    </a>
  );
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      return { ok: true };
    } catch (e) {
      return { ok: false, errorKey: mapAuthError(e) };
    }
  };
  const handleEmailSignIn = async (em, pw) => {
    try {
      await signInEmail(em, pw);
      return { ok: true };
    } catch (e) {
      return { ok: false, errorKey: mapAuthError(e) };
    }
  };
  const handleEmailSignUp = async (em, pw) => {
    try {
      await signUpEmail(em, pw);
      return { ok: true };
    } catch (e) {
      return { ok: false, errorKey: mapAuthError(e) };
    }
  };
  const handlePasswordReset = async (em) => {
    try {
      await requestPasswordReset(em);
      return { ok: true };
    } catch (e) {
      return { ok: false, errorKey: mapAuthError(e) };
    }
  };
  const handleContinueLocal = () => {
    saveLocalGuestMode(true);
    setLocalGuestMode(true);
    navTo("/home");
  };
  if (showAuthLoading) {
    return (
      <LangContext.Provider value={lang}>
        <main id="main-content" tabIndex="-1" className="auth-loading">
          <p>{t("openingWorkspace")}</p>
        </main>
      </LangContext.Provider>
    );
  }
  if (showStandaloneAuth) {
    return (
      <LangContext.Provider value={lang}>
        <AuthEntryScreen
          lang={lang}
          setLang={setLang}
          authConfigured={firebaseAuthConfigured}
          returnRoute={page === "account" ? "/account" : "/login"}
          onGoogleSignIn={handleGoogleSignIn}
          onEmailSignIn={handleEmailSignIn}
          onEmailSignUp={handleEmailSignUp}
          onPasswordReset={handlePasswordReset}
          onContinueLocal={handleContinueLocal}
        />
      </LangContext.Provider>
    );
  }
  return (
    <LangContext.Provider value={lang}>
      <a
        href="#main-content"
        className="skip"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector("main")?.focus();
        }}
      >
        {t("skipToContent")}
      </a>
      <aside className="rail">
        <a className="brand" href="#/home">
          <img src="/mark.svg" alt="" />
          Tuntas<span>✦</span>
        </a>
        <div className="rail-inner">
          <div className="overline">
            {demoMode ? t("sampleWorkspace") : t("workspace")}
          </div>
          <nav aria-label={t("mainNav")}>{items.map((args) => nav(...args))}</nav>
          {captureLink}
        </div>
        {demoMode ? (
          <div className="local-profile">
            <span className="soft-icon">
              <Monitor size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>{DEMO_ACCOUNT_EMAIL}</strong>
              <small>{t("sampleDataIsolated")}</small>
            </div>
          </div>
        ) : (
          <a
            href="#/account"
            aria-current={page === "account" ? "page" : undefined}
            className={
              "local-profile account-rail-link" +
              (page === "account" ? " selected" : "")
            }
          >
            <span className="soft-icon">
              {user ? (
                <User size={19} aria-hidden="true" />
              ) : (
                <Monitor size={19} aria-hidden="true" />
              )}
            </span>
            <div>
              <strong>
                {user ? user.email || t("navAccount") : t("localWorkspace")}
              </strong>
              <small>
                {user
                  ? syncMeta.enabled
                    ? syncMeta.status === "failed"
                      ? t("syncStatusFailed")
                      : syncMeta.status === "pending" ||
                          syncMeta.pendingCount > 0
                        ? t("syncStatusPending")
                        : t("syncStatusSynced")
                    : t("accountRailSignedInSub")
                  : firebaseAuthConfigured
                    ? t("accountRailSignInHint")
                    : t("thisBrowserOnly")}
              </small>
            </div>
          </a>
        )}
      </aside>
      <div className="shell">
        <header className="top">
          <a className="mob-brand" href="#/home">
            <img src="/mark.svg" alt="" />
            Tuntas ✦
          </a>
          <div className="crumb">
            <PanelLeft size={16} aria-hidden="true" />
            <span>{demoMode ? t("sampleWorkspace") : t("workspace")}</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{active}</strong>
          </div>
          <div className="top-actions">
            <label className="lang-picker" title={t("languageLabel")}>
              <Globe size={16} aria-hidden="true" />
              <span className="sr-only">{t("languageLabel")}</span>
              <select
                aria-label={t("languageLabel")}
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                {LANGUAGES.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {!demoMode && (
              <a
                href="#/account"
                aria-current={page === "account" ? "page" : undefined}
                className={
                  "account-short" + (page === "account" ? " selected" : "")
                }
                title={user ? user.email || t("navAccount") : t("navAccount")}
              >
                <User size={16} aria-hidden="true" />
                <span>
                  {user ? user.email || t("navAccount") : t("navAccount")}
                </span>
                {user && syncMeta.enabled && (
                  <i
                    aria-hidden="true"
                    className={
                      "sync-dot" +
                      (syncMeta.status === "failed"
                        ? " failed"
                        : syncMeta.status === "pending" ||
                            syncMeta.pendingCount > 0
                          ? " pending"
                          : "")
                    }
                  />
                )}
              </a>
            )}
            <button
              type="button"
              onClick={goSearch}
              className="search-short"
              title={t("searchLibrary")}
            >
              <Search size={16} aria-hidden="true" />
              <span>{t("searchLibrary")}</span>
              <kbd aria-hidden="true">{t("searchShortcutHint")}</kbd>
            </button>
          </div>
        </header>
        {demoMode && (
          <section className="demo-bar" aria-label={t("sampleWorkspace")}>
            <div className="demo-bar-copy">
              <span className="demo-badge">{t("sampleWorkspace")}</span>
              <span className="demo-email-chip">{DEMO_ACCOUNT_EMAIL}</span>
              <span>
                {hasLocalReceipts
                  ? t("demoBannerLocalReceipts")
                  : t("demoBannerDefault")}
              </span>
            </div>
            <a className="demo-exit" href={exitDemoHref()}>
              {t("exitDemo")}
            </a>
          </section>
        )}
        <main id="main-content" tabIndex="-1">
          {!online && (
            <div className="note">
              <WifiOff size={15} aria-hidden="true" /> {t("offlineNote")}
            </div>
          )}
          <div aria-live="polite" aria-atomic="true">
            {busy && (
              <div className="progress">
                <span className="spinner" />
                {translateRuntimeMessage(busy, lang)}…
              </div>
            )}
          </div>
          <div aria-live="polite" aria-atomic="true">
            {notice && (
              <div
                className={"notice " + (notice.bad ? "warn" : "")}
                role={notice.bad ? "alert" : "status"}
              >
                {notice.bad ? (
                  <AlertCircle size={17} aria-hidden="true" />
                ) : (
                  <Check size={17} aria-hidden="true" />
                )}
                <span>{translateRuntimeMessage(notice.message, lang)}</span>
                <button
                  type="button"
                  aria-label={t("dismissMessage")}
                  title={t("dismissMessage")}
                  onClick={() => setNotice(null)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {!loaded ? (
            <p>
              {loadFailed ? t("workspaceUnavailable") : t("openingWorkspace")}
            </p>
          ) : page === "home" ? (
            <Home
              {...data}
              todayIso={todayIso}
              demo={demoMode}
              busy={!!busy}
              onSample={() =>
                work({
                  sampleRun: true,
                  payload: {
                    text: sample.text,
                    sample: true,
                    source: "Sample",
                  },
                })
              }
              onCapture={onCapture}
              onDrop={(e) => {
                e.preventDefault();
                selectFile(e.dataTransfer.files[0], "file");
              }}
            />
          ) : page === "capture" ? (
            <Capture
              {...{
                kind,
                setKind,
                file,
                setFile,
                text,
                setText,
                modeProps,
                ready,
                busy,
              }}
              run={() =>
                work({
                  payload: {
                    file: kind !== "text" ? file : null,
                    text,
                    source: kind,
                  },
                })
              }
            />
          ) : page === "library" ? (
            <Library
              {...{
                docs: data.docs,
                actions: data.actions,
                online,
                query,
                setQuery,
                category,
                setCategory,
                inputRef,
              }}
            />
          ) : page === "inbox" ? (
            <InboxPage docs={data.docs} />
          ) : page === "actions" ? (
            <Actions
              {...data}
              splitsData={splitsData}
              todayIso={todayIso}
              focusedActionId={id || ""}
              onToggle={(action) =>
                mutation(() => toggleAction(action.id))
              }
              onUpdateAction={(actionId, fields, msg) =>
                mutation(() => updateAction(actionId, fields), msg)
              }
              onCreateGroup={(groupTitle) =>
                mutation(() => createGroup(groupTitle), "Group created.")
              }
              onRenameGroup={(groupId, groupTitle) =>
                mutation(
                  () => renameGroup(groupId, groupTitle),
                  "Group renamed.",
                )
              }
              onDeleteGroup={(groupId) =>
                mutation(
                  () => deleteGroup(groupId),
                  "Group removed. Actions kept.",
                )
              }
              onAddDependency={async (prereqId, depId) => {
                try {
                  await addDependency(prereqId, depId);
                  await refresh();
                  say("Connection added.");
                  syncAfterWrite().catch(() => {});
                  return { ok: true };
                } catch (e) {
                  return {
                    ok: false,
                    error:
                      e?.message || "The change could not be saved. Try again.",
                  };
                }
              }}
              onRemoveDependency={(depId) =>
                mutation(
                  () => removeDependency(depId),
                  "Connection removed.",
                )
              }
              onExportCalendar={() => say("Calendar reminder downloaded.")}
            />
          ) : page === "document" && doc ? (
            <Detail
              key={doc.id}
              {...{ doc, modeProps, ready, busy }}
              actions={data.actions.filter((a) => a.documentId === doc.id)}
              save={(d, fields) =>
                mutation(() => change(d.id, fields), "Filing saved.")
              }
              undo={(d) =>
                mutation(
                  () =>
                    change(d.id, {
                      status: "needs_review",
                      reason:
                        "Filing undone. Choose a category when you’re ready.",
                      autoFiled: false,
                    }),
                  "Moved to Inbox. Original kept.",
                )
              }
              remove={async (d) => {
                try {
                  await deleteDocument(d.id);
                  navTo("/library");
                  setRoute("/library");
                  await refresh();
                  say("Document deleted.");
                  syncAfterWrite().catch(() => {});
                  return true;
                } catch {
                  say("The document could not be deleted. Try again.", true);
                  return false;
                }
              }}
              retry={(d) => work({ existing: d })}
              add={async (docId, actionTitle, due, opts) => {
                try {
                  const res = await addAction(docId, actionTitle, due, opts);
                  await refresh();
                  say(
                    res.created
                      ? "Added to Actions."
                      : "Follow-up already saved in Actions.",
                  );
                  syncAfterWrite().catch(() => {});
                  return true;
                } catch {
                  say("The change could not be saved. Try again.", true);
                  return false;
                }
              }}
              dismissFollowUp={(d) =>
                mutation(
                  () => change(d.id, { followUpDismissed: true }),
                  "Follow-up draft dismissed.",
                )
              }
              applyTemplate={async (d, template) => {
                try {
                  const res = await applyWorkflowTemplate(d.id, template);
                  await refresh();
                  say(
                    res.created
                      ? "Workflow template created in Actions."
                      : "Workflow template already added.",
                  );
                  syncAfterWrite().catch(() => {});
                  return true;
                } catch {
                  say("The change could not be saved. Try again.", true);
                  return false;
                }
              }}
              dismissTemplate={(d) =>
                mutation(
                  () => change(d.id, { workflowTemplateDismissed: true }),
                  "Workflow template dismissed.",
                )
              }
              user={user}
              authConfigured={firebaseAuthConfigured}
              online={online}
              demo={demoMode}
              onCreateSplitWorkflow={async (opts) => {
                await createSplitActionWorkflow(doc.id, opts);
                await refresh();
                say("Split bill actions created.");
                syncAfterWrite().catch(() => {});
              }}
              onSplitPublished={() => refreshSplits()}
            />
          ) : page === "split" && id ? (
            <SplitDetailPage
              splitId={id}
              user={user}
              online={online}
              aiModule={ai}
              onConfirmShareActionDone={async (splitIdArg, shareIdArg) => {
                const updated = await markSplitShareActionDone(splitIdArg, shareIdArg);
                if (updated) {
                  await refresh();
                  syncAfterWrite().catch(() => {});
                }
              }}
              onSplitsChanged={() => refreshSplits()}
            />
          ) : page === "account" ? (
            <AccountPage
              demo={demoMode}
              authConfigured={firebaseAuthConfigured}
              user={user}
              online={online}
              syncMeta={syncMeta}
              remoteSyncDetected={remoteSyncDetected}
              localSummary={localSummary}
              onGoogleSignIn={handleGoogleSignIn}
              onEmailSignIn={handleEmailSignIn}
              onEmailSignUp={handleEmailSignUp}
              onPasswordReset={handlePasswordReset}
              onContinueLocal={handleContinueLocal}
              onResendVerification={async () => {
                try {
                  await resendVerificationEmail();
                  say(t("resendVerification"));
                } catch (e) {
                  say(t(mapAuthError(e)), true);
                }
              }}
              onRefreshVerification={async () => {
                try {
                  const refreshed = await reloadCurrentUser();
                  if (refreshed) {
                    const snap = snapshotUser(refreshed);
                    userRef.current = snap;
                    setUser(snap);
                  }
                } catch (e) {
                  say(t(mapAuthError(e)), true);
                }
              }}
              onSignOut={async () => {
                syncUnsubRef.current?.();
                syncUnsubRef.current = null;
                setSplitsData({ outgoing: [], incoming: [] });
                saveLocalGuestMode(false);
                setLocalGuestMode(false);
                await signOutAccount();
              }}
              onEnableSync={async ({ importLocal = false } = {}) => {
                const uid = userRef.current?.uid;
                if (!uid) return;
                try {
                  if (importLocal) {
                    await importLocalWorkspaceIntoCurrent(uid);
                  }
                  const next = await enableProgressSync(uid);
                  if (next) setSyncMeta(next);
                  attachSyncSubscription(uid, () => userRef.current?.uid === uid);
                  setRemoteSyncDetected(false);
                  await refresh(uid);
                } catch (e) {
                  setSyncMeta(await getSyncMeta(uid));
                  say(e?.message || t("syncStatusFailed"), true);
                }
              }}
              onDisableSync={async () => {
                const uid = userRef.current?.uid;
                if (!uid) return;
                syncUnsubRef.current?.();
                syncUnsubRef.current = null;
                await disableProgressSync(uid);
                await refresh(uid);
              }}
              onSyncNow={async () => {
                const uid = userRef.current?.uid;
                if (!uid) return;
                const next = await runSyncCycle(uid);
                if (next) setSyncMeta(next);
                await refresh(uid);
              }}
              onImportLocal={async () => {
                const uid = userRef.current?.uid;
                if (!uid) return;
                await importLocalWorkspaceIntoCurrent(uid);
                const next = await runSyncCycle(uid);
                if (next) setSyncMeta(next);
                await refresh(uid);
              }}
            />
          ) : (
            <Empty title={t("pageNotFound")}>
              <a href="#/home">{t("backToHome")}</a>
            </Empty>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label={t("mobileNav")}>
        {items.slice(0, 2).map((args) => nav(...args))}
        {captureLink}
        {items.slice(2).map((args) => nav(...args))}
      </nav>
      <input
        ref={quickFile}
        hidden
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          selectFile(e.target.files[0], "file");
          e.target.value = "";
        }}
      />
      <input
        ref={quickCamera}
        hidden
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={(e) => {
          selectFile(e.target.files[0], "camera");
          e.target.value = "";
        }}
      />
    </LangContext.Provider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
