import React, { useState } from 'react';
import { ListChecks, ChevronDown, ChevronRight } from 'lucide-react';
import AddActionForm from './AddActionForm.jsx';
import ActionRow from './ActionRow.jsx';
import { EmptyState, fmtDate } from './Shared.jsx';

export default function NextActionsView({ actions, projects, contexts, onComplete, onUndo, onDelete, onEdit, onAdd, onAddContext }) {
  const [projectFilter, setProjectFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const matchesProject = (a) => !projectFilter || a.projectId === Number(projectFilter);
  const next = actions.filter((a) => a.status === 'next' && matchesProject(a));
  // Full history, not just the last few — most recently completed first.
  const history = actions
    .filter((a) => a.status === 'done' && matchesProject(a))
    .slice()
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const grouped = {};
  next.forEach((a) => {
    const key = a.context || 'No context';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });
  const contextOrder = [...contexts.filter((c) => grouped[c]), ...Object.keys(grouped).filter((k) => !contexts.includes(k))];
  const projectName = (id) => (projects.find((p) => p.id === id) || {}).name;

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
              <ActionRow
                key={a.id}
                action={a}
                contexts={contexts}
                projects={projects}
                projectName={projectName}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onAddContext={onAddContext}
              />
            ))}
          </div>
        ))
      )}

      {/* Always visible, even with nothing in it yet — hiding this entirely
          when empty made the feature impossible to discover. */}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Recently completed ({history.length})
        </button>
        {showHistory && (
          history.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8, padding: '4px 2px' }}>
              Nothing completed yet — items you check off will show up here.
            </div>
          ) : (
            history.map((a) => (
              <div key={a.id} className="card row" style={{ justifyContent: 'space-between', opacity: 0.7, marginTop: 8 }}>
                <div>
                  <span style={{ textDecoration: 'line-through' }}>{a.text}</span>
                  {a.projectId && <span className="chip project" style={{ marginLeft: 8 }}>{projectName(a.projectId)}</span>}
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Completed {fmtDate(a.completedAt)}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => onUndo(a.id)}>Undo</button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
