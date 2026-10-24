"use client";

import { useEffect, useState } from "react";

// Generative chiptune in a gamelan-like slendro pentatonic scale. WebAudio only: no audio files, no licensing.
// ponytail: tiny step sequencer with fixed patterns; swap for composed tracks if the game ever needs real music.

export type Theme = "garden" | "flappy";

const SLENDRO = [0, 2.4, 4.8, 7.2, 9.6]; // ~240 cents per step, in semitones
const ROOT = { garden: 220, flappy: 262 }; // A3 / C4
const BPM = { garden: 84, flappy: 138 };

// Scale-degree patterns (null = rest). Octave offset via +5 per octave.
const MELODY: Record<Theme, (number | null)[]> = {
  garden: [0, null, 2, 3, null, 2, 4, null, 3, null, 2, 0, null, 1, 2, null],
  flappy: [0, 2, 4, 5, 4, 2, 3, null, 0, 2, 4, 7, 6, 4, 5, null],
};
const BASS: Record<Theme, (number | null)[]> = {
  garden: [0, null, null, null, -3, null, null, null, -2, null, null, null, -5, null, null, null],
  flappy: [0, null, 0, null, -3, null, -3, null, -2, null, -2, null, -1, null, -5, null],
};

const MUTE_KEY = "kicau:music-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let current: Theme | null = null;
let step = 0;
let nextTime = 0;

const freq = (theme: Theme, degree: number) => {
  const octave = Math.floor(degree / 5);
  const idx = ((degree % 5) + 5) % 5;
  return ROOT[theme] * 2 ** ((SLENDRO[idx] + octave * 12) / 12);
};

function note(f: number, t: number, dur: number, type: OscillatorType, vol: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // metallic, bonang-like decay
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function schedule() {
  if (!ctx || !current) return;
  const theme = current;
  const stepDur = 60 / BPM[theme] / 2; // 8th notes
  while (nextTime < ctx.currentTime + 0.25) {
    const i = step % 16;
    const m = MELODY[theme][i];
    const b = BASS[theme][i];
    if (m !== null) note(freq(theme, m + 5), nextTime, stepDur * 1.8, "square", 0.05);
    if (b !== null) note(freq(theme, b), nextTime, stepDur * 3.5, "triangle", 0.09);
    if (theme === "garden" && step % 64 === 0) note(ROOT.garden / 2, nextTime, 3, "sine", 0.12); // gong
    if (theme === "flappy" && i % 4 === 2) note(1800, nextTime, 0.03, "square", 0.015); // hi-hat tick
    if (i % 8 === 0) {
      // classic 8-bit arpeggio on the downbeat
      [0, 2, 4].forEach((d, k) => note(freq(theme, (m ?? 0) + 10 + d), nextTime + k * (stepDur / 3), stepDur / 3, "square", 0.025));
    }
    nextTime += stepDur;
    step++;
  }
}

export function isMusicMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function startMusic(theme: Theme) {
  if (typeof window === "undefined" || isMusicMuted()) return;
  ctx ??= new AudioContext();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  void ctx.resume();
  if (current === theme && timer) return;
  current = theme;
  step = 0;
  nextTime = ctx.currentTime + 0.05;
  if (timer) clearInterval(timer);
  timer = setInterval(schedule, 60);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  current = null;
}

export function setMusicMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
  if (muted) stopMusic();
}

/**
 * Plays `theme` while `active`, starting on the first user gesture (autoplay policy).
 * Returns [muted, toggleMute] for a speaker button.
 */
export function useMusic(theme: Theme, active = true): [boolean, () => void] {
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(isMusicMuted()), []);

  useEffect(() => {
    if (!active || muted) return;
    const kick = () => startMusic(theme);
    kick(); // works if the page already had a gesture (e.g. navigated by click)
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      stopMusic();
    };
  }, [theme, active, muted]);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMusicMuted(next);
  };
  return [muted, toggle];
}
