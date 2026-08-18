import React, { useState } from 'react';
import { FolderKanban, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Plus, Pencil, CalendarDays } from 'lucide-react';
import AddActionForm from './AddActionForm.jsx';
import ActionRow from './ActionRow.jsx';
import { EmptyState, fmtDueDate, isOverdue } from './Shared.jsx';

function EditProjectForm({ project, onSave, onCancel }) {
  const [name, setName] = useState(project.name);
  const [outcome, setOutcome] = useState(project.outcome || '');
  const [dueDate, setDueDate] = useState(project.dueDate || '');
  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), outcome: outcome.trim(), dueDate: dueDate || null });
  };
  return (
    <div className="clarify-box" onClick={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Project name</div>
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>What does done look like?</div>
      <input className="text-input" style={{ width: '100%', marginBottom: 10 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="(optional)" />
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Due date</div>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <input type="date" className="text-input" style={{ flex: 1 }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {dueDate && <button className="btn btn-ghost btn-sm" onClick={() => setDueDate('')}>Clear</button>}
      </div>
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ProjectRow({ project, actions, contexts, onCompleteProject, onEditProject, onCompleteAction, onDeleteAction, onEditAction, onAddAction, onAddSubAction, onAddContext }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  // The visible list is root actions only — sub-actions show up by
  // expanding one of these, not as their own rows here. But "stalled"
  // means genuinely nothing to do, at any depth: a project whose root
  // action is done but still has an open sub-action underneath it isn't
  // stalled, since there's still a real next physical step.
  const projectActions = actions.filter((a) => a.projectId === project.id && a.status === 'next' && a.parentActionId == null);
  const hasAnyOpenAction = actions.some((a) => a.projectId === project.id && a.status === 'next');
  const stalled = !hasAnyOpenAction;
  const overdue = project.status === 'active' && isOverdue(project.dueDate);

  return (
    <div className="card project-card">
      <div className="row" style={{ justifyContent: 'space-between' }} onClick={() => setExpanded((e) => !e)}>
        <div>
          <div className="row" style={{ gap: 8 }}>
            <div className="project-name">{project.name}</div>
            {project.dueDate && (
              <span className={`chip due${overdue ? ' overdue' : ''}`}>
                <CalendarDays size={11} /> {fmtDueDate(project.dueDate)}
              </span>
            )}
          </div>
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
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <EditProjectForm
              project={project}
              onSave={(patch) => { onEditProject(project.id, patch); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              {projectActions.map((a) => (
                <div key={a.id} style={{ marginBottom: 6 }}>
                  <ActionRow
                    action={a}
                    allActions={actions}
                    contexts={contexts}
                    hideProjectPicker
                    onComplete={onCompleteAction}
                    onDelete={onDeleteAction}
                    onEdit={onEditAction}
                    onAddSubAction={onAddSubAction}
                    onAddContext={onAddContext}
                  />
                </div>
              ))}
              <div style={{ marginTop: projectActions.length ? 8 : 0 }}>
                <AddActionForm
                  contexts={contexts}
                  projects={[]}
                  hideProjectPicker
                  onAddContext={onAddContext}
                  onAdd={(text, context) => onAddAction(project.id, text, context)}
                />
              </div>
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                  <Pencil size={13} /> Edit project
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onCompleteProject(project.id)}>
                  <CheckCircle2 size={13} /> Mark project complete
                </button>
              </div>
            </>
          )}
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

export default function ProjectsView({ projects, actions, contexts, onAdd, onCompleteProject, onEditProject, onCompleteAction, onDeleteAction, onEditAction, onAddAction, onAddSubAction, onAddContext }) {
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
          <ProjectRow
            key={p.id}
            project={p}
            actions={actions}
            contexts={contexts}
            onCompleteProject={onCompleteProject}
            onEditProject={onEditProject}
            onCompleteAction={onCompleteAction}
            onDeleteAction={onDeleteAction}
            onEditAction={onEditAction}
            onAddAction={onAddAction}
            onAddSubAction={onAddSubAction}
            onAddContext={onAddContext}
          />
        ))
      )}
    </div>
  );
}
