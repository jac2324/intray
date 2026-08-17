// Thin fetch wrapper for the Intray REST API. Every mutating endpoint on the
// server returns the full, fresh application state (`{ state: {...} }`), so
// callers here just resolve to that state object — the caller can drop it
// straight into React state without tracking partial updates.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const json = (obj) => JSON.stringify(obj);

export const api = {
  // --- bootstrap / auth ---
  getState: () => request('/state'),
  authStatus: () => request('/auth/status'),
  login: (password) => request('/auth/login', { method: 'POST', body: json({ password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // --- inbox ---
  addInboxItem: (text) => request('/inbox', { method: 'POST', body: json({ text }) }),
  deleteInboxItem: (id) => request(`/inbox/${id}`, { method: 'DELETE' }),
  processInboxItem: (id, resolution) =>
    request(`/inbox/${id}/process`, { method: 'POST', body: json({ resolution }) }),

  // --- actions (next actions) ---
  addAction: ({ text, context, projectId }) =>
    request('/actions', { method: 'POST', body: json({ text, context, projectId }) }),
  updateAction: (id, patch) => request(`/actions/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteAction: (id) => request(`/actions/${id}`, { method: 'DELETE' }),

  // --- projects ---
  addProject: ({ name, outcome }) => request('/projects', { method: 'POST', body: json({ name, outcome }) }),
  updateProject: (id, patch) => request(`/projects/${id}`, { method: 'PATCH', body: json(patch) }),
  completeProject: (id) => request(`/projects/${id}/complete`, { method: 'POST' }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // --- waiting for ---
  addWaiting: ({ text, who }) => request('/waiting', { method: 'POST', body: json({ text, who }) }),
  convertWaiting: (id, { text, context, projectId }) =>
    request(`/waiting/${id}/convert`, { method: 'POST', body: json({ text, context, projectId }) }),
  resolveWaiting: (id) => request(`/waiting/${id}`, { method: 'DELETE' }),

  // --- someday/maybe ---
  addSomeday: (text) => request('/someday', { method: 'POST', body: json({ text }) }),
  activateSomeday: (id, outcome) => request(`/someday/${id}/activate`, { method: 'POST', body: json({ outcome }) }),
  deleteSomeday: (id) => request(`/someday/${id}`, { method: 'DELETE' }),

  // --- contexts ---
  addContext: (name) => request('/contexts', { method: 'POST', body: json({ name }) }),

  // --- weekly review ---
  toggleReviewCheck: (stepId) => request('/review/toggle', { method: 'POST', body: json({ stepId }) }),
  completeReview: () => request('/review/complete', { method: 'POST' }),
};
