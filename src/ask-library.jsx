import React, { useState } from "react";
import {
  ChevronRight,
  Cpu,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  answerPaperworkLocally,
  buildRagPrompt,
  retrieveRelevantDocs,
} from "./rag-local.js";
import { configured } from "./engine.js";
import { supportsDeviceAI } from "./device-ai.js";
import { useLang } from "./lang.js";
import { createTranslator } from "./i18n.js";

export function AskPaperworkPanel({ docs = [], actions = [], online = true }) {
  const lang = useLang();
  const t = createTranslator(lang);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("local");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const deviceSupported = supportsDeviceAI();

  const runQuestion = async (rawQ = question) => {
    const clean = rawQ.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const localAnswer = answerPaperworkLocally(docs, actions, clean, lang);
      if (mode === "local" || !configured || (mode === "hybrid" && (!consent || !online))) {
        setResult(localAnswer);
        return;
      }
      const matches = retrieveRelevantDocs(docs, actions, clean, { limit: 4 });
      if (!matches.length) {
        setResult(localAnswer);
        return;
      }
      try {
        const aiMod = await import("./firebase-ai.js");
        const qa = aiMod.preparePaperworkQA({
          allowCloud: mode === "hybrid" && consent && online,
        });
        const aiRes = await qa({
          promptText: buildRagPrompt(clean, matches, lang),
          validDocIds: matches.map((m) => m.doc.id),
        });
        const byId = new Map(matches.map((m) => [m.doc.id, m]));
        const citations = (
          aiRes.citationIds.length
            ? aiRes.citationIds
            : matches.slice(0, 2).map((m) => m.doc.id)
        )
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((m) => ({
            docId: m.doc.id,
            title: m.doc.title,
            excerpt: m.excerpt,
          }));
        setResult({
          answer: aiRes.answer || localAnswer.answer,
          citations,
          mode: aiRes.mode,
        });
      } catch {
        setResult(localAnswer);
      }
    } finally {
      setBusy(false);
    }
  };

  const quickPrompts = [t("askSamplePromptSpending"), t("askSamplePromptRenewal")];

  return (
    <section className="ask-card" aria-label={t("askPaperworkHeading")}>
      <div className="ask-head">
        <div className="workflow-template-title">
          <Sparkles size={17} aria-hidden="true" />
          <h2>{t("askPaperworkHeading")}</h2>
        </div>
        <span className="chip privacy-badge is-green">
          {mode === "local" ? (
            <ShieldCheck size={12} aria-hidden="true" />
          ) : (
            <Cpu size={12} aria-hidden="true" />
          )}
          <span>
            {mode === "local"
              ? t("askBadgeLocal")
              : mode === "device"
                ? t("privacyBadgeOnDevice")
                : t("privacyBadgeHybridPreferDevice")}
          </span>
        </span>
      </div>
      <small>{t("askPaperworkSubtitle")}</small>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          runQuestion();
        }}
      >
        <input
          aria-label={t("askInputLabel")}
          placeholder={t("askInputPlaceholder")}
          value={question}
          maxLength={240}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          className="primary compact-btn"
          disabled={busy || !question.trim()}
        >
          <Search size={15} aria-hidden="true" />
          <span>{busy ? t("askSearching") : t("askSubmitBtn")}</span>
        </button>
      </form>

      <div className="ask-prompts">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="filter-pill ask-prompt-pill"
            onClick={() => {
              setQuestion(prompt);
              runQuestion(prompt);
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {configured && (
        <div className="ask-mode-row">
          <label>
            <span className="sr-only">{t("processingMethod")}</span>
            <select
              aria-label={t("processingMethod")}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setConsent(false);
              }}
            >
              <option value="local">{t("askModeLocal")}</option>
              <option value="device" disabled={!deviceSupported}>
                {t("modeDevice")}
              </option>
              <option value="hybrid">{t("modeHybrid")}</option>
            </select>
          </label>
          {mode === "hybrid" && (
            <label className="checkline">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>{t("askCloudConsentLabel")}</span>
            </label>
          )}
        </div>
      )}

      {result && (
        <div className="ask-answer-box" role="region" aria-label={t("askAnswerRegion")}>
          <div className="followup-top">
            <strong>{t("askAnswerHeading")}</strong>
            <span className="chip neutral-chip">{result.mode}</span>
          </div>
          <p>{result.answer}</p>
          {result.citations?.length > 0 && (
            <div className="ask-citations">
              <small className="subpanel-label">{t("askCitationsHeading")}</small>
              <div className="ask-citation-list">
                {result.citations.map((c) => (
                  <a
                    key={c.docId}
                    className="ask-citation-link"
                    href={`#/document/${c.docId}`}
                  >
                    <FileText size={14} aria-hidden="true" />
                    <span>
                      <strong>{c.title}</strong>
                      <small>{c.excerpt}</small>
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
