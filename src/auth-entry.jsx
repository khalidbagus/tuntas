import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Cloud,
  KeyRound,
  Mail,
  Monitor,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DEMO_ACCOUNT_EMAIL, demoWorkspaceHref } from "./demo.js";
import { LANGUAGES, createTranslator } from "./i18n.js";

export function AuthEntryScreen({
  lang,
  setLang,
  authConfigured = false,
  returnRoute = "/login",
  onGoogleSignIn,
  onEmailSignIn,
  onEmailSignUp,
  onPasswordReset,
  onContinueLocal,
}) {
  const t = createTranslator(lang);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authFeedback, setAuthFeedback] = useState("");

  useEffect(() => {
    setAuthError("");
    setAuthFeedback("");
  }, [authMode]);

  const demoHref = demoWorkspaceHref(
    globalThis.location?.pathname ?? "/",
    returnRoute || "/login",
  );

  return (
    <div className="auth-entry-page">
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

      <header className="auth-entry-top">
        <a className="brand" href="#/login">
          <img src="/mark.svg" alt="" />
          Tuntas<span>✦</span>
        </a>
        <label className="lang-picker" title={t("languageLabel")}>
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
      </header>

      <main id="main-content" tabIndex="-1" className="auth-entry-main">
        <div className="auth-entry-grid">
          <section className="auth-entry-intro" aria-labelledby="auth-entry-heading">
            <div className="overline">
              <span className="blue-line" />
              {t("authEntryKicker")}
            </div>
            <h1 id="auth-entry-heading" tabIndex="-1">
              {t("authEntryTitle")}
            </h1>
            <p className="auth-entry-lead">{t("homeDescription")}</p>

            <ul className="auth-highlights">
              <li>
                <span className="soft-icon" aria-hidden="true">
                  <Monitor size={18} />
                </span>
                <span>{t("authHighlightLocal")}</span>
              </li>
              <li>
                <span className="soft-icon" aria-hidden="true">
                  <Sparkles size={18} />
                </span>
                <span>{t("authHighlightHybrid")}</span>
              </li>
              <li>
                <span className="soft-icon" aria-hidden="true">
                  <Cloud size={18} />
                </span>
                <span>{t("authHighlightSync")}</span>
              </li>
            </ul>
          </section>

          <section
            className="form-panel auth-entry-card"
            aria-label={t("authEntryKicker")}
          >
            {!authConfigured ? (
              <div className="note">
                <div>
                  <strong>{t("accountUnavailableTitle")}</strong>
                  <p>{t("accountUnavailableBody")}</p>
                </div>
              </div>
            ) : (
              <>
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
                            t("authSubmitReset") + ": " + email.trim(),
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
                      className="primary auth-submit-btn"
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
              </>
            )}

            <div className="auth-demo-box">
              <div className="auth-demo-head">
                <span className="demo-badge">{t("demoIdentityBadge")}</span>
                <span className="demo-email-chip">{DEMO_ACCOUNT_EMAIL}</span>
              </div>
              <p>{t("authDemoHint")}</p>
              <div className="button-line">
                <a className="secondary demo-cta" href={demoHref}>
                  <span>{t("enterDemo")}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="secondary auth-local-btn"
                  onClick={onContinueLocal}
                >
                  <Monitor size={16} aria-hidden="true" />
                  <span>{t("continueOnThisDevice")}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
