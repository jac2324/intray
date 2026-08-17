import React, { useState } from 'react';
import { Clock, Check, Plus } from 'lucide-react';
import ContextPicker from './ContextPicker.jsx';
import { EmptyState, fmtDate } from './Shared.jsx';

function ConvertWaitingForm({ item, contexts, projects, onConvert, onCancel, onAddContext }) {
  const [text, setText] = useState(item.text);
  const [context, setContext] = useState(contexts[0] || '');
  const [projectId, setProjectId] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onConvert(item, text.trim(), context, projectId ? Number(projectId) : null);
  };
  return (
    <div className="clarify-box">
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={text} onChange={(e) => setText(e.target.value)} />
      <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
      <select className="text-input" style={{ width: '100%', marginBottom: 8 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">No project</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Add as Next Action</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function WaitingRow({ item, contexts, projects, onDone, onConvertToAction, onAddContext }) {
  const [converting, setConverting] = useState(false);
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div>{item.text}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Waiting on <strong>{item.who}</strong> · since {fmtDate(item.createdAt)}</div>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => setConverting((c) => !c)}>Heard back</button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDone(item.id)} aria-label="Resolve"><Check size={13} /></button>
        </div>
      </div>
      {converting && (
        <ConvertWaitingForm
          item={item}
          contexts={contexts}
          projects={projects}
          onAddContext={onAddContext}
          onConvert={(it, text, context, projectId) => { onConvertToAction(it, text, context, projectId); setConverting(false); }}
          onCancel={() => setConverting(false)}
        />
      )}
    </div>
  );
}

function AddWaitingForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [who, setWho] = useState('');
  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)}><Plus size={13} /> Add something you're waiting on</button>;
  const submit = () => {
    if (!text.trim() || !who.trim()) return;
    onAdd(text.trim(), who.trim());
    setText('');
    setWho('');
    setOpen(false);
  };
  return (
    <div className="card">
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="What are you waiting on?" autoFocus />
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={who} onChange={(e) => setWho(e.target.value)} placeholder="Waiting on whom?" />
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export default function WaitingView({ waiting, contexts, projects, onDone, onConvertToAction, onAdd, onAddContext }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}><AddWaitingForm onAdd={onAdd} /></div>
      {waiting.length === 0 ? (
        <EmptyState icon={Clock} title="Nothing pending">Delegate something from your inbox, or add one directly, and it'll show up here.</EmptyState>
      ) : (
        waiting.map((w) => (
          <WaitingRow key={w.id} item={w} contexts={contexts} projects={projects} onDone={onDone} onConvertToAction={onConvertToAction} onAddContext={onAddContext} />
        ))
      )}
    </div>
  );
}
