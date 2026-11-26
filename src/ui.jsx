import React, { useState } from "react";
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
  ClipboardPaste,
  Camera,
  Upload,
  Search,
  CircleCheck,
  LibraryBig,
  ReceiptText,
  House,
  Briefcase,
  ShoppingBag,
  IdCard,
  Folder,
  AlertTriangle,
  Clock,
  CalendarClock,
  Calendar,
  CalendarOff,
  Target,
  X,
} from "lucide-react";
import {
  demoWorkspaceHref,
  LOCAL_RECEIPT_SOURCE,
  REDACTED_RECEIPT_SOURCE,
} from "./demo.js";
import { matchesQuery, formatCalendarDate } from "./domain.js";
import {
  isValidIsoDate,
  selectTodaysFocus,
  toLocalIsoDate,
} from "./actions-domain.js";
import { useLang } from "./lang.js";
import { AskPaperworkPanel } from "./ask-library.jsx";
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

export const CATEGORY_TILES = [
  {
    id: "",
    img: "/categories/category-all.png",
    Icon: Files,
    labelKey: "allDocuments",
  },
  {
    id: "Money & Bills",
    img: "/categories/category-money-bills.png",
    Icon: ReceiptText,
  },
  {
    id: "Home & Living",
    img: "/categories/category-home-living.png",
    Icon: House,
  },
  {
    id: "Work & Study",
    img: "/categories/category-work-study.png",
    Icon: Briefcase,
  },
  {
    id: "Purchases",
    img: "/categories/category-purchases.png",
    Icon: ShoppingBag,
  },
  {
    id: "Personal Records",
    img: "/categories/category-personal-records.png",
    Icon: IdCard,
  },
  {
    id: "Other",
    img: "/categories/category-other.png",
    Icon: Folder,
  },
];

function CategoryArt({ src, Icon }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="category-art-fallback" aria-hidden="true">
        <Icon size={21} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="category-art"
      width="42"
      height="42"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

const URGENCY_CONFIG = {
  overdue: { Icon: AlertTriangle, className: "overdue", labelKey: "urgencyOverdue" },
  due_today: { Icon: Clock, className: "due-today", labelKey: "urgencyDueToday" },
  due_soon: {
    Icon: CalendarClock,
    className: "due-soon",
    labelKey: "urgencyDueSoon",
  },
  upcoming: { Icon: Calendar, className: "upcoming", labelKey: "urgencyUpcoming" },
  no_due_date: {
    Icon: CalendarOff,
    className: "no-date",
    labelKey: "urgencyNoDueDate",
  },
  completed: {
    Icon: CircleCheck,
    className: "completed",
    labelKey: "urgencyCompleted",
  },
};

export function UrgencyBadge({ urgency }) {
  const lang = useLang();
  const t = createTranslator(lang);
  const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.no_due_date;
  const Icon = cfg.Icon;
  return (
    <span className={"chip urgency-badge " + cfg.className}>
      <Icon size={12} aria-hidden="true" />
      <span>{t(cfg.labelKey)}</span>
    </span>
  );
}

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

export function Heading({ kicker, title, description, actions = null }) {
  return (
    <header className="heading">
      <div className="overline">
        <span className="blue-line" />
        {kicker}
      </div>
      {actions ? (
        <div className="home-head-row">
          <div>
            <h1 tabIndex="-1">{title}</h1>
            <p>{description}</p>
          </div>
          {actions}
        </div>
      ) : (
        <>
          <h1 tabIndex="-1">{title}</h1>
          <p>{description}</p>
        </>
      )}
    </header>
  );
}

export function Home({
  docs,
  actions,
  groups = [],
  dependencies = [],
  todayIso = toLocalIsoDate(),
  onSample,
  onCapture,
  onDrop,
  busy,
  demo = false,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);
  const waiting = docs.filter((d) => d.status !== "organized").length,
    filed = docs.filter((d) => d.status === "organized").length,
    open = actions.filter((a) => !a.done).length;
  const focus = selectTodaysFocus(actions, groups, dependencies, todayIso);
  const focusSourceDoc =
    focus.kind === "action"
      ? docs.find((d) => d.id === focus.action.documentId)
      : null;

  const focusWhyText = () => {
    if (focus.kind !== "action") return "";
    if (focus.urgency === "overdue") return t("todaysFocusWhyOverdue");
    if (focus.urgency === "due_today") return t("todaysFocusWhyDueToday");
    if (focus.urgency === "due_soon") {
      return t("todaysFocusWhyDueSoon", { days: focus.daysDelta });
    }
    if (focus.urgency === "upcoming") return t("todaysFocusWhyUpcoming");
    return t("todaysFocusWhyNoDate");
  };

  const focusSection = (
    <section className="section" aria-label={t("todaysFocusHeading")}>
      <div className="section-top">
        <div className="section-title">
          <span className="section-icon">
            <Target aria-hidden="true" />
          </span>
          <h2>{t("todaysFocusHeading")}</h2>
        </div>
        <a href="#/actions" className="text-link">
          {t("navActions")} <ChevronRight size={15} aria-hidden="true" />
        </a>
      </div>

      {focus.kind === "action" ? (
        <div className="focus-card">
          <div className="focus-top-meta">
            <span className="overline">{t("todaysFocusReadyLabel")}</span>
            <div className="button-line">
              <UrgencyBadge urgency={focus.urgency} />
              {focus.group && (
                <span className="chip blue">
                  {t("todaysFocusGroupContext", { group: focus.group.title })}
                </span>
              )}
            </div>
          </div>
          <div className="focus-body">
            <strong>{focus.action.title}</strong>
            <p className="focus-why">{focusWhyText()}</p>
            {isValidIsoDate(focus.action.due) && (
              <small>
                {t("duePrefix", {
                  date: formatCalendarDate(focus.action.due, locale),
                })}
              </small>
            )}
          </div>
          <div className="button-line">
            <a
              className="primary focus-primary"
              href={"#/actions/" + focus.action.id}
            >
              {t("todaysFocusOpenAction")}
            </a>
            <a
              className="secondary focus-secondary"
              href={"#/document/" + focus.action.documentId}
            >
              {focusSourceDoc?.title || t("todaysFocusOpenDocument")}
            </a>
          </div>
        </div>
      ) : focus.kind === "waiting" ? (
        <div className="focus-card is-muted">
          <strong>{t("todaysFocusWaitingTitle")}</strong>
          <p className="focus-why">
            {t("todaysFocusWaitingBody", {
              count: focus.waitingCount,
              group: focus.group?.title || "",
            })}
          </p>
          <div className="button-line">
            <a className="secondary focus-secondary" href="#/actions">
              {t("todaysFocusGoActions")}
            </a>
          </div>
        </div>
      ) : focus.kind === "all_done" ? (
        <div className="focus-card is-muted">
          <strong>{t("todaysFocusAllDoneTitle")}</strong>
          <p className="focus-why">
            {t("todaysFocusAllDoneBody", { count: focus.completedCount })}
          </p>
          <div className="button-line">
            <a className="secondary focus-secondary" href="#/actions">
              {t("navActions")}
            </a>
          </div>
        </div>
      ) : (
        <div className="focus-card is-muted">
          <strong>{t("todaysFocusEmptyTitle")}</strong>
          <p className="focus-why">{t("todaysFocusEmptyBody")}</p>
        </div>
      )}
    </section>
  );

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
        actions={
          !demo ? (
            <a
              className="secondary demo-cta"
              href={demoWorkspaceHref(
                globalThis.location?.pathname ?? "/",
                "/home",
              )}
            >
              {t("exploreDemo")} <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ) : null
        }
      />
      {docs.length > 0 || actions.length > 0 ? (
        <>
          {workspaceSection}
          {focusSection}
          <section className="section" aria-label={t("documentCaptureSection")}>
            {heroSection}
          </section>
          {recentSection}
        </>
      ) : (
        <>
          <section aria-label={t("documentCaptureSection")}>
            {heroSection}
          </section>
          {recentSection}
          {workspaceSection}
        </>
      )}
    </>
  );
}

export function Library({
  docs,
  actions = [],
  online = true,
  query,
  setQuery,
  category,
  setCategory,
  inputRef,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const organizedDocs = docs.filter((d) => d.status === "organized");
  const visible = organizedDocs.filter(
    (d) => (!category || d.category === category) && matchesQuery(d, query),
  );
  const countsByCategory = new Map();
  for (const d of organizedDocs) {
    countsByCategory.set(d.category, (countsByCategory.get(d.category) || 0) + 1);
  }

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
          {query && (
            <button
              type="button"
              className="search-clear"
              aria-label={t("clearSearch")}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      <div
        className="category-grid"
        role="group"
        aria-label={t("categoryPickerLabel")}
      >
        {CATEGORY_TILES.map((tile) => {
          const selected = category === tile.id;
          const count = tile.id
            ? countsByCategory.get(tile.id) || 0
            : organizedDocs.length;
          const label = tile.labelKey
            ? t(tile.labelKey)
            : translateCategory(tile.id, lang);
          return (
            <button
              key={tile.id || "all"}
              type="button"
              aria-pressed={selected}
              className={
                "category-tile" +
                (selected ? " selected" : "") +
                (count === 0 && tile.id ? " is-empty" : "")
              }
              onClick={() => setCategory(tile.id)}
            >
              <CategoryArt src={tile.img} Icon={tile.Icon} />
              <span className="category-tile-text">
                <span className="category-tile-label">{label}</span>
                <span className="category-tile-count">{count}</span>
              </span>
            </button>
          );
        })}
      </div>

      {organizedDocs.length > 0 && (
        <AskPaperworkPanel
          docs={organizedDocs}
          actions={actions}
          online={online}
        />
      )}

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
