import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Mail,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  SPLIT_CURRENCIES,
  buildSplitInviteUrl,
  buildSplitMailtoHref,
  buildSplitShareText,
  calculateShares,
  detectReceiptCurrency,
  detectReceiptTotal,
  formatSplitAmount,
  isValidEmail,
  normalizeEmail,
  parseReceiptLineItems,
  verifyTransferProofLocally,
} from "./split-domain.js";
import {
  createSimulatedGooglePayToken,
  runGooglePaySandbox,
} from "./google-pay-demo.js";
import {
  createSharedSplit,
  fetchSplitById,
  organizerUpdateShareStatus,
  respondToSplitShare,
} from "./splits-service.js";
import { configured } from "./engine.js";
import { supportsDeviceAI } from "./device-ai.js";
import { useLang } from "./lang.js";
import { createTranslator, localeFor } from "./i18n.js";
import { Empty, Heading } from "./ui.jsx";

function splitStatusChip(status, t) {
  if (status === "confirmed" || status === "settled") {
    return { cls: "chip green", label: t("splitStatusConfirmed") };
  }
  if (status === "paid_pending_confirm") {
    return { cls: "chip blue", label: t("splitStatusProofSubmitted") };
  }
  if (status === "accepted") {
    return { cls: "chip blue", label: t("splitStatusAccepted") };
  }
  if (status === "declined" || status === "canceled") {
    return { cls: "chip urgency-badge overdue", label: t("splitStatusDeclined") };
  }
  return { cls: "chip amber", label: t("splitStatusPending") };
}

export function SplitBillBuilder({
  doc,
  user = null,
  authConfigured = false,
  online = true,
  demo = false,
  onCreateWorkflow,
  onSplitPublished,
  onClose,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);

  const [currency, setCurrency] = useState(() => detectReceiptCurrency(doc, lang));
  const [totalInput, setTotalInput] = useState(() => {
    const detected = detectReceiptTotal(doc);
    return detected > 0 ? String(detected) : "";
  });
  const [splitMode, setSplitMode] = useState("equal");
  const [participants, setParticipants] = useState(() => [
    {
      id: "p-self",
      name: user?.displayName || (lang === "id" ? "Saya (Pembayar)" : "Me (Organizer)"),
      email: user?.email || "",
      isSelf: true,
    },
    { id: "p-1", name: "", email: "", isSelf: false },
  ]);
  const [items, setItems] = useState(() => {
    const parsed = parseReceiptLineItems(doc?.text || "");
    return parsed.length
      ? parsed.map((item) => ({ ...item, assigneeIds: [] }))
      : [{ id: "item-1", name: "", amount: "", assigneeIds: [] }];
  });
  const [taxOrTip, setTaxOrTip] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  const numericTotal = Number(totalInput || 0);
  const { shares, computedTotal } = calculateShares({
    mode: splitMode,
    totalAmount: numericTotal,
    participants,
    items,
    taxOrTip: Number(taxOrTip || 0),
    currency,
  });

  const nonSelfShares = shares.filter((s) => !s.isSelf);
  const effectiveTotal = splitMode === "itemized" ? computedTotal : numericTotal;
  const canPublishCloud = Boolean(
    !demo &&
      authConfigured &&
      user &&
      online &&
      nonSelfShares.some((s) => isValidEmail(s.email)),
  );

  const copyText = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  if (createdResult) {
    const { split, shares: createdShares, published } = createdResult;
    const inviteUrl = published ? buildSplitInviteUrl(split.id) : "";
    return (
      <section className="split-builder" aria-label={t("splitBillTitle")}>
        <div className="followup-top">
          <strong>{t("splitCreatedHeading")}</strong>
          <span className={"chip " + (published ? "green" : "blue")}>
            {published ? t("splitPublishedCloudChip") : t("splitSavedLocalChip")}
          </span>
        </div>
        <p className="muted-copy">
          {published ? t("splitSparkEmailNote") : t("splitLocalOnlyNote")}
        </p>

        {published && (
          <div className="button-line">
            <a className="primary compact-btn" href={`#/split/${split.id}`}>
              {t("openSplitDetail")}
            </a>
            <button
              type="button"
              className="secondary compact-btn"
              onClick={() => copyText("link", inviteUrl)}
            >
              <Copy size={15} aria-hidden="true" />
              <span>{copiedKey === "link" ? t("copiedLabel") : t("copyInviteLink")}</span>
            </button>
          </div>
        )}

        <div className="split-share-list">
          {createdShares
            .filter((s) => !s.isSelf)
            .map((s) => {
              const mailto = buildSplitMailtoHref(
                split,
                { ...s, participantName: s.participantName || s.name, participantEmail: s.participantEmail || s.email },
                { inviteUrl, locale },
              );
              const shareBody = buildSplitShareText(
                split,
                { ...s, participantName: s.participantName || s.name, participantEmail: s.participantEmail || s.email },
                { inviteUrl, locale },
              );
              return (
                <div key={s.id} className="split-share-row">
                  <div>
                    <strong>{s.participantName || s.name}</strong>
                    <small>
                      {formatSplitAmount(s.amount, split.currency, locale)}
                      {(s.participantEmail || s.email)
                        ? ` · ${s.participantEmail || s.email}`
                        : ""}
                    </small>
                  </div>
                  <div className="button-line">
                    {mailto && (
                      <a className="secondary compact-btn" href={mailto}>
                        <Mail size={15} aria-hidden="true" />
                        <span>{t("sendSplitEmail")}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      className="secondary compact-btn"
                      onClick={() => copyText(s.id, shareBody)}
                    >
                      <Copy size={15} aria-hidden="true" />
                      <span>{copiedKey === s.id ? t("copiedLabel") : t("copyShareSummary")}</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="button-line">
          <a className="text-link" href="#/actions">
            {t("openInActions")}
          </a>
          <button type="button" className="link-button" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="split-builder" aria-label={t("splitBillTitle")}>
      <div className="followup-top">
        <span className="workflow-template-title">
          <ReceiptText size={16} aria-hidden="true" />
          <strong>{t("splitBillTitle")}</strong>
        </span>
        <button type="button" className="link-button compact-link" onClick={onClose}>
          {t("cancel")}
        </button>
      </div>
      <small>{t("splitBillSubtitle")}</small>

      {error && (
        <div className="notice warn" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="split-top-fields">
        <label>
          {t("splitCurrencyLabel")}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {SPLIT_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {splitMode === "equal" ? (
          <label>
            {t("splitTotalLabel")}
            <input
              type="number"
              min="0"
              step="any"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder="0"
              required
            />
          </label>
        ) : (
          <label>
            {t("splitTaxTipLabel")}
            <input
              type="number"
              min="0"
              step="any"
              value={taxOrTip}
              onChange={(e) => setTaxOrTip(e.target.value)}
              placeholder="0"
            />
          </label>
        )}
      </div>

      <div className="segments" role="group" aria-label={t("splitModeLabel")}>
        {[
          ["equal", t("splitModeEqual")],
          ["itemized", t("splitModeItemized")],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={splitMode === k}
            onClick={() => setSplitMode(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {splitMode === "itemized" && (
        <div className="split-items-box">
          <strong>{t("splitItemsHeading")}</strong>
          {items.map((item, idx) => (
            <div key={item.id} className="split-item-card">
              <div className="split-item-inputs">
                <input
                  aria-label={t("splitItemNameLabel")}
                  placeholder={t("splitItemNamePlaceholder")}
                  value={item.name}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, j) =>
                        j === idx ? { ...it, name: e.target.value } : it,
                      ),
                    )
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  aria-label={t("splitItemPriceLabel")}
                  placeholder="0"
                  value={item.amount}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, j) =>
                        j === idx ? { ...it, amount: e.target.value } : it,
                      ),
                    )
                  }
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    className="secondary compact-btn"
                    aria-label={t("remove")}
                    onClick={() =>
                      setItems((prev) => prev.filter((_, j) => j !== idx))
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="split-assignee-row">
                {participants
                  .filter((p) => p.name.trim())
                  .map((p) => {
                    const checked = item.assigneeIds.includes(p.id);
                    return (
                      <label key={p.id} className="split-assignee-chip">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...item.assigneeIds, p.id]
                              : item.assigneeIds.filter((id) => id !== p.id);
                            setItems((prev) =>
                              prev.map((it, j) =>
                                j === idx ? { ...it, assigneeIds: next } : it,
                              ),
                            );
                          }}
                        />
                        <span>{p.name}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary compact-btn"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                {
                  id: `item-${Date.now()}-${prev.length}`,
                  name: "",
                  amount: "",
                  assigneeIds: [],
                },
              ])
            }
          >
            <Plus size={15} aria-hidden="true" />
            <span>{t("splitAddItem")}</span>
          </button>
        </div>
      )}

      <div className="split-participants-box">
        <div className="followup-top">
          <strong>{t("splitParticipantsHeading")}</strong>
          <button
            type="button"
            className="secondary compact-btn"
            onClick={() =>
              setParticipants((prev) => [
                ...prev,
                {
                  id: `p-${Date.now()}-${prev.length}`,
                  name: "",
                  email: "",
                  isSelf: false,
                },
              ])
            }
          >
            <Plus size={15} aria-hidden="true" />
            <span>{t("splitAddPerson")}</span>
          </button>
        </div>

        {participants.map((p, idx) => (
          <div key={p.id} className="split-participant-row">
            <input
              aria-label={t("splitPersonNameLabel")}
              placeholder={p.isSelf ? t("splitYourNamePlaceholder") : t("splitPersonNamePlaceholder")}
              value={p.name}
              maxLength={80}
              onChange={(e) =>
                setParticipants((prev) =>
                  prev.map((item, j) =>
                    j === idx ? { ...item, name: e.target.value } : item,
                  ),
                )
              }
            />
            <input
              type="email"
              aria-label={t("splitPersonEmailLabel")}
              placeholder={t("splitPersonEmailPlaceholder")}
              value={p.email}
              maxLength={120}
              disabled={p.isSelf}
              onChange={(e) =>
                setParticipants((prev) =>
                  prev.map((item, j) =>
                    j === idx ? { ...item, email: e.target.value } : item,
                  ),
                )
              }
            />
            {!p.isSelf && participants.length > 2 && (
              <button
                type="button"
                className="secondary compact-btn"
                aria-label={t("remove")}
                onClick={() =>
                  setParticipants((prev) => prev.filter((_, j) => j !== idx))
                }
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>

      {shares.length > 0 && effectiveTotal > 0 && (
        <div className="split-preview-box">
          <strong>
            {t("splitPreviewHeading", {
              total: formatSplitAmount(effectiveTotal, currency, locale),
            })}
          </strong>
          <ul>
            {shares.map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <strong>{formatSplitAmount(s.amount, currency, locale)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label>
        {t("splitPaymentInstructionsLabel")}
        <textarea
          rows="2"
          maxLength={500}
          placeholder={t("splitPaymentInstructionsPlaceholder")}
          value={paymentInstructions}
          onChange={(e) => setPaymentInstructions(e.target.value)}
        />
      </label>

      {!demo && authConfigured && user && (
        <small className="muted-copy">{t("splitEmailInviteNote")}</small>
      )}

      <div className="button-line">
        <button
          type="button"
          className="primary"
          disabled={saving || effectiveTotal <= 0 || nonSelfShares.length === 0}
          onClick={async () => {
            setError("");
            const invalidEmail = nonSelfShares.find(
              (s) => s.email && !isValidEmail(s.email),
            );
            if (invalidEmail) {
              setError(t("authErrorInvalidEmail"));
              return;
            }
            setSaving(true);
            try {
              let publishedSplit = null;
              let publishedShares = shares.map((s) => ({
                ...s,
                participantName: s.name,
                participantEmail: s.email,
              }));
              if (canPublishCloud) {
                const itemsSummary =
                  splitMode === "itemized"
                    ? items
                        .filter((it) => it.name.trim() && Number(it.amount) > 0)
                        .map((it) => `${it.name}: ${it.amount}`)
                        .join("; ")
                    : "";
                const res = await createSharedSplit({
                  organizerUid: user.uid,
                  organizerEmail: user.email,
                  title: doc.title,
                  currency,
                  totalAmount: effectiveTotal,
                  splitMode,
                  itemsSummary,
                  paymentInstructions: paymentInstructions.trim(),
                  shares,
                });
                publishedSplit = res.split;
                publishedShares = res.shares;
                onSplitPublished?.();
              }

              await onCreateWorkflow({
                groupTitle: doc.title,
                currency,
                locale,
                shares: publishedShares.map((s) => ({
                  id: s.id,
                  name: s.participantName || s.name,
                  email: s.participantEmail || s.email,
                  amount: s.amount,
                  isSelf: Boolean(s.isSelf),
                })),
                splitId: publishedSplit?.id || "",
              });

              setCreatedResult({
                published: Boolean(publishedSplit),
                split: publishedSplit || {
                  id: "local",
                  title: doc.title,
                  currency,
                  totalAmount: effectiveTotal,
                  paymentInstructions: paymentInstructions.trim(),
                },
                shares: publishedShares,
              });
            } catch (err) {
              setError(err?.message || t("noticeCouldNotSaveChange"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Users size={16} aria-hidden="true" />
          <span>{saving ? t("creatingSplit") : t("createSplitButton")}</span>
        </button>
      </div>
    </section>
  );
}

export function SplitDetailPage({
  splitId,
  user = null,
  online = true,
  aiModule = null,
  onConfirmShareActionDone,
  onSplitsChanged,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [proofText, setProofText] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [allowCloudProof, setAllowCloudProof] = useState(false);
  const [proofFeedback, setProofFeedback] = useState(null);
  const [gpayStatus, setGpayStatus] = useState("");
  const [gpayUnavailable, setGpayUnavailable] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!user?.uid || !splitId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetchSplitById(splitId, user.uid, user.email);
      setRecord(res);
    } catch (err) {
      setError(err?.message || t("splitNotFound"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [splitId, user?.uid]);

  if (!user) {
    return (
      <Empty icon={Users} title={t("splitSignInRequiredTitle")}>
        <a href="#/login">{t("authTabSignIn")}</a>
      </Empty>
    );
  }

  if (loading) {
    return <p>{t("openingWorkspace")}</p>;
  }

  if (error || !record) {
    return (
      <Empty icon={Users} title={t("splitNotFound")}>
        <p>{error}</p>
        <a href="#/actions">{t("navActions")}</a>
      </Empty>
    );
  }

  const { split, shares, isOrganizer } = record;
  const splitChip = splitStatusChip(split.status, t);
  const inviteUrl = buildSplitInviteUrl(split.id);
  const myEmail = normalizeEmail(user.email);
  const myShare = !isOrganizer
    ? shares.find((s) => s.participantEmail === myEmail) || shares[0]
    : null;

  const verifyWithAiOrLocal = async (expectedAmount) => {
    setError("");
    if (proofFile && configured && aiModule) {
      try {
        const verifier = aiModule.prepareProofVerifier({
          allowCloud: allowCloudProof && online,
          image: true,
        });
        const res = await verifier({ blob: proofFile, text: proofText });
        setProofFeedback({
          matched: true,
          summary: `${res.summary || "Proof read"} (${res.mode})`,
          aiVerified: true,
        });
        return;
      } catch (err) {
        if (!proofText.trim()) {
          setError(err?.message || t("splitProofAiFallbackHint"));
          return;
        }
      }
    }
    const localRes = verifyTransferProofLocally({
      text: proofText,
      expectedAmount,
      currency: split.currency,
    });
    if (!localRes.summary) {
      setError(t("splitProofEmptyError"));
      return;
    }
    setProofFeedback({
      matched: localRes.matched,
      summary: localRes.summary,
      aiVerified: false,
    });
  };

  return (
    <>
      <a className="back" href="#/actions">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("navActions")}
      </a>
      <Heading
        kicker={t("splitBillKicker")}
        title={split.title}
        description={t("splitDetailMeta", {
          total: formatSplitAmount(split.totalAmount, split.currency, locale),
          organizer: split.organizerEmail || t("splitOrganizerLabel"),
        })}
      />

      <section className="form-panel split-detail-card">
        <div className="status-line">
          <span className={splitChip.cls}>{splitChip.label}</span>
          <span className="chip neutral-chip">{split.currency}</span>
          {isOrganizer && (
            <button
              type="button"
              className="secondary compact-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // Ignore
                }
              }}
            >
              <Copy size={15} aria-hidden="true" />
              <span>{copied ? t("copiedLabel") : t("copyInviteLink")}</span>
            </button>
          )}
        </div>

        {split.paymentInstructions && (
          <div className="split-instructions-box">
            <strong>{t("splitPaymentInstructionsLabel")}</strong>
            <p>{split.paymentInstructions}</p>
          </div>
        )}

        {split.itemsSummary && (
          <small className="muted-copy">{split.itemsSummary}</small>
        )}

        {error && (
          <div className="notice warn" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!isOrganizer && myShare && (
          <div className="split-participant-panel">
            <div className="followup-top">
              <div>
                <span className="overline">{t("splitYourShareLabel")}</span>
                <h2 className="split-amount-heading">
                  {formatSplitAmount(myShare.amount, split.currency, locale)}
                </h2>
              </div>
              <span className={splitStatusChip(myShare.status, t).cls}>
                {splitStatusChip(myShare.status, t).label}
              </span>
            </div>

            {myShare.status === "pending" && (
              <div className="button-line">
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await respondToSplitShare(split.id, myShare.id, {
                        status: "accepted",
                        participantUid: user.uid,
                      });
                      await load();
                      onSplitsChanged?.();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Check size={16} aria-hidden="true" />
                  <span>{t("splitAcceptShare")}</span>
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await respondToSplitShare(split.id, myShare.id, {
                        status: "declined",
                        participantUid: user.uid,
                      });
                      await load();
                      onSplitsChanged?.();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("splitDeclineShare")}
                </button>
              </div>
            )}

            {myShare.status === "accepted" && (
              <div className="split-payment-grid">
                <section className="action-subpanel" aria-label={t("splitTransferProofHeading")}>
                  <div className="evidence-head">
                    <Upload size={16} aria-hidden="true" />
                    <strong>{t("splitTransferProofHeading")}</strong>
                  </div>
                  <small>{t("splitTransferProofHint")}</small>

                  <label>
                    {t("splitProofTextLabel")}
                    <textarea
                      rows="2"
                      maxLength={400}
                      placeholder={t("splitProofTextPlaceholder")}
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                    />
                  </label>

                  <label>
                    {t("splitProofScreenshotLabel")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  {proofFile && configured && (
                    <label className="checkline">
                      <input
                        type="checkbox"
                        checked={allowCloudProof}
                        onChange={(e) => setAllowCloudProof(e.target.checked)}
                      />
                      <span>
                        {supportsDeviceAI()
                          ? t("splitProofCloudOptIn")
                          : t("splitProofCloudOnlyOptIn")}
                      </span>
                    </label>
                  )}

                  {proofFeedback && (
                    <div className="notice" role="status">
                      <ShieldCheck size={16} aria-hidden="true" />
                      <span>{proofFeedback.summary}</span>
                    </div>
                  )}

                  <div className="button-line">
                    <button
                      type="button"
                      className="secondary compact-btn"
                      disabled={busy || (!proofText.trim() && !proofFile)}
                      onClick={() => verifyWithAiOrLocal(myShare.amount)}
                    >
                      {t("splitVerifyProofBtn")}
                    </button>
                    <button
                      type="button"
                      className="primary compact-btn"
                      disabled={busy || (!proofText.trim() && !proofFeedback)}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const summary =
                            proofFeedback?.summary ||
                            verifyTransferProofLocally({
                              text: proofText,
                              expectedAmount: myShare.amount,
                              currency: split.currency,
                            }).summary ||
                            proofText.trim().slice(0, 380);
                          await respondToSplitShare(split.id, myShare.id, {
                            status: "paid_pending_confirm",
                            participantUid: user.uid,
                            paymentMethod: "qris_bank_ewallet",
                            proofSummary: summary,
                            proofVerifiedByAi: Boolean(proofFeedback?.aiVerified),
                          });
                          await load();
                          onSplitsChanged?.();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t("splitSubmitProofBtn")}
                    </button>
                  </div>
                </section>

                <section className="action-subpanel gpay-demo-card" aria-label={t("gpayDemoHeading")}>
                  <div className="followup-top">
                    <span className="evidence-head">
                      <CreditCard size={16} aria-hidden="true" />
                      <strong>{t("gpayDemoHeading")}</strong>
                    </span>
                    <span className="chip amber">{t("gpaySandboxBadge")}</span>
                  </div>
                  <small>{t("gpaySandboxDisclaimer")}</small>

                  {gpayStatus && (
                    <div className="notice" role="status">
                      <span>{gpayStatus}</span>
                    </div>
                  )}

                  <div className="button-line">
                    <button
                      type="button"
                      className="secondary compact-btn"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setGpayUnavailable(false);
                        setGpayStatus("");
                        try {
                          const res = await runGooglePaySandbox({
                            amount: myShare.amount,
                            currency: split.currency,
                          });
                          if (res.ok) {
                            await respondToSplitShare(split.id, myShare.id, {
                              status: "paid_pending_confirm",
                              participantUid: user.uid,
                              paymentMethod: "google_pay_sandbox",
                              proofSummary: res.summary,
                              proofVerifiedByAi: false,
                            });
                            await load();
                            onSplitsChanged?.();
                          } else if (res.canceled) {
                            setGpayStatus(t("gpayCanceledNote"));
                          } else {
                            setGpayUnavailable(true);
                            setGpayStatus(t("gpayUnavailableNote"));
                          }
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <CreditCard size={15} aria-hidden="true" />
                      <span>{t("gpayPayDemoBtn")}</span>
                    </button>

                    {gpayUnavailable && (
                      <button
                        type="button"
                        className="primary compact-btn"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const sim = createSimulatedGooglePayToken({
                              amount: myShare.amount,
                              currency: split.currency,
                            });
                            await respondToSplitShare(split.id, myShare.id, {
                              status: "paid_pending_confirm",
                              participantUid: user.uid,
                              paymentMethod: "google_pay_sandbox",
                              proofSummary: sim.summary,
                              proofVerifiedByAi: false,
                            });
                            await load();
                            onSplitsChanged?.();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t("gpaySimulateTokenBtn")}
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}

            {(myShare.status === "paid_pending_confirm" ||
              myShare.status === "confirmed") &&
              myShare.proofSummary && (
                <div className="note">
                  <span>{myShare.proofSummary}</span>
                </div>
              )}
          </div>
        )}

        {isOrganizer && (
          <div className="split-organizer-list">
            <h2>{t("splitParticipantsHeading")}</h2>
            {shares.map((s) => {
              const chip = splitStatusChip(s.status, t);
              const mailto = buildSplitMailtoHref(split, s, { inviteUrl, locale });
              return (
                <article key={s.id} className="split-organizer-row">
                  <div className="followup-top">
                    <div>
                      <strong>{s.participantName}</strong>
                      <small>
                        {formatSplitAmount(s.amount, split.currency, locale)}
                        {s.participantEmail ? ` · ${s.participantEmail}` : ""}
                      </small>
                    </div>
                    <span className={chip.cls}>{chip.label}</span>
                  </div>
                  {s.proofSummary && (
                    <small className="split-proof-summary">{s.proofSummary}</small>
                  )}
                  <div className="button-line">
                    {s.status === "paid_pending_confirm" && (
                      <>
                        <button
                          type="button"
                          className="primary compact-btn"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await organizerUpdateShareStatus(
                                split.id,
                                s.id,
                                "confirmed",
                              );
                              await onConfirmShareActionDone?.(split.id, s.id);
                              await load();
                              onSplitsChanged?.();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <CheckCircle2 size={15} aria-hidden="true" />
                          <span>{t("splitConfirmReceivedBtn")}</span>
                        </button>
                        <button
                          type="button"
                          className="secondary compact-btn"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await organizerUpdateShareStatus(
                                split.id,
                                s.id,
                                "accepted",
                              );
                              await load();
                              onSplitsChanged?.();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {t("splitRequestRetryBtn")}
                        </button>
                      </>
                    )}
                    {s.status === "pending" && mailto && (
                      <a className="secondary compact-btn" href={mailto}>
                        <Mail size={15} aria-hidden="true" />
                        <span>{t("sendSplitEmail")}</span>
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
