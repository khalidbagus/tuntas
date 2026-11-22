export const DUE_SOON_DAYS = 7;

export function isValidIsoDate(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

export function toLocalIsoDate(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function msUntilNextLocalMidnight(now = new Date()) {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    1,
    0,
  );
  return Math.max(1000, next.getTime() - now.getTime());
}

function isoToUtcMs(iso) {
  const [y, m, d] = iso.trim().split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function calendarDaysBetween(fromIso, toIso) {
  if (!isValidIsoDate(fromIso) || !isValidIsoDate(toIso)) return null;
  return Math.round((isoToUtcMs(toIso) - isoToUtcMs(fromIso)) / 86400000);
}

export function getActionUrgency(action, todayIso = toLocalIsoDate()) {
  if (action?.done) return "completed";
  if (!isValidIsoDate(action?.due)) return "no_due_date";
  const diff = calendarDaysBetween(todayIso, action.due);
  if (diff === null) return "no_due_date";
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= DUE_SOON_DAYS) return "due_soon";
  return "upcoming";
}

export function dependencyId(prerequisiteActionId, dependentActionId) {
  return `${prerequisiteActionId}->${dependentActionId}`;
}

function validGroupEdges(actions, dependencies) {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const seen = new Set();
  const edges = [];
  for (const dep of dependencies || []) {
    if (!dep) continue;
    const prereq = byId.get(dep.prerequisiteActionId);
    const target = byId.get(dep.dependentActionId);
    if (!prereq || !target || prereq.id === target.id) continue;
    if (!prereq.groupId || prereq.groupId !== target.groupId) continue;
    const id = dependencyId(prereq.id, target.id);
    if (seen.has(id)) continue;
    seen.add(id);
    edges.push({
      id: dep.id || id,
      prerequisiteActionId: prereq.id,
      dependentActionId: target.id,
    });
  }
  return { byId, edges };
}

export function validateDependency(
  actions,
  dependencies,
  prerequisiteActionId,
  dependentActionId,
) {
  const byId = new Map((actions || []).map((a) => [a.id, a]));
  const prereq = byId.get(prerequisiteActionId);
  const dependent = byId.get(dependentActionId);
  if (!prereq || !dependent) {
    return {
      ok: false,
      code: "missing",
      message: "Both actions must exist before linking.",
    };
  }
  if (prerequisiteActionId === dependentActionId) {
    return {
      ok: false,
      code: "self",
      message: "An action cannot depend on itself.",
    };
  }
  if (!prereq.groupId || !dependent.groupId || prereq.groupId !== dependent.groupId) {
    return {
      ok: false,
      code: "cross_group",
      message: "Place both actions in the same group before linking them.",
    };
  }
  const id = dependencyId(prerequisiteActionId, dependentActionId);
  const { edges } = validGroupEdges(actions, dependencies);
  if (
    edges.some(
      (e) =>
        e.prerequisiteActionId === prerequisiteActionId &&
        e.dependentActionId === dependentActionId,
    )
  ) {
    return {
      ok: false,
      code: "duplicate",
      message: "This connection already exists.",
    };
  }

  // Adding prereq -> dependent creates a cycle iff prereq is reachable from dependent.
  const outgoing = new Map();
  for (const edge of edges) {
    if (!outgoing.has(edge.prerequisiteActionId)) {
      outgoing.set(edge.prerequisiteActionId, []);
    }
    outgoing.get(edge.prerequisiteActionId).push(edge.dependentActionId);
  }
  const visited = new Set([dependentActionId]);
  const queue = [dependentActionId];
  while (queue.length) {
    const current = queue.shift();
    if (current === prerequisiteActionId) {
      return {
        ok: false,
        code: "cycle",
        message: "This link would create a circular dependency.",
      };
    }
    for (const next of outgoing.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return { ok: true, id };
}

export function evaluateActionStates(actions = [], dependencies = []) {
  const { byId, edges } = validGroupEdges(actions, dependencies);
  const prereqIdsByAction = new Map();
  const dependentIdsByAction = new Map();
  for (const action of actions) {
    prereqIdsByAction.set(action.id, []);
    dependentIdsByAction.set(action.id, []);
  }
  for (const edge of edges) {
    prereqIdsByAction.get(edge.dependentActionId)?.push(edge.prerequisiteActionId);
    dependentIdsByAction.get(edge.prerequisiteActionId)?.push(edge.dependentActionId);
  }

  const stateMap = new Map();
  for (const action of actions) {
    const prerequisites = (prereqIdsByAction.get(action.id) || [])
      .map((id) => byId.get(id))
      .filter(Boolean);
    const incompletePrerequisites = prerequisites.filter((p) => !p.done);
    const dependents = (dependentIdsByAction.get(action.id) || [])
      .map((id) => byId.get(id))
      .filter(Boolean);
    const readiness = action.done
      ? "completed"
      : incompletePrerequisites.length > 0
        ? "waiting"
        : "ready";
    stateMap.set(action.id, {
      prerequisites,
      incompletePrerequisites,
      dependents,
      readiness,
    });
  }
  return stateMap;
}

export function getGroupProgress(groupId, actions = [], stateMap = null) {
  const resolvedStates = stateMap || evaluateActionStates(actions, []);
  const members = actions.filter((a) => a.groupId === groupId);
  const total = members.length;
  let completed = 0;
  let waiting = 0;
  let ready = 0;
  for (const member of members) {
    if (member.done) {
      completed += 1;
    } else if (resolvedStates.get(member.id)?.readiness === "waiting") {
      waiting += 1;
    } else {
      ready += 1;
    }
  }
  const open = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, ready, waiting, open, percent };
}

const URGENCY_RANK = {
  overdue: 0,
  due_today: 1,
  due_soon: 2,
  upcoming: 3,
  no_due_date: 4,
};

function compareReadyCandidates(a, b, todayIso) {
  const ua = getActionUrgency(a, todayIso);
  const ub = getActionUrgency(b, todayIso);
  const rankDiff = (URGENCY_RANK[ua] ?? 9) - (URGENCY_RANK[ub] ?? 9);
  if (rankDiff !== 0) return rankDiff;
  const aDue = isValidIsoDate(a.due) ? a.due.trim() : "";
  const bDue = isValidIsoDate(b.due) ? b.due.trim() : "";
  if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
  if (aDue && !bDue) return -1;
  if (!aDue && bDue) return 1;
  const createdDiff = (a.created || 0) - (b.created || 0);
  if (createdDiff !== 0) return createdDiff;
  return String(a.id).localeCompare(String(b.id));
}

export function selectTodaysFocus(
  actions = [],
  groups = [],
  dependencies = [],
  todayIso = toLocalIsoDate(),
) {
  if (!actions.length) {
    return { kind: "empty", readyCount: 0, waitingCount: 0 };
  }
  const stateMap = evaluateActionStates(actions, dependencies);
  const openActions = actions.filter((a) => !a.done);
  if (!openActions.length) {
    return {
      kind: "all_done",
      completedCount: actions.length,
      readyCount: 0,
      waitingCount: 0,
    };
  }
  const readyCandidates = openActions.filter(
    (a) => stateMap.get(a.id)?.readiness !== "waiting",
  );
  const waitingCandidates = openActions.filter(
    (a) => stateMap.get(a.id)?.readiness === "waiting",
  );
  const groupById = new Map((groups || []).map((g) => [g.id, g]));

  if (!readyCandidates.length) {
    const firstWaiting = waitingCandidates[0];
    return {
      kind: "waiting",
      waitingCount: waitingCandidates.length,
      readyCount: 0,
      group: firstWaiting?.groupId
        ? groupById.get(firstWaiting.groupId) || null
        : null,
    };
  }

  const sorted = [...readyCandidates].sort((a, b) =>
    compareReadyCandidates(a, b, todayIso),
  );
  const action = sorted[0];
  const urgency = getActionUrgency(action, todayIso);
  const group = action.groupId ? groupById.get(action.groupId) || null : null;
  const daysDelta = isValidIsoDate(action.due)
    ? calendarDaysBetween(todayIso, action.due)
    : null;
  return {
    kind: "action",
    action,
    urgency,
    group,
    daysDelta,
    readyCount: readyCandidates.length,
    waitingCount: waitingCandidates.length,
  };
}

function compareGroupStepFallback(a, b) {
  const aDue = isValidIsoDate(a.due) ? a.due.trim() : "";
  const bDue = isValidIsoDate(b.due) ? b.due.trim() : "";
  if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
  if (aDue && !bDue) return -1;
  if (!aDue && bDue) return 1;
  const createdDiff = (a.created || 0) - (b.created || 0);
  if (createdDiff !== 0) return createdDiff;
  return String(a.title || "").localeCompare(String(b.title || "")) || String(a.id).localeCompare(String(b.id));
}

export function orderGroupActions(groupActions = [], groupDeps = []) {
  const byId = new Map(groupActions.map((a) => [a.id, a]));
  const inDegree = new Map(groupActions.map((a) => [a.id, 0]));
  const outgoing = new Map(groupActions.map((a) => [a.id, []]));
  const seen = new Set();

  for (const dep of groupDeps) {
    if (!dep || dep.prerequisiteActionId === dep.dependentActionId) continue;
    if (!byId.has(dep.prerequisiteActionId) || !byId.has(dep.dependentActionId)) {
      continue;
    }
    const key = dependencyId(dep.prerequisiteActionId, dep.dependentActionId);
    if (seen.has(key)) continue;
    seen.add(key);
    outgoing.get(dep.prerequisiteActionId).push(dep.dependentActionId);
    inDegree.set(
      dep.dependentActionId,
      (inDegree.get(dep.dependentActionId) || 0) + 1,
    );
  }

  const available = groupActions
    .filter((a) => (inDegree.get(a.id) || 0) === 0)
    .sort(compareGroupStepFallback);
  const ordered = [];
  const placed = new Set();

  while (available.length) {
    const current = available.shift();
    if (placed.has(current.id)) continue;
    placed.add(current.id);
    ordered.push(current);
    for (const nextId of outgoing.get(current.id) || []) {
      const nextDegree = (inDegree.get(nextId) || 0) - 1;
      inDegree.set(nextId, nextDegree);
      if (nextDegree <= 0 && !placed.has(nextId)) {
        const nextAction = byId.get(nextId);
        if (nextAction) {
          available.push(nextAction);
          available.sort(compareGroupStepFallback);
        }
      }
    }
  }

  if (ordered.length < groupActions.length) {
    const remaining = groupActions
      .filter((a) => !placed.has(a.id))
      .sort(compareGroupStepFallback);
    ordered.push(...remaining);
  }
  return ordered;
}

export function computeGroupGraphLayout(groupActions = [], groupDeps = []) {
  if (!groupActions.length) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }
  const ordered = orderGroupActions(groupActions, groupDeps);
  const idSet = new Set(ordered.map((a) => a.id));
  const seen = new Set();
  const cleanEdges = [];
  const incoming = new Map(ordered.map((a) => [a.id, []]));

  for (const dep of groupDeps) {
    if (!dep || dep.prerequisiteActionId === dep.dependentActionId) continue;
    if (!idSet.has(dep.prerequisiteActionId) || !idSet.has(dep.dependentActionId)) {
      continue;
    }
    const key = dependencyId(dep.prerequisiteActionId, dep.dependentActionId);
    if (seen.has(key)) continue;
    seen.add(key);
    cleanEdges.push({
      id: dep.id || key,
      fromId: dep.prerequisiteActionId,
      toId: dep.dependentActionId,
    });
    incoming.get(dep.dependentActionId).push(dep.prerequisiteActionId);
  }

  const layerById = new Map();
  for (const action of ordered) {
    const parents = incoming.get(action.id) || [];
    let layer = 0;
    for (const p of parents) {
      if (layerById.has(p)) {
        layer = Math.max(layer, layerById.get(p) + 1);
      }
    }
    layerById.set(action.id, layer);
  }

  const columns = [];
  for (const action of ordered) {
    const layer = layerById.get(action.id) || 0;
    while (columns.length <= layer) columns.push([]);
    columns[layer].push(action);
  }

  const NODE_W = 204;
  const NODE_H = 78;
  const COL_GAP = 64;
  const ROW_GAP = 22;
  const PAD_X = 24;
  const PAD_Y = 24;

  const maxRows = Math.max(...columns.map((c) => c.length));
  const contentHeight = maxRows * NODE_H + Math.max(0, maxRows - 1) * ROW_GAP;
  const height = PAD_Y * 2 + contentHeight;
  const width =
    PAD_X * 2 +
    columns.length * NODE_W +
    Math.max(0, columns.length - 1) * COL_GAP;

  const nodes = [];
  const nodeById = new Map();

  columns.forEach((col, colIndex) => {
    const colHeight = col.length * NODE_H + Math.max(0, col.length - 1) * ROW_GAP;
    const startY = PAD_Y + (contentHeight - colHeight) / 2;
    const x = PAD_X + colIndex * (NODE_W + COL_GAP);
    col.forEach((action, rowIndex) => {
      const y = startY + rowIndex * (NODE_H + ROW_GAP);
      const node = {
        action,
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        layer: colIndex,
      };
      nodes.push(node);
      nodeById.set(action.id, node);
    });
  });

  const edges = cleanEdges.map((edge) => {
    const from = nodeById.get(edge.fromId);
    const to = nodeById.get(edge.toId);
    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = to.x;
    const y2 = to.y + to.height / 2;
    const span = Math.max(28, Math.abs(x2 - x1) * 0.45);
    const path =
      x2 >= x1
        ? `M ${x1} ${y1} C ${x1 + span} ${y1}, ${x2 - span} ${y2}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1 + 40} ${y1 - 48}, ${x2 - 40} ${y2 - 48}, ${x2} ${y2}`;
    return {
      ...edge,
      x1,
      y1,
      x2,
      y2,
      path,
    };
  });

  return { nodes, edges, width, height };
}
