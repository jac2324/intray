// Small helpers for working with the self-referencing action tree
// (action.parentActionId -> another action.id, arbitrary depth).

export function getChildren(actions, parentId) {
  return actions.filter((a) => a.parentActionId === parentId);
}

// Total number of descendants at any depth — used to warn before a
// cascading delete.
export function countDescendants(actions, actionId) {
  const direct = getChildren(actions, actionId);
  return direct.reduce((sum, child) => sum + 1 + countDescendants(actions, child.id), 0);
}

// Walks up from an action to the root, returning [root, ..., immediateParent]
// (not including the action itself). Used to build a breadcrumb like
// "Renovate Bathroom › Get quotes" in the completed-items history.
export function getAncestorChain(actions, action) {
  const chain = [];
  let current = action;
  const byId = new Map(actions.map((a) => [a.id, a]));
  const seen = new Set(); // guards against a corrupt/cyclic chain
  while (current && current.parentActionId != null && !seen.has(current.parentActionId)) {
    seen.add(current.parentActionId);
    const parent = byId.get(current.parentActionId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}
