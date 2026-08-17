import React, { useState } from 'react';
import { ArrowRight, Check, Trash2, Lightbulb, Inbox } from 'lucide-react';
import ContextPicker from './ContextPicker.jsx';
import { EmptyState } from './Shared.jsx';

// The GTD clarify flow, one step at a time:
//   actionable? -> no: trash / someday
//               -> yes: <2min? -> yes: do it now
//                               -> no: yours to do? -> delegate -> waiting for
//                                                    -> keep -> next action
function InboxItem({ item, contexts, projects, openActionOptions, onResolve, onAddContext }) {
  const [step, setStep] = useState('closed');
  const [text, setText] = useState(item.text);
  const [context, setContext] = useState(contexts[0] || '');
  const [projectChoice, setProjectChoice] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [parentChoice, setParentChoice] = useState('');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => setStep('closed');

  const resolve = async (resolution) => {
    setBusy(true);
    try {
      await onResolve(item, resolution);
    } finally {
      setBusy(false);
    }
  };

  const finishTrash = () => resolve({ type: 'trash' });
  const finishSomeday = () => resolve({ type: 'someday' });
  const finishDone = () => resolve({ type: 'done' });
  const finishWaiting = () => {
    if (!who.trim()) return;
    resolve({ type: 'waiting', who: who.trim() });
  };
  const finishAction = () => {
    if (!text.trim()) return;
    if (parentChoice) {
      // Attaching to an existing action as a sub-step — project is
      // inherited from that parent, so no project fields are sent.
      resolve({ type: 'action', text: text.trim(), context, parentActionId: Number(parentChoice) });
      return;
    }
    resolve({
      type: 'action',
      text: text.trim(),
      context,
      projectId: projectChoice && projectChoice !== 'new' ? Number(projectChoice) : null,
      newProjectName: projectChoice === 'new' ? newProjectName.trim() : null,
    });
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{item.text}</span>
        {step === 'closed' && (
          <button className="btn btn-sm" onClick={() => setStep('actionable')} disabled={item._optimistic}>
            Process <ArrowRight size={13} />
          </button>
        )}
      </div>

      {step === 'actionable' && (
        <div className="clarify-box">
          <div className="clarify-q">Is this actionable?</div>
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setStep('twoMin')}>Yes</button>
            <button className="btn btn-sm" onClick={() => setStep('notActionable')}>No</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {step === 'notActionable' && (
        <div className="clarify-box">
          <div className="clarify-q">Not actionable — what should happen to it?</div>
          <div className="clarify-actions">
            <button className="btn btn-sm" disabled={busy} onClick={finishSomeday}><Lightbulb size={13} /> Someday/Maybe</button>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={finishTrash}><Trash2 size={13} /> Trash it</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'twoMin' && (
        <div className="clarify-box">
          <div className="clarify-q">Will it take less than 2 minutes?</div>
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={finishDone}><Check size={13} /> Yes — do it now</button>
            <button className="btn btn-sm" onClick={() => setStep('whoDoes')}>No</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'whoDoes' && (
        <div className="clarify-box">
          <div className="clarify-q">Is this yours to do?</div>
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setStep('nextAction')}>I'll do it</button>
            <button className="btn btn-sm" onClick={() => setStep('delegate')}>Delegate it</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'delegate' && (
        <div className="clarify-box">
          <div className="clarify-q">Who's it waiting on?</div>
          <input
            className="text-input"
            style={{ width: '100%', marginBottom: 10 }}
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="e.g. Sam, the plumber…"
            autoFocus
          />
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" disabled={busy || !who.trim()} onClick={finishWaiting}>Add to Waiting For</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'nextAction' && (
        <div className="clarify-box">
          <div className="clarify-q">Set the next action</div>
          <input className="text-input" style={{ width: '100%', marginBottom: 10 }} value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Context</div>
          <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
          {openActionOptions.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Attach to an existing action (optional)</div>
              <select className="text-input" style={{ width: '100%', marginBottom: 10 }} value={parentChoice} onChange={(e) => setParentChoice(e.target.value)}>
                <option value="">— Top-level action —</option>
                {openActionOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </>
          )}
          {!parentChoice && (
            <>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Project (optional)</div>
              <select className="text-input" style={{ width: '100%', marginBottom: 10 }} value={projectChoice} onChange={(e) => setProjectChoice(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="new">+ New project…</option>
              </select>
              {projectChoice === 'new' && (
                <input className="text-input" style={{ width: '100%', marginBottom: 10 }} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Project name" />
              )}
            </>
          )}
          {parentChoice && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
              Project is inherited from the parent action.
            </div>
          )}
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()} onClick={finishAction}>
              {parentChoice ? 'Add as Sub-action' : 'Add Next Action'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxView({ inbox, contexts, projects, openActionOptions, onResolve, onAddContext }) {
  if (inbox.length === 0) {
    return (
      <EmptyState icon={Inbox} title="Inbox zero">
        Nothing waiting to be processed. Capture something above whenever it crosses your mind.
      </EmptyState>
    );
  }
  return (
    <div>
      {inbox.map((item) => (
        <InboxItem
          key={item.id}
          item={item}
          contexts={contexts}
          projects={projects}
          openActionOptions={openActionOptions}
          onResolve={onResolve}
          onAddContext={onAddContext}
        />
      ))}
    </div>
  );
}
