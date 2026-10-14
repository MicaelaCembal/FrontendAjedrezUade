// Motor de sonido del juego: todo generado con la Web Audio API (osciladores
// + envolventes de volumen), sin archivos .mp3/.wav que descargar ni licencias
// que pensar. Cada tipo de pieza tiene su propio "timbre" al moverse, y hay
// sonidos aparte para captura, jaque, jaque mate, tablas, coronación y cuando
// se acaba el tiempo de alguien.

let audioCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    // Los navegadores bloquean el audio hasta el primer click/tap del
    // usuario: esto lo "despierta" apenas haya una interacción real (un
    // click en el tablero), sin romper nada si todavía está bloqueado.
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Un solo tono con ataque rápido y caída exponencial (como un "pluck"),
// opcionalmente con glide de frecuencia (freqEnd) para sonidos tipo "boing".
function playTone({ freq, duration = 0.15, type = "sine", startTime = 0, gain = 0.18, freqEnd = null }) {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;

  const t0 = ctx.currentTime + startTime;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  }

  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

function safely(fn) {
  try {
    fn();
  } catch {
    // Si el navegador bloquea el audio (política de autoplay, modo privado,
    // etc.) no tiene que romper el juego: simplemente no suena.
  }
}

// Un sonido propio por tipo de pieza, pensado para que se puedan distinguir
// "a la oreja": el peón es chiquito y agudo, la torre es grave y seca, el
// caballo tiene un pequeño "salto" de tono, el alfil es brillante, la dama
// suena a dos campanitas y el rey es el más grave y solemne.
export function playMoveSound(pieceType) {
  safely(() => {
    switch (pieceType) {
      case "PAWN":
        playTone({ freq: 540, duration: 0.08, type: "sine", gain: 0.16 });
        break;
      case "KNIGHT":
        playTone({ freq: 300, freqEnd: 480, duration: 0.14, type: "triangle", gain: 0.2 });
        break;
      case "BISHOP":
        playTone({ freq: 700, duration: 0.15, type: "sawtooth", gain: 0.1 });
        playTone({ freq: 1050, duration: 0.1, type: "sine", gain: 0.06, startTime: 0.03 });
        break;
      case "ROOK":
        playTone({ freq: 150, duration: 0.18, type: "square", gain: 0.16 });
        break;
      case "QUEEN":
        playTone({ freq: 740, duration: 0.15, type: "sine", gain: 0.15 });
        playTone({ freq: 988, duration: 0.2, type: "sine", gain: 0.12, startTime: 0.06 });
        break;
      case "KING":
        playTone({ freq: 196, duration: 0.24, type: "sine", gain: 0.2 });
        playTone({ freq: 294, duration: 0.24, type: "sine", gain: 0.12, startTime: 0.04 });
        break;
      default:
        playTone({ freq: 440, duration: 0.12 });
    }
  });
}

// Golpe seco y grave para una captura (propia o de la IA).
export function playCaptureSound() {
  safely(() => {
    playTone({ freq: 180, freqEnd: 85, duration: 0.18, type: "sawtooth", gain: 0.22 });
    playTone({ freq: 95, duration: 0.14, type: "square", gain: 0.15, startTime: 0.04 });
  });
}

// Dos notas cortas y tensas para avisar un jaque (propio o en contra).
export function playCheckSound() {
  safely(() => {
    playTone({ freq: 523, duration: 0.09, type: "square", gain: 0.18 });
    playTone({ freq: 659, duration: 0.14, type: "square", gain: 0.18, startTime: 0.1 });
  });
}

// Jaque mate: un arpegio ascendente y triunfal si ganás, uno descendente y
// grave si perdés.
export function playCheckmateSound(won) {
  safely(() => {
    const notes = won ? [523, 659, 784, 1047] : [392, 349, 311, 262];
    const type = won ? "triangle" : "sawtooth";
    notes.forEach((freq, i) =>
      playTone({ freq, duration: won ? 0.2 : 0.3, type, gain: 0.17, startTime: i * (won ? 0.11 : 0.15) })
    );
  });
}

// Tablas: dos notas iguales y neutras, ni festejo ni lamento.
export function playDrawSound() {
  safely(() => {
    playTone({ freq: 440, duration: 0.22, type: "sine", gain: 0.14 });
    playTone({ freq: 440, duration: 0.22, type: "sine", gain: 0.14, startTime: 0.24 });
  });
}

// Coronación: un pequeño glissando de "brillo" hacia arriba.
export function playPromotionSound() {
  safely(() => {
    [660, 880, 1100, 1320].forEach((freq, i) =>
      playTone({ freq, duration: 0.12, type: "sine", gain: 0.15, startTime: i * 0.07 })
    );
  });
}

// Se acabó el tiempo de alguien: un tono grave que cae, como un "clonc" de
// reloj parado.
export function playTimeoutSound() {
  safely(() => {
    playTone({ freq: 220, freqEnd: 70, duration: 0.5, type: "sawtooth", gain: 0.2 });
  });
}
