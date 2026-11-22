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
  LibraryBig,
} from "lucide-react";
import {
  demoWorkspaceHref,
  LOCAL_RECEIPT_SOURCE,
  REDACTED_RECEIPT_SOURCE,
} from "./demo.js";
import { matchesQuery, categories, formatCalendarDate } from "./domain.js";
import { useLang } from "./lang.js";
import {
  createTranslator,
  formatDate,
  localeFor,
  translateCategory,
} from "./i18n.js";
export const pathFor = (d) => "/document/" + d.id;
export const date = (t, lang) => formatDate(t, lang);
export const pageLink = (p) => "#" + p;
export const navTo = (p) => {
  location.hash = p;
};
export function DocRow({ d }) {
  const lang = useLang();
  const t = createTranslator(lang);
  const Icon = d.mime?.startsWith("image/") ? ImageIcon : FileText;
  return (
    <a className="doc-row" href={pageLink(pathFor(d))}>
      <span className="file-icon">
        <Icon size={21} aria-hidden="true" />
      </span>
      <span className="grow">
        <strong>{d.title}</strong>
        <small>
          {translateCategory(d.category, lang)} <i>·</i>{" "}
          {d.source === REDACTED_RECEIPT_SOURCE
            ? t("sourceRedactedSample")
            : d.source === LOCAL_RECEIPT_SOURCE
              ? t("sourcePhotoSample")
              : d.sample
                ? t("sourceSyntheticSample")
                : date(d.created, lang)}
        </small>
      </span>
      <span
        className={"chip " + (d.status === "organized" ? "green" : "amber")}
      >
        {d.status === "organized"
          ? t("statusFiled")
          : d.status === "error"
            ? t("statusNeedsAttention")
            : t("statusReview")}
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </a>
  );
}
export function Empty({ icon: Icon = Files, title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={23} aria-hidden="true" />
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
export function Home({
  docs,
  actions,
  onSample,
  onCapture,
  onDrop,
  busy,
  demo = false,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const waiting = docs.filter((d) => d.status !== "organized").length,
    filed = docs.filter((d) => d.status === "organized").length,
    open = actions.filter((a) => !a.done).length;
  const heroSection = (
    <div className="hero-grid">
      <section
        className="capture-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <span className="hero-icon">
          <ScanLine size={26} aria-hidden="true" />
        </span>
        <div>
          <div className="overline">{t("documentIntake")}</div>
          <h2>{t("captureDocumentTitle")}</h2>
          <p>{t("captureDocumentSubtitle")}</p>
        </div>
        <div className="button-line">
          <button
            className="primary"
            disabled={busy}
            onClick={() => onCapture("file")}
          >
            <Upload aria-hidden="true" /> {t("uploadFile")}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => onCapture("camera")}
          >
            <Camera aria-hidden="true" /> {t("scan")}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => onCapture("text")}
          >
            <ClipboardPaste aria-hidden="true" /> {t("pasteText")}
          </button>
        </div>
        <small>{t("acceptedFilesShort")}</small>
      </section>
      <aside className="sample-card">
        <div className="card-top">
          <span className="overline">
            {demo ? t("liveAiOption") : t("sampleNotice")}
          </span>
          <span className="index-no">
            {demo ? t("optInIndex") : t("sampleIndex")}
          </span>
        </div>
        <img
          src="/renewal-icon.png"
          alt=""
          className="sample-art"
          width="128"
          height="128"
        />
        <div className="sample-bottom">
          <div>
            <strong>
              {demo ? t("tryFreshInput") : t("householdRenewal")}
            </strong>
            <small>
              {demo ? t("seededNoAi") : t("syntheticLocalRules")}
            </small>
          </div>
          {demo ? (
            <a href="#/capture" className="secondary sample-btn">
              {t("openCapture")} <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ) : (
            <button
              type="button"
              disabled={busy}
              className="secondary sample-btn"
              onClick={onSample}
            >
              {t("trySample")} <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
  const recentSection = (
    <section className="section">
      <div className="section-top">
        <div className="section-title">
          <span className="section-icon">
            <Files aria-hidden="true" />
          </span>
          <h2>{t("recentDocuments")}</h2>
        </div>
        <a href="#/library" className="text-link">
          {t("viewLibrary")} <ChevronRight size={15} aria-hidden="true" />
        </a>
      </div>
      <div className="list">
        {docs.length ? (
          docs.slice(0, 3).map((d) => <DocRow key={d.id} d={d} />)
        ) : (
          <Empty title={t("emptyFirstDocTitle")}>
            {t("emptyFirstDocBody")}
            {!demo && (
              <span className="empty-actions">
                <a className="secondary demo-cta" href={demoWorkspaceHref()}>
                  {t("exploreDemo")}{" "}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </span>
            )}
          </Empty>
        )}
      </div>
    </section>
  );
  const workspaceSection = (
    <section className="section" aria-label={t("workspaceOverview")}>
      <div className="section-top">
        <h2>{demo ? t("exploreThisWorkspace") : t("workspace")}</h2>
      </div>
      <div className="mini-grid">
        {[
          [
            Inbox,
            t("navInbox"),
            waiting,
            waiting ? t("readyForReview") : t("nothingToReview"),
            "inbox",
          ],
          [
            LibraryBig,
            t("navLibrary"),
            filed,
            filed ? t("filedDocuments") : t("noFiledDocuments"),
            "library",
          ],
          [
            CheckCheck,
            t("navActions"),
            open,
            open ? t("openFollowUps") : t("noOpenFollowUps"),
            "actions",
          ],
        ].map(([Icon, title, n, sub, path]) => (
          <a className="mini" key={path} href={"#/" + path}>
            <span className="soft-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="grow">
              <strong>{title}</strong>
              <small>{sub}</small>
            </span>
            <span className="number">{n}</span>
            <ChevronRight size={15} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
  return (
    <>
      <Heading
        kicker={demo ? t("sampleWorkspace") : t("personalWorkspace")}
        title={
          <>
            {t("homeTitlePrefix")}
            <span className="accent">.</span>
          </>
        }
        description={t("homeDescription")}
      />
      {docs.length > 0 ? (
        <>
          {workspaceSection}
          {recentSection}
          <section className="section" aria-label={t("documentCaptureSection")}>
            {heroSection}
          </section>
        </>
      ) : (
        <>
          {heroSection}
          {recentSection}
          {workspaceSection}
        </>
      )}
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
  const lang = useLang();
  const t = createTranslator(lang);
  const visible = docs.filter(
    (d) =>
      d.status === "organized" &&
      (!category || d.category === category) &&
      matchesQuery(d, query),
  );
  return (
    <>
      <Heading
        kicker={t("libraryKicker")}
        title={t("navLibrary")}
        description={t("libraryDescription")}
      />
      <div className="filterbar">
        <label className="searchbox">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label={t("searchDocumentsLabel")}
            placeholder={t("searchDocumentsPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label={t("filterByCategoryLabel")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {translateCategory(c, lang)}
            </option>
          ))}
        </select>
      </div>
      <div className="section-top">
        <h2>
          {query ? t("searchResultsHeading") : t("filedDocumentsHeading")}
        </h2>
        <small>{t("documentCount", { n: visible.length })}</small>
      </div>
      <div className="list">
        {visible.length ? (
          visible.map((d) => <DocRow d={d} key={d.id} />)
        ) : (
          <Empty
            icon={FolderOpen}
            title={
              query || category
                ? t("noMatchingDocuments")
                : t("libraryReady")
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
                {t("clearSearchFilters")}
              </button>
            ) : (
              <a href="#/capture">{t("captureFirstDocument")}</a>
            )}
          </Empty>
        )}
      </div>
    </>
  );
}
export function InboxPage({ docs }) {
  const lang = useLang();
  const t = createTranslator(lang);
  const pending = docs.filter((d) => d.status !== "organized");
  return (
    <>
      <Heading
        kicker={t("inboxKicker")}
        title={t("navInbox")}
        description={t("inboxDescription")}
      />
      <div className="list">
        {pending.length ? (
          pending.map((d) => <DocRow key={d.id} d={d} />)
        ) : (
          <Empty icon={CircleCheck} title={t("inboxCaughtUpTitle")}>
            {t("inboxCaughtUpBody")}
          </Empty>
        )}
      </div>
    </>
  );
}
export function Actions({ docs, actions, onToggle }) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);
  return (
    <>
      <Heading
        kicker={t("actionsKicker")}
        title={t("navActions")}
        description={t("actionsDescription")}
      />
      {!actions.length ? (
        <div className="list">
          <Empty icon={CheckCheck} title={t("noActionsTitle")}>
            {t("noActionsPrefix")}{" "}
            <a href="#/library">{t("navLibrary")}</a> {t("noActionsSuffix")}
          </Empty>
        </div>
      ) : (
        [false, true].map((done) => (
          <section key={String(done)} className="section">
            <h2>{done ? t("completedHeading") : t("openHeading")}</h2>
            <div className="list">
              {actions.filter((a) => a.done === done).length ? (
                actions
                  .filter((a) => a.done === done)
                  .map((a) => (
                    <div className="action-row" key={a.id}>
                      <label className="action-toggle">
                        <input
                          type="checkbox"
                          id={"action-" + a.id}
                          aria-label={
                            done
                              ? t("reopenAction", { title: a.title })
                              : t("completeAction", { title: a.title })
                          }
                          checked={a.done}
                          onChange={async () => {
                            if (await onToggle(a.id))
                              requestAnimationFrame(() =>
                                document
                                  .getElementById("action-" + a.id)
                                  ?.focus({ preventScroll: true }),
                              );
                          }}
                        />
                      </label>
                      <div>
                        <strong>{a.title}</strong>
                        <small>
                          {a.due
                            ? t("duePrefix", {
                                date: formatCalendarDate(a.due, locale),
                              }) + " · "
                            : ""}
                          <a href={"#/document/" + a.documentId}>
                            {docs.find((d) => d.id === a.documentId)?.title ||
                              t("openSource")}
                          </a>
                        </small>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="pad">
                  {done ? t("noCompletedActions") : t("noOpenActions")}
                </p>
              )}
            </div>
          </section>
        ))
      )}
    </>
  );
}
