import React, { useState } from 'react';
import { ListChecks, ChevronDown, ChevronRight } from 'lucide-react';
import AddActionForm from './AddActionForm.jsx';
import ActionRow from './ActionRow.jsx';
import { EmptyState, fmtDate } from './Shared.jsx';
import { getAncestorChain } from '../utils/actionTree.js';

export default function NextActionsView({ actions, projects, contexts, onComplete, onUndo, onDelete, onEdit, onAdd, onAddSubAction, onAddContext }) {
  const [projectFilter, setProjectFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // A sub-action's projectId always mirrors its root ancestor's (enforced
  // server-side at creation), so this filter works the same for every
  // depth without needing to walk the tree.
  const matchesProject = (a) => !projectFilter || a.projectId === Number(projectFilter);

  // Only root actions drive the main grouped list — sub-actions are only
  // ever seen by expanding their parent.
  const next = actions.filter((a) => a.status === 'next' && a.parentActionId == null && matchesProject(a));

  const grouped = {};
  next.forEach((a) => {
    const key = a.context || 'No context';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });
  const contextOrder = [...contexts.filter((c) => grouped[c]), ...Object.keys(grouped).filter((k) => !contexts.includes(k))];
  const projectName = (id) => (projects.find((p) => p.id === id) || {}).name;

  // History: root completions show individually; completions of a
  // sub-action are grouped under their immediate parent (with a full
  // breadcrumb, since that parent might itself be nested several levels
  // deep) rather than flattened in — even if the parent itself isn't done.
  const doneMatching = actions.filter((a) => a.status === 'done' && matchesProject(a));
  const doneRoot = doneMatching.filter((a) => a.parentActionId == null);
  const doneNested = doneMatching.filter((a) => a.parentActionId != null);

  const nestedGroups = new Map();
  doneNested.forEach((a) => {
    if (!nestedGroups.has(a.parentActionId)) nestedGroups.set(a.parentActionId, []);
    nestedGroups.get(a.parentActionId).push(a);
  });

  const rootEntries = doneRoot.map((a) => ({ type: 'root', sortKey: a.completedAt || 0, action: a }));
  const groupEntries = Array.from(nestedGroups.entries()).map(([parentId, items]) => {
    const sorted = items.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    const parentAction = actions.find((a) => a.id === parentId);
    const breadcrumb = parentAction
      ? [...getAncestorChain(actions, parentAction), parentAction].map((a) => a.text).join(' › ')
      : 'a deleted action';
    return { type: 'group', sortKey: sorted[0].completedAt || 0, parentAction, breadcrumb, items: sorted };
  });
  const historyEntries = [...rootEntries, ...groupEntries].sort((a, b) => b.sortKey - a.sortKey);
  const historyCount = doneMatching.length;

  return (
    <div>
      <div className="row row-wrap" style={{ justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <AddActionForm contexts={contexts} projects={projects} onAdd={onAdd} onAddContext={onAddContext} />
        {projects.length > 0 && (
          <select className="text-input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {next.length === 0 ? (
        <EmptyState icon={ListChecks} title="No next actions yet">Process your inbox, or add one directly, to get moving.</EmptyState>
      ) : (
        contextOrder.map((ctx) => (
          <div key={ctx}>
            <div className="section-title">{ctx} <span style={{ opacity: 0.6 }}>· {grouped[ctx].length}</span></div>
            {grouped[ctx].map((a) => (
              <div key={a.id} style={{ marginBottom: 8 }}>
                <ActionRow
                  action={a}
                  allActions={actions}
                  contexts={contexts}
                  projects={projects}
                  projectName={projectName}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onAddSubAction={onAddSubAction}
                  onAddContext={onAddContext}
                />
              </div>
            ))}
          </div>
        ))
      )}

      {/* Always visible, even with nothing in it yet — hiding this entirely
          when empty made the feature impossible to discover. */}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Recently completed ({historyCount})
        </button>
        {showHistory && (
          historyEntries.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8, padding: '4px 2px' }}>
              Nothing completed yet — items you check off will show up here.
            </div>
          ) : (
            historyEntries.map((entry) =>
              entry.type === 'root' ? (
                <div key={`root-${entry.action.id}`} className="card row" style={{ justifyContent: 'space-between', opacity: 0.7, marginTop: 8 }}>
                  <div>
                    <span style={{ textDecoration: 'line-through' }}>{entry.action.text}</span>
                    {entry.action.projectId && <span className="chip project" style={{ marginLeft: 8 }}>{projectName(entry.action.projectId)}</span>}
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Completed {fmtDate(entry.action.completedAt)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => onUndo(entry.action.id)}>Undo</button>
                </div>
              ) : (
                <div key={`group-${entry.parentAction ? entry.parentAction.id : entry.breadcrumb}`} className="card" style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8, fontWeight: 600 }}>
                    in: {entry.breadcrumb}
                  </div>
                  {entry.items.map((child) => (
                    <div key={child.id} className="row" style={{ justifyContent: 'space-between', opacity: 0.7, marginBottom: 6 }}>
                      <div>
                        <span style={{ textDecoration: 'line-through' }}>{child.text}</span>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Completed {fmtDate(child.completedAt)}</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => onUndo(child.id)}>Undo</button>
                    </div>
                  ))}
                </div>
              )
            )
          )
        )}
      </div>
    </div>
  );
}
