import React, { useEffect, useState, useRef } from "react";
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
} from "lucide-react";
import { Heading, date } from "./ui.jsx";
import { configured } from "./engine.js";
import { original } from "./db.js";
import { categories } from "./domain.js";
import { supportsDeviceAI } from "./device-ai.js";
export function Mode({ mode, setMode, consent, setConsent }) {
  return (
    <div className="mode">
      <label>
        Processing method
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setConsent(false);
          }}
        >
          <option value="rules">Local filing rules · no AI</option>
          {configured && (
            <>
              <option value="device" disabled={!supportsDeviceAI()}>
                Firebase AI · device only
              </option>
              <option value="hybrid">
                Firebase AI · prefer device, allow cloud
              </option>
            </>
          )}
        </select>
      </label>
      {mode === "hybrid" ? (
        <div>
          {!supportsDeviceAI() && (
            <small>
              On-device AI is unavailable in this browser. Cloud analysis
              requires your permission.
            </small>
          )}
          <label className="checkline">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            For this document, allow Firebase to send the extracted text or
            image to Google’s cloud model if needed.
          </label>
        </div>
      ) : (
        <small>
          {mode === "device"
            ? "Requires a supported Chrome device. A model download may be needed. No document is sent to the cloud."
            : configured
              ? "Uses simple text matches in this browser. No AI request."
              : "Firebase AI is not connected. Text-based filing rules run in this browser."}
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
  const fileRef = useRef(null);
  return (
    <>
      <Heading
        kicker="Document intake"
        title="Capture"
        description="Bring the original. Tuntas will help with the filing."
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
            ["file", Upload, "Upload file"],
            ["camera", Camera, "Scan"],
            ["text", ClipboardPaste, "Paste text"],
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
              <I size={17} />
              {l}
            </button>
          ))}
        </div>
        {kind === "text" ? (
          <label>
            Document text
            <textarea
              rows="7"
              maxLength={16000}
              placeholder="Paste a receipt, bill or note…"
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
              {kind === "camera" ? <Camera /> : <Upload />}
            </span>
            <strong>
              {file?.name ||
                (kind === "camera"
                  ? "Capture a page"
                  : "Drop your document here")}
            </strong>
            <small>
              {kind === "camera"
                ? "Use the camera on supported devices, or choose a photo."
                : "PDF, JPEG or PNG · 8 MB maximum"}
            </small>
            <input
              key={kind}
              ref={fileRef}
              aria-label="Select original file"
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
                ? "Choose another"
                : kind === "camera"
                  ? "Open camera or photos"
                  : "Browse files"}
            </button>
          </div>
        )}
        <Mode {...modeProps} />
        <button
          className="primary"
          disabled={busy || !ready || (kind === "text" ? !text.trim() : !file)}
        >
          <Check size={17} /> Save & organize
        </button>
        <small className="privacy">
          <Monitor size={15} /> Original stays in this browser profile.
        </small>
      </form>
    </>
  );
}
function Original({ doc }) {
  const [url, setUrl] = useState(""),
    [source, setSource] = useState(""),
    [broken, setBroken] = useState(false);
  useEffect(() => {
    let active = true,
      objectURL;
    setBroken(false);
    original(doc.id)
      .then(async (blob) => {
        if (!blob || !active) return;
        objectURL = URL.createObjectURL(blob);
        setUrl(objectURL);
        if (doc.mime === "text/plain") {
          const t = await blob.text();
          if (active) setSource(t);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [doc.id]);
  return (
    <details className="original">
      <summary>Original document</summary>
      <small>
        {doc.name} · {doc.mime} · {Math.max(1, Math.ceil(doc.size / 1024))} KB
      </small>
      {doc.mime === "text/plain" ? (
        <pre>{source}</pre>
      ) : doc.mime.startsWith("image/") && url && !broken ? (
        <img
          src={url}
          alt="Original captured document"
          onError={() => setBroken(true)}
        />
      ) : doc.mime.startsWith("image/") && broken ? (
        <p>
          Image preview is unavailable. Download the original file to inspect
          it.
        </p>
      ) : doc.text ? (
        <pre>{doc.text}</pre>
      ) : (
        <p>Download the original PDF to inspect it.</p>
      )}
      {url && (
        <a className="text-link" download={doc.name} href={url}>
          <Download size={16} />
          Download original
        </a>
      )}
    </details>
  );
}
export function Detail({
  doc,
  save,
  undo,
  retry,
  add,
  modeProps,
  ready,
  busy,
}) {
  const [editing, setEditing] = useState(false),
    [adding, setAdding] = useState(false),
    [title, setTitle] = useState(doc.title),
    [category, setCategory] = useState(doc.category),
    [tags, setTags] = useState(doc.tags.join(", ")),
    [facts, setFacts] = useState(doc.facts),
    [task, setTask] = useState(""),
    [due, setDue] = useState("");
  const filed = doc.status === "organized",
    failed = ["error", "pending", "processing"].includes(doc.status);
  useEffect(() => {
    setTitle(doc.title);
    setCategory(doc.category);
    setTags(doc.tags.join(", "));
    setFacts(doc.facts);
  }, [doc]);
  return (
    <>
      <a className="back" href={filed ? "#/library" : "#/inbox"}>
        <ArrowLeft size={16} />
        {filed ? "Library" : "Inbox"}
      </a>
      <Heading
        kicker={doc.sample ? "Synthetic sample · Document" : "Document record"}
        title={doc.title}
        description={doc.name + " · Added " + date(doc.created)}
      />
      <section className="form-panel detail">
        <div className="status-line">
          <span className={"chip " + (filed ? "green" : "amber")}>
            {filed
              ? "Filed in Library"
              : failed
                ? "Needs attention"
                : "Needs review"}
          </span>
          <small>{doc.mode}</small>
        </div>
        {!filed && (
          <div className="note">
            {doc.reason ||
              (failed
                ? "Processing was interrupted. Retry or file the original manually."
                : "Check the details before filing.")}
          </div>
        )}
        {failed && !busy && (
          <div className="retry">
            <Mode {...modeProps} />
            <button
              className="secondary"
              disabled={!ready}
              onClick={() => retry(doc)}
            >
              <RotateCcw size={16} />
              Retry processing
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
              Document title
              <input
                value={title}
                maxLength={120}
                required
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Primary category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Tags <small>(optional, comma separated)</small>
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
                <small>Source excerpt: {f.quote}</small>
              </label>
            ))}
            <div className="button-line">
              <button className="primary" disabled={busy || !title.trim()}>
                {failed
                  ? "File without AI"
                  : filed
                    ? "Save changes"
                    : "Confirm & file"}
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
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <>
            <div className="section-top">
              <h2>Filing details</h2>
              <button className="link-button" onClick={() => setEditing(true)}>
                Edit details
              </button>
            </div>
            <dl>
              <dt>Category</dt>
              <dd>{doc.category}</dd>
              {doc.tags.length > 0 && (
                <>
                  <dt>Tags</dt>
                  <dd>{doc.tags.join(" · ")}</dd>
                </>
              )}
              {doc.facts.map((f, i) => (
                <React.Fragment key={i}>
                  <dt>
                    {f.label}
                    {f.edited ? " · edited" : ""}
                  </dt>
                  <dd>
                    {f.value}
                    <small>Source: {f.quote}</small>
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </>
        )}
        {doc.proposal && (
          <details>
            <summary>Filing evidence</summary>
            <p>
              {doc.proposal.mode} proposed <b>{doc.proposal.category}</b>
              {doc.proposal.evidence
                ? " based on “" + doc.proposal.evidence + "”."
                : "."}
            </p>
            {doc.reviewed && <small>Current filing confirmed by you.</small>}
          </details>
        )}
        <Original doc={doc} />
        {filed && (
          <div className="button-line">
            <button className="secondary" onClick={() => setAdding(!adding)}>
              <Plus size={17} />
              Add an action
            </button>
            {doc.autoFiled && (
              <button className="link-button" onClick={() => undo(doc)}>
                Undo filing
              </button>
            )}
          </div>
        )}
        {adding && filed && (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await add(doc.id, task, due)) {
                setAdding(false);
                setTask("");
                setDue("");
              }
            }}
          >
            <label>
              Action title
              <input
                autoFocus
                required
                maxLength={140}
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
            </label>
            <label>
              Due date <small>(optional)</small>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <button className="primary" disabled={!task.trim()}>
              Create action
            </button>
          </form>
        )}
      </section>
    </>
  );
}
