import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { supportsDeviceAI } from "./device-ai.js";
import {
  House,
  Inbox,
  LibraryBig,
  ListChecks,
  Plus,
  Search,
  Monitor,
  ChevronRight,
  PanelLeft,
  ScanLine,
  AlertCircle,
  X,
  Check,
  Folder,
  WifiOff,
} from "lucide-react";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/plus-jakarta-sans";
import "./style.css";
import {
  Home,
  Library,
  Actions,
  InboxPage,
  Heading,
  Empty,
  navTo,
  pathFor,
} from "./ui.jsx";
import { Capture, Detail } from "./forms.jsx";
import { snapshot, change, addAction, toggleAction } from "./db.js";
import {
  configured,
  localClassifier,
  intake,
  processDocument,
} from "./engine.js";
import { sample } from "./domain.js";
const items = [
  ["home", "Home", House],
  ["inbox", "Inbox", Inbox],
  ["library", "Library", LibraryBig],
  ["actions", "Actions", ListChecks],
];
const readRoute = () => location.hash.slice(1) || "/home";
function App() {
  const [route, setRoute] = useState(readRoute),
    [data, setData] = useState({ docs: [], actions: [] }),
    [loaded, setLoaded] = useState(false),
    [loadFailed, setLoadFailed] = useState(false),
    [notice, setNotice] = useState(null),
    [busy, setBusy] = useState(""),
    running = useRef(false);
  const [kind, setKind] = useState("file"),
    [file, setFile] = useState(null),
    [text, setText] = useState(""),
    [mode, setMode] = useState(
      configured ? (supportsDeviceAI() ? "device" : "hybrid") : "rules",
    ),
    [consent, setConsent] = useState(false),
    [ai, setAI] = useState(null);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  const inputRef = useRef(null),
    searchFocus = useRef(false),
    quickFile = useRef(null),
    quickCamera = useRef(null);
  const [page, id] = route.replace(/^\//, "").split("/"),
    active =
      items.find(([p]) => p === page)?.[1] ||
      { capture: "Capture", document: "Document" }[page] ||
      "Page";
  const doc = data.docs.find((d) => d.id === id);
  useEffect(() => {
    setConsent(false);
  }, [kind, file, text, mode]);
  const refresh = async () => {
    setData(await snapshot());
    setLoaded(true);
  };
  const say = (message, bad = false) => setNotice({ message, bad });
  useEffect(() => {
    refresh().catch(() => {
      setLoadFailed(true);
      say(
        "Browser storage is unavailable. Allow site storage and reload.",
        true,
      );
    });
    const update = () => {
      setRoute(readRoute());
      setConsent(false);
      window.scrollTo(0, 0);
    };
    const net = () => setOnline(navigator.onLine),
      key = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          goSearch();
        }
      };
    window.addEventListener("hashchange", update);
    // A hash navigation can occur between the initial render and this effect.
    // Reconcile after subscribing so that early links cannot leave a stale page.
    update();
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("keydown", key);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, []);
  useEffect(() => {
    if (configured && (page === "capture" || page === "document"))
      import("./firebase-ai.js")
        .then(setAI)
        .catch(() =>
          say("Firebase AI could not load. You can use local rules.", true),
        );
  }, [page]);
  useEffect(() => {
    if (!loaded) return;
    document.title = active + " · Tuntas ✦";
    if (searchFocus.current && page === "library") {
      inputRef.current?.focus();
      searchFocus.current = false;
    } else document.querySelector("h1")?.focus({ preventScroll: true });
  }, [route, loaded]);
  const goSearch = () => {
    if (readRoute() === "/library") inputRef.current?.focus();
    else {
      searchFocus.current = true;
      navTo("/library");
    }
  };
  const modeProps = { mode, setMode, consent, setConsent },
    ready =
      mode === "rules" || (!!ai && (mode !== "hybrid" || (consent && online)));
  async function work({ payload, existing, sampleRun = false }) {
    if (running.current || loadFailed) return;
    const useAI = !sampleRun && mode !== "rules";
    if (useAI && !ready) {
      say("Choose an available processing method first.", true);
      return;
    }
    running.current = true;
    setBusy("Saving original");
    setNotice(null);
    let classify = localClassifier,
      initError = false;
    if (useAI) {
      try {
        classify = ai.prepareAI({
          allowCloud: mode === "hybrid" && consent,
          image: (existing?.mime || payload?.file?.type || "").startsWith(
            "image/",
          ),
        });
      } catch {
        initError = true;
      }
    }
    try {
      let current = existing;
      if (!current) {
        const staged = await intake(payload);
        current = staged.doc;
        if (staged.duplicate) {
          await refresh();
          navTo(pathFor(current));
          say("Already captured. Opened the existing original.");
          return;
        }
      }
      if (initError)
        classify = () => {
          throw Error("Firebase initialization failed.");
        };
      const result = await processDocument(current, classify, setBusy, useAI);
      await refresh();
      setFile(null);
      setText("");
      navTo(pathFor(result));
      say(
        result.status === "organized"
          ? "Filed in Library. You can undo this filing."
          : result.status === "error"
            ? "Original saved. Processing needs attention."
            : "Original saved. Please check the suggested details.",
        result.status === "error",
      );
    } catch (e) {
      if (!existing) setFile(null);
      say(
        e?.name === "QuotaExceededError"
          ? "Storage is full. Your document could not be saved."
          : e.message || "Could not save the document.",
        true,
      );
    } finally {
      setBusy("");
      running.current = false;
      setConsent(false);
    }
  }
  function selectFile(f, k) {
    if (!f) return;
    setFile(f);
    setKind(k);
    navTo("/capture");
  }
  function onCapture(k) {
    if (k === "text") {
      setKind(k);
      navTo("/capture");
    } else (k === "camera" ? quickCamera : quickFile).current?.click();
  }
  async function mutation(fn, message) {
    try {
      await fn();
      await refresh();
      if (message) say(message);
      return true;
    } catch {
      say("The change could not be saved. Please try again.", true);
      return false;
    }
  }
  const nav = (p, label, Icon) => (
    <a
      key={p}
      aria-current={page === p ? "page" : undefined}
      className={page === p ? "nav-item selected" : "nav-item"}
      href={"#/" + p}
    >
      <Icon size={19} />
      <span>{label}</span>
      {p === "inbox" && data.docs.some((d) => d.status !== "organized") && (
        <b className="nav-count">
          {data.docs.filter((d) => d.status !== "organized").length}
        </b>
      )}
    </a>
  );
  const captureLink = (
    <a href="#/capture" className="capture-link">
      <Plus size={18} /> Capture
    </a>
  );
  return (
    <>
      <a
        href="#main-content"
        className="skip"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="rail">
        <a className="brand" href="#/home">
          <img src="/mark.svg" alt="" />
          Tuntas<span>✦</span>
        </a>
        <div className="rail-inner">
          <div className="overline">Workspace</div>
          <nav aria-label="Main">{items.map((args) => nav(...args))}</nav>
          {captureLink}
        </div>
        <div className="local-profile">
          <span className="soft-icon">
            <Monitor size={19} />
          </span>
          <div>
            <strong>Local workspace</strong>
            <small>This browser only</small>
          </div>
        </div>
      </aside>
      <div className="shell">
        <header className="top">
          <a className="mob-brand" href="#/home">
            <img src="/mark.svg" alt="" />
            Tuntas ✦
          </a>
          <div className="crumb">
            <PanelLeft size={16} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{active}</strong>
          </div>
          <button onClick={goSearch} className="search-short">
            <Search size={16} />
            <span>Search library</span>
            <kbd>Ctrl K</kbd>
          </button>
        </header>
        <main id="main-content" tabIndex="-1">
          {!online && (
            <div className="note">
              <WifiOff size={15} /> Offline · Your local workspace is still
              available in this tab.
            </div>
          )}
          <div aria-live="polite" aria-atomic="true">
            {busy && (
              <div className="progress">
                <span className="spinner" />
                {busy}…
              </div>
            )}
          </div>
          {notice && (
            <div
              className={"notice " + (notice.bad ? "warn" : "")}
              role={notice.bad ? "alert" : "status"}
            >
              {notice.bad ? <AlertCircle size={17} /> : <Check size={17} />}
              <span>{notice.message}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!loaded ? (
            <p>
              {loadFailed ? "Workspace unavailable." : "Opening workspace…"}
            </p>
          ) : page === "home" ? (
            <Home
              {...data}
              busy={!!busy}
              onSample={() =>
                work({
                  sampleRun: true,
                  payload: {
                    text: sample.text,
                    sample: true,
                    source: "Sample",
                  },
                })
              }
              onCapture={onCapture}
              onDrop={(e) => {
                e.preventDefault();
                selectFile(e.dataTransfer.files[0], "file");
              }}
            />
          ) : page === "capture" ? (
            <Capture
              {...{
                kind,
                setKind,
                file,
                setFile,
                text,
                setText,
                modeProps,
                ready,
                busy,
              }}
              run={() =>
                work({
                  payload: {
                    file: kind !== "text" ? file : null,
                    text,
                    source: kind,
                  },
                })
              }
            />
          ) : page === "library" ? (
            <Library
              {...{
                docs: data.docs,
                query,
                setQuery,
                category,
                setCategory,
                inputRef,
              }}
            />
          ) : page === "inbox" ? (
            <InboxPage docs={data.docs} />
          ) : page === "actions" ? (
            <Actions
              {...data}
              onToggle={(id) => mutation(() => toggleAction(id))}
            />
          ) : page === "document" && doc ? (
            <Detail
              key={doc.id}
              {...{ doc, modeProps, ready, busy }}
              save={(d, fields) =>
                mutation(() => change(d.id, fields), "Filing saved.")
              }
              undo={(d) =>
                mutation(
                  () =>
                    change(d.id, {
                      status: "needs_review",
                      reason:
                        "Filing undone. Choose a category when you’re ready.",
                      autoFiled: false,
                    }),
                  "Moved to Inbox. Original kept.",
                )
              }
              retry={(d) => work({ existing: d })}
              add={(id, title, due) =>
                mutation(() => addAction(id, title, due), "Added to Actions.")
              }
            />
          ) : (
            <Empty title="Page not found">
              <a href="#/home">Back to Home</a>
            </Empty>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {items.slice(0, 2).map((args) => nav(...args))}
        {captureLink}
        {items.slice(2).map((args) => nav(...args))}
      </nav>
      <input
        ref={quickFile}
        hidden
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          selectFile(e.target.files[0], "file");
          e.target.value = "";
        }}
      />
      <input
        ref={quickCamera}
        hidden
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={(e) => {
          selectFile(e.target.files[0], "camera");
          e.target.value = "";
        }}
      />
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
