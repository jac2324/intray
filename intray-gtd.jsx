import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox, ListChecks, FolderKanban, Clock, Lightbulb, RotateCcw,
  Plus, Check, Trash2, ChevronDown, ChevronRight, ArrowRight,
  AlertTriangle, Sparkles, CheckCircle2, Loader2, Settings, Lock
} from 'lucide-react';

const STORAGE_KEY = 'intray:gtd-state';

const DEFAULT_CONTEXTS = ['Calls', 'Errands', 'Computer', 'Home', 'Office', 'Anywhere'];

const DEFAULT_STATE = {
  inbox: [],
  projects: [],
  actions: [],
  waiting: [],
  someday: [],
  contexts: DEFAULT_CONTEXTS,
  lastReview: null,
  reviewChecks: {},
};

const TABS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'next', label: 'Next Actions', icon: ListChecks },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'waiting', label: 'Waiting For', icon: Clock },
  { id: 'someday', label: 'Someday/Maybe', icon: Lightbulb },
  { id: 'review', label: 'Weekly Review', icon: RotateCcw },
];

const REVIEW_STEPS = [
  { id: 'loose', phase: 'Get Clear', text: 'Collect loose papers & materials', hint: 'Round up anything physical or digital that has landed on your desk, bag, or notes app since last time.' },
  { id: 'inboxzero', phase: 'Get Clear', text: 'Get your Inbox to zero', hint: 'dynamic-inbox' },
  { id: 'reviewactions', phase: 'Get Current', text: 'Review your Next Actions lists', hint: 'Cross off anything already done, and rewrite anything too vague to act on.' },
  { id: 'reviewwaiting', phase: 'Get Current', text: 'Review your Waiting For list', hint: 'dynamic-waiting' },
  { id: 'reviewprojects', phase: 'Get Current', text: 'Review every active project', hint: 'dynamic-projects' },
  { id: 'reviewcalendar', phase: 'Get Current', text: 'Look back and ahead on your calendar', hint: 'Capture any actions that fell out of recent or upcoming events.' },
  { id: 'reviewsomeday', phase: 'Get Creative', text: 'Revisit your Someday/Maybe list', hint: 'dynamic-someday' },
  { id: 'newideas', phase: 'Get Creative', text: 'Capture any new ideas or commitments', hint: "Let your mind wander \u2014 anything else you're carrying that isn't captured yet?" },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const day = 86400000;
  const days = Math.floor(diff / day);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  return `${weeks} weeks ago`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// --- Client-side encryption helpers (Web Crypto API) ---
// Nothing here ever leaves the browser: the passphrase is never stored,
// and only the derived key lives in memory for the session.

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(passphrase, saltBuf) {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 200000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptJSON(key, saltB64, obj) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 2, salt: saltB64, iv: bufToB64(iv), ct: bufToB64(ct) };
}

async function decryptJSON(key, blob) {
  const iv = new Uint8Array(b64ToBuf(blob.iv));
  const ctBuf = b64ToBuf(blob.ct);
  const ptBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ctBuf);
  return JSON.parse(new TextDecoder().decode(ptBuf));
}

const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=Karla:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.gtd-app {
  --paper: #F6F5F0;
  --paper-raised: #FCFBF8;
  --ink: #20242C;
  --ink-soft: #676F7D;
  --ink-faint: #9BA0AA;
  --indigo: #3D5A99;
  --indigo-soft: #E7ECF6;
  --amber: #B9791F;
  --amber-soft: #F6EBD8;
  --rust: #B5573C;
  --rust-soft: #F5E5DF;
  --sage: #5C7F62;
  --sage-soft: #E4EBE1;
  --line: #E3DFD3;
  font-family: 'Karla', sans-serif;
  color: var(--ink);
  background-color: var(--paper);
  background-image: radial-gradient(rgba(32,36,44,0.07) 1px, transparent 1px);
  background-size: 22px 22px;
  min-height: 100%;
  padding-bottom: 40px;
}

.gtd-header { max-width: 760px; margin: 0 auto; padding: 32px 20px 8px; }
.gtd-title { font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 28px; letter-spacing: -0.01em; margin: 0; }
.gtd-tagline { color: var(--ink-soft); font-size: 13px; margin-top: 4px; }

.capture-wrap { max-width: 760px; margin: 18px auto 0; padding: 0 20px; }
.capture-bar { display: flex; gap: 8px; background: var(--paper-raised); border: 1px solid var(--line); border-radius: 10px; padding: 10px 10px 10px 16px; box-shadow: 0 1px 2px rgba(32,36,44,0.05); }
.capture-input { flex: 1; border: none; background: transparent; outline: none; font-family: 'Karla', sans-serif; font-size: 15px; color: var(--ink); min-width: 0; }
.capture-input::placeholder { color: var(--ink-faint); }
.capture-btn { display: flex; align-items: center; gap: 6px; background: var(--indigo); color: #fff; border: none; padding: 8px 14px; border-radius: 7px; font-family: 'Karla', sans-serif; font-weight: 600; font-size: 14px; cursor: pointer; transition: transform .12s ease, background .12s ease; flex-shrink: 0; }
.capture-btn:hover { background: #33497f; }
.capture-btn:active { transform: scale(.96); }

.tab-nav { max-width: 760px; margin: 22px auto 0; padding: 0 20px; display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--line); }
.tab-btn { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border: none; background: transparent; font-family: 'Karla', sans-serif; font-weight: 600; font-size: 13px; color: var(--ink-soft); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; transition: color .15s ease, border-color .15s ease; }
.tab-btn.active { color: var(--indigo); border-bottom-color: var(--indigo); }
.tab-badge { font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: var(--indigo-soft); color: var(--indigo); padding: 1px 6px; border-radius: 999px; }
.tab-badge.pulse { animation: pulseTray .5s ease; }
.tab-badge.due { background: var(--rust-soft); color: var(--rust); }

@keyframes pulseTray { 0% { transform: scale(1); } 40% { transform: scale(1.4); } 100% { transform: scale(1); } }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

.gtd-main { max-width: 760px; margin: 0 auto; padding: 20px 20px 40px; }

.section-title { font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-soft); margin: 22px 0 10px; }
.section-title:first-child { margin-top: 0; }

.card { background: var(--paper-raised); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 8px; }
.row { display: flex; align-items: center; gap: 10px; }

.checkbox-btn { width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid var(--ink-faint); background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background .12s, border-color .12s; padding: 0; }
.checkbox-btn.checked { background: var(--sage); border-color: var(--sage); }

.chip { font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--amber-soft); color: var(--amber); white-space: nowrap; }
.chip.project { background: var(--indigo-soft); color: var(--indigo); }

.btn { font-family: 'Karla', sans-serif; font-weight: 600; font-size: 13px; padding: 7px 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--paper-raised); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .12s ease; }
.btn:hover { border-color: var(--ink-faint); }
.btn-primary { background: var(--indigo); border-color: var(--indigo); color: #fff; }
.btn-primary:hover { background: #33497f; }
.btn-ghost { background: transparent; border-color: transparent; color: var(--ink-soft); }
.btn-ghost:hover { color: var(--ink); }
.btn-danger { color: var(--rust); }
.btn-danger:hover { background: var(--rust-soft); border-color: var(--rust-soft); }
.btn-sm { padding: 5px 9px; font-size: 12px; }

.empty-state { text-align: center; padding: 40px 20px; color: var(--ink-soft); }
.empty-state svg { opacity: .35; margin-bottom: 10px; }
.empty-state p { font-size: 14px; max-width: 320px; margin: 4px auto 0; }
.empty-title { font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 16px; color: var(--ink); }

.clarify-box { background: var(--indigo-soft); border-radius: 8px; padding: 14px; margin-top: 10px; }
.clarify-q { font-weight: 600; font-size: 14px; margin-bottom: 10px; }
.clarify-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.chip-picker { display: flex; gap: 6px; flex-wrap: wrap; }
.chip-option { font-family: 'IBM Plex Mono', monospace; font-size: 12px; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--paper-raised); cursor: pointer; color: var(--ink-soft); }
.chip-option.selected { background: var(--ink); border-color: var(--ink); color: #fff; }

.text-input { font-family: 'Karla', sans-serif; font-size: 14px; color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; outline: none; }
input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }

.stalled-flag { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--rust); margin-top: 4px; }

.project-card { cursor: pointer; }
.project-name { font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 16px; }
.project-outcome { color: var(--ink-soft); font-size: 13px; margin-top: 2px; }

.review-phase-title { font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 14px; margin: 20px 0 8px; display: flex; align-items: center; gap: 6px; color: var(--ink); }
.review-step { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--line); }
.review-step:last-child { border-bottom: none; }
.review-step-text { font-weight: 600; font-size: 14px; }
.review-step-hint { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
.review-step.done .review-step-text { text-decoration: line-through; color: var(--ink-faint); }

.save-toast { position: fixed; bottom: 16px; right: 16px; background: var(--rust); color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.15); }

@media (prefers-reduced-motion: reduce) {
  .tab-badge.pulse, .spin { animation: none !important; }
  .btn, .capture-btn, .checkbox-btn, .tab-btn { transition: none !important; }
}
`;

function LoadingScreen() {
  return (
    <div className="gtd-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <style>{APP_CSS}</style>
      <div className="row" style={{ color: 'var(--ink-soft)', fontFamily: 'Karla, sans-serif', fontSize: 14 }}>
        <Loader2 size={16} className="spin" /> Loading your system…
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <div className="empty-title">{title}</div>
      <p>{children}</p>
    </div>
  );
}

function PassphraseGate({ mode, error, hasLegacyData, onSetup, onUnlock }) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const submit = async () => {
    setLocalError('');
    if (mode === 'setup') {
      if (pass.length < 8) { setLocalError('Use at least 8 characters.'); return; }
      if (pass !== confirm) { setLocalError("Passphrases don't match."); return; }
      setBusy(true);
      await onSetup(pass);
      setBusy(false);
    } else {
      if (!pass) return;
      setBusy(true);
      await onUnlock(pass);
      setBusy(false);
    }
  };

  return (
    <div className="gtd-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
      <style>{APP_CSS}</style>
      <div className="card" style={{ width: 320, maxWidth: '90%' }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <Lock size={16} color="var(--indigo)" />
          <div className="gtd-title" style={{ fontSize: 19 }}>
            {mode === 'setup' ? 'Secure Intray' : 'Unlock Intray'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 14px' }}>
          {mode === 'setup'
            ? (hasLegacyData
              ? "Set a passphrase to encrypt your existing data. It's encrypted right here in your browser before it's ever saved — Anthropic's storage only ever sees ciphertext."
              : "Set a passphrase to encrypt your data. It's encrypted right here in your browser before it's ever saved — Anthropic's storage only ever sees ciphertext.")
            : 'Enter your passphrase to decrypt your data.'}
        </div>
        <input
          type="password"
          className="text-input"
          style={{ width: '100%', marginBottom: 8 }}
          placeholder="Passphrase"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && mode === 'unlock') submit(); }}
          autoFocus
        />
        {mode === 'setup' && (
          <input
            type="password"
            className="text-input"
            style={{ width: '100%', marginBottom: 8 }}
            placeholder="Confirm passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        )}
        {(localError || error) && (
          <div style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 8 }}>{localError || error}</div>
        )}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : (mode === 'setup' ? 'Encrypt & continue' : 'Unlock')}
        </button>
        {mode === 'setup' && (
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 10 }}>
            There's no password reset. If you forget this passphrase, your data can't be recovered.
          </div>
        )}
      </div>
    </div>
  );
}

function CaptureBar({ onCapture }) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    setText('');
  };
  return (
    <div className="capture-wrap">
      <div className="capture-bar">
        <input
          className="capture-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Capture anything on your mind…"
          aria-label="Capture a new item"
        />
        <button className="capture-btn" onClick={submit}>
          <Plus size={15} /> Capture
        </button>
      </div>
    </div>
  );
}

function TabNav({ activeTab, setActiveTab, counts, pulse, reviewDue }) {
  return (
    <div className="tab-nav">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const count = counts[tab.id];
        const isReview = tab.id === 'review';
        return (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon size={15} />
            {tab.label}
            {isReview
              ? (reviewDue && <span className="tab-badge due">due</span>)
              : (count > 0 && <span className={`tab-badge${tab.id === 'inbox' && pulse ? ' pulse' : ''}`}>{count}</span>)}
          </button>
        );
      })}
    </div>
  );
}

function ContextPicker({ contexts, value, onChange, onAddContext }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className="chip-picker" style={{ marginBottom: 10 }}>
      {contexts.map((c) => (
        <button key={c} type="button" className={`chip-option${value === c ? ' selected' : ''}`} onClick={() => onChange(c)}>{c}</button>
      ))}
      {adding ? (
        <input
          className="text-input"
          style={{ width: 100, padding: '4px 8px', fontSize: 12 }}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              onAddContext(text.trim());
              onChange(text.trim());
              setText('');
              setAdding(false);
            }
          }}
          onBlur={() => setAdding(false)}
          placeholder="New…"
        />
      ) : (
        <button type="button" className="chip-option" onClick={() => setAdding(true)}>+ New</button>
      )}
    </div>
  );
}

function InboxItem({ item, contexts, projects, onResolve, onAddContext }) {
  const [step, setStep] = useState('closed');
  const [text, setText] = useState(item.text);
  const [context, setContext] = useState(contexts[0] || '');
  const [projectChoice, setProjectChoice] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [who, setWho] = useState('');

  const reset = () => setStep('closed');
  const finishTrash = () => onResolve(item, { type: 'trash' });
  const finishSomeday = () => onResolve(item, { type: 'someday' });
  const finishDone = () => onResolve(item, { type: 'done' });
  const finishWaiting = () => {
    if (!who.trim()) return;
    onResolve(item, { type: 'waiting', who: who.trim() });
  };
  const finishAction = () => {
    if (!text.trim()) return;
    onResolve(item, {
      type: 'action',
      text: text.trim(),
      context,
      projectId: projectChoice && projectChoice !== 'new' ? projectChoice : null,
      newProjectName: projectChoice === 'new' ? newProjectName.trim() : null,
    });
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{item.text}</span>
        {step === 'closed' && (
          <button className="btn btn-sm" onClick={() => setStep('actionable')}>
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
            <button className="btn btn-sm" onClick={finishSomeday}><Lightbulb size={13} /> Someday/Maybe</button>
            <button className="btn btn-danger btn-sm" onClick={finishTrash}><Trash2 size={13} /> Trash it</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'twoMin' && (
        <div className="clarify-box">
          <div className="clarify-q">Will it take less than 2 minutes?</div>
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" onClick={finishDone}><Check size={13} /> Yes — do it now</button>
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
          <input className="text-input" style={{ width: '100%', marginBottom: 10 }} value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. Sam, the plumber…" autoFocus />
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" onClick={finishWaiting}>Add to Waiting For</button>
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
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Project (optional)</div>
          <select className="text-input" style={{ width: '100%', marginBottom: 10 }} value={projectChoice} onChange={(e) => setProjectChoice(e.target.value)}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="new">+ New project…</option>
          </select>
          {projectChoice === 'new' && (
            <input className="text-input" style={{ width: '100%', marginBottom: 10 }} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Project name" />
          )}
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" onClick={finishAction}>Add Next Action</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InboxView({ inbox, contexts, projects, onResolve, onAddContext }) {
  if (inbox.length === 0) {
    return <EmptyState icon={Inbox} title="Inbox zero">Nothing waiting to be processed. Capture something above whenever it crosses your mind.</EmptyState>;
  }
  return (
    <div>
      {inbox.map((item) => (
        <InboxItem key={item.id} item={item} contexts={contexts} projects={projects} onResolve={onResolve} onAddContext={onAddContext} />
      ))}
    </div>
  );
}

function AddActionForm({ contexts, projects, onAdd, onAddContext, hideProjectPicker }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [context, setContext] = useState(contexts[0] || '');
  const [projectId, setProjectId] = useState('');

  if (!open) {
    return <button className="btn btn-sm" onClick={() => setOpen(true)}><Plus size={13} /> Add next action</button>;
  }
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), context, projectId || null);
    setText('');
    setOpen(false);
  };
  return (
    <div className="card">
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="What's the next physical action?" autoFocus />
      <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
      {!hideProjectPicker && (
        <select className="text-input" style={{ width: '100%', marginBottom: 8 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function NextActionsView({ actions, projects, contexts, onComplete, onUndo, onDelete, onAdd, onAddContext }) {
  const [projectFilter, setProjectFilter] = useState('');
  const [showDone, setShowDone] = useState(false);

  const next = actions.filter((a) => a.status === 'next' && (!projectFilter || a.projectId === projectFilter));
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
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
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
            <div className="section-title">{ctx} <span style={{ opacity: .6 }}>· {grouped[ctx].length}</span></div>
            {grouped[ctx].map((a) => (
              <div key={a.id} className="card row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <button className="checkbox-btn" onClick={() => onComplete(a.id)} aria-label="Complete action" />
                  <span>{a.text}</span>
                  {a.projectId && <span className="chip project">{projectName(a.projectId)}</span>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(a.id)} aria-label="Delete action"><Trash2 size={13} /></button>
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
            <div key={a.id} className="card row" style={{ justifyContent: 'space-between', opacity: .6, marginTop: 8 }}>
              <span style={{ textDecoration: 'line-through' }}>{a.text}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => onUndo(a.id)}>Undo</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{projectActions.length} next action{projectActions.length !== 1 ? 's' : ''}</div>
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

function ProjectsView({ projects, actions, contexts, onAdd, onComplete, onAddAction, onAddContext }) {
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

function ConvertWaitingForm({ item, contexts, projects, onConvert, onCancel, onAddContext }) {
  const [text, setText] = useState(item.text);
  const [context, setContext] = useState(contexts[0] || '');
  const [projectId, setProjectId] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onConvert(item, text.trim(), context, projectId || null);
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
          <button className="btn btn-ghost btn-sm" onClick={() => onDone(item.id)} aria-label="Resolve"><Check size={13} /></button>
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

function WaitingView({ waiting, contexts, projects, onDone, onConvertToAction, onAdd, onAddContext }) {
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

function ActivateForm({ item, onActivate, onCancel }) {
  const [outcome, setOutcome] = useState('');
  return (
    <div className="clarify-box">
      <div className="clarify-q">Turn "{item.text}" into a project</div>
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What does done look like? (optional)" autoFocus />
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onActivate(item, outcome.trim())}>Create project</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function SomedayRow({ item, onActivate, onDelete }) {
  const [activating, setActivating] = useState(false);
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{item.text}</span>
        <div className="row">
          <button className="btn btn-sm" onClick={() => setActivating((a) => !a)}>Activate</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onDelete(item.id)} aria-label="Delete"><Trash2 size={13} /></button>
        </div>
      </div>
      {activating && (
        <ActivateForm item={item} onActivate={(it, o) => { onActivate(it, o); setActivating(false); }} onCancel={() => setActivating(false)} />
      )}
    </div>
  );
}

function AddSomedayForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)}><Plus size={13} /> Add a someday/maybe</button>;
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
    setOpen(false);
  };
  return (
    <div className="card">
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Something you might want to do one day…" autoFocus />
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function SomedayView({ someday, onActivate, onDelete, onAdd }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}><AddSomedayForm onAdd={onAdd} /></div>
      {someday.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No dreams parked yet">Capture something you're not ready to act on — it'll wait here until you are.</EmptyState>
      ) : (
        someday.map((s) => <SomedayRow key={s.id} item={s} onActivate={onActivate} onDelete={onDelete} />)
      )}
    </div>
  );
}

function ReviewView({ data, counts, onToggle, onCompleteReview }) {
  const dynamicHint = (id) => {
    if (id === 'inboxzero') return counts.inbox === 0 ? 'Inbox is already at zero. Nice.' : `${counts.inbox} item${counts.inbox !== 1 ? 's' : ''} still waiting in your inbox.`;
    if (id === 'reviewwaiting') return counts.waiting === 0 ? "You're not waiting on anyone right now." : `${counts.waiting} thing${counts.waiting !== 1 ? 's' : ''} you're waiting on.`;
    if (id === 'reviewprojects') return counts.stalled === 0 ? 'Every active project has a next action.' : `${counts.stalled} project${counts.stalled !== 1 ? 's' : ''} with no next action.`;
    if (id === 'reviewsomeday') return counts.someday === 0 ? 'Nothing parked in Someday/Maybe.' : `${counts.someday} idea${counts.someday !== 1 ? 's' : ''} parked for later.`;
    return null;
  };

  const phases = ['Get Clear', 'Get Current', 'Get Creative'];
  const checkedCount = REVIEW_STEPS.filter((s) => data.reviewChecks[s.id]).length;

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Last full review: {timeAgo(data.lastReview)}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{checkedCount} of {REVIEW_STEPS.length} steps checked this time</div>
      </div>

      {phases.map((phase) => (
        <div key={phase}>
          <div className="review-phase-title">
            {phase === 'Get Clear' && <CheckCircle2 size={14} />}
            {phase === 'Get Current' && <RotateCcw size={14} />}
            {phase === 'Get Creative' && <Sparkles size={14} />}
            {phase}
          </div>
          {REVIEW_STEPS.filter((s) => s.phase === phase).map((step) => {
            const checked = !!data.reviewChecks[step.id];
            const hint = step.hint.startsWith('dynamic') ? dynamicHint(step.id) : step.hint;
            return (
              <div key={step.id} className={`review-step${checked ? ' done' : ''}`}>
                <button className={`checkbox-btn${checked ? ' checked' : ''}`} onClick={() => onToggle(step.id)} aria-label={step.text}>
                  {checked && <Check size={13} color="#fff" />}
                </button>
                <div>
                  <div className="review-step-text">{step.text}</div>
                  <div className="review-step-hint">{hint}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onCompleteReview}>
        <CheckCircle2 size={15} /> Complete weekly review
      </button>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | setup | unlock | app
  const [legacyPayload, setLegacyPayload] = useState(null);
  const [gateError, setGateError] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [pulse, setPulse] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const keyRef = React.useRef(null);
  const saltRef = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (cancelled) return;
        if (!res || !res.value) {
          setPhase('setup');
          return;
        }
        let parsed = null;
        try { parsed = JSON.parse(res.value); } catch (e) { parsed = null; }
        if (parsed && parsed.v === 2 && parsed.salt && parsed.iv && parsed.ct) {
          setPhase('unlock');
        } else if (parsed && Array.isArray(parsed.inbox)) {
          setLegacyPayload({ ...DEFAULT_STATE, ...parsed });
          setPhase('setup');
        } else {
          setPhase('setup');
        }
      } catch (e) {
        if (!cancelled) setPhase('setup');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSetup = async (passphrase) => {
    setGateError('');
    try {
      const saltBuf = window.crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = bufToB64(saltBuf);
      const key = await deriveKey(passphrase, saltBuf);
      const initial = legacyPayload || { ...DEFAULT_STATE };
      const blob = await encryptJSON(key, saltB64, initial);
      await window.storage.set(STORAGE_KEY, JSON.stringify(blob), false);
      keyRef.current = key;
      saltRef.current = saltB64;
      setData(initial);
      setPhase('app');
    } catch (e) {
      setGateError("Couldn't set up encryption in this browser. Try a different browser or device.");
    }
  };

  const handleUnlock = async (passphrase) => {
    setGateError('');
    try {
      const res = await window.storage.get(STORAGE_KEY, false);
      const blob = JSON.parse(res.value);
      const saltBuf = b64ToBuf(blob.salt);
      const key = await deriveKey(passphrase, saltBuf);
      const decrypted = await decryptJSON(key, blob);
      keyRef.current = key;
      saltRef.current = blob.salt;
      setData({ ...DEFAULT_STATE, ...decrypted });
      setPhase('app');
    } catch (e) {
      setGateError("That passphrase didn't work. Try again.");
    }
  };

  const handleLock = () => {
    keyRef.current = null;
    setData(null);
    setPhase('unlock');
    setSettingsOpen(false);
  };

  const persist = useCallback(async (next) => {
    setData(next);
    if (!keyRef.current || !saltRef.current) return;
    try {
      const blob = await encryptJSON(keyRef.current, saltRef.current, next);
      await window.storage.set(STORAGE_KEY, JSON.stringify(blob), false);
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const handleCapture = (text) => {
    persist({ ...data, inbox: [...data.inbox, { id: uid(), text, createdAt: Date.now() }] });
    setPulse(true);
    setTimeout(() => setPulse(false), 500);
  };

  const handleResolveInboxItem = (item, resolution) => {
    const next = { ...data };
    next.inbox = data.inbox.filter((i) => i.id !== item.id);
    if (resolution.type === 'someday') {
      next.someday = [...data.someday, { id: uid(), text: item.text, createdAt: Date.now() }];
    } else if (resolution.type === 'waiting') {
      next.waiting = [...data.waiting, { id: uid(), text: item.text, who: resolution.who, createdAt: Date.now() }];
    } else if (resolution.type === 'action') {
      let projectId = resolution.projectId || null;
      let projects = data.projects;
      if (resolution.newProjectName) {
        const newProject = { id: uid(), name: resolution.newProjectName, outcome: '', status: 'active', createdAt: Date.now() };
        projects = [...data.projects, newProject];
        projectId = newProject.id;
      }
      next.projects = projects;
      next.actions = [...data.actions, { id: uid(), text: resolution.text, context: resolution.context, projectId, status: 'next', createdAt: Date.now() }];
    }
    persist(next);
  };

  const handleAddProject = (name, outcome) => {
    persist({ ...data, projects: [...data.projects, { id: uid(), name, outcome, status: 'active', createdAt: Date.now() }] });
  };

  const handleCompleteProject = (id) => {
    persist({ ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, status: 'completed' } : p)) });
  };

  const handleAddAction = (text, context, projectId) => {
    persist({ ...data, actions: [...data.actions, { id: uid(), text, context, projectId: projectId || null, status: 'next', createdAt: Date.now() }] });
  };

  const handleAddActionToProject = (projectId, text, context) => {
    persist({ ...data, actions: [...data.actions, { id: uid(), text, context, projectId, status: 'next', createdAt: Date.now() }] });
  };

  const handleCompleteAction = (id) => {
    persist({ ...data, actions: data.actions.map((a) => (a.id === id ? { ...a, status: 'done', completedAt: Date.now() } : a)) });
  };

  const handleUndoAction = (id) => {
    persist({ ...data, actions: data.actions.map((a) => (a.id === id ? { ...a, status: 'next', completedAt: null } : a)) });
  };

  const handleDeleteAction = (id) => {
    persist({ ...data, actions: data.actions.filter((a) => a.id !== id) });
  };

  const handleAddWaiting = (text, who) => {
    persist({ ...data, waiting: [...data.waiting, { id: uid(), text, who, createdAt: Date.now() }] });
  };

  const handleResolveWaitingDone = (id) => {
    persist({ ...data, waiting: data.waiting.filter((w) => w.id !== id) });
  };

  const handleConvertWaitingToAction = (item, text, context, projectId) => {
    const next = { ...data };
    next.waiting = data.waiting.filter((w) => w.id !== item.id);
    next.actions = [...data.actions, { id: uid(), text, context, projectId: projectId || null, status: 'next', createdAt: Date.now() }];
    persist(next);
  };

  const handleAddSomeday = (text) => {
    persist({ ...data, someday: [...data.someday, { id: uid(), text, createdAt: Date.now() }] });
  };

  const handleDeleteSomeday = (id) => {
    persist({ ...data, someday: data.someday.filter((s) => s.id !== id) });
  };

  const handleActivateSomeday = (item, outcome) => {
    const next = { ...data };
    next.someday = data.someday.filter((s) => s.id !== item.id);
    next.projects = [...data.projects, { id: uid(), name: item.text, outcome: outcome || '', status: 'active', createdAt: Date.now() }];
    persist(next);
  };

  const handleAddContext = (name) => {
    if (!name || data.contexts.includes(name)) return;
    persist({ ...data, contexts: [...data.contexts, name] });
  };

  const handleToggleReviewCheck = (stepId) => {
    persist({ ...data, reviewChecks: { ...data.reviewChecks, [stepId]: !data.reviewChecks[stepId] } });
  };

  const handleCompleteReview = () => {
    persist({ ...data, lastReview: Date.now(), reviewChecks: {} });
  };

  const handleResetAll = async () => {
    try { await window.storage.delete(STORAGE_KEY, false); } catch (e) { /* nothing to delete */ }
    keyRef.current = null;
    saltRef.current = null;
    setLegacyPayload(null);
    setData(null);
    setPhase('setup');
  };

  if (phase === 'loading') return <LoadingScreen />;
  if (phase === 'setup' || phase === 'unlock') {
    return (
      <PassphraseGate
        mode={phase}
        error={gateError}
        hasLegacyData={!!legacyPayload}
        onSetup={handleSetup}
        onUnlock={handleUnlock}
      />
    );
  }
  if (!data) return <LoadingScreen />;

  const inboxCount = data.inbox.length;
  const nextCount = data.actions.filter((a) => a.status === 'next').length;
  const activeProjects = data.projects.filter((p) => p.status === 'active');
  const stalledCount = activeProjects.filter((p) => !data.actions.some((a) => a.projectId === p.id && a.status === 'next')).length;
  const waitingCount = data.waiting.length;
  const somedayCount = data.someday.length;
  const reviewDue = !data.lastReview || (Date.now() - data.lastReview) > 7 * 86400000;

  const counts = {
    inbox: inboxCount,
    next: nextCount,
    projects: activeProjects.length,
    waiting: waitingCount,
    someday: somedayCount,
    stalled: stalledCount,
  };

  return (
    <div className="gtd-app">
      <style>{APP_CSS}</style>
      <header className="gtd-header">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 className="gtd-title">Intray</h1>
            <div className="gtd-tagline">Capture now. Decide later. Do what matters.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sage)', marginTop: 4 }}>
              <Lock size={11} /> Encrypted with your passphrase
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setSettingsOpen((s) => !s)} aria-label="Settings">
            <Settings size={15} />
          </button>
        </div>
        {settingsOpen && (
          <div className="card" style={{ marginTop: 10 }}>
            {!confirmReset ? (
              <div className="clarify-actions">
                <button className="btn btn-sm" onClick={handleLock}>
                  <Lock size={13} /> Lock now
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirmReset(true)}>
                  <Trash2 size={13} /> Reset all data
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>This erases everything — inbox, projects, actions — and cannot be undone. Are you sure?</div>
                <div className="clarify-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => { handleResetAll(); setConfirmReset(false); setSettingsOpen(false); }}>
                    Yes, erase everything
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <CaptureBar onCapture={handleCapture} />
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} counts={counts} pulse={pulse} reviewDue={reviewDue} />

      <main className="gtd-main">
        {activeTab === 'inbox' && (
          <InboxView inbox={data.inbox} contexts={data.contexts} projects={data.projects} onResolve={handleResolveInboxItem} onAddContext={handleAddContext} />
        )}
        {activeTab === 'next' && (
          <NextActionsView
            actions={data.actions}
            projects={activeProjects}
            contexts={data.contexts}
            onComplete={handleCompleteAction}
            onUndo={handleUndoAction}
            onDelete={handleDeleteAction}
            onAdd={handleAddAction}
            onAddContext={handleAddContext}
          />
        )}
        {activeTab === 'projects' && (
          <ProjectsView
            projects={data.projects}
            actions={data.actions}
            contexts={data.contexts}
            onAdd={handleAddProject}
            onComplete={handleCompleteProject}
            onAddAction={handleAddActionToProject}
            onAddContext={handleAddContext}
          />
        )}
        {activeTab === 'waiting' && (
          <WaitingView
            waiting={data.waiting}
            contexts={data.contexts}
            projects={activeProjects}
            onDone={handleResolveWaitingDone}
            onConvertToAction={handleConvertWaitingToAction}
            onAdd={handleAddWaiting}
            onAddContext={handleAddContext}
          />
        )}
        {activeTab === 'someday' && (
          <SomedayView someday={data.someday} onActivate={handleActivateSomeday} onDelete={handleDeleteSomeday} onAdd={handleAddSomeday} />
        )}
        {activeTab === 'review' && (
          <ReviewView data={data} counts={counts} onToggle={handleToggleReviewCheck} onCompleteReview={handleCompleteReview} />
        )}
      </main>

      {saveError && <div className="save-toast">Couldn't save changes — check your connection.</div>}
    </div>
  );
}
