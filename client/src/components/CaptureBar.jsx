import React, { useState, useRef, useEffect } from 'react';
import { Plus, Mic, Square } from 'lucide-react';

const MAX_RECORD_MS = 2 * 60 * 1000; // auto-stop, so a forgotten recording can't run forever
const MIN_RECORD_MS = 700; // shorter than this is almost certainly an accidental tap
const NOTICE_MS = 6000;

// Order of preference: Chrome/Android/Firefox record webm+opus; Safari only
// does mp4. Whatever the browser picks is stored and served back as-is.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function pickMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// Browsers only expose the microphone on https:// pages (or localhost), so
// over plain http the mic button can't work — say so instead of failing silently.
function micUnavailableReason() {
  if (!window.isSecureContext) {
    return 'Voice notes need a secure (https) connection — see the README for the Tailscale HTTPS setup.';
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    return "This browser can't record audio.";
  }
  return null;
}

const fmtClock = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// The one persistent, always-available element across every view. Capture
// is optimistic — onCapture resolves instantly from the caller's point of
// view, so the field clears right away without waiting on the network.
// The mic button records a voice note instead of typing; onVoiceNote hands
// the finished recording to the on-device queue, which handles upload.
export default function CaptureBar({ onCapture, onVoiceNote, pendingVoiceCount = 0 }) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [notice, setNotice] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const discardRef = useRef(false);
  const startingRef = useRef(false);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    setText('');
  };

  const showNotice = (message) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), NOTICE_MS);
  };

  const releaseMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  // Idempotent: safe to call from onstop, onerror, or a failed start().
  const teardown = () => {
    releaseMic();
    recorderRef.current = null;
    setRecording(false);
  };

  const start = async () => {
    // A recorder that has gone inactive is stale (it errored or finished
    // without clearing itself) and must never block the next recording.
    const active = recorderRef.current && recorderRef.current.state !== 'inactive';
    if (startingRef.current || active) return;
    const reason = micUnavailableReason();
    if (reason) {
      showNotice(reason);
      return;
    }
    startingRef.current = true;
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        showNotice(
          e && e.name === 'NotAllowedError'
            ? 'Microphone access was blocked — allow it in your browser’s site settings, then try again.'
            : "Couldn't open the microphone."
        );
        return;
      }

      const mime = pickMime();
      let recorder;
      try {
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        showNotice("This browser can't record audio.");
        return;
      }

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = () => {
        // Don't keep a half-written recording; free the mic and the button.
        discardRef.current = true;
        teardown();
        showNotice('Recording failed — please try again.');
      };
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        teardown();
        if (discardRef.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        if (blob.size === 0 || durationMs < MIN_RECORD_MS) {
          showNotice('That was too short to keep — tap the mic, say it, then tap stop.');
          return;
        }
        onVoiceNote(blob, durationMs);
      };

      discardRef.current = false;
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setNotice('');
      try {
        recorder.start();
      } catch {
        teardown();
        showNotice("Couldn't start recording — please try again.");
        return;
      }
      setRecording(true);
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_RECORD_MS) stop();
      }, 250);
    } finally {
      startingRef.current = false;
    }
  };

  // Leaving the page mid-recording discards it and releases the microphone.
  useEffect(
    () => () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      releaseMic();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    []
  );

  return (
    <div className="capture-wrap">
      <div className="capture-bar">
        {recording ? (
          <div className="capture-recording" role="status" aria-live="polite">
            <span className="rec-dot" aria-hidden="true" />
            <span>Recording {fmtClock(elapsedMs)}</span>
            <span className="rec-hint">tap stop to save</span>
          </div>
        ) : (
          <input
            className="capture-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="Capture anything on your mind…"
            aria-label="Capture a new item"
          />
        )}
        <button
          className={`capture-mic${recording ? ' recording' : ''}`}
          onClick={recording ? stop : start}
          aria-label={recording ? 'Stop recording and save voice note' : 'Record a voice note'}
        >
          {recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
        </button>
        {!recording && (
          <button className="capture-btn" onClick={submit}>
            <Plus size={15} /> <span className="capture-btn-label">Capture</span>
          </button>
        )}
      </div>
      {notice && <div className="capture-notice" role="alert">{notice}</div>}
      {!notice && pendingVoiceCount > 0 && (
        <div className="capture-notice sync" role="status">
          {pendingVoiceCount} voice note{pendingVoiceCount !== 1 ? 's' : ''} saved on this device, waiting to sync…
        </div>
      )}
    </div>
  );
}
