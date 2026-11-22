import React, { useEffect, useRef, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Check,
  Clock,
  CircleDot,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import {
  computeGroupGraphLayout,
  getActionUrgency,
} from "./actions-domain.js";
import { formatCalendarDate } from "./domain.js";
import { useLang } from "./lang.js";
import { createTranslator, localeFor } from "./i18n.js";

const ZOOM_STEPS = [0.75, 1, 1.25];

export function ConnectionsGraph({
  group,
  groupActions,
  groupDependencies,
  stateMap,
  docs,
  todayIso,
  selectedActionId,
  onSelectAction,
  onFocusStepInList,
  onClose,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);
  const [zoomIndex, setZoomIndex] = useState(1);
  const closeBtnRef = useRef(null);

  const layout = computeGroupGraphLayout(groupActions, groupDependencies);
  const effectiveSelectedId = layout.nodes.some(
    (n) => n.action.id === selectedActionId,
  )
    ? selectedActionId
    : layout.nodes[0]?.action.id || "";

  useEffect(() => {
    closeBtnRef.current?.focus({ preventScroll: true });
  }, [group.id]);

  const zoom = ZOOM_STEPS[zoomIndex];
  const selectedNode =
    layout.nodes.find((n) => n.action.id === effectiveSelectedId) || null;
  const selectedState = selectedNode
    ? stateMap.get(selectedNode.action.id)
    : null;
  const directNeighborIds = new Set();
  if (effectiveSelectedId) {
    for (const edge of layout.edges) {
      if (edge.fromId === effectiveSelectedId) directNeighborIds.add(edge.toId);
      if (edge.toId === effectiveSelectedId) directNeighborIds.add(edge.fromId);
    }
  }

  const docById = new Map(docs.map((d) => [d.id, d]));
  const actionById = new Map(groupActions.map((a) => [a.id, a]));

  const statusLabelFor = (action) => {
    const readiness = stateMap.get(action.id)?.readiness || "ready";
    if (readiness === "completed") return t("urgencyCompleted");
    if (readiness === "waiting") return t("stateWaiting");
    return t("stateReady");
  };

  const urgencyLabelFor = (action) => {
    const urgency = getActionUrgency(action, todayIso);
    const map = {
      overdue: t("urgencyOverdue"),
      due_today: t("urgencyDueToday"),
      due_soon: t("urgencyDueSoon"),
      upcoming: t("urgencyUpcoming"),
      no_due_date: t("urgencyNoDueDate"),
      completed: t("urgencyCompleted"),
    };
    return map[urgency] || t("urgencyNoDueDate");
  };

  return (
    <section
      className="graph-panel"
      aria-label={t("connectionsGraphTitle", { title: group.title })}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="graph-header">
        <div>
          <div className="graph-title-row">
            <GitBranch size={17} aria-hidden="true" />
            <h3>{t("connectionsGraphTitle", { title: group.title })}</h3>
          </div>
          <small>{t("connectionsGraphHint")}</small>
        </div>
        <div className="graph-controls">
          <button
            type="button"
            className="secondary graph-ctrl-btn"
            aria-label={t("zoomOut")}
            disabled={zoomIndex <= 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <span className="graph-zoom-value" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="secondary graph-ctrl-btn"
            aria-label={t("zoomIn")}
            disabled={zoomIndex >= ZOOM_STEPS.length - 1}
            onClick={() =>
              setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
            }
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="secondary graph-ctrl-btn"
            disabled={zoomIndex === 1}
            onClick={() => setZoomIndex(1)}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>{t("zoomReset")}</span>
          </button>
          <button
            ref={closeBtnRef}
            type="button"
            className="secondary graph-ctrl-btn"
            aria-label={t("hideConnections")}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {layout.edges.length === 0 && (
        <p className="graph-empty-hint">{t("graphNoConnectionsYet")}</p>
      )}

      {layout.nodes.length > 0 && (
        <div
          className="graph-canvas"
          role="region"
          aria-label={t("graphAriaLabel", { title: group.title })}
        >
          <div
            className="graph-stage"
            style={{
              width: layout.width * zoom,
              height: layout.height * zoom,
            }}
          >
            <svg
              className="graph-edges"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              width={layout.width * zoom}
              height={layout.height * zoom}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id={`arrow-muted-${group.id}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M 0 1 L 7 4 L 0 7 z" fill="#8592a6" />
                </marker>
                <marker
                  id={`arrow-active-${group.id}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M 0 1 L 7 4 L 0 7 z" fill="#2459de" />
                </marker>
              </defs>
              {layout.edges.map((edge) => {
                const highlighted =
                  edge.fromId === effectiveSelectedId ||
                  edge.toId === effectiveSelectedId;
                return (
                  <path
                    key={edge.id}
                    d={edge.path}
                    fill="none"
                    stroke={highlighted ? "#2459de" : "#9aa8be"}
                    strokeWidth={highlighted ? 2.4 : 1.6}
                    markerEnd={`url(#${highlighted
                      ? `arrow-active-${group.id}`
                      : `arrow-muted-${group.id}`
                      })`}
                  />
                );
              })}
            </svg>

            {layout.nodes.map((node) => {
              const readiness =
                stateMap.get(node.action.id)?.readiness || "ready";
              const isSelected = node.action.id === effectiveSelectedId;
              const isNeighbor = directNeighborIds.has(node.action.id);
              const isDimmed =
                Boolean(effectiveSelectedId) && !isSelected && !isNeighbor;
              const StatusIcon =
                readiness === "completed"
                  ? Check
                  : readiness === "waiting"
                    ? Clock
                    : CircleDot;
              return (
                <button
                  key={node.action.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={[
                    "graph-node",
                    `is-${readiness}`,
                    isSelected ? "is-selected" : "",
                    isNeighbor ? "is-neighbor" : "",
                    isDimmed ? "is-dimmed" : "",
                    zoom < 0.9 ? "is-compact" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    left: node.x * zoom,
                    top: node.y * zoom,
                    width: node.width * zoom,
                    height: node.height * zoom,
                  }}
                  onClick={() => onSelectAction(node.action.id)}
                >
                  <span className="graph-node-state">
                    <StatusIcon size={12} aria-hidden="true" />
                    <span>{statusLabelFor(node.action)}</span>
                  </span>
                  <span className="graph-node-title">{node.action.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="graph-inspector">
          <div className="graph-inspector-head">
            <div>
              <span className="overline">{t("graphSelectedStep")}</span>
              <strong>{selectedNode.action.title}</strong>
            </div>
            <div className="button-line">
              <span
                className={
                  "chip " +
                  (selectedState?.readiness === "completed"
                    ? "green"
                    : selectedState?.readiness === "waiting"
                      ? "amber"
                      : "blue")
                }
              >
                {statusLabelFor(selectedNode.action)}
              </span>
              <span className="chip neutral-chip">
                {urgencyLabelFor(selectedNode.action)}
              </span>
            </div>
          </div>
          <small>
            {selectedNode.action.due
              ? t("duePrefix", {
                date: formatCalendarDate(selectedNode.action.due, locale),
              })
              : t("noDueDateLabel")}
            {" · "}
            <a href={"#/document/" + selectedNode.action.documentId}>
              {docById.get(selectedNode.action.documentId)?.title ||
                t("openSource")}
            </a>
          </small>
          {(selectedState?.prerequisites.length > 0 ||
            selectedState?.dependents.length > 0) && (
              <div className="graph-inspector-links">
                {selectedState.prerequisites.map((prereq) => (
                  <button
                    key={`p-${prereq.id}`}
                    type="button"
                    className="graph-link-pill"
                    onClick={() => onSelectAction(prereq.id)}
                  >
                    <span>{t("dependsOnHeading")}:</span>
                    <strong>{prereq.title}</strong>
                  </button>
                ))}
                {selectedState.dependents.map((dep) => (
                  <button
                    key={`d-${dep.id}`}
                    type="button"
                    className="graph-link-pill"
                    onClick={() => onSelectAction(dep.id)}
                  >
                    <span>{t("unlocksHeading")}:</span>
                    <strong>{dep.title}</strong>
                  </button>
                ))}
              </div>
            )}
          <div>
            <button
              type="button"
              className="secondary graph-focus-btn"
              onClick={() => onFocusStepInList(selectedNode.action.id)}
            >
              {t("graphOpenStepInList")}
            </button>
          </div>
        </div>
      )}

      <div className="graph-text-list">
        <h4>{t("graphTextListHeading")}</h4>
        <ul>
          {layout.edges.map((edge) => {
            const from = actionById.get(edge.fromId);
            const to = actionById.get(edge.toId);
            if (!from || !to) return null;
            return (
              <li key={`txt-${edge.id}`}>
                <button
                  type="button"
                  className="link-button graph-text-btn"
                  onClick={() => onSelectAction(from.id)}
                >
                  {from.title}
                </button>
                <span className="graph-text-arrow">
                  <ArrowRight size={14} aria-hidden="true" />
                  <span>{t("graphArrowLabel")}</span>
                </span>
                <button
                  type="button"
                  className="link-button graph-text-btn"
                  onClick={() => onSelectAction(to.id)}
                >
                  {to.title}
                </button>
              </li>
            );
          })}
          {layout.nodes
            .filter((n) => {
              const st = stateMap.get(n.action.id);
              return (
                !st?.prerequisites.length && !st?.dependents.length
              );
            })
            .map((n) => (
              <li key={`solo-${n.action.id}`}>
                <button
                  type="button"
                  className="link-button graph-text-btn"
                  onClick={() => onSelectAction(n.action.id)}
                >
                  {n.action.title}
                </button>
                <span className="graph-text-solo">
                  {" · "}
                  {t("graphStandaloneStep")}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}
