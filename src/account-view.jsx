import React, { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Cloud,
  CloudOff,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  Monitor,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { demoWorkspaceHref, exitDemoHref } from "./demo.js";
import { useLang } from "./lang.js";
import { createTranslator, localeFor } from "./i18n.js";
import { Heading } from "./ui.jsx";

function formatSyncTime(ts, locale) {
  if (!ts) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function AccountPage({
  demo = false,
  authConfigured = false,
  user = null,
  online = true,
  syncMeta = {
    enabled: false,
    status: "off",
    lastSyncedAt: null,
    lastError: "",
    pendingCount: 0,
  },
  remoteSyncDetected = false,
  localSummary = {
    totalDocs: 0,
    totalActions: 0,
    unimportedDocs: 0,
    unimportedActions: 0,
  },
  onGoogleSignIn,
  onEmailSignIn,
  onEmailSignUp,
  onPasswordReset,
  onResendVerification,
  onRefreshVerification,
  onSignOut,
  onEnableSync,
  onDisableSync,
  onSyncNow,
  onImportLocal,
  onContinueLocal,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);

  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authFeedback, setAuthFeedback] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [showImportPrompt, setShowImportPrompt] = useState(false);

  const importCancelRef = useRef(null);
  const importHeadingId = useId();

  useEffect(() => {
    setAuthError("");
    setAuthFeedback("");
  }, [authMode, user?.uid]);

  useEffect(() => {
    if (!showImportPrompt) return;
    const frame = requestAnimationFrame(() => {
      importCancelRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [showImportPrompt]);

  if (demo) {
    return (
      <>
        <Heading
          kicker={t("accountKicker")}
          title={t("accountTitle")}
          description={t("accountDescription")}
        />
        <section className="form-panel account-panel">
          <div className="account-card">
            <strong>{t("accountDemoTitle")}</strong>
            <p>{t("accountDemoBody")}</p>
            <div className="button-line">
              <a className="primary" href={exitDemoHref()}>
                {t("exitDemo")}
              </a>
            </div>
          </div>
        </section>
      </>
    );
  }

  const hasUnimportedLocal =
    localSummary.unimportedDocs > 0 || localSummary.unimportedActions > 0;

  const isGoogleUser = user?.providerData?.some(
    (p) => p.providerId === "google.com",
  );

  const syncBadgeInfo = () => {
    if (!syncMeta.enabled) {
      return {
        cls: "chip neutral-chip",
        Icon: CloudOff,
        label: t("syncStatusOff"),
      };
    }
    if (syncMeta.status === "failed") {
      return {
        cls: "chip urgency-badge overdue",
        Icon: AlertCircle,
        label: t("syncStatusFailed"),
      };
    }
    if (syncMeta.status === "pending" || syncMeta.pendingCount > 0) {
      return {
        cls: "chip amber",
        Icon: Clock,
        label: t("syncStatusPending"),
      };
    }
    return {
      cls: "chip green",
      Icon: Check,
      label: t("syncStatusSynced"),
    };
  };

  const badge = syncBadgeInfo();
  const BadgeIcon = badge.Icon;

  return (
    <>
      <Heading
        kicker={t("accountKicker")}
        title={t("accountTitle")}
        description={t("accountDescription")}
      />

      {!user ? (
        <div className="account-stack">
          {!authConfigured ? (
            <section className="form-panel account-panel">
              <div className="account-card">
                <strong>{t("accountUnavailableTitle")}</strong>
                <p>{t("accountUnavailableBody")}</p>
                <div className="button-line">
                  <a
                    className="primary"
                    href="#/home"
                    onClick={() => onContinueLocal?.()}
                  >
                    {t("continueOnThisDevice")}
                  </a>
                  <a
                    className="secondary demo-cta"
                    href={demoWorkspaceHref(
                      globalThis.location?.pathname ?? "/",
                      "/account",
                    )}
                  >
                    {t("exploreDemo")}{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </section>
          ) : (
            <section className="form-panel account-panel">
              {authError && (
                <div className="notice warn" role="alert">
                  <AlertCircle size={17} aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}
              {authFeedback && (
                <div className="notice" role="status">
                  <Check size={17} aria-hidden="true" />
                  <span>{authFeedback}</span>
                </div>
              )}

              <div className="account-google-block">
                <button
                  type="button"
                  className="secondary google-btn"
                  disabled={authBusy}
                  onClick={async () => {
                    setAuthBusy(true);
                    setAuthError("");
                    setAuthFeedback("");
                    try {
                      const res = await onGoogleSignIn();
                      if (!res.ok) setAuthError(t(res.errorKey));
                    } finally {
                      setAuthBusy(false);
                    }
                  }}
                >
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>{t("continueWithGoogle")}</span>
                </button>
                <small>{t("googleHint")}</small>
              </div>

              <div
                className="segments auth-tabs"
                role="group"
                aria-label={t("accountKicker")}
              >
                {[
                  ["signin", t("authTabSignIn")],
                  ["signup", t("authTabCreate")],
                  ["reset", t("authTabReset")],
                ].map(([modeKey, label]) => (
                  <button
                    key={modeKey}
                    type="button"
                    aria-pressed={authMode === modeKey}
                    onClick={() => setAuthMode(modeKey)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form
                className="stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (authBusy) return;
                  setAuthBusy(true);
                  setAuthError("");
                  setAuthFeedback("");
                  try {
                    if (authMode === "signin") {
                      const res = await onEmailSignIn(email, password);
                      if (!res.ok) setAuthError(t(res.errorKey));
                    } else if (authMode === "signup") {
                      const res = await onEmailSignUp(email, password);
                      if (!res.ok) setAuthError(t(res.errorKey));
                    } else {
                      const res = await onPasswordReset(email);
                      if (res.ok) {
                        setAuthFeedback(
                          t("authSubmitReset") +
                            ": " +
                            email.trim(),
                        );
                      } else {
                        setAuthError(t(res.errorKey));
                      }
                    }
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                <label>
                  {t("authEmailLabel")}
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>

                {authMode !== "reset" && (
                  <label>
                    {t("authPasswordLabel")}
                    {authMode === "signup" && (
                      <>
                        {" "}
                        <small className="inline-hint">
                          ({t("authPasswordHint")})
                        </small>
                      </>
                    )}
                    <input
                      type="password"
                      required
                      minLength={authMode === "signup" ? 6 : undefined}
                      autoComplete={
                        authMode === "signup"
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                )}

                <div className="button-line">
                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      authBusy ||
                      !email.trim() ||
                      (authMode !== "reset" && !password)
                    }
                  >
                    {authMode === "reset" ? (
                      <KeyRound size={17} aria-hidden="true" />
                    ) : (
                      <Mail size={17} aria-hidden="true" />
                    )}
                    <span>
                      {authMode === "signin"
                        ? t("authSubmitSignIn")
                        : authMode === "signup"
                          ? t("authSubmitCreate")
                          : t("authSubmitReset")}
                    </span>
                  </button>
                </div>
              </form>

              <div className="account-alt-paths">
                <a
                  className="secondary"
                  href="#/home"
                  onClick={() => onContinueLocal?.()}
                >
                  <Monitor size={16} aria-hidden="true" />
                  <span>{t("continueOnThisDevice")}</span>
                </a>
                <a
                  className="secondary demo-cta"
                  href={demoWorkspaceHref(
                    globalThis.location?.pathname ?? "/",
                    "/account",
                  )}
                >
                  <span>{t("exploreDemo")}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="account-stack">
          <section
            className="form-panel account-panel"
            aria-label={t("signedInAsHeading")}
          >
            <div className="account-identity-head">
              <div>
                <span className="overline">{t("signedInAsHeading")}</span>
                <strong className="account-email-value">
                  {user.email || user.uid}
                </strong>
                <div className="button-line account-chips">
                  <span className="chip blue">
                    <UserCheck size={12} aria-hidden="true" />
                    {isGoogleUser ? t("providerGoogle") : t("providerEmail")}
                  </span>
                  <span className="chip neutral-chip">
                    {t("uidIsolatedChip")}
                  </span>
                  {!isGoogleUser && (
                    <span
                      className={
                        "chip " + (user.emailVerified ? "green" : "amber")
                      }
                    >
                      {user.emailVerified
                        ? t("emailVerifiedChip")
                        : t("emailPendingChip")}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={authBusy || syncBusy}
                onClick={async () => {
                  setAuthBusy(true);
                  try {
                    await onSignOut();
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>{t("signOut")}</span>
              </button>
            </div>

            {!isGoogleUser && !user.emailVerified && (
              <div className="note account-verify-box">
                <div>
                  <p>{t("emailVerifyHint")}</p>
                  <div className="button-line">
                    <button
                      type="button"
                      className="secondary compact-btn"
                      disabled={authBusy}
                      onClick={async () => {
                        setAuthBusy(true);
                        try {
                          await onResendVerification();
                        } finally {
                          setAuthBusy(false);
                        }
                      }}
                    >
                      {t("resendVerification")}
                    </button>
                    <button
                      type="button"
                      className="link-button compact-link"
                      disabled={authBusy}
                      onClick={async () => {
                        setAuthBusy(true);
                        try {
                          await onRefreshVerification();
                        } finally {
                          setAuthBusy(false);
                        }
                      }}
                    >
                      {t("refreshVerification")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section
            className="form-panel account-panel sync-card"
            aria-label={t("syncSectionTitle")}
          >
            <div className="sync-head-row">
              <div className="section-title">
                <Cloud size={19} aria-hidden="true" />
                <h2>{t("syncSectionTitle")}</h2>
              </div>
              <span className={badge.cls + " sync-status-pill"}>
                <BadgeIcon size={13} aria-hidden="true" />
                <span>{badge.label}</span>
              </span>
            </div>

            {remoteSyncDetected && !syncMeta.enabled && (
              <div className="note">
                <span>{t("syncRemoteDetectedNote")}</span>
              </div>
            )}

            <div className="sync-boundary-grid">
              <div className="sync-boundary-item">
                <strong>{t("syncWhatSyncsLabel")}</strong>
                <p>{t("syncWhatSyncsBody")}</p>
              </div>
              <div className="sync-boundary-item">
                <strong>{t("syncWhatStaysLocalLabel")}</strong>
                <p>{t("syncWhatStaysLocalBody")}</p>
              </div>
            </div>

            <small>{t("syncBillingNote")}</small>

            {syncMeta.enabled && (
              <div className="sync-meta-line">
                {syncMeta.pendingCount > 0 && (
                  <small>
                    {t("syncPendingCount", { n: syncMeta.pendingCount })}
                  </small>
                )}
                {syncMeta.lastSyncedAt && (
                  <small>
                    {t("syncLastSyncedAt", {
                      time: formatSyncTime(syncMeta.lastSyncedAt, locale),
                    })}
                  </small>
                )}
                {syncMeta.status === "failed" && syncMeta.lastError && (
                  <p className="inline-error" role="alert">
                    {syncMeta.lastError}
                  </p>
                )}
              </div>
            )}

            {showImportPrompt ? (
              <section
                className="import-confirm"
                role="region"
                aria-labelledby={importHeadingId}
              >
                <strong id={importHeadingId}>{t("importPromptHeading")}</strong>
                <p>
                  {t("importPromptBody", {
                    docs: localSummary.unimportedDocs,
                    actions: localSummary.unimportedActions,
                  })}
                </p>
                <div className="button-line">
                  <button
                    type="button"
                    className="primary"
                    disabled={syncBusy}
                    onClick={async () => {
                      setSyncBusy(true);
                      try {
                        await onEnableSync({ importLocal: true });
                        setShowImportPrompt(false);
                      } finally {
                        setSyncBusy(false);
                      }
                    }}
                  >
                    {t("importAndEnableSync")}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={syncBusy}
                    onClick={async () => {
                      setSyncBusy(true);
                      try {
                        await onEnableSync({ importLocal: false });
                        setShowImportPrompt(false);
                      } finally {
                        setSyncBusy(false);
                      }
                    }}
                  >
                    {t("enableWithoutImport")}
                  </button>
                  <button
                    ref={importCancelRef}
                    type="button"
                    className="link-button"
                    disabled={syncBusy}
                    onClick={() => setShowImportPrompt(false)}
                  >
                    {t("cancel")}
                  </button>
                </div>
              </section>
            ) : (
              <div className="button-line">
                {!syncMeta.enabled ? (
                  <button
                    type="button"
                    className="primary"
                    disabled={syncBusy}
                    onClick={async () => {
                      if (hasUnimportedLocal) {
                        setShowImportPrompt(true);
                        return;
                      }
                      setSyncBusy(true);
                      try {
                        await onEnableSync({ importLocal: false });
                      } finally {
                        setSyncBusy(false);
                      }
                    }}
                  >
                    <Cloud size={17} aria-hidden="true" />
                    <span>{t("enableSync")}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={syncBusy || !online}
                      onClick={async () => {
                        setSyncBusy(true);
                        try {
                          await onSyncNow();
                        } finally {
                          setSyncBusy(false);
                        }
                      }}
                    >
                      <RefreshCw size={16} aria-hidden="true" />
                      <span>
                        {syncMeta.status === "failed"
                          ? t("retrySync")
                          : t("syncNow")}
                      </span>
                    </button>
                    {hasUnimportedLocal && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={syncBusy}
                        onClick={async () => {
                          setSyncBusy(true);
                          try {
                            await onImportLocal();
                          } finally {
                            setSyncBusy(false);
                          }
                        }}
                      >
                        {t("importLocalRecords", {
                          docs: localSummary.unimportedDocs,
                          actions: localSummary.unimportedActions,
                        })}
                      </button>
                    )}
                    <button
                      type="button"
                      className="link-button"
                      disabled={syncBusy}
                      onClick={async () => {
                        setSyncBusy(true);
                        try {
                          await onDisableSync();
                        } finally {
                          setSyncBusy(false);
                        }
                      }}
                    >
                      {t("disableSync")}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
