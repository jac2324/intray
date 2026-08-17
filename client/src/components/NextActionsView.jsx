import React, { useState } from 'react';
import { ListChecks, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import AddActionForm from './AddActionForm.jsx';
import { EmptyState } from './Shared.jsx';

export default function NextActionsView({ actions, projects, contexts, onComplete, onUndo, onDelete, onAdd, onAddContext }) {
  const [projectFilter, setProjectFilter] = useState('');
  const [showDone, setShowDone] = useState(false);

  const next = actions.filter(
    (a) => a.status === 'next' && (!projectFilter || a.projectId === Number(projectFilter))
  );
  const done = actions.filter((a) => a.status === 'done').slice(-10).reverse();

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
              <div key={a.id} className="card row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <button className="checkbox-btn" onClick={() => onComplete(a.id)} aria-label="Complete action" />
                  <span>{a.text}</span>
                  {a.projectId && <span className="chip project">{projectName(a.projectId)}</span>}
                </div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(a.id)} aria-label="Delete action"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        ))
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowDone((s) => !s)}>
            {showDone ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Recently completed ({done.length})
          </button>
          {showDone && done.map((a) => (
            <div key={a.id} className="card row" style={{ justifyContent: 'space-between', opacity: 0.6, marginTop: 8 }}>
              <span style={{ textDecoration: 'line-through' }}>{a.text}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => onUndo(a.id)}>Undo</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
