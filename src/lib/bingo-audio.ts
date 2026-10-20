"use client";

import { getBallLetter } from "./bingo-patterns";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Reproduce un timbre brillante de tómbola antes de cantar la bolilla.
 */
export function playBallChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // Do - Mi - Sol
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.36);
    });
  } catch {}
}

/**
 * Sonido corto y agradable cuando el jugador pinta una casilla en su celular.
 */
export function playDaubPop() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.07);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {}
}

/**
 * Fanfarria de alerta cuando entra un reclamo de "¡BINGO!" o hay ganador.
 */
export function playBingoFanfare() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.46);
    });
  } catch {}
}

/**
 * Canta con voz en español la bolilla que acaba de salir (ej. "¡Bolilla B, 12!").
 */
export function announceBallVoice(ballNumber: number, soundEnabled: boolean = true) {
  if (!soundEnabled || typeof window === "undefined") return;

  playBallChime();

  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const letter = getBallLetter(ballNumber);
    // Pronunciación clara en español para cada letra (evita que el navegador confunda "Ene 33" con el mes de Enero de 1933)
    const letterSpoken =
      letter === "B"
        ? "Letra B"
        : letter === "I"
        ? "Letra I"
        : letter === "N"
        ? "Letra N"
        : letter === "G"
        ? "Letra G"
        : "Letra O";

    const text = `¡${letterSpoken}, número ${ballNumber}! ... ${letterSpoken}, ${ballNumber}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-EC";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice =
      voices.find((v) => v.lang.startsWith("es-EC")) ||
      voices.find((v) => v.lang.startsWith("es-MX")) ||
      voices.find((v) => v.lang.startsWith("es-ES")) ||
      voices.find((v) => v.lang.startsWith("es"));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 220);
  } catch {}
}

/**
 * Canta un mensaje personalizado en voz alta (ej. cambio de etapa o "¡BINGO!").
 */
export function announceCustomVoice(message: string, soundEnabled: boolean = true) {
  if (!soundEnabled || typeof window === "undefined") return;
  playBingoFanfare();

  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "es-EC";
    utterance.rate = 0.98;
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find((v) => v.lang.startsWith("es"));
    if (spanishVoice) utterance.voice = spanishVoice;
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 300);
  } catch {}
}
