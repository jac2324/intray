import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { enqueue, listPending, removePending, newClientId } from '../utils/voiceQueue.js';

let tempIdCounter = 0;
const nextTempId = () => `temp-${Date.now()}-${tempIdCounter++}`;

// How often to retry queued voice notes while any are waiting. The other
// retry triggers (app load, coming back online, tab/app becoming visible)
// cover the common cases; this just catches "connection came back while the
// app stayed open and the browser never fired an event".
const VOICE_RETRY_MS = 20000;

const pendingMeta = (rec) => ({ clientId: rec.clientId, durationMs: rec.durationMs, createdAt: rec.createdAt });

// Central data hook. Holds the full GTD state bundle and exposes one
// function per mutation. Every mutation (except the optimistic capture bar)
// follows the same pattern: call the API, then replace local state with the
// fresh bundle the server sends back.
export function useGtdData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [authed, setAuthed] = useState(true);
  const errorTimer = useRef(null);

  const flashError = useCallback((message) => {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const status = await api.authStatus();
      setAuthRequired(status.authRequired);
      setAuthed(status.authed);
      if (!status.authed) {
        setLoading(false);
        return;
      }
      const state = await api.getState();
      setData(state);
    } catch (e) {
      if (e.status === 401) {
        setAuthed(false);
      } else {
        flashError("Couldn't reach the server. Is it running?");
      }
    } finally {
      setLoading(false);
    }
  }, [flashError]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = useCallback(
    async (fn) => {
      try {
        const result = await fn();
        if (result && result.state) setData(result.state);
        return result;
      } catch (e) {
        if (e.status === 401) {
          setAuthed(false);
        } else {
          flashError(e.message || 'Something went wrong.');
        }
        throw e;
      }
    },
    [flashError]
  );

  // The one interaction that must feel instant: append optimistically, then
  // reconcile with the server's response (which already contains the real
  // row, replacing the temp one).
  const capture = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tempId = nextTempId();
      setData((d) =>
        d ? { ...d, inbox: [...d.inbox, { id: tempId, text: trimmed, createdAt: Date.now(), _optimistic: true }] } : d
      );
      try {
        const result = await api.addInboxItem(trimmed);
        setData(result.state);
      } catch (e) {
        setData((d) => (d ? { ...d, inbox: d.inbox.filter((i) => i.id !== tempId) } : d));
        if (e.status === 401) setAuthed(false);
        else flashError("Couldn't save that — check your connection.");
      }
    },
    [flashError]
  );

  // --- voice notes ---------------------------------------------------------
  // Recordings go to an on-device queue first and are uploaded from there, so
  // a dropped connection can't lose one. `pendingVoice` is what's still
  // waiting; App shows those in the Inbox as "waiting to sync".
  const [pendingVoice, setPendingVoice] = useState([]);
  const flushing = useRef(false);
  const flushAgain = useRef(false);

  const dropPending = useCallback((clientId) => {
    setPendingVoice((p) => p.filter((x) => x.clientId !== clientId));
  }, []);

  const flushVoice = useCallback(async () => {
    // One flush at a time, so a retry timer can never upload the same
    // recording twice concurrently. A recording enqueued mid-flush sets
    // flushAgain and gets picked up by another pass below.
    if (flushing.current) {
      flushAgain.current = true;
      return;
    }
    flushing.current = true;
    try {
      do {
        flushAgain.current = false;
        const queued = await listPending();
        setPendingVoice(queued.map(pendingMeta));
        for (const rec of queued) {
          try {
            const result = await api.uploadVoiceNote(rec);
            await removePending(rec.clientId);
            // New state first, then drop the "waiting to sync" placeholder,
            // so the note never blinks out of the Inbox between the two.
            if (result && result.state) setData(result.state);
            dropPending(rec.clientId);
          } catch (e) {
            if (e.status === 401) {
              // Logged out: keep everything queued; it uploads after sign-in.
              setAuthed(false);
              return;
            }
            if (e.status >= 400 && e.status < 500) {
              // The server rejected this one for good (e.g. too large) —
              // retrying can't help, and it would block the ones behind it.
              await removePending(rec.clientId);
              dropPending(rec.clientId);
              flashError(`A voice note couldn't be saved (${e.message}).`);
              continue;
            }
            // Network down or server error: stop and retry later, keeping order.
            break;
          }
        }
      } while (flushAgain.current);
    } finally {
      flushing.current = false;
    }
  }, [dropPending, flashError]);

  const recordVoiceNote = useCallback(
    async (blob, durationMs) => {
      const record = { clientId: newClientId(), blob, mime: blob.type, durationMs, createdAt: Date.now() };
      await enqueue(record);
      setPendingVoice((p) => [...p, pendingMeta(record)]);
      flushVoice();
    },
    [flushVoice]
  );

  const loaded = !!data;
  useEffect(() => {
    if (!authed || !loaded) return undefined;
    flushVoice();
    const onOnline = () => flushVoice();
    const onVisible = () => {
      if (document.visibilityState === 'visible') flushVoice();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authed, loaded, flushVoice]);

  const hasPendingVoice = pendingVoice.length > 0;
  useEffect(() => {
    if (!authed || !loaded || !hasPendingVoice) return undefined;
    const t = setInterval(flushVoice, VOICE_RETRY_MS);
    return () => clearInterval(t);
  }, [authed, loaded, hasPendingVoice, flushVoice]);

  const login = useCallback(async (password) => {
    await api.login(password);
    setAuthed(true);
    await load();
  }, [load]);

  const logout = useCallback(async () => {
    await api.logout();
    setAuthed(false);
    setData(null);
  }, []);

  return {
    data,
    loading,
    error,
    authRequired,
    authed,
    login,
    logout,
    reload: load,

    capture,
    recordVoiceNote,
    pendingVoice,
    deleteSavedRecording: (id) => mutate(() => api.deleteSavedRecording(id)),
    deleteInboxItem: (id) => mutate(() => api.deleteInboxItem(id)),
    processInboxItem: (id, resolution) => mutate(() => api.processInboxItem(id, resolution)),

    addAction: (payload) => mutate(() => api.addAction(payload)),
    completeAction: (id) => mutate(() => api.updateAction(id, { status: 'done' })),
    undoAction: (id) => mutate(() => api.updateAction(id, { status: 'next' })),
    editAction: (id, patch) => mutate(() => api.updateAction(id, patch)),
    deleteAction: (id) => mutate(() => api.deleteAction(id)),

    addProject: (payload) => mutate(() => api.addProject(payload)),
    editProject: (id, patch) => mutate(() => api.updateProject(id, patch)),
    completeProject: (id) => mutate(() => api.completeProject(id)),

    addWaiting: (payload) => mutate(() => api.addWaiting(payload)),
    convertWaiting: (id, payload) => mutate(() => api.convertWaiting(id, payload)),
    resolveWaiting: (id) => mutate(() => api.resolveWaiting(id)),

    addSomeday: (text) => mutate(() => api.addSomeday(text)),
    activateSomeday: (id, outcome) => mutate(() => api.activateSomeday(id, outcome)),
    deleteSomeday: (id) => mutate(() => api.deleteSomeday(id)),

    addContext: (name) => mutate(() => api.addContext(name)),

    toggleReviewCheck: (stepId) => mutate(() => api.toggleReviewCheck(stepId)),
    completeReview: () => mutate(() => api.completeReview()),
  };
}
