import React, { useState } from 'react';
import { FolderKanban, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import AddActionForm from './AddActionForm.jsx';
import { EmptyState } from './Shared.jsx';

function ProjectRow({ project, actions, contexts, onComplete, onAddAction, onAddContext }) {
  const [expanded, setExpanded] = useState(false);
  const projectActions = actions.filter((a) => a.projectId === project.id && a.status === 'next');
  const stalled = projectActions.length === 0;

  return (
    <div className="card project-card">
      <div className="row" style={{ justifyContent: 'space-between' }} onClick={() => setExpanded((e) => !e)}>
        <div>
          <div className="project-name">{project.name}</div>
          {project.outcome && <div className="project-outcome">{project.outcome}</div>}
          {stalled ? (
            <div className="stalled-flag"><AlertTriangle size={12} /> No next action — this project may be stalled</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
              {projectActions.length} next action{projectActions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {projectActions.map((a) => (
            <div key={a.id} className="row" style={{ marginBottom: 6 }}>
              <span className="chip">{a.context}</span>
              <span style={{ fontSize: 13 }}>{a.text}</span>
            </div>
          ))}
          <div onClick={(e) => e.stopPropagation()}>
            <AddActionForm
              contexts={contexts}
              projects={[]}
              hideProjectPicker
              onAddContext={onAddContext}
              onAdd={(text, context) => onAddAction(project.id, text, context)}
            />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); onComplete(project.id); }}>
            <CheckCircle2 size={13} /> Mark project complete
          </button>
        </div>
      )}
    </div>
  );
}

function NewProjectForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState('');
  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)}><Plus size={13} /> New project</button>;
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), outcome.trim());
    setName('');
    setOutcome('');
    setOpen(false);
  };
  return (
    <div className="card">
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" autoFocus />
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What does done look like? (optional)" />
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Create</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export default function ProjectsView({ projects, actions, contexts, onAdd, onComplete, onAddAction, onAddContext }) {
  const active = projects.filter((p) => p.status === 'active');
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <NewProjectForm onAdd={onAdd} />
      </div>
      {active.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No active projects">Add one to break a bigger outcome into next actions.</EmptyState>
      ) : (
        active.map((p) => (
          <ProjectRow key={p.id} project={p} actions={actions} contexts={contexts} onComplete={onComplete} onAddAction={onAddAction} onAddContext={onAddContext} />
        ))
      )}
    </div>
  );
}
