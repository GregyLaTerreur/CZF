// Sons de l'ouverture de booster, synthétisés avec Web Audio : aucun fichier à héberger.
// Registre « jeu de cartes » : papier, carton, cloches douces avec réverbération (pas de bips).
// Joués uniquement après un clic du joueur (les navigateurs bloquent le son sans geste).

import type { Rarity } from '@/lib/tcg/cards';

const MUTE_KEY = 'czf-tcg-muted';

let ctx: AudioContext | null = null;
let reverb: ConvolverNode | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      reverb = ctx.createConvolver();
      reverb.buffer = impulse(ctx, 2.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      reverb.connect(wet).connect(master);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Réponse impulsionnelle de salle, générée : adoucit les cloches et les souffles.
function impulse(c: AudioContext, seconds: number) {
  const length = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  return buffer;
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

// Sortie : directe + envoi vers la réverbération.
function out(c: AudioContext, node: AudioNode, wet = 0.5) {
  node.connect(master!);
  if (wet > 0) {
    const send = c.createGain();
    send.gain.value = wet;
    node.connect(send).connect(reverb!);
  }
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const length = Math.ceil(c.sampleRate * seconds);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Bruit filtré avec enveloppe : papier, carton, souffle.
function rustle(c: AudioContext, start: number, duration: number, volume: number, type: BiquadFilterType, from: number, to: number, wet = 0.1, attack = 0.005) {
  const source = c.createBufferSource();
  source.buffer = noiseBuffer(c, duration);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain);
  out(c, gain, wet);
  source.start(start);
}

// Craquements courts : film plastique / papier du sachet qu'on froisse.
function crinkle(c: AudioContext, start: number, duration: number, grains: number, volume: number) {
  for (let i = 0; i < grains; i++) {
    const at = start + Math.random() * duration;
    rustle(c, at, 0.02 + Math.random() * 0.04, volume * (0.4 + Math.random() * 0.6), 'highpass', 2500 + Math.random() * 3000, 1800, 0.05, 0.002);
  }
}

// Cloche douce : fondamentale + partiels inharmoniques, attaque feutrée, longue extinction.
function bell(c: AudioContext, freq: number, start: number, duration: number, volume: number, wet = 0.7) {
  [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([ratio, level]) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume * level, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration / ratio);
    osc.connect(gain);
    out(c, gain, wet);
    osc.start(start);
    osc.stop(start + duration + 0.1);
  });
}

// Nappe chaude (voix légèrement désaccordées, attaque lente) pour les grandes raretés.
function pad(c: AudioContext, freqs: number[], start: number, duration: number, volume: number) {
  freqs.forEach((freq) => {
    [-6, 6].forEach((cents) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      out(c, gain, 0.8);
      osc.start(start);
      osc.stop(start + duration + 0.1);
    });
  });
}

// Coup sourd grave (impact) : sinus qui chute.
function thump(c: AudioContext, start: number, volume: number, from = 110, to = 45, duration = 0.5) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration * 0.6);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  out(c, gain, 0.3);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function play(fn: (c: AudioContext, now: number) => void) {
  if (isMuted()) return;
  const c = audio();
  if (c) fn(c, c.currentTime + 0.01);
}

// Ouverture du sachet : on le froisse puis on le déchire.
export function playOpen() {
  play((c, now) => {
    crinkle(c, now, 0.35, 14, 0.25);
    rustle(c, now + 0.3, 0.45, 0.35, 'bandpass', 3500, 1200, 0.1, 0.02);
    crinkle(c, now + 0.32, 0.4, 10, 0.18);
  });
}

// Carte retournée : glissement sur le carton puis petit claquement, et la touche de la rareté.
export function playReveal(rarity: Rarity) {
  play((c, now) => {
    rustle(c, now, 0.18, 0.18, 'bandpass', 2200, 900, 0.05, 0.03);
    rustle(c, now + 0.17, 0.05, 0.3, 'lowpass', 1600, 600, 0.05, 0.002);
    const t = now + 0.22;

    if (rarity === 'rare') {
      rustle(c, t, 0.9, 0.06, 'highpass', 7000, 9000, 0.6, 0.15);
      bell(c, 1174.66, t, 1.6, 0.06);
    }

    if (rarity === 'epique') {
      rustle(c, t - 0.05, 0.6, 0.12, 'bandpass', 600, 2400, 0.4, 0.25);
      bell(c, 587.33, t + 0.1, 2.2, 0.08);
      bell(c, 880, t + 0.1, 2.2, 0.05);
      rustle(c, t + 0.15, 1.2, 0.05, 'highpass', 6000, 9000, 0.7, 0.2);
    }

    if (rarity === 'legendaire') {
      rustle(c, t - 0.1, 0.8, 0.16, 'bandpass', 300, 3000, 0.5, 0.45);
      thump(c, t + 0.45, 0.5);
      pad(c, [261.63, 329.63, 392, 523.25], t + 0.45, 3, 0.035);
      bell(c, 1046.5, t + 0.5, 2.8, 0.07);
      bell(c, 1567.98, t + 0.62, 2.6, 0.04);
      rustle(c, t + 0.5, 2, 0.06, 'highpass', 7000, 10000, 0.8, 0.4);
    }
  });
}

// Clic sur le sachet pendant qu'on le force : froissement, plus appuyé à mesure qu'on avance (0 à 1).
export function playTap(level: number) {
  play((c, now) => {
    crinkle(c, now, 0.08, 4 + Math.round(level * 6), 0.15 + level * 0.2);
    rustle(c, now, 0.07, 0.12 + level * 0.15, 'lowpass', 900, 300, 0.05, 0.002);
  });
}

// Le sachet « résiste » : il passe en épique ou en légendaire (souffle qui monte + coup sourd).
export function playCharge(rarity: Rarity) {
  play((c, now) => {
    rustle(c, now, 0.6, rarity === 'legendaire' ? 0.2 : 0.14, 'bandpass', 300, 2600, 0.5, 0.3);
    thump(c, now + 0.05, rarity === 'legendaire' ? 0.45 : 0.3, rarity === 'legendaire' ? 90 : 120, 40, 0.6);
    bell(c, rarity === 'legendaire' ? 783.99 : 587.33, now + 0.1, 1.6, 0.05);
  });
}
