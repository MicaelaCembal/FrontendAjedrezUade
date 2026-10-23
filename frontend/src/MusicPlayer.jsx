import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  TRACKS,
  subscribe,
  getSnapshot,
  togglePlay,
  selectTrack,
  setMusicVolume,
  toggleMute,
  setSfxVolumeState,
} from "./music";
import { playSelectSound } from "./sound";
import "./MusicPlayer.css";

// Tocadiscos de valija rosa (como el del juego) abajo a la derecha.
// Cada canción es un vinilo con su etiqueta de color. Cambiar de canción =
// sacar el vinilo del plato y poner otro: primero se levanta el brazo, el disco
// viejo sale volando hacia la caja de discos, entra el nuevo, baja el brazo y
// recién ahí empieza a sonar.
//
// El audio sigue viviendo en music.js (un solo <audio> para toda la app); este
// componente solo lo dibuja y lo controla.

// Colores de las etiquetas, en orden. Si hay más canciones que colores, se
// repiten (la canción 8 vuelve a ser rosa, etc.).
const LABEL_COLORS = ["#b48be0", "#ec6f93", "#6ccbe8", "#f7c52b", "#5fb8a5", "#f28c4b", "#78b94a"];

// Duración de cada mitad del cambio de disco. Tienen que coincidir con las
// animaciones tt-record-out / tt-record-in de MusicPlayer.css.
const OUT_MS = 420;
const IN_MS = 480;

const MINI_KEY = "ajedrezCrossingTurntableMini";

function labelColor(index) {
  return LABEL_COLORS[index % LABEL_COLORS.length];
}

function wrapIndex(index) {
  return (index + TRACKS.length) % TRACKS.length;
}

// Por debajo de este ancho, el panel de la partida ocupa la esquina de abajo a
// la derecha, así que el tocadiscos arranca achicado para no taparlo.
const NARROW_SCREEN = 1200;

function loadMini() {
  try {
    const saved = localStorage.getItem(MINI_KEY);
    // Si la persona ya lo abrió o achicó alguna vez, se respeta lo que eligió
    if (saved !== null) return saved === "1";
  } catch {
    // sin localStorage, se decide por el ancho de la pantalla
  }
  return typeof window !== "undefined" && window.innerWidth < NARROW_SCREEN;
}

function saveMini(value) {
  try {
    localStorage.setItem(MINI_KEY, value ? "1" : "0");
  } catch {
    // sin localStorage no pasa nada, solo no se recuerda
  }
}

// El vinilo en sí: surcos, etiqueta de color con el número y el agujerito.
// Se usa en el plato, en las fundas de la caja y en el modo minimizado.
function Vinyl({ index, className = "" }) {
  return (
    <span className={`tt-vinyl ${className}`} style={{ "--label": labelColor(index) }} aria-hidden="true">
      <span className="tt-vinyl-label">
        <span className="tt-vinyl-number">{index + 1}</span>
      </span>
    </span>
  );
}

// ---------- Iconitos (SVG) ----------
// Todos usan currentColor, así toman el color del botón donde están.
function Icon({ children, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const IconPrev = () => (
  <Icon>
    <rect x="4.5" y="5" width="3" height="14" rx="1.5" />
    <path d="M19.5 6.6v10.8a1.2 1.2 0 0 1-1.85 1l-8.4-5.4a1.2 1.2 0 0 1 0-2l8.4-5.4a1.2 1.2 0 0 1 1.85 1z" />
  </Icon>
);
const IconNext = () => (
  <Icon>
    <rect x="16.5" y="5" width="3" height="14" rx="1.5" />
    <path d="M4.5 6.6v10.8a1.2 1.2 0 0 0 1.85 1l8.4-5.4a1.2 1.2 0 0 0 0-2l-8.4-5.4A1.2 1.2 0 0 0 4.5 6.6z" />
  </Icon>
);
const IconPlay = () => (
  <Icon size={22}>
    <path d="M8 5.2v13.6a1.3 1.3 0 0 0 2 1.1l10.4-6.8a1.3 1.3 0 0 0 0-2.2L10 4.1a1.3 1.3 0 0 0-2 1.1z" />
  </Icon>
);
const IconPause = () => (
  <Icon size={22}>
    <rect x="6" y="5" width="4.2" height="14" rx="1.6" />
    <rect x="13.8" y="5" width="4.2" height="14" rx="1.6" />
  </Icon>
);
// Parlante con ondas (con sonido) o con una cruz (silenciado)
const IconSpeaker = ({ muted }) => (
  <Icon>
    <path d="M3.5 9.6v4.8a1 1 0 0 0 1 1h3.2l4.6 3.8a1 1 0 0 0 1.7-.8V5.6a1 1 0 0 0-1.7-.8L7.7 8.6H4.5a1 1 0 0 0-1 1z" />
    {muted ? (
      <g fill="none" strokeWidth="2.4">
        <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
      </g>
    ) : (
      <g fill="none" strokeWidth="2.2">
        <path d="M16.5 9.2a4 4 0 0 1 0 5.6" />
        <path d="M19.2 6.6a7.6 7.6 0 0 1 0 10.8" />
      </g>
    )}
  </Icon>
);
const IconNote = () => (
  <Icon size={16}>
    <path d="M9 17.5V6.2a1 1 0 0 1 .8-1l9-1.9a1 1 0 0 1 1.2 1V15" fill="none" strokeWidth="2.2" />
    <circle cx="6.5" cy="17.5" r="3" />
    <circle cx="17.5" cy="15" r="3" />
  </Icon>
);
const IconSparkle = () => (
  <Icon size={16}>
    <path d="M10 2.5l1.9 5.6 5.6 1.9-5.6 1.9L10 17.5l-1.9-5.6L2.5 10l5.6-1.9z" />
    <path d="M18 14l.9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9z" />
  </Icon>
);
// Caja de discos: un vinilo con su etiqueta
const IconRecords = () => (
  <Icon size={18}>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="12" cy="12" r="3.6" fill="#fdf6dc" />
    <circle cx="12" cy="12" r="1.1" />
  </Icon>
);
const IconMinimize = () => (
  <Icon size={18}>
    <path d="M6 9.5l6 6 6-6" fill="none" strokeWidth="2.8" />
  </Icon>
);

// Barra de volumen siempre visible. --fill pinta la parte "llena" de la barra
// (los navegadores no tienen una forma estándar de colorearla por CSS solo).
function VolumeSlider({ icon, label, value, onChange, onPointerUp }) {
  return (
    <label className="tt-volume" title={label}>
      <span className="tt-volume-icon">{icon}</span>
      <span className="tt-sr-only">{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        style={{ "--fill": `${Math.round(value * 100)}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onPointerUp}
      />
    </label>
  );
}

function MusicPlayer() {
  const music = useSyncExternalStore(subscribe, getSnapshot);
  const [cratesOpen, setCratesOpen] = useState(false);
  const [mini, setMini] = useState(loadMini);

  // shown = el disco que se VE en el plato. Normalmente es igual a
  // music.index, pero durante el cambio de disco va un paso atrás: el viejo
  // tiene que terminar de salir antes de que aparezca el nuevo.
  const [shown, setShown] = useState(music.index);
  // phase: "idle" (quieto) | "out" (sale el disco viejo) | "in" (entra el nuevo)
  const [phase, setPhase] = useState("idle");
  const timers = useRef([]);

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }

  // Al desmontar (por ej. al pasar de la pantalla de inicio a la partida) se
  // cancelan los timers pendientes para no tocar un componente que ya no está.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Si la canción cambió "sola" (terminó y pasó a la siguiente), el plato se
  // entera acá y hace la misma animación de cambio de disco. La música ya
  // está sonando, solo se pone al día el dibujo. Depende también de phase:
  // si la canción cambió justo en medio de otra animación, se espera a que
  // termine (phase vuelve a "idle") y ahí se pone al día.
  useEffect(() => {
    if (music.index === shown || phase !== "idle") return;
    // Todo va dentro de timers (nada de setState directo en el efecto) para
    // no provocar renders en cascada.
    const target = music.index;
    later(() => {
      setPhase("out");
      later(() => {
        setShown(target);
        setPhase("in");
        later(() => setPhase("idle"), IN_MS);
      }, OUT_MS);
    }, 0);
  }, [music.index, shown, phase]);

  const track = TRACKS[music.index];
  if (!track) return null; // no hay canciones en src/assets/music

  const swapping = phase !== "idle";
  // El brazo solo apoya la púa si suena y no se está cambiando el disco.
  const needleDown = music.playing && !swapping;

  // Cambio de disco pedido por la persona (funda, anterior o siguiente).
  // A diferencia del cambio automático, acá la canción nueva arranca recién
  // cuando el disco nuevo ya está en el plato.
  function changeRecord(target) {
    if (swapping) return;
    const next = wrapIndex(target);
    if (next === music.index) {
      // Eligió el mismo disco que ya está puesto: solo le damos play
      if (!music.playing) togglePlay();
      return;
    }
    setPhase("out");
    later(() => {
      setShown(next);
      setPhase("in");
      selectTrack(next, true);
      later(() => setPhase("idle"), IN_MS);
    }, OUT_MS);
  }

  function pickFromCrate(index) {
    playSelectSound();
    changeRecord(index);
  }

  function toggleMini() {
    setMini((value) => {
      saveMini(!value);
      return !value;
    });
    setCratesOpen(false);
  }

  // ---------- Modo minimizado: solo un vinilo girando ----------
  if (mini) {
    return (
      <div className="tt-player tt-player-mini">
        <button
          type="button"
          className="tt-mini-btn"
          onClick={toggleMini}
          aria-label={`Abrir el tocadiscos. ${music.playing ? "Sonando" : "En pausa"}: ${track.title}`}
          title="Abrir el tocadiscos"
        >
          <Vinyl index={music.index} className={music.playing ? "spinning" : ""} />
        </button>
      </div>
    );
  }

  return (
    <div className="tt-player" aria-label="Tocadiscos">
      {/* ---------- Caja de discos (se abre arriba del tocadiscos) ---------- */}
      {cratesOpen && (
        <div className="tt-crate">
          <p className="tt-crate-title">Caja de discos</p>
          <ul className="tt-sleeves">
            {TRACKS.map((item, index) => {
              const onPlatter = index === shown;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`tt-sleeve ${onPlatter ? "empty" : ""}`}
                    style={{ "--label": labelColor(index) }}
                    onClick={() => pickFromCrate(index)}
                    title={item.title}
                    disabled={swapping}
                    aria-label={onPlatter ? `${item.title}, está en el tocadiscos` : `Poner el disco ${item.title}`}
                  >
                    <span className="tt-sleeve-cover">
                      {/* Si el disco está en el plato, la funda queda vacía */}
                      {!onPlatter && <Vinyl index={index} className="tt-sleeve-vinyl" />}
                      <span className="tt-sleeve-art" />
                    </span>
                    <span className="tt-sleeve-title">{onPlatter ? (music.playing ? "Reproduciendo" : "En pausa") : item.title}</span>                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ---------- El tocadiscos ---------- */}
      <div className={`tt ${music.playing ? "is-playing" : ""}`}>
        <div className="tt-lid" aria-hidden="true">
          <span className="tt-lid-inner" />
        </div>

        <div className="tt-base">
          <div className="tt-deck">
            {/* Tocar el plato también pausa / reanuda */}
            <button
              type="button"
              className="tt-platter"
              onClick={togglePlay}
              disabled={swapping}
              aria-label={music.playing ? "Pausar la música" : "Reproducir la música"}
              title={music.playing ? "Pausar" : "Reproducir"}
            >
              <span className={`tt-record-slot phase-${phase}`}>
                <Vinyl index={shown} className={music.playing && !swapping ? "spinning" : ""} />
              </span>
              <span className="tt-shine" aria-hidden="true" />
            </button>

            <span className={`tt-arm ${needleDown ? "down" : ""}`} aria-hidden="true">
              <span className="tt-arm-pivot" />
              <span className="tt-arm-rod" />
              <span className="tt-arm-head" />
            </span>

            <span className="tt-knob" aria-hidden="true" />
          </div>

          <div className="tt-front" aria-hidden="true">
            <span className="tt-latch left" />
            <span className="tt-latch right" />
          </div>
        </div>
        <span className="tt-handle" aria-hidden="true" />
      </div>

      {/* ---------- Cartelito con la canción, los controles y el volumen ---------- */}
      <div className="tt-plaque">
        <div className="tt-plaque-top">
          <div className="tt-now">
            <span className="tt-now-label">{swapping ? "Cambiando disco" : music.playing ? "Sonando" : "En pausa"}</span>
            <span className="tt-now-title">{TRACKS[shown]?.title ?? track.title}</span>
          </div>
          <button
            type="button"
            className={`tt-mini-icon ${cratesOpen ? "active" : ""}`}
            onClick={() => setCratesOpen((value) => !value)}
            aria-expanded={cratesOpen}
            aria-label={cratesOpen ? "Cerrar la caja de discos" : "Abrir la caja de discos"}
            title="Elegir disco"
          >
            <IconRecords />
          </button>
          <button type="button" className="tt-mini-icon" onClick={toggleMini} aria-label="Achicar el tocadiscos" title="Achicar">
            <IconMinimize />
          </button>
        </div>

        <div className="tt-controls">
          <button
            type="button"
            className="tt-btn"
            onClick={() => changeRecord(music.index - 1)}
            disabled={swapping}
            aria-label="Disco anterior"
            title="Disco anterior"
          >
            <IconPrev />
          </button>
          <button
            type="button"
            className="tt-btn tt-play"
            onClick={togglePlay}
            disabled={swapping}
            aria-label={music.playing ? "Pausar la música" : "Reproducir la música"}
            title={music.playing ? "Pausar" : "Reproducir"}
          >
            {music.playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            className="tt-btn"
            onClick={() => changeRecord(music.index + 1)}
            disabled={swapping}
            aria-label="Disco siguiente"
            title="Disco siguiente"
          >
            <IconNext />
          </button>
          <button
            type="button"
            className={`tt-btn tt-mute ${music.muted ? "muted" : ""}`}
            onClick={toggleMute}
            aria-pressed={music.muted}
            aria-label={music.muted ? "Activar el sonido de la música" : "Silenciar la música"}
            title={music.muted ? "Activar sonido" : "Silenciar"}
          >
            <IconSpeaker muted={music.muted} />
          </button>
        </div>

        <div className="tt-volumes">
          <VolumeSlider
            icon={<IconNote />}
            label="Volumen de la música"
            value={music.muted ? 0 : music.volume}
            onChange={setMusicVolume}
          />
          <VolumeSlider
            icon={<IconSparkle />}
            label="Volumen de los efectos"
            value={music.sfxVolume}
            onChange={setSfxVolumeState}
            onPointerUp={playSelectSound}
          />
        </div>
      </div>
    </div>
  );
}

export default MusicPlayer;