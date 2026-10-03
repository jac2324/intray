import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

const fmt = (ms) => {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// A small play/pause control for a voice note. Deliberately not a native
// <audio controls>: recordings made with MediaRecorder have no duration in
// their metadata, so native controls show a broken "0:00 / Infinity" and an
// unusable seek bar. The length is stored server-side when the note is
// uploaded, so it's shown from that instead.
export default function VoicePlayer({ src, durationMs }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    },
    []
  );

  const toggle = async (e) => {
    e.stopPropagation();
    if (!audioRef.current) {
      const a = new Audio(src);
      a.preload = 'auto';
      a.ontimeupdate = () => setElapsedMs(a.currentTime * 1000);
      a.onplay = () => setPlaying(true);
      a.onpause = () => setPlaying(false);
      a.onended = () => {
        setPlaying(false);
        setElapsedMs(0);
        a.currentTime = 0;
      };
      a.onerror = () => {
        setFailed(true);
        setPlaying(false);
      };
      audioRef.current = a;
    }
    const a = audioRef.current;
    setFailed(false);
    if (a.paused) {
      try {
        await a.play();
      } catch {
        setFailed(true);
      }
    } else {
      a.pause();
    }
  };

  const shown = durationMs ? Math.min(elapsedMs, durationMs) : elapsedMs;

  return (
    <span className="voice-player">
      <button className="voice-play-btn" onClick={toggle} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span className="voice-time">
        {failed ? "Couldn't play" : playing || elapsedMs > 0 ? `${fmt(shown)} / ${fmt(durationMs)}` : fmt(durationMs)}
      </span>
    </span>
  );
}
