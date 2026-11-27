import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Eraser,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  maskSensitiveText,
  redactedExportFilename,
  renderRedactedImageBlob,
} from "./privacy-redact.js";
import { useLang } from "./lang.js";
import { createTranslator } from "./i18n.js";

function ImageRedactor({ doc, imageUrl, t }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const dragStartRef = useRef(null);
  const [imgReady, setImgReady] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const [draftBox, setDraftBox] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBoxes([]);
    setDraftBox(null);
    setImgReady(false);
  }, [doc.id, imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgReady) return;
    const width = img.clientWidth || img.naturalWidth;
    const height = img.clientHeight || img.naturalHeight;
    if (!width || !height) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#1e293b";
    for (const b of boxes) {
      ctx.fillRect(
        Math.round(b.x * width),
        Math.round(b.y * height),
        Math.round(b.w * width),
        Math.round(b.h * height),
      );
    }
    if (draftBox) {
      ctx.fillStyle = "rgba(30, 41, 59, 0.72)";
      ctx.strokeStyle = "#194fcf";
      ctx.lineWidth = 2;
      const rx = Math.round(draftBox.x * width);
      const ry = Math.round(draftBox.y * height);
      const rw = Math.round(draftBox.w * width);
      const rh = Math.round(draftBox.h * height);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }
  }, [boxes, draftBox, imgReady]);

  const normalizedPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const toRect = (a, b) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  });

  const handlePointerDown = (e) => {
    const pt = normalizedPoint(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStartRef.current = pt;
    setDraftBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const handlePointerMove = (e) => {
    if (!dragStartRef.current) return;
    const pt = normalizedPoint(e);
    if (!pt) return;
    setDraftBox(toRect(dragStartRef.current, pt));
  };

  const commitDraft = (e) => {
    if (!dragStartRef.current) return;
    const pt = normalizedPoint(e) || dragStartRef.current;
    const box = toRect(dragStartRef.current, pt);
    dragStartRef.current = null;
    setDraftBox(null);
    if (box.w >= 0.01 && box.h >= 0.008) {
      setBoxes((prev) => [...prev, box]);
    }
  };

  const handleDownload = async () => {
    if (!imgRef.current || busy) return;
    setBusy(true);
    try {
      const ext = doc.mime === "image/png" ? "png" : "jpg";
      const blob = await renderRedactedImageBlob(imgRef.current, boxes, doc.mime);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = redactedExportFilename(doc.name, ext);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="redact-body">
      <div className="redact-meta-row">
        <small>{t("redactImageHint")}</small>
        <span className="chip neutral-chip">
          {t("redactBoxCount", { count: boxes.length })}
        </span>
      </div>

      <div className="redact-stage">
        <img
          ref={imgRef}
          src={imageUrl}
          alt={t("originalCapturedAlt")}
          onLoad={() => setImgReady(true)}
        />
        <canvas
          ref={canvasRef}
          className="redact-canvas"
          aria-label={t("redactCanvasLabel")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commitDraft}
          onPointerCancel={() => {
            dragStartRef.current = null;
            setDraftBox(null);
          }}
        />
      </div>

      <div className="button-line">
        <button
          type="button"
          className="secondary compact-btn"
          disabled={!boxes.length}
          onClick={() => setBoxes((prev) => prev.slice(0, -1))}
        >
          <RotateCcw size={15} aria-hidden="true" />
          <span>{t("redactUndoBtn")}</span>
        </button>
        <button
          type="button"
          className="secondary compact-btn"
          disabled={!boxes.length}
          onClick={() => setBoxes([])}
        >
          <Eraser size={15} aria-hidden="true" />
          <span>{t("redactClearBtn")}</span>
        </button>
        <button
          type="button"
          className="primary compact-btn"
          disabled={!imgReady || busy}
          onClick={handleDownload}
        >
          <Download size={15} aria-hidden="true" />
          <span>{t("redactDownloadCopyBtn")}</span>
        </button>
      </div>
    </div>
  );
}

function TextRedactor({ doc, sourceText, t }) {
  const baseText = sourceText || doc.text || "";
  const [maskEmails, setMaskEmails] = useState(true);
  const [maskPhones, setMaskPhones] = useState(true);
  const [maskAccounts, setMaskAccounts] = useState(true);
  const [draft, setDraft] = useState(
    () =>
      maskSensitiveText(baseText, {
        emails: true,
        phones: true,
        accounts: true,
      }).text,
  );
  const [copied, setCopied] = useState(false);

  const applyMaskToggles = (nextEmails, nextPhones, nextAccounts) => {
    setDraft(
      maskSensitiveText(baseText, {
        emails: nextEmails,
        phones: nextPhones,
        accounts: nextAccounts,
      }).text,
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure in headless browsers
    }
  };

  const handleDownload = () => {
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = redactedExportFilename(doc.name, "txt");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="redact-body">
      <div className="redact-toggles">
        <label className="checkline">
          <input
            type="checkbox"
            checked={maskEmails}
            onChange={(e) => {
              const v = e.target.checked;
              setMaskEmails(v);
              applyMaskToggles(v, maskPhones, maskAccounts);
            }}
          />
          <span>{t("redactOptEmails")}</span>
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={maskPhones}
            onChange={(e) => {
              const v = e.target.checked;
              setMaskPhones(v);
              applyMaskToggles(maskEmails, v, maskAccounts);
            }}
          />
          <span>{t("redactOptPhones")}</span>
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={maskAccounts}
            onChange={(e) => {
              const v = e.target.checked;
              setMaskAccounts(v);
              applyMaskToggles(maskEmails, maskPhones, v);
            }}
          />
          <span>{t("redactOptAccounts")}</span>
        </label>
      </div>

      <label>
        {t("redactTextPreviewLabel")}
        <textarea
          rows="7"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>

      <div className="button-line">
        <button
          type="button"
          className="secondary compact-btn"
          onClick={handleCopy}
        >
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          <span>{copied ? t("copiedLabel") : t("redactCopyTextBtn")}</span>
        </button>
        <button
          type="button"
          className="primary compact-btn"
          onClick={handleDownload}
        >
          <Download size={15} aria-hidden="true" />
          <span>{t("redactDownloadTxtBtn")}</span>
        </button>
      </div>
    </div>
  );
}

export function RedactExportPanel({
  doc,
  imageUrl = "",
  sourceText = "",
  onClose,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const isImage = Boolean(doc.mime?.startsWith("image/") && imageUrl);

  return (
    <section className="redact-panel" aria-label={t("redactCopyHeading")}>
      <div className="followup-top">
        <span className="workflow-template-title">
          <ShieldCheck size={16} aria-hidden="true" />
          <strong>{t("redactCopyHeading")}</strong>
        </span>
        <button
          type="button"
          className="link-button compact-link"
          aria-label={t("close")}
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <small className="redact-safe-note">{t("redactOriginalSafeNote")}</small>
      {isImage ? (
        <ImageRedactor doc={doc} imageUrl={imageUrl} t={t} />
      ) : (
        <TextRedactor doc={doc} sourceText={sourceText} t={t} />
      )}
    </section>
  );
}
