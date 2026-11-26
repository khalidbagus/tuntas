import React, { useEffect, useId, useState, useRef } from "react";
import {
  Camera,
  Upload,
  ClipboardPaste,
  ShieldCheck,
  FileText,
  Download,
  ArrowLeft,
  RotateCcw,
  Plus,
  Monitor,
  Check,
  Trash2,
  AlertTriangle,
  Cpu,
  Cloud,
  Sparkles,
  GitBranch,
  ArrowRight,
} from "lucide-react";
import { Heading, date } from "./ui.jsx";
import { configured } from "./engine.js";
import { original } from "./db.js";
import { categories, formatCalendarDate } from "./domain.js";
import { supportsDeviceAI } from "./device-ai.js";
import {
  getCapturePrivacyStatus,
  getDocumentPrivacyMeta,
} from "./ai-privacy.js";
import { suggestWorkflowTemplate } from "./workflow-templates.js";
import {
  LOCAL_RECEIPT_SOURCE,
  REDACTED_RECEIPT_SOURCE,
} from "./demo.js";
import { useLang } from "./lang.js";
import {
  createTranslator,
  localeFor,
  translateCategory,
  translateMode,
  translateRuntimeMessage,
} from "./i18n.js";
const PRIVACY_ICONS = {
  shield: ShieldCheck,
  cpu: Cpu,
  cloud: Cloud,
  sparkles: Sparkles,
  alert: AlertTriangle,
  monitor: Monitor,
};

function PrivacyBadge({ tone, iconKey, label }) {
  const Icon = PRIVACY_ICONS[iconKey] || ShieldCheck;
  return (
    <span className={"chip privacy-badge is-" + tone}>
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function Mode({
  mode,
  setMode,
  consent,
  setConsent,
  payloadKind,
  file,
  mime,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const deviceSupported = supportsDeviceAI();
  const privacy = getCapturePrivacyStatus({
    mode,
    configured,
    deviceSupported,
    consent,
  });
  const payloadLabel =
    mime?.startsWith("image/") ||
    payloadKind === "camera" ||
    file?.type?.startsWith("image/")
      ? t("payloadImage")
      : payloadKind === "text" || mime === "text/plain"
        ? t("payloadText")
        : mime === "application/pdf" || file?.type === "application/pdf"
          ? t("payloadPdf")
          : t("payloadFallback");
  return (
    <div className="mode">
      <div className="privacy-strip">
        <PrivacyBadge
          tone={privacy.tone}
          iconKey={privacy.iconKey}
          label={t(privacy.badgeKey)}
        />
        <small className="privacy-strip-detail">{t(privacy.detailKey)}</small>
      </div>
      <label>
        {t("processingMethod")}
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setConsent(false);
          }}
        >
          <option value="rules">{t("modeRules")}</option>
          {configured && (
            <>
              <option value="device" disabled={!deviceSupported}>
                {t("modeDevice")}
              </option>
              <option value="hybrid">{t("modeHybrid")}</option>
            </>
          )}
        </select>
      </label>
      {mode === "hybrid" ? (
        <div>
          {!deviceSupported && (
            <small>{t("onDeviceUnavailableHint")}</small>
          )}
          <label className="checkline">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t("cloudConsentLabel", { payload: payloadLabel })}
          </label>
        </div>
      ) : (
        <small>
          {mode === "device"
            ? t("deviceOnlyHint")
            : configured
              ? t("rulesConnectedHint")
              : t("rulesDisconnectedHint")}
        </small>
      )}
    </div>
  );
}
export function Capture({
  kind,
  setKind,
  file,
  setFile,
  text,
  setText,
  run,
  modeProps,
  busy,
  ready,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const fileRef = useRef(null);
  return (
    <>
      <Heading
        kicker={t("documentIntake")}
        title={t("pageCapture")}
        description={t("captureDescription")}
      />
      <form
        className="form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div className="segments">
          {[
            ["file", Upload, t("uploadFile")],
            ["camera", Camera, t("scan")],
            ["text", ClipboardPaste, t("pasteText")],
          ].map(([k, I, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setFile(null);
              }}
            >
              <I size={17} aria-hidden="true" />
              {l}
            </button>
          ))}
        </div>
        {kind === "text" ? (
          <label>
            {t("documentTextLabel")}
            <textarea
              rows="7"
              maxLength={16000}
              placeholder={t("documentTextPlaceholder")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </label>
        ) : (
          <div
            className="file-area"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
            }}
          >
            <span className="hero-icon">
              {kind === "camera" ? (
                <Camera aria-hidden="true" />
              ) : (
                <Upload aria-hidden="true" />
              )}
            </span>
            <strong>
              {file?.name ||
                (kind === "camera"
                  ? t("capturePagePrompt")
                  : t("dropDocumentHere"))}
            </strong>
            <small>
              {kind === "camera" ? t("cameraSubtext") : t("fileSubtext")}
            </small>
            <input
              key={kind}
              ref={fileRef}
              aria-label={t("selectOriginalFile")}
              type="file"
              className="sr-only"
              tabIndex="-1"
              accept={
                kind === "camera"
                  ? "image/jpeg,image/png"
                  : "application/pdf,image/jpeg,image/png"
              }
              capture={kind === "camera" ? "environment" : undefined}
              onChange={(e) => {
                if (e.target.files?.[0]) setFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => fileRef.current?.click()}
            >
              {file
                ? t("chooseAnother")
                : kind === "camera"
                  ? t("openCameraOrPhotos")
                  : t("browseFiles")}
            </button>
          </div>
        )}
        <Mode {...modeProps} payloadKind={kind} file={file} />
        {modeProps.mode === "hybrid" && !modeProps.consent && (
          <small className="consent-hint">{t("consentHintCapture")}</small>
        )}
        <button
          className="primary"
          disabled={busy || !ready || (kind === "text" ? !text.trim() : !file)}
        >
          <Check size={17} aria-hidden="true" /> {t("saveAndOrganize")}
        </button>
        <small className="privacy">
          <Monitor size={15} aria-hidden="true" /> {t("privacyFootnote")}
        </small>
      </form>
    </>
  );
}
function Original({ doc, detailsRef, defaultOpen = false }) {
  const lang = useLang();
  const t = createTranslator(lang);
  const [url, setUrl] = useState(""),
    [source, setSource] = useState(""),
    [broken, setBroken] = useState(false),
    [missingOriginal, setMissingOriginal] = useState(false);
  useEffect(() => {
    if (defaultOpen && detailsRef?.current) detailsRef.current.open = true;
  }, [defaultOpen, detailsRef]);
  useEffect(() => {
    let active = true,
      objectURL;
    setBroken(false);
    setMissingOriginal(false);
    original(doc.id)
      .then(async (blob) => {
        if (!active) return;
        if (!blob) {
          setMissingOriginal(true);
          return;
        }
        objectURL = URL.createObjectURL(blob);
        setUrl(objectURL);
        if (doc.mime === "text/plain") {
          const t = await blob.text();
          if (active) setSource(t);
        }
      })
      .catch(() => {
        if (active) setMissingOriginal(true);
      });
    return () => {
      active = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [doc.id]);
  return (
    <details
      className="original"
      ref={detailsRef}
      open={defaultOpen || undefined}
    >
      <summary>{t("originalDocumentSummary")}</summary>
      {missingOriginal || doc.remoteOnly ? (
        <div className="note">{t("originalUnavailableOnDevice")}</div>
      ) : (
        <>
          <small>
            {doc.name} · {doc.mime} · {Math.max(1, Math.ceil(doc.size / 1024))}{" "}
            KB
          </small>
          {doc.mime === "text/plain" ? (
            <pre>{source}</pre>
          ) : doc.mime.startsWith("image/") && url && !broken ? (
            <img
              src={url}
              alt={t("originalCapturedAlt")}
              onError={() => setBroken(true)}
            />
          ) : doc.mime.startsWith("image/") && broken ? (
            <p>{t("imagePreviewUnavailable")}</p>
          ) : doc.text ? (
            <pre>{doc.text}</pre>
          ) : (
            <p>{t("downloadPdfFallback")}</p>
          )}
          {url && (
            <a className="text-link" download={doc.name} href={url}>
              <Download size={16} aria-hidden="true" />
              {t("downloadOriginal")}
            </a>
          )}
        </>
      )}
    </details>
  );
}
export function Detail({
  doc,
  actions = [],
  save,
  undo,
  remove,
  retry,
  add,
  dismissFollowUp,
  applyTemplate,
  dismissTemplate,
  modeProps,
  ready,
  busy,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);
  const [editing, setEditing] = useState(false),
    [adding, setAdding] = useState(false),
    [confirmingDelete, setConfirmingDelete] = useState(false),
    [deletingDoc, setDeletingDoc] = useState(false),
    [applyingTemplate, setApplyingTemplate] = useState(false),
    [title, setTitle] = useState(doc.title),
    [category, setCategory] = useState(doc.category),
    [tags, setTags] = useState(doc.tags.join(", ")),
    [facts, setFacts] = useState(doc.facts),
    [task, setTask] = useState(""),
    [due, setDue] = useState(""),
    [suggestionKey, setSuggestionKey] = useState(""),
    [suggestionQuote, setSuggestionQuote] = useState(""),
    [savingAction, setSavingAction] = useState(false);
  const originalRef = useRef(null),
    actionTitleRef = useRef(null),
    cancelDeleteRef = useRef(null),
    deleteTriggerRef = useRef(null),
    deleteHeadingId = useId();
  const filed = doc.status === "organized",
    failed = ["error", "pending", "processing"].includes(doc.status),
    suggestion = doc.followUp || null,
    confirmedAction = suggestion
      ? actions.find((a) => a.suggestionKey === suggestion.key)
      : null,
    showSuggestion = Boolean(suggestion && !doc.followUpDismissed),
    docPrivacy = getDocumentPrivacyMeta(doc.mode),
    workflowTemplate =
      filed && !doc.workflowTemplateDismissed
        ? suggestWorkflowTemplate(doc, lang)
        : null,
    templateAlreadyApplied = Boolean(
      workflowTemplate && doc.appliedTemplateIds?.includes(workflowTemplate.id),
    ),
    docAlreadyInGroup = actions.some((a) => Boolean(a.groupId)),
    showWorkflowTemplate = Boolean(
      workflowTemplate &&
        applyTemplate &&
        (templateAlreadyApplied || !docAlreadyInGroup),
    );
  useEffect(() => {
    setTitle(doc.title);
    setCategory(doc.category);
    setTags(doc.tags.join(", "));
    setFacts(doc.facts);
    if (doc.followUpDismissed && suggestionKey) {
      setAdding(false);
      setSuggestionKey("");
      setSuggestionQuote("");
    }
  }, [doc]);
  useEffect(() => {
    if (!adding) return;
    const frame = requestAnimationFrame(() => {
      const el = actionTitleRef.current;
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [adding, suggestionKey]);
  useEffect(() => {
    if (!confirmingDelete) return;
    const frame = requestAnimationFrame(() => {
      const el = cancelDeleteRef.current;
      if (!el) return;
      el.scrollIntoView({ block: "nearest" });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [confirmingDelete]);
  const openFollowUp = () => {
    if (!suggestion) return;
    setTask(suggestion.title);
    setDue(suggestion.due || "");
    setSuggestionKey(suggestion.key);
    setSuggestionQuote(suggestion.quote);
    setAdding(true);
  };
  const openManualAction = () => {
    if (adding && !suggestionKey) {
      setAdding(false);
      return;
    }
    setTask("");
    setDue("");
    setSuggestionKey("");
    setSuggestionQuote("");
    setAdding(true);
  };
  const compareWithOriginal = () => {
    if (!originalRef.current) return;
    originalRef.current.open = true;
    originalRef.current.scrollIntoView({ block: "nearest" });
  };
  return (
    <>
      <a className="back" href={filed ? "#/library" : "#/inbox"}>
        <ArrowLeft size={16} aria-hidden="true" />
        {filed ? t("navLibrary") : t("navInbox")}
      </a>
      <Heading
        kicker={
          doc.source === REDACTED_RECEIPT_SOURCE
            ? t("kickerRedactedSample")
            : doc.source === LOCAL_RECEIPT_SOURCE
              ? t("kickerPhotoSample")
              : doc.sample
                ? t("kickerSyntheticSample")
                : t("kickerDocumentRecord")
        }
        title={doc.title}
        description={t("addedDate", {
          name: doc.name,
          date: date(doc.created, lang),
        })}
      />
      <section className="form-panel detail">
        <div className="status-line">
          <span className={"chip " + (filed ? "green" : "amber")}>
            {filed
              ? t("statusFiledInLibrary")
              : failed
                ? t("statusNeedsAttention")
                : t("statusNeedsReview")}
          </span>
          {doc.remoteOnly && (
            <span className="chip blue">{t("remoteOnlyChip")}</span>
          )}
          <PrivacyBadge
            tone={docPrivacy.tone}
            iconKey={docPrivacy.iconKey}
            label={
              docPrivacy.labelKey
                ? t(docPrivacy.labelKey)
                : translateMode(docPrivacy.fallbackLabel, lang)
            }
          />
        </div>
        {!filed && (
          <div className="note">
            {doc.reason
              ? translateRuntimeMessage(doc.reason, lang)
              : failed
                ? t("interruptedFallback")
                : t("checkBeforeFiling")}
          </div>
        )}
        {failed && !busy && (
          <div className="retry">
            <Mode {...modeProps} mime={doc.mime} />
            {modeProps.mode === "hybrid" && !modeProps.consent && (
              <small className="consent-hint">{t("consentHintRetry")}</small>
            )}
            <button
              className="secondary"
              disabled={!ready}
              onClick={() => retry(doc)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {t("retryProcessing")}
            </button>
          </div>
        )}
        {editing || !filed ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save(doc, {
                  title: title.trim(),
                  category,
                  tags: [
                    ...new Set(
                      tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    ),
                  ].slice(0, 10),
                  facts: facts.filter((f) => f.value.trim()),
                  reviewed: true,
                  status: "organized",
                  autoFiled: false,
                  reason: "",
                  ...(failed ? { mode: "Manual filing" } : {}),
                })
              )
                setEditing(false);
            }}
          >
            <label>
              {t("documentTitleLabel")}
              <input
                value={title}
                maxLength={120}
                required
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {t("primaryCategoryLabel")}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {translateCategory(c, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("tagsLabel")} <small>{t("tagsOptional")}</small>
              <input
                value={tags}
                maxLength={200}
                onChange={(e) => setTags(e.target.value)}
              />
            </label>
            {facts.map((f, i) => (
              <label key={i}>
                {f.label}
                <input
                  value={f.value}
                  maxLength={160}
                  onChange={(e) =>
                    setFacts(
                      facts.map((v, j) =>
                        i === j
                          ? { ...v, value: e.target.value, edited: true }
                          : v,
                      ),
                    )
                  }
                />
                <small>{t("sourceExcerpt", { quote: f.quote })}</small>
              </label>
            ))}
            <div className="button-line">
              <button className="primary" disabled={busy || !title.trim()}>
                {failed
                  ? t("fileWithoutAi")
                  : filed
                    ? t("saveChanges")
                    : t("confirmAndFile")}
              </button>
              {filed && (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setTitle(doc.title);
                    setCategory(doc.category);
                    setFacts(doc.facts);
                    setTags(doc.tags.join(", "));
                    setEditing(false);
                  }}
                >
                  {t("cancel")}
                </button>
              )}
            </div>
          </form>
        ) : (
          <>
            <div className="section-top">
              <h2>{t("filingDetails")}</h2>
              <button
                type="button"
                className="link-button"
                onClick={() => setEditing(true)}
              >
                {t("editDetails")}
              </button>
            </div>
            <dl>
              <dt>{t("categoryLabel")}</dt>
              <dd>{translateCategory(doc.category, lang)}</dd>
              {doc.tags.length > 0 && (
                <>
                  <dt>{t("tagsLabel")}</dt>
                  <dd>{doc.tags.join(" · ")}</dd>
                </>
              )}
              {doc.facts.map((f, i) => (
                <React.Fragment key={i}>
                  <dt>
                    {f.label}
                    {f.edited ? t("editedSuffix") : ""}
                  </dt>
                  <dd>
                    {f.value}
                    <small>{t("sourcePrefix", { quote: f.quote })}</small>
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </>
        )}
        {doc.proposal && (
          <details>
            <summary>{t("filingEvidence")}</summary>
            <p>
              {t("proposedSentenceStart", {
                mode: translateMode(doc.proposal.mode, lang),
              })}
              <b>{translateCategory(doc.proposal.category, lang)}</b>
              {doc.proposal.evidence
                ? t("proposedBasedOn", { evidence: doc.proposal.evidence })
                : "."}
            </p>
            {doc.reviewed && <small>{t("currentFilingConfirmed")}</small>}
          </details>
        )}
        {showSuggestion && (
          <section className="followup-card" aria-label={t("suggestedFollowUp")}>
            <div className="followup-top">
              <strong>{t("suggestedFollowUp")}</strong>
              <div className="button-line">
                <span
                  className={
                    "chip " + (suggestion.visualReview ? "amber" : "blue")
                  }
                >
                  {suggestion.visualReview
                    ? t("modelReadChip")
                    : t("sourceExcerptChip")}
                </span>
                {confirmedAction && (
                  <span className="chip green">{t("savedInActions")}</span>
                )}
              </div>
            </div>
            <blockquote className="followup-quote">
              “{suggestion.quote}”
            </blockquote>
            <small>
              {confirmedAction
                ? t("confirmedActionSummary", {
                    title: confirmedAction.title,
                    due: confirmedAction.due
                      ? formatCalendarDate(confirmedAction.due, locale)
                      : "",
                  })
                : suggestion.visualReview
                  ? t("draftVisualReview", {
                      title: suggestion.title,
                      due: suggestion.due
                        ? formatCalendarDate(suggestion.due, locale)
                        : "",
                    })
                  : suggestion.due
                    ? t("draftWithDue", {
                        title: suggestion.title,
                        due: formatCalendarDate(suggestion.due, locale),
                      })
                    : t("draftWithoutDue", { title: suggestion.title })}
            </small>
            <div className="button-line">
              {confirmedAction ? (
                <a className="text-link" href="#/actions">
                  {t("openInActions")}
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    className={filed && !adding ? "primary" : "secondary"}
                    disabled={busy || savingAction}
                    onClick={openFollowUp}
                  >
                    <Plus size={17} aria-hidden="true" />
                    {t("addFollowUp")}
                  </button>
                  {suggestion.visualReview && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={compareWithOriginal}
                    >
                      {t("compareWithOriginal")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy || savingAction}
                    onClick={() => {
                      setAdding(false);
                      setSuggestionKey("");
                      setSuggestionQuote("");
                      dismissFollowUp(doc);
                    }}
                  >
                    {t("dismiss")}
                  </button>
                </>
              )}
            </div>
          </section>
        )}
        {showWorkflowTemplate && (
          <section
            className="workflow-template-card"
            aria-label={t("workflowTemplateHeading")}
          >
            <div className="followup-top">
              <span className="workflow-template-title">
                <GitBranch size={16} aria-hidden="true" />
                <strong>{t("workflowTemplateHeading")}</strong>
              </span>
              <div className="button-line">
                <span className="chip blue">
                  {t("workflowTemplateStepCount", {
                    count: workflowTemplate.steps.length,
                  })}
                </span>
                {templateAlreadyApplied && (
                  <span className="chip green">
                    {t("workflowTemplateAppliedChip")}
                  </span>
                )}
              </div>
            </div>
            <small>{workflowTemplate.label}</small>
            <ol className="workflow-step-preview">
              {workflowTemplate.steps.map((step, idx) => (
                <li key={step.key} className="workflow-step-item">
                  <span className="workflow-step-num">{idx + 1}</span>
                  <span className="workflow-step-text">
                    <span>{step.title}</span>
                    {step.due && (
                      <small>
                        {t("duePrefix", {
                          date: formatCalendarDate(step.due, locale),
                        })}
                      </small>
                    )}
                  </span>
                  {idx < workflowTemplate.steps.length - 1 && (
                    <ArrowRight
                      size={14}
                      className="workflow-step-arrow"
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ol>
            <div className="button-line">
              {templateAlreadyApplied ? (
                <a className="text-link" href="#/actions">
                  {t("openInActions")}
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || applyingTemplate}
                    onClick={async () => {
                      if (applyingTemplate) return;
                      setApplyingTemplate(true);
                      try {
                        await applyTemplate(doc, workflowTemplate);
                      } finally {
                        setApplyingTemplate(false);
                      }
                    }}
                  >
                    <GitBranch size={16} aria-hidden="true" />
                    <span>
                      {applyingTemplate
                        ? t("creatingWorkflow")
                        : t("createWorkflowButton", {
                            count: workflowTemplate.steps.length,
                          })}
                    </span>
                  </button>
                  {dismissTemplate && (
                    <button
                      type="button"
                      className="link-button"
                      disabled={busy || applyingTemplate}
                      onClick={() => dismissTemplate(doc)}
                    >
                      {t("dismiss")}
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        )}
        <Original
          doc={doc}
          detailsRef={originalRef}
          defaultOpen={Boolean(
            suggestion?.visualReview && !confirmedAction && !doc.followUpDismissed,
          )}
        />
        {filed && (
          <div className="button-line detail-actions-row">
            <button
              type="button"
              className="secondary"
              disabled={deletingDoc}
              onClick={() => {
                setConfirmingDelete(false);
                openManualAction();
              }}
            >
              <Plus size={17} aria-hidden="true" />
              {t("addAnAction")}
            </button>
            {doc.autoFiled && (
              <button
                type="button"
                className="link-button"
                disabled={deletingDoc}
                onClick={() => undo(doc)}
              >
                {t("undoFiling")}
              </button>
            )}
            {remove && (
              <button
                ref={deleteTriggerRef}
                type="button"
                className="link-button danger-link detail-delete-trigger"
                disabled={busy || deletingDoc}
                aria-expanded={confirmingDelete}
                onClick={() => {
                  setAdding(false);
                  setConfirmingDelete((v) => !v);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                {t("deleteDocument")}
              </button>
            )}
          </div>
        )}
        {filed && confirmingDelete && remove && (
          <section
            className="delete-confirm"
            role="region"
            aria-labelledby={deleteHeadingId}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !deletingDoc) {
                e.stopPropagation();
                setConfirmingDelete(false);
                requestAnimationFrame(() =>
                  deleteTriggerRef.current?.focus({ preventScroll: true }),
                );
              }
            }}
          >
            <div className="delete-confirm-copy">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong id={deleteHeadingId}>
                  {t("deleteDocumentConfirmHeading", { title: doc.title })}
                </strong>
                <p>
                  {actions.length > 0
                    ? t("deleteDocumentConfirmWithActions", {
                        count: actions.length,
                      })
                    : t("deleteDocumentConfirmBody")}
                </p>
              </div>
            </div>
            <div className="button-line">
              <button
                ref={cancelDeleteRef}
                type="button"
                className="secondary"
                disabled={deletingDoc}
                onClick={() => {
                  setConfirmingDelete(false);
                  requestAnimationFrame(() =>
                    deleteTriggerRef.current?.focus({ preventScroll: true }),
                  );
                }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={busy || deletingDoc}
                onClick={async () => {
                  if (deletingDoc) return;
                  setDeletingDoc(true);
                  const ok = await remove(doc);
                  if (!ok) {
                    setDeletingDoc(false);
                  }
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                {deletingDoc
                  ? t("deletingDocument")
                  : t("confirmDeleteDocument")}
              </button>
            </div>
          </section>
        )}
        {adding && (filed || showSuggestion) && (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (savingAction) return;
              setSavingAction(true);
              try {
                if (
                  await add(doc.id, task, due, {
                    suggestionKey,
                    quote: suggestionQuote,
                  })
                ) {
                  setAdding(false);
                  setTask("");
                  setDue("");
                  setSuggestionKey("");
                  setSuggestionQuote("");
                }
              } finally {
                setSavingAction(false);
              }
            }}
          >
            <label>
              {t("actionTitleLabel")}
              <input
                ref={actionTitleRef}
                required
                maxLength={140}
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
            </label>
            <label>
              {t("dueDateLabel")} <small>{t("optionalParen")}</small>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <div className="button-line">
              <button
                className="primary"
                disabled={busy || savingAction || !task.trim()}
              >
                {t("createAction")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={savingAction}
                onClick={() => {
                  setAdding(false);
                  setSuggestionKey("");
                  setSuggestionQuote("");
                }}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
