// Efectos de sonido del juego, generados con la Web Audio API (sin archivos
// que descargar). Todos son sonidos originales con onda suave y "burbujeante",
// pensados para una isla tranquila: marimbas, campanitas, "bloops" y chillidos
// de aldeano. Cada tipo de movimiento tiene varias variantes y se elige una al
// azar, así que jugar no se vuelve repetitivo.
//
// Tipos de sonido: mover cada pieza (peón, caballo, alfil, torre, dama, rey),
// enroque, captura, jaque, coronación, jaque mate (ganás / perdés), tablas,
// tiempo agotado, seleccionar una pieza y movimiento inválido.

import { getSfxVolume } from "./music";

// ---------------------------------------------------------------------------
// Sonidos de archivo (opcionales)
// ---------------------------------------------------------------------------
// Si existen estos archivos en public/sounds/, se usan en lugar de los sonidos
// sintetizados de más abajo. Si falta alguno, el juego usa el sintetizado y no
// pasa nada. Para cambiar un sonido alcanza con reemplazar el archivo.
//   check    jaque y enroque
//   move     cada movimiento normal del jugador
//   ai       cada movimiento normal de la computadora
//   select   elegir una pieza
//   win      ganar la partida (jaque mate a favor o tiempo del rival agotado)
//   lose     perder la partida
const SAMPLE_FILES = {
  check: "/sounds/jaque-enroque.mp3",
  move: "/sounds/mover.mp3",
  ai: "/sounds/mover-ia.mp3",
  select: "/sounds/seleccionar.mp3",
  win: "/sounds/ganar.mp3",
  lose: "/sounds/perder.mp3",
};
const sampleBuffers = {};
let samplesRequested = false;

// Se pide y decodifica todo al arrancar la app. Se decodifica con un contexto
// "offline" para no necesitar un click del usuario todavía.
export function preloadSamples() {
  if (samplesRequested || typeof window === "undefined") return;
  samplesRequested = true;
  const OfflineClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineClass) return;
  Object.entries(SAMPLE_FILES).forEach(async ([key, url]) => {
    try {
      const res = await fetch(url);
      const type = res.headers.get("content-type") ?? "";
      // Un archivo que falta puede devolver la página principal: se descarta
      if (!res.ok || type.includes("text/html")) return;
      const data = await res.arrayBuffer();
      sampleBuffers[key] = await new OfflineClass(1, 1, 44100).decodeAudioData(data);
    } catch {
      // sin archivo (o formato que el navegador no entiende): queda el sintetizado
    }
  });
}

// Reproduce el archivo si está cargado; devuelve false si no hay que usar el sintetizado.
function playSample(key, gain = 1) {
  const buffer = sampleBuffers[key];
  const ctx = getCtx();
  if (!buffer || !ctx) return false;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(master);
  src.start();
  return true;
}

let audioCtx = null;
let master = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
    master = audioCtx.createGain();
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    // Los navegadores bloquean el audio hasta el primer click del usuario
    audioCtx.resume().catch(() => {});
  }
  master.gain.value = getSfxVolume();
  return audioCtx;
}

function safely(fn) {
  try {
    fn();
  } catch {
    // Si el navegador bloquea el audio no tiene que romper el juego
  }
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Escala pentatónica de Do mayor, la que mejor suena sin desafinar
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

// Un tono con ataque suave y caída exponencial; con glide opcional (freqEnd).
function tone({ freq, freqEnd = null, duration = 0.15, type = "sine", start = 0, gain = 0.18, attack = 0.01 }) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  const t0 = ctx.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

// Campanita: la nota más una octava arriba más suave, caída larga.
function bell(freq, start = 0, gain = 0.14, duration = 0.5) {
  tone({ freq, duration, start, gain });
  tone({ freq: freq * 2, duration: duration * 0.6, start, gain: gain * 0.35 });
}

// Marimba: ataque seco con un armónico agudo que muere rápido.
function marimba(freq, start = 0, gain = 0.2, duration = 0.26) {
  tone({ freq, duration, start, gain, attack: 0.004 });
  tone({ freq: freq * 4, duration: duration * 0.25, start, gain: gain * 0.3, attack: 0.002 });
}

// "Bloop" de burbuja: sube de tono rápido.
function bloop(freq, start = 0, gain = 0.18, duration = 0.11) {
  tone({ freq: freq * 0.7, freqEnd: freq * 1.15, duration, start, gain, type: "sine" });
}

// Golpecito de madera: un ruido cortito filtrado.
function knock(start = 0, gain = 0.2, freq = 700) {
  const ctx = getCtx();
  if (!ctx) return;
  const length = Math.floor(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.18));
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(ctx.currentTime + start);
}

// Chillido de aldeano: sílabas muy cortas de tono aleatorio, con un leve
// "vibrato" hacia arriba o abajo, como cuando hablan en el juego.
function chirps(count, { base = 520, spread = 260, gap = 0.075, gain = 0.13, start = 0 } = {}) {
  for (let i = 0; i < count; i += 1) {
    const f = base + Math.random() * spread;
    const up = Math.random() < 0.5;
    tone({
      freq: f,
      freqEnd: f * (up ? 1.18 : 0.85),
      duration: 0.07,
      type: "triangle",
      start: start + i * gap,
      gain,
      attack: 0.006,
    });
  }
}

// ---------------------------------------------------------------------------
// Movimientos de cada pieza
// ---------------------------------------------------------------------------

const MOVE_SOUNDS = {
  // Peón: un "bloop" chiquito
  PAWN: [
    () => bloop(E5),
    () => bloop(G5),
    () => bloop(D5, 0, 0.17, 0.1),
  ],
  // Caballo: dos saltitos seguidos, como un trote
  KNIGHT: [
    () => {
      bloop(C5, 0, 0.17, 0.09);
      bloop(G5, 0.1, 0.17, 0.1);
    },
    () => {
      bloop(D5, 0, 0.17, 0.09);
      bloop(A5, 0.1, 0.17, 0.1);
    },
    () => {
      bloop(E5, 0, 0.17, 0.09);
      bloop(C6, 0.1, 0.15, 0.1);
    },
  ],
  // Alfil: campanita de cristal
  BISHOP: [
    () => bell(C6),
    () => bell(E6, 0, 0.12),
    () => {
      bell(G5);
      bell(C6, 0.09, 0.1);
    },
  ],
  // Torre: golpecito de madera con una marimba grave
  ROOK: [
    () => {
      knock(0, 0.22, 650);
      marimba(C5 / 2, 0.01, 0.2);
    },
    () => {
      knock(0, 0.22, 800);
      marimba(G5 / 2, 0.01, 0.2);
    },
    () => {
      knock(0, 0.22, 560);
      marimba(E5 / 2, 0.01, 0.2);
    },
  ],
  // Dama: arpegio chiquito y brillante hacia arriba
  QUEEN: [
    () => [C5, E5, G5].forEach((f, i) => marimba(f, i * 0.07, 0.15)),
    () => [D5, G5, A5].forEach((f, i) => marimba(f, i * 0.07, 0.15)),
    () => [E5, G5, C6].forEach((f, i) => bell(f, i * 0.07, 0.11)),
  ],
  // Rey: tono grave y redondo con una campanita encima
  KING: [
    () => {
      marimba(C5 / 2, 0, 0.24, 0.4);
      bell(G5, 0.08, 0.09);
    },
    () => {
      marimba(G5 / 2, 0, 0.24, 0.4);
      bell(E5, 0.08, 0.09);
    },
    () => {
      marimba(A5 / 2, 0, 0.24, 0.4);
      bell(C6, 0.08, 0.09);
    },
  ],
};

export function playMoveSound(pieceType) {
  safely(() => {
    if (playSample("move")) return;
    const variants = MOVE_SOUNDS[pieceType] ?? MOVE_SOUNDS.PAWN;
    pick(variants)();
  });
}

// Enroque: dos golpecitos de madera (torre y rey) y una campanita
export function playCastleSound() {
  safely(() => {
    if (playSample("check")) return;
    knock(0, 0.22, 650);
    marimba(C5 / 2, 0.01, 0.18);
    knock(0.14, 0.22, 800);
    marimba(G5 / 2, 0.15, 0.18);
    bell(C6, 0.3, 0.1);
  });
}

// Captura: un chillido de aldeano sorprendido más un "pum" blandito
export function playCaptureSound() {
  safely(() => {
    pick([
      () => {
        chirps(3, { base: 560, spread: 300 });
        tone({ freq: 160, freqEnd: 70, duration: 0.16, type: "sine", gain: 0.24, start: 0.05 });
      },
      () => {
        chirps(2, { base: 700, spread: 200, gap: 0.09 });
        tone({ freq: 190, freqEnd: 80, duration: 0.18, type: "sine", gain: 0.24, start: 0.04 });
        knock(0.04, 0.16, 420);
      },
      () => {
        chirps(4, { base: 480, spread: 380, gap: 0.06 });
        tone({ freq: 140, freqEnd: 60, duration: 0.2, type: "triangle", gain: 0.22, start: 0.06 });
      },
    ])();
  });
}

// Jaque: "ding-dong" de timbre de puerta
export function playCheckSound() {
  safely(() => {
    if (playSample("check")) return;
    pick([
      () => {
        bell(E5, 0, 0.17, 0.4);
        bell(C5, 0.2, 0.17, 0.6);
      },
      () => {
        bell(G5, 0, 0.17, 0.4);
        bell(E5, 0.2, 0.17, 0.6);
      },
      () => {
        bell(A5, 0, 0.16, 0.4);
        bell(E5, 0.2, 0.16, 0.6);
      },
    ])();
  });
}

// Coronación: escala brillante hacia arriba con un destello final
export function playPromotionSound() {
  safely(() => {
    const scale = pick([
      [C5, D5, E5, G5, A5, C6],
      [G5, A5, C6, D5 * 2, E6, G6],
    ]);
    scale.forEach((f, i) => marimba(f, i * 0.07, 0.15, 0.3));
    bell(scale[scale.length - 1] * 2, 0.45, 0.08, 0.8);
  });
}

// Jaque mate: fanfarria alegre si ganás; trombón triste que se cae si perdés
export function playCheckmateSound(won) {
  safely(() => {
    if (playSample(won ? "win" : "lose")) return;
    if (won) {
      [C5, E5, G5, C6, E6].forEach((f, i) => {
        marimba(f, i * 0.1, 0.17, 0.4);
        bell(f, i * 0.1 + 0.02, 0.07, 0.8);
      });
      bell(G6, 0.6, 0.1, 1.2);
    } else {
      [
        [392, 0],
        [370, 0.28],
        [349, 0.56],
      ].forEach(([f, s]) => tone({ freq: f, freqEnd: f * 0.97, duration: 0.3, type: "triangle", start: s, gain: 0.2 }));
      tone({ freq: 330, freqEnd: 196, duration: 0.7, type: "triangle", start: 0.86, gain: 0.22 });
    }
  });
}

// Tablas: dos campanitas iguales, ni festejo ni lamento
export function playDrawSound() {
  safely(() => {
    bell(G5, 0, 0.14, 0.5);
    bell(G5, 0.3, 0.14, 0.7);
  });
}

// Se acabó el tiempo: un "bonk" que cae
export function playTimeoutSound(userWon = false) {
  safely(() => {
    if (playSample(userWon ? "win" : "lose")) return;
    tone({ freq: 330, freqEnd: 90, duration: 0.45, type: "triangle", gain: 0.26 });
    knock(0, 0.2, 380);
  });
}

// Tocar una pieza propia para elegirla: un "tic" suave
export function playSelectSound() {
  safely(() => {
    if (playSample("select")) return;
    pick([() => bloop(A5, 0, 0.1, 0.06), () => bloop(E6, 0, 0.09, 0.06), () => marimba(C6, 0, 0.1, 0.1)])();
  });
}

// Movimiento no permitido: dos "bub" graves, como un aldeano que se confunde
export function playInvalidSound() {
  safely(() => {
    tone({ freq: 220, freqEnd: 190, duration: 0.09, type: "triangle", gain: 0.16 });
    tone({ freq: 196, freqEnd: 165, duration: 0.12, type: "triangle", gain: 0.16, start: 0.1 });
  });
}

// Respuesta normal de la computadora (sin captura ni jaque): un sonido distinto
// al del jugador para distinguir de quién fue la jugada.
export function playAiMoveSound() {
  safely(() => {
    if (playSample("ai")) return;
    pick([() => bell(E5, 0, 0.1, 0.35), () => bell(G5, 0, 0.1, 0.35), () => bell(D5, 0, 0.1, 0.35)])();
  });
}
