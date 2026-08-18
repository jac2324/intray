import React, { useState } from 'react';
import { Trash2, Pencil, ChevronDown, ChevronRight, Plus, StickyNote, CalendarDays } from 'lucide-react';
import ContextPicker from './ContextPicker.jsx';
import { getChildren, countDescendants } from '../utils/actionTree.js';
import { fmtDueDate, isOverdue } from './Shared.jsx';

const INDENT_PER_LEVEL = 16; // px

function AddSubActionForm({ contexts, defaultContext, onAdd, onAddContext }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [context, setContext] = useState(defaultContext || contexts[0] || '');

  if (!open) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Plus size={13} /> Add sub-action
      </button>
    );
  }
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), context);
    setText('');
    setOpen(false);
  };
  return (
    <div className="card" style={{ marginTop: 6 }}>
      <input
        className="text-input"
        style={{ width: '100%', marginBottom: 8 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's the smaller step?"
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

// A single Next Action row — and, recursively, its whole sub-action
// subtree. hideProjectPicker/no project chip applies to anything that
// isn't a genuine top-level action shown in the main (project-agnostic)
// Next Actions list: every nested row, and every row shown inside an
// already-project-scoped Projects view.
export default function ActionRow({
  action,
  allActions,
  contexts,
  projects,
  projectName,
  depth = 0,
  hideProjectPicker = false,
  onComplete,
  onDelete,
  onEdit,
  onAddSubAction,
  onAddContext,
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(action.text);
  const [context, setContext] = useState(action.context || contexts[0] || '');
  const [projectId, setProjectId] = useState(action.projectId ? String(action.projectId) : '');
  const [notes, setNotes] = useState(action.notes || '');
  const [dueDate, setDueDate] = useState(action.dueDate || '');

  const children = getChildren(allActions, action.id);
  const openChildren = children.filter((a) => a.status === 'next');
  const hasNotes = !!(action.notes && action.notes.trim());
  const overdue = action.status === 'next' && isOverdue(action.dueDate);

  const startEdit = () => {
    setText(action.text);
    setContext(action.context || contexts[0] || '');
    setProjectId(action.projectId ? String(action.projectId) : '');
    setNotes(action.notes || '');
    setDueDate(action.dueDate || '');
    setEditing(true);
  };

  const save = () => {
    if (!text.trim()) return;
    onEdit(action.id, {
      text: text.trim(),
      context,
      projectId: hideProjectPicker ? action.projectId : projectId ? Number(projectId) : null,
      notes: notes.trim(),
      dueDate: dueDate || null,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    const descendantCount = countDescendants(allActions, action.id);
    if (descendantCount > 0) {
      const ok = window.confirm(
        `Delete "${action.text}"? This will also delete its ${descendantCount} sub-action${descendantCount !== 1 ? 's' : ''} — this can't be undone.`
      );
      if (!ok) return;
    }
    onDelete(action.id);
  };

  if (editing) {
    return (
      <div className="card" style={{ marginLeft: depth * INDENT_PER_LEVEL }}>
        <input
          className="text-input"
          style={{ width: '100%', marginBottom: 8 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
        />
        <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
        {!hideProjectPicker && (
          <select className="text-input" style={{ width: '100%', marginBottom: 10 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Due date</div>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <input
            type="date"
            className="text-input"
            style={{ flex: 1 }}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {dueDate && (
            <button className="btn btn-ghost btn-sm" onClick={() => setDueDate('')}>Clear</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Notes</div>
        <textarea
          className="text-input"
          style={{ width: '100%', marginBottom: 10, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes…"
        />
        <div className="clarify-actions">
          <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: depth * INDENT_PER_LEVEL }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row row-wrap" style={{ minWidth: 0, rowGap: 4 }}>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? 'Collapse sub-actions' : 'Expand sub-actions'}
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <button className="checkbox-btn" onClick={() => onComplete(action.id)} aria-label="Complete action" />
            <span>{action.text}</span>
            {hasNotes && <StickyNote size={12} color="var(--amber)" aria-label="Has notes" />}
            {action.dueDate && (
              <span className={`chip due${overdue ? ' overdue' : ''}`}>
                <CalendarDays size={11} /> {fmtDueDate(action.dueDate)}
              </span>
            )}
            {hideProjectPicker && action.context && <span className="chip">{action.context}</span>}
            {!hideProjectPicker && action.projectId && <span className="chip project">{projectName(action.projectId)}</span>}
            {openChildren.length > 0 && (
              <span className="chip" style={{ fontFamily: 'var(--font-mono)' }}>{openChildren.length} sub</span>
            )}
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={startEdit} aria-label="Edit action">
              <Pencil size={13} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={handleDelete} aria-label="Delete action">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            {openChildren.map((child) => (
              <div key={child.id} style={{ marginBottom: 6 }}>
                <ActionRow
                  action={child}
                  allActions={allActions}
                  contexts={contexts}
                  projects={projects}
                  projectName={projectName}
                  depth={depth + 1}
                  hideProjectPicker
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onAddSubAction={onAddSubAction}
                  onAddContext={onAddContext}
                />
              </div>
            ))}
            <div style={{ marginLeft: INDENT_PER_LEVEL }}>
              <AddSubActionForm
                contexts={contexts}
                defaultContext={action.context}
                onAdd={(childText, childContext) => onAddSubAction(action.id, childText, childContext)}
                onAddContext={onAddContext}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
