import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

let tempIdCounter = 0;
const nextTempId = () => `temp-${Date.now()}-${tempIdCounter++}`;

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
    deleteInboxItem: (id) => mutate(() => api.deleteInboxItem(id)),
    processInboxItem: (id, resolution) => mutate(() => api.processInboxItem(id, resolution)),

    addAction: (payload) => mutate(() => api.addAction(payload)),
    completeAction: (id) => mutate(() => api.updateAction(id, { status: 'done' })),
    undoAction: (id) => mutate(() => api.updateAction(id, { status: 'next' })),
    deleteAction: (id) => mutate(() => api.deleteAction(id)),

    addProject: (payload) => mutate(() => api.addProject(payload)),
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
