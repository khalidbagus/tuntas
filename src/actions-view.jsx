import React, { useEffect, useRef, useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  GitBranch,
  Link2,
  Plus,
  Trash2,
  Unlink,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  dependencyId,
  evaluateActionStates,
  getActionUrgency,
  getGroupProgress,
  isValidIsoDate,
  orderGroupActions,
  toLocalIsoDate,
} from "./actions-domain.js";
import { formatCalendarDate } from "./domain.js";
import { useLang } from "./lang.js";
import { createTranslator, localeFor, translateRuntimeMessage } from "./i18n.js";
import { Empty, Heading, UrgencyBadge } from "./ui.jsx";
import { ConnectionsGraph } from "./graph.jsx";

function ActionCard({
  action,
  doc,
  state,
  groups,
  allActions,
  todayIso,
  expanded,
  onToggleExpand,
  onToggleDone,
  onUpdateAction,
  onAddDependency,
  onRemoveDependency,
  onJumpToStep,
}) {
  const lang = useLang();
  const t = createTranslator(lang);
  const locale = localeFor(lang);

  const [dueDraft, setDueDraft] = useState(action.due || "");
  const [selectedPrereqId, setSelectedPrereqId] = useState("");
  const [linkError, setLinkError] = useState("");
  const [overrideConfirm, setOverrideConfirm] = useState(false);

  useEffect(() => {
    setDueDraft(action.due || "");
  }, [action.due]);

  useEffect(() => {
    setLinkError("");
  }, [action.groupId, state?.prerequisites?.length]);

  useEffect(() => {
    if (action.done || state?.readiness !== "waiting") {
      setOverrideConfirm(false);
    }
  }, [action.done, state?.readiness]);

  const urgency = getActionUrgency(action, todayIso);
  const readiness = state?.readiness || (action.done ? "completed" : "ready");
  const isWaiting = !action.done && readiness === "waiting";
  const sameGroupOthers = action.groupId
    ? allActions.filter(
        (other) => other.groupId === action.groupId && other.id !== action.id,
      )
    : [];

  const handleCheckChange = async () => {
    if (isWaiting && !overrideConfirm) {
      setOverrideConfirm(true);
      return;
    }
    setOverrideConfirm(false);
    const saved = await onToggleDone(action);
    if (saved) {
      requestAnimationFrame(() =>
        document
          .getElementById("action-" + action.id)
          ?.focus({ preventScroll: true }),
      );
    }
  };

  return (
    <article
      id={"action-card-" + action.id}
      className={"action-card" + (expanded ? " is-expanded" : "")}
    >
      <div className="action-row">
        <label className="action-toggle">
          <input
            type="checkbox"
            id={"action-" + action.id}
            aria-label={
              action.done
                ? t("reopenAction", { title: action.title })
                : t("completeAction", { title: action.title })
            }
            checked={action.done}
            onChange={handleCheckChange}
          />
        </label>
        <div className="grow action-summary">
          <div className="action-title-line">
            <strong className={action.done ? "is-done-title" : undefined}>
              {action.title}
            </strong>
            <UrgencyBadge urgency={urgency} />
            {isWaiting && (
              <span className="chip amber readiness-chip">
                <Clock size={12} aria-hidden="true" />
                {t("waitingSummary", {
                  count: state.incompletePrerequisites.length,
                })}
              </span>
            )}
            {!action.done &&
              !isWaiting &&
              action.groupId &&
              state?.prerequisites?.length > 0 && (
                <span className="chip blue readiness-chip">
                  {t("stateReady")}
                </span>
              )}
          </div>
          <small className="action-meta-line">
            {isValidIsoDate(action.due)
              ? t("duePrefix", {
                  date: formatCalendarDate(action.due, locale),
                })
              : t("noDueDateLabel")}
            {" · "}
            <a href={"#/document/" + action.documentId}>
              {doc?.title || t("openSource")}
            </a>
          </small>
        </div>
        <button
          type="button"
          className="secondary action-expand-btn"
          aria-expanded={expanded}
          aria-controls={"action-details-" + action.id}
          onClick={() => onToggleExpand(action.id)}
        >
          <span>{expanded ? t("hideDetails") : t("showDetails")}</span>
          {expanded ? (
            <ChevronUp size={15} aria-hidden="true" />
          ) : (
            <ChevronDown size={15} aria-hidden="true" />
          )}
        </button>
      </div>

      {overrideConfirm && (
        <div className="override-prompt" role="region" aria-label={t("overridePromptTitle")}>
          <div className="override-copy">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>{t("overridePromptTitle")}</strong>
              <ul>
                {state.incompletePrerequisites.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="button-line">
            <button
              type="button"
              className="primary compact-btn"
              onClick={async () => {
                setOverrideConfirm(false);
                await onToggleDone(action);
              }}
            >
              {t("completeAnyway")}
            </button>
            <button
              type="button"
              className="secondary compact-btn"
              onClick={() => {
                setOverrideConfirm(false);
                requestAnimationFrame(() =>
                  document
                    .getElementById("action-" + action.id)
                    ?.focus({ preventScroll: true }),
                );
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div id={"action-details-" + action.id} className="action-details">
          <div className="evidence-box">
            <div className="evidence-head">
              <FileText size={15} aria-hidden="true" />
              <strong>{t("evidenceHeading")}</strong>
            </div>
            <div className="evidence-source-row">
              <div>
                <small>{t("evidenceSourceDoc")}</small>
                <div className="evidence-doc-title">
                  {doc?.title || t("openSource")}
                </div>
              </div>
              <a
                className="text-link compact-link"
                href={"#/document/" + action.documentId}
              >
                {t("openOriginalDocument")}
              </a>
            </div>
            {action.quote && action.quote.trim() ? (
              <div>
                <small>{t("evidenceSourceQuote")}</small>
                <blockquote className="followup-quote">
                  “{action.quote}”
                </blockquote>
              </div>
            ) : (
              <p className="muted-copy">{t("evidenceNoQuote")}</p>
            )}
            <small className="evidence-meta-note">
              {t("evidenceDueAndStatus")}:{" "}
              {isValidIsoDate(action.due)
                ? formatCalendarDate(action.due, locale)
                : t("noDueDateLabel")}
              {" · "}
              {readiness === "completed"
                ? t("urgencyCompleted")
                : readiness === "waiting"
                  ? t("stateWaiting")
                  : t("stateReady")}
              . {t("evidenceUserEnteredNote")}
            </small>
          </div>

          <div className="action-edit-grid">
            <form
              className="action-subpanel"
              onSubmit={async (e) => {
                e.preventDefault();
                await onUpdateAction(
                  action.id,
                  { due: dueDraft },
                  dueDraft ? "Due date updated." : "Due date removed.",
                );
              }}
            >
              <label>
                {t("editDueDateHeading")}
                <input
                  type="date"
                  value={dueDraft}
                  onChange={(e) => setDueDraft(e.target.value)}
                />
              </label>
              <div className="button-line">
                <button
                  type="submit"
                  className="secondary compact-btn"
                  disabled={dueDraft === (action.due || "")}
                >
                  {t("saveDueDate")}
                </button>
                {action.due && (
                  <button
                    type="button"
                    className="link-button compact-link"
                    onClick={async () => {
                      setDueDraft("");
                      await onUpdateAction(
                        action.id,
                        { due: "" },
                        "Due date removed.",
                      );
                    }}
                  >
                    {t("removeDueDate")}
                  </button>
                )}
              </div>
            </form>

            <div className="action-subpanel">
              <label>
                {action.groupId
                  ? t("groupAssignmentLabel")
                  : t("addToGroupLabel")}
                <select
                  value={action.groupId || ""}
                  onChange={async (e) => {
                    const nextGroup = e.target.value;
                    await onUpdateAction(
                      action.id,
                      { groupId: nextGroup },
                      nextGroup ? "Added to group." : "Moved out of group.",
                    );
                  }}
                >
                  <option value="">{t("noGroupOption")}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
              {(state?.prerequisites?.length > 0 ||
                state?.dependents?.length > 0) && (
                <small>{t("groupChangeClearsLinksHint")}</small>
              )}
            </div>
          </div>

          <div className="action-subpanel">
            <div className="evidence-head">
              <Link2 size={15} aria-hidden="true" />
              <strong>{t("manageStepsHeading")}</strong>
            </div>

            {!action.groupId ? (
              <small>{t("groupNeededToLink")}</small>
            ) : (
              <>
                <div className="dependency-list-block">
                  <small className="subpanel-label">
                    {t("dependsOnHeading")}
                  </small>
                  {state?.prerequisites?.length ? (
                    <ul className="dependency-items">
                      {state.prerequisites.map((prereq) => (
                        <li key={prereq.id}>
                          <span className="dep-item-title">
                            <span
                              className={
                                "chip " + (prereq.done ? "green" : "amber")
                              }
                            >
                              {prereq.done
                                ? t("urgencyCompleted")
                                : t("openHeading")}
                            </span>
                            <span>{prereq.title}</span>
                          </span>
                          <span className="dep-item-actions">
                            <button
                              type="button"
                              className="link-button compact-link"
                              onClick={() => onJumpToStep(prereq.id)}
                            >
                              {t("jumpToStep")}
                            </button>
                            <button
                              type="button"
                              className="link-button compact-link danger-link"
                              onClick={() =>
                                onRemoveDependency(
                                  dependencyId(prereq.id, action.id),
                                )
                              }
                            >
                              <Unlink size={13} aria-hidden="true" />
                              {t("removeLink")}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <small>{t("noPrerequisites")}</small>
                  )}
                </div>

                {state?.dependents?.length > 0 && (
                  <div className="dependency-list-block">
                    <small className="subpanel-label">
                      {t("unlocksHeading")}
                    </small>
                    <ul className="dependency-items">
                      {state.dependents.map((dep) => (
                        <li key={dep.id}>
                          <span className="dep-item-title">{dep.title}</span>
                          <button
                            type="button"
                            className="link-button compact-link"
                            onClick={() => onJumpToStep(dep.id)}
                          >
                            {t("jumpToStep")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sameGroupOthers.length > 0 ? (
                  <form
                    className="link-add-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selectedPrereqId) return;
                      setLinkError("");
                      const res = await onAddDependency(
                        selectedPrereqId,
                        action.id,
                      );
                      if (res?.ok) {
                        setSelectedPrereqId("");
                      } else if (res?.error) {
                        setLinkError(res.error);
                      }
                    }}
                  >
                    <label>
                      {t("addPrerequisiteLabel")}
                      <div className="link-add-row">
                        <select
                          value={selectedPrereqId}
                          onChange={(e) => {
                            setSelectedPrereqId(e.target.value);
                            setLinkError("");
                          }}
                        >
                          <option value="">
                            {t("choosePrerequisiteOption")}
                          </option>
                          {sameGroupOthers.map((other) => (
                            <option key={other.id} value={other.id}>
                              {other.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="secondary compact-btn"
                          disabled={!selectedPrereqId}
                        >
                          {t("linkStepButton")}
                        </button>
                      </div>
                    </label>
                    {linkError && (
                      <p className="inline-error" role="alert">
                        {translateRuntimeMessage(linkError, lang)}
                      </p>
                    )}
                  </form>
                ) : (
                  <small>{t("noOtherStepsInGroup")}</small>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function Actions({
  docs,
  actions,
  groups = [],
  dependencies = [],
  todayIso = toLocalIsoDate(),
  focusedActionId = "",
  onToggle,
  onUpdateAction,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onAddDependency,
  onRemoveDependency,
}) {
  const lang = useLang();
  const t = createTranslator(lang);

  const [filter, setFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState("");
  const [graphGroupId, setGraphGroupId] = useState("");
  const [graphSelectedId, setGraphSelectedId] = useState("");

  const newGroupInputRef = useRef(null);

  const stateMap = evaluateActionStates(actions, dependencies);
  const docById = new Map(docs.map((d) => [d.id, d]));
  const groupIds = new Set(groups.map((g) => g.id));

  const missingDateCount = actions.filter(
    (a) => !a.done && !isValidIsoDate(a.due),
  ).length;

  const matchesFilter = (action) => {
    if (filter === "open") return !action.done;
    if (filter === "no_due_date")
      return !action.done && !isValidIsoDate(action.due);
    if (filter === "completed") return Boolean(action.done);
    return true;
  };

  useEffect(() => {
    if (!focusedActionId) return;
    const target = actions.find((a) => a.id === focusedActionId);
    if (!target) return;
    setFilter("all");
    setExpandedIds((prev) => new Set([...prev, target.id]));
    if (target.groupId) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        next.delete(target.groupId);
        return next;
      });
    }
    requestAnimationFrame(() => {
      document
        .getElementById("action-card-" + target.id)
        ?.scrollIntoView({ block: "center" });
      document
        .getElementById("action-" + target.id)
        ?.focus({ preventScroll: true });
    });
  }, [focusedActionId]);

  useEffect(() => {
    if (creatingGroup) {
      newGroupInputRef.current?.focus({ preventScroll: true });
    }
  }, [creatingGroup]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCollapseGroup = (groupId) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const jumpToStep = (actionId) => {
    const target = actions.find((a) => a.id === actionId);
    if (!target) return;
    setFilter("all");
    setExpandedIds((prev) => new Set([...prev, actionId]));
    if (target.groupId) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        next.delete(target.groupId);
        return next;
      });
    }
    requestAnimationFrame(() => {
      document
        .getElementById("action-card-" + actionId)
        ?.scrollIntoView({ block: "center" });
      document
        .getElementById("action-" + actionId)
        ?.focus({ preventScroll: true });
    });
  };

  const visibleGroups = groups.filter((group) => {
    if (filter === "all") return true;
    return actions.some((a) => a.groupId === group.id && matchesFilter(a));
  });

  const standaloneActions = actions.filter(
    (a) => (!a.groupId || !groupIds.has(a.groupId)) && matchesFilter(a),
  );
  const openStandalone = standaloneActions.filter((a) => !a.done);
  const doneStandalone = standaloneActions.filter((a) => a.done);

  const hasAnyFilteredResults =
    visibleGroups.some((g) =>
      actions.some((a) => a.groupId === g.id && matchesFilter(a)),
    ) || standaloneActions.length > 0;

  return (
    <>
      <Heading
        kicker={t("actionsKicker")}
        title={t("navActions")}
        description={t("actionsDescription")}
      />

      <div className="actions-toolbar">
        <div
          className="filter-pills"
          role="group"
          aria-label={t("actionsFilterLabel")}
        >
          {[
            ["all", t("filterAll"), actions.length],
            ["open", t("filterOpen"), actions.filter((a) => !a.done).length],
            ["no_due_date", t("filterNoDueDate"), missingDateCount],
            [
              "completed",
              t("filterCompleted"),
              actions.filter((a) => a.done).length,
            ],
          ].map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              className={"filter-pill" + (filter === key ? " selected" : "")}
              onClick={() => setFilter(key)}
            >
              <span>{label}</span>
              <span className="pill-count">{count}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="secondary new-group-btn"
          aria-expanded={creatingGroup}
          onClick={() => setCreatingGroup((v) => !v)}
        >
          <Plus size={16} aria-hidden="true" />
          <span>{t("newGroup")}</span>
        </button>
      </div>

      {creatingGroup && (
        <form
          className="group-create-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newGroupName.trim()) return;
            const created = await onCreateGroup(newGroupName);
            if (created) {
              setNewGroupName("");
              setCreatingGroup(false);
              setFilter("all");
            }
          }}
        >
          <label>
            {t("groupNameLabel")}
            <input
              ref={newGroupInputRef}
              required
              maxLength={80}
              placeholder={t("groupNamePlaceholder")}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
          </label>
          <div className="button-line">
            <button
              type="submit"
              className="primary compact-btn"
              disabled={!newGroupName.trim()}
            >
              {t("createGroup")}
            </button>
            <button
              type="button"
              className="secondary compact-btn"
              onClick={() => {
                setCreatingGroup(false);
                setNewGroupName("");
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {!actions.length && !groups.length ? (
        <div className="list">
          <Empty icon={CheckCheck} title={t("noActionsTitle")}>
            {t("noActionsPrefix")}{" "}
            <a href="#/library">{t("navLibrary")}</a> {t("noActionsSuffix")}
          </Empty>
        </div>
      ) : (
        <>
          {visibleGroups.map((group) => {
            const members = actions.filter((a) => a.groupId === group.id);
            const memberIds = new Set(members.map((m) => m.id));
            const groupDeps = dependencies.filter(
              (d) =>
                memberIds.has(d.prerequisiteActionId) &&
                memberIds.has(d.dependentActionId),
            );
            const ordered = orderGroupActions(members, groupDeps).filter(
              matchesFilter,
            );
            const progress = getGroupProgress(group.id, actions, stateMap);
            const collapsed = collapsedGroups.has(group.id);
            const showingGraph = graphGroupId === group.id;

            return (
              <section
                key={group.id}
                className="section group-card"
                aria-label={group.title}
              >
                <div className="group-header">
                  <div className="group-header-main">
                    {renamingGroupId === group.id ? (
                      <form
                        className="group-rename-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!renameDraft.trim()) return;
                          if (await onRenameGroup(group.id, renameDraft)) {
                            setRenamingGroupId("");
                          }
                        }}
                      >
                        <input
                          aria-label={t("groupNameLabel")}
                          maxLength={80}
                          required
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="primary compact-btn"
                          disabled={!renameDraft.trim()}
                        >
                          {t("saveGroupName")}
                        </button>
                        <button
                          type="button"
                          className="secondary compact-btn"
                          onClick={() => setRenamingGroupId("")}
                        >
                          {t("cancel")}
                        </button>
                      </form>
                    ) : (
                      <div className="group-title-line">
                        <button
                          type="button"
                          className="group-collapse-btn"
                          aria-expanded={!collapsed}
                          aria-label={
                            collapsed
                              ? `${t("expandGroup")}: ${group.title}`
                              : `${t("collapseGroup")}: ${group.title}`
                          }
                          onClick={() => toggleCollapseGroup(group.id)}
                        >
                          {collapsed ? (
                            <ChevronDown size={18} aria-hidden="true" />
                          ) : (
                            <ChevronUp size={18} aria-hidden="true" />
                          )}
                          <h2>{group.title}</h2>
                        </button>
                      </div>
                    )}

                    <div className="group-progress-row">
                      <small className="group-progress-text">
                        {t("groupProgress", {
                          completed: progress.completed,
                          total: progress.total,
                        })}
                      </small>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={t("groupProgressBarLabel", {
                          title: group.title,
                          completed: progress.completed,
                          total: progress.total,
                        })}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(1, progress.total)}
                        aria-valuenow={progress.completed}
                      >
                        <div
                          className="progress-fill"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="group-actions">
                    <button
                      id={"view-connections-" + group.id}
                      type="button"
                      className={
                        showingGraph
                          ? "primary compact-btn"
                          : "secondary compact-btn"
                      }
                      aria-expanded={showingGraph}
                      onClick={() => {
                        if (showingGraph) {
                          setGraphGroupId("");
                        } else {
                          setCollapsedGroups((prev) => {
                            const next = new Set(prev);
                            next.delete(group.id);
                            return next;
                          });
                          setGraphGroupId(group.id);
                          setGraphSelectedId(ordered[0]?.id || members[0]?.id || "");
                        }
                      }}
                    >
                      <GitBranch size={15} aria-hidden="true" />
                      <span>
                        {showingGraph
                          ? t("hideConnections")
                          : t("viewConnections")}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="secondary compact-btn"
                      aria-label={`${t("renameGroup")} ${group.title}`}
                      onClick={() => {
                        setRenamingGroupId(group.id);
                        setRenameDraft(group.title);
                      }}
                    >
                      <Edit3 size={15} aria-hidden="true" />
                      <span>{t("renameGroup")}</span>
                    </button>
                    <button
                      type="button"
                      className="secondary compact-btn"
                      aria-label={`${t("deleteGroup")} ${group.title}`}
                      onClick={() =>
                        setConfirmDeleteGroupId((prev) =>
                          prev === group.id ? "" : group.id,
                        )
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      <span>{t("deleteGroup")}</span>
                    </button>
                  </div>
                </div>

                {confirmDeleteGroupId === group.id && (
                  <div className="override-prompt" role="region" aria-label={t("deleteGroup")}>
                    <p>{t("deleteGroupConfirm")}</p>
                    <div className="button-line">
                      <button
                        type="button"
                        className="primary compact-btn"
                        onClick={async () => {
                          setConfirmDeleteGroupId("");
                          if (graphGroupId === group.id) setGraphGroupId("");
                          await onDeleteGroup(group.id);
                        }}
                      >
                        {t("confirmRemoveGroup")}
                      </button>
                      <button
                        type="button"
                        className="secondary compact-btn"
                        onClick={() => setConfirmDeleteGroupId("")}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {!collapsed && (
                  <>
                    {showingGraph && (
                      <ConnectionsGraph
                        group={group}
                        groupActions={members}
                        groupDependencies={groupDeps}
                        stateMap={stateMap}
                        docs={docs}
                        todayIso={todayIso}
                        selectedActionId={graphSelectedId}
                        onSelectAction={setGraphSelectedId}
                        onFocusStepInList={jumpToStep}
                        onClose={() => {
                          setGraphGroupId("");
                          requestAnimationFrame(() =>
                            document
                              .getElementById("view-connections-" + group.id)
                              ?.focus({ preventScroll: true }),
                          );
                        }}
                      />
                    )}

                    {ordered.length ? (
                      <div className="list group-list">
                        {ordered.map((a) => (
                          <ActionCard
                            key={a.id}
                            action={a}
                            doc={docById.get(a.documentId)}
                            state={stateMap.get(a.id)}
                            groups={groups}
                            allActions={actions}
                            todayIso={todayIso}
                            expanded={expandedIds.has(a.id)}
                            onToggleExpand={toggleExpand}
                            onToggleDone={onToggle}
                            onUpdateAction={onUpdateAction}
                            onAddDependency={onAddDependency}
                            onRemoveDependency={onRemoveDependency}
                            onJumpToStep={jumpToStep}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="pad">{t("emptyGroupNote")}</p>
                    )}
                  </>
                )}
              </section>
            );
          })}

          {!hasAnyFilteredResults && actions.length > 0 && (
            <section className="section">
              <div className="list">
                <Empty icon={CheckCheck} title={t("noActionsInFilter")}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setFilter("all")}
                  >
                    {t("showAllActions")}
                  </button>
                </Empty>
              </div>
            </section>
          )}

          {standaloneActions.length > 0 && (
            <section className="section">
              {groups.length > 0 && (
                <div className="section-top">
                  <h2>{t("standaloneActionsHeading")}</h2>
                </div>
              )}

              {filter === "all" ? (
                [false, true].map((done) => {
                  const slice = done ? doneStandalone : openStandalone;
                  return (
                    <div key={String(done)} className="standalone-bucket">
                      <h3 className="bucket-heading">
                        {done ? t("completedHeading") : t("openHeading")}
                      </h3>
                      <div className="list">
                        {slice.length ? (
                          slice.map((a) => (
                            <ActionCard
                              key={a.id}
                              action={a}
                              doc={docById.get(a.documentId)}
                              state={stateMap.get(a.id)}
                              groups={groups}
                              allActions={actions}
                              todayIso={todayIso}
                              expanded={expandedIds.has(a.id)}
                              onToggleExpand={toggleExpand}
                              onToggleDone={onToggle}
                              onUpdateAction={onUpdateAction}
                              onAddDependency={onAddDependency}
                              onRemoveDependency={onRemoveDependency}
                              onJumpToStep={jumpToStep}
                            />
                          ))
                        ) : (
                          <p className="pad">
                            {done
                              ? t("noCompletedActions")
                              : t("noOpenActions")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="list">
                  {standaloneActions.map((a) => (
                    <ActionCard
                      key={a.id}
                      action={a}
                      doc={docById.get(a.documentId)}
                      state={stateMap.get(a.id)}
                      groups={groups}
                      allActions={actions}
                      todayIso={todayIso}
                      expanded={expandedIds.has(a.id)}
                      onToggleExpand={toggleExpand}
                      onToggleDone={onToggle}
                      onUpdateAction={onUpdateAction}
                      onAddDependency={onAddDependency}
                      onRemoveDependency={onRemoveDependency}
                      onJumpToStep={jumpToStep}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
