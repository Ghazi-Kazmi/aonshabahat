"use client";

import { useEffect, useRef, useState } from "react";

const SRC = "/assets/music/perfect-bg.mp3?v=1";
const PREF_KEY = "music-muted";
const VOLUME = 0.5;

function prefersMuted() {
  try { return localStorage.getItem(PREF_KEY) === "1"; } catch { return false; }
}
function rememberMuted(muted: boolean) {
  try { localStorage.setItem(PREF_KEY, muted ? "1" : "0"); } catch { /* private mode: not remembered */ }
}

/* Background song with a play/mute toggle. Browsers block sound until the visitor first
   interacts with the page, so if autoplay is refused the song starts on the first tap,
   click or key press instead. Mounted only once the loader is done. */
export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  // Visitors who muted before stay muted; everyone else hears the song.
  const wantRef = useRef(!prefersMuted());

  useEffect(() => {
    const audio = audioRef.current!;
    audio.volume = VOLUME;
    let fade = 0;

    const start = () => {
      if (!wantRef.current || !audio.paused) return Promise.resolve();
      audio.volume = 0;
      return audio.play().then(() => {
        cancelAnimationFrame(fade);
        const t0 = performance.now();
        const step = (t: number) => {
          audio.volume = Math.min(VOLUME, ((t - t0) / 1800) * VOLUME);
          if (audio.volume < VOLUME) fade = requestAnimationFrame(step);
        };
        fade = requestAnimationFrame(step);
      });
    };

    // Fallback for blocked autoplay: the visitor's first tap, click or key press starts the
    // song. These listeners stay until the song is actually playing, so they don't depend
    // on how (or whether) the autoplay attempt failed.
    const gestures = ["pointerdown", "touchend", "keydown"] as const;
    const onGesture = (e: Event) => {
      // A tap on the music button itself is handled by its own click.
      if (btnRef.current?.contains(e.target as Node)) return;
      start().catch(() => {});
    };
    const removeGestures = () => gestures.forEach((g) => window.removeEventListener(g, onGesture, true));
    gestures.forEach((g) => window.addEventListener(g, onGesture, true));
    audio.addEventListener("playing", removeGestures);

    start().catch(() => {}); // usually refused on a first visit; the gestures above cover that

    // Pause while the tab is in the background; pick up again on return.
    let resume = false;
    const onVisibility = () => {
      if (document.hidden) { resume = !audio.paused; audio.pause(); }
      else if (resume) audio.play().catch(() => {});
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    document.addEventListener("visibilitychange", onVisibility);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      cancelAnimationFrame(fade);
      removeGestures();
      audio.removeEventListener("playing", removeGestures);
      document.removeEventListener("visibilitychange", onVisibility);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current!;
    if (audio.paused) {
      wantRef.current = true;
      rememberMuted(false);
      audio.volume = VOLUME;
      audio.play().catch(() => {});
    } else {
      wantRef.current = false;
      rememberMuted(true);
      audio.pause();
    }
  };

  return (
    <>
      <audio ref={audioRef} src={SRC} loop preload="auto" />
      <button
        ref={btnRef}
        type="button"
        className={`music-btn${playing ? " is-playing" : ""}`}
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Mute music" : "Play music"}
        title={playing ? "Mute music" : "Play music"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="music-btn__spk" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
          {playing ? (
            <g className="music-btn__waves"><path d="M15.5 9a4.2 4.2 0 0 1 0 6" /><path d="M18 6.5a8 8 0 0 1 0 11" /></g>
          ) : (
            <path d="M16 9.5l5 5M21 9.5l-5 5" />
          )}
        </svg>
      </button>
    </>
  );
}
