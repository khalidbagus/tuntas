import React from "react";
import {
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  Files,
  ChevronRight,
  ScanLine,
  Inbox,
  CheckCheck,
  FolderOpen,
  Plus,
  ClipboardPaste,
  Camera,
  Upload,
  Search,
  CircleCheck,
  BookOpen,
} from "lucide-react";
import { ReceiptArt } from "./ReceiptArt.jsx";
export const pathFor = (d) => "/document/" + d.id;
export const date = (t) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(t));
export const pageLink = (p) => "#" + p;
export const navTo = (p) => {
  location.hash = p;
};
export function DocRow({ d }) {
  const Icon = d.mime?.startsWith("image/") ? ImageIcon : FileText;
  return (
    <a className="doc-row" href={pageLink(pathFor(d))}>
      <span className="file-icon">
        <Icon size={21} />
      </span>
      <span className="grow">
        <strong>{d.title}</strong>
        <small>
          {d.category} <i>·</i>{" "}
          {d.sample ? "Synthetic sample" : date(d.created)}
        </small>
      </span>
      <span
        className={"chip " + (d.status === "organized" ? "green" : "amber")}
      >
        {d.status === "organized"
          ? "Filed"
          : d.status === "error"
            ? "Needs attention"
            : "Review"}
      </span>
      <ChevronRight size={16} />
    </a>
  );
}
export function Empty({ icon: Icon = Files, title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={23} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
export function Heading({ kicker, title, description }) {
  return (
    <header className="heading">
      <div className="overline">
        <span className="blue-line" />
        {kicker}
      </div>
      <h1 tabIndex="-1">{title}</h1>
      <p>{description}</p>
    </header>
  );
}
export function Home({ docs, actions, onSample, onCapture, onDrop, busy }) {
  const waiting = docs.filter((d) => d.status !== "organized").length,
    open = actions.filter((a) => !a.done).length;
  return (
    <>
      <Heading
        kicker="Personal workspace"
        title={
          <>
            Life, sorted<span className="accent">.</span>
          </>
        }
        description="A home for your paperwork, from the first scan to the next step."
      />
      <div className="hero-grid">
        <section
          className="capture-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <span className="hero-icon">
            <ScanLine size={26} />
          </span>
          <div>
            <div className="overline">Document intake</div>
            <h2>Capture a document</h2>
            <p>Drop a file here, or choose how to add it.</p>
          </div>
          <div className="button-line">
            <button
              className="primary"
              disabled={busy}
              onClick={() => onCapture("file")}
            >
              <Upload /> Upload file
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onCapture("camera")}
            >
              <Camera /> Scan
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onCapture("text")}
            >
              <ClipboardPaste /> Paste text
            </button>
          </div>
          <small>
            PDF, JPEG or PNG <i>·</i> Up to 8 MB
          </small>
        </section>
        <aside className="sample-card">
          <div className="card-top">
            <span className="overline">Sample document</span>
            <span className="index-no">01 / 01</span>
          </div>
          <ReceiptArt />
          <div className="sample-bottom">
            <div>
              <strong>Fieldnote Supply</strong>
              <small>Synthetic receipt</small>
            </div>
            <button
              disabled={busy}
              className="small-round"
              aria-label="Try sample receipt"
              title="Try sample receipt"
              onClick={onSample}
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
        </aside>
      </div>
      <section className="section">
        <div className="section-top">
          <div className="section-title">
            <span className="section-icon">
              <Files />
            </span>
            <h2>Recent documents</h2>
          </div>
          <a href="#/library" className="text-link">
            View library <ChevronRight size={15} />
          </a>
        </div>
        <div className="list">
          {docs.length ? (
            docs.slice(0, 3).map((d) => <DocRow key={d.id} d={d} />)
          ) : (
            <Empty title="Your first document goes here.">
              Capture your own or try the sample receipt above.
            </Empty>
          )}
        </div>
      </section>
      <section className="section">
        <div className="section-top">
          <h2>Needs attention</h2>
        </div>
        <div className="mini-grid">
          {[
            [
              Inbox,
              "Inbox",
              waiting,
              waiting ? "Ready for your review" : "Nothing to review",
              "inbox",
            ],
            [
              CheckCheck,
              "Actions",
              open,
              open ? "Open follow-ups" : "No open follow-ups",
              "actions",
            ],
          ].map(([Icon, title, n, sub, path]) => (
            <a className="mini" key={path} href={"#/" + path}>
              <span className="soft-icon">
                <Icon size={20} />
              </span>
              <span className="grow">
                <strong>{title}</strong>
                <small>{sub}</small>
              </span>
              <span className="number">{n}</span>
              <ChevronRight size={15} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
export function Library({
  docs,
  query,
  setQuery,
  category,
  setCategory,
  inputRef,
}) {
  const visible = docs.filter(
    (d) =>
      d.status === "organized" &&
      (!category || d.category === category) &&
      matchesQuery(d, query),
  );
  return (
    <>
      <Heading
        kicker="Document archive"
        title="Library"
        description="Find a document by its title, category, or words inside."
      />
      <div className="filterbar">
        <label className="searchbox">
          <Search size={19} />
          <input
            ref={inputRef}
            aria-label="Search documents"
            placeholder="Search documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="section-top">
        <h2>{query ? "Search results" : "Filed documents"}</h2>
        <small>
          {visible.length} {visible.length === 1 ? "document" : "documents"}
        </small>
      </div>
      <div className="list">
        {visible.length ? (
          visible.map((d) => <DocRow d={d} key={d.id} />)
        ) : (
          <Empty
            icon={FolderOpen}
            title={
              query || category
                ? "No matching documents"
                : "Your library is ready."
            }
          >
            {query || category ? (
              <button
                className="link-button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                }}
              >
                Clear search and filters
              </button>
            ) : (
              <a href="#/capture">Capture your first document</a>
            )}
          </Empty>
        )}
      </div>
    </>
  );
}
import { matchesQuery, categories } from "./domain.js";
export function InboxPage({ docs }) {
  const pending = docs.filter((d) => d.status !== "organized");
  return (
    <>
      <Heading
        kicker="Review queue"
        title="Inbox"
        description="Only documents that need a decision land here."
      />
      <div className="list">
        {pending.length ? (
          pending.map((d) => <DocRow key={d.id} d={d} />)
        ) : (
          <Empty icon={CircleCheck} title="You’re all caught up.">
            Confident matches go straight to your Library.
          </Empty>
        )}
      </div>
    </>
  );
}
export function Actions({ docs, actions, onToggle }) {
  return (
    <>
      <Heading
        kicker="Follow-ups"
        title="Actions"
        description="Small next steps, each linked to its source document."
      />
      {!actions.length ? (
        <div className="list">
          <Empty icon={CheckCheck} title="No actions yet.">
            Open a document in your <a href="#/library">Library</a> to add a
            follow-up.
          </Empty>
        </div>
      ) : (
        [false, true].map((done) => (
          <section key={String(done)} className="section">
            <h2>{done ? "Completed" : "Open"}</h2>
            <div className="list">
              {actions.filter((a) => a.done === done).length ? (
                actions
                  .filter((a) => a.done === done)
                  .map((a) => (
                    <div className="action-row" key={a.id}>
                      <label className="action-toggle"><input
                        type="checkbox"
                        id={'action-'+a.id}
                        aria-label={(done ? "Reopen " : "Complete ") + a.title}
                        checked={a.done}
                        onChange={async () => {
                          if (await onToggle(a.id)) requestAnimationFrame(() => document.getElementById('action-'+a.id)?.focus({preventScroll:true}));
                        }}
                      /></label>
                      <div>
                        <strong>{a.title}</strong>
                        <small>
                          {a.due ? "Due " + a.due + " · " : ""}
                          <a href={"#/document/" + a.documentId}>
                            {docs.find((d) => d.id === a.documentId)?.title ||
                              "Open source"}
                          </a>
                        </small>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="pad">No {done ? "completed" : "open"} actions.</p>
              )}
            </div>
          </section>
        ))
      )}
    </>
  );
}
