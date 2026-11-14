// Sons de l'ouverture de booster, synthétisés avec Web Audio : aucun fichier à héberger.
// Joués uniquement après un clic du joueur (les navigateurs bloquent le son sans geste).

import type { Rarity } from '@/lib/tcg/cards';

const MUTE_KEY = 'czf-tcg-muted';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Stockage indisponible (navigation privée) : le réglage ne dure que la page.
  }
}

// Note simple avec attaque et extinction douces.
function tone(c: AudioContext, freq: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// Souffle de bruit filtré (déchirure du sachet, carte qui tourne).
function noise(c: AudioContext, start: number, duration: number, volume: number, fromHz: number, toHz: number) {
  const length = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const source = c.createBufferSource();
  source.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(fromHz, start);
  filter.frequency.exponentialRampToValueAtTime(toHz, start + duration);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(c.destination);
  source.start(start);
}

function play(fn: (c: AudioContext, now: number) => void) {
  if (isMuted()) return;
  const c = audio();
  if (c) fn(c, c.currentTime + 0.01);
}

// Ouverture du sachet : déchirure.
export function playOpen() {
  play((c, now) => {
    noise(c, now, 0.35, 0.5, 600, 4000);
    noise(c, now + 0.12, 0.25, 0.35, 2500, 900);
  });
}

// Retournement d'une carte, puis son de sa rareté au moment où elle se révèle.
export function playReveal(rarity: Rarity) {
  play((c, now) => {
    noise(c, now, 0.16, 0.25, 1800, 500);
    const t = now + 0.28;

    if (rarity === 'commune') {
      tone(c, 660, t, 0.18, 0.12, 'triangle');
    }

    if (rarity === 'rare') {
      tone(c, 880, t, 0.5, 0.16);
      tone(c, 1320, t + 0.09, 0.6, 0.13);
    }

    if (rarity === 'epique') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.07, 0.7, 0.14, 'triangle'));
      noise(c, t + 0.05, 0.5, 0.12, 6000, 9000);
    }

    if (rarity === 'legendaire') {
      // Montée, puis accord tenu et scintillement.
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, f, t + i * 0.06, 0.4, 0.13, 'triangle'));
      const chord = t + 0.42;
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(c, f, chord, 1.8, 0.1));
      tone(c, 261.63, chord, 1.6, 0.14, 'sawtooth');
      for (let i = 0; i < 8; i++) tone(c, 2093 + Math.random() * 1500, chord + 0.1 + i * 0.09, 0.25, 0.05);
    }
  });
}
