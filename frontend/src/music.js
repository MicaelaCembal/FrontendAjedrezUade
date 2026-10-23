// Reproductor de música de fondo. Vive fuera de React (un único <audio> para
// toda la app) para que no se corte ni se reinicie al pasar de la pantalla de
// dificultad a la partida. El componente MusicPlayer solo lo controla.
//
// Para sumar tus propias canciones: copiá los archivos de audio (.mp3, .ogg,
// .wav o .m4a) en la carpeta src/assets/music/. No hay que tocar código: la
// lista se arma sola con todo lo que haya ahí, ordenada por nombre de archivo,
// y el título que se muestra sale del nombre ("01-mi-cancion.mp3" se ve como
// "Mi cancion"). Para quitar una canción, borrá el archivo.
//
// Si querés un título con mayúsculas, puntos o tildes que no se puede escribir
// bien en un nombre de archivo (por ej. "K.K. Bossa"), ponelo en TITLES: la
// clave es el nombre del archivo y el valor, el título que se muestra. Los
// archivos que no estén acá usan el título que sale del nombre.

const TITLES = {
  "01-tema-1.mp3": "Chill evening vibes",
  "02-tema-2.mp3": "Floating in the clouds",
  "03-tema-3.mp3": "Sunset serenade",
  "04-tema-4.mp3": "Midnight stroll",
  "05-tema-5.mp3": "Dizzy thoughts",
  "06-tema-6.mp3": "Rainy day reflections",
};

const files = import.meta.glob("./assets/music/*.{mp3,ogg,wav,m4a}", {
  eager: true,
  query: "?url",
  import: "default",
});

function titleFromPath(path) {
  const fileName = path.split("/").pop();
  if (TITLES[fileName]) return TITLES[fileName];
  const name = fileName
    .replace(/\.[^.]+$/, "") // extensión
    .replace(/^\d+[\s._-]+/, "") // número de orden al principio
    .replace(/[-_]+/g, " ")
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Sin título";
}

export const TRACKS = Object.keys(files)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((path) => ({ id: path, title: titleFromPath(path), file: files[path] }));

const STORAGE_KEY = "ajedrezCrossingMusic";

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      index: Number.isInteger(saved.index) && saved.index >= 0 && saved.index < TRACKS.length ? saved.index : 0,
      volume: typeof saved.volume === "number" ? Math.min(1, Math.max(0, saved.volume)) : 0.4,
      sfxVolume: typeof saved.sfxVolume === "number" ? Math.min(1, Math.max(0, saved.sfxVolume)) : 0.8,
      muted: Boolean(saved.muted),
      wantsMusic: saved.wantsMusic !== false, // false solo si la persona la pausó a propósito
    };
  } catch {
    return { index: 0, volume: 0.4, sfxVolume: 0.8, muted: false, wantsMusic: true };
  }
}

const prefs = loadPrefs();
const state = { ...prefs, playing: false };
const listeners = new Set();
let audio = null;

function save() {
  try {
    const { index, volume, sfxVolume, muted, wantsMusic } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index, volume, sfxVolume, muted, wantsMusic }));
  } catch {
    // sin localStorage no pasa nada
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function ensureAudio() {
  if (audio || typeof Audio === "undefined") return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.src = TRACKS[state.index]?.file ?? "";
  audio.volume = state.muted ? 0 : state.volume;
  audio.addEventListener("ended", () => nextTrack(true));
  audio.addEventListener("play", () => {
    state.playing = true;
    emit();
  });
  audio.addEventListener("pause", () => {
    state.playing = false;
    emit();
  });
  return audio;
}

function tryPlay() {
  const el = ensureAudio();
  if (!el) return;
  // Si el navegador bloquea el autoplay, simplemente queda en pausa
  el.play().catch(() => {});
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Foto del estado actual. Se recrea solo cuando algo cambia, para
// useSyncExternalStore.
let snapshot = { ...state };
export function getSnapshot() {
  if (
    snapshot.index !== state.index ||
    snapshot.volume !== state.volume ||
    snapshot.sfxVolume !== state.sfxVolume ||
    snapshot.muted !== state.muted ||
    snapshot.playing !== state.playing
  ) {
    snapshot = { ...state };
  }
  return snapshot;
}

export function togglePlay() {
  const el = ensureAudio();
  if (!el) return;
  if (el.paused) {
    state.wantsMusic = true;
    save();
    tryPlay();
  } else {
    state.wantsMusic = false;
    save();
    el.pause();
  }
}

// Se llama desde un click real (empezar partida): arranca la música salvo que
// la persona la haya pausado a propósito la última vez.
export function startIfWanted() {
  if (TRACKS.length > 0 && state.wantsMusic && !state.muted) tryPlay();
}

export function selectTrack(index, autoplay = true) {
  const el = ensureAudio();
  if (!el || TRACKS.length === 0) return;
  const wrapped = (index + TRACKS.length) % TRACKS.length;
  state.index = wrapped;
  el.src = TRACKS[wrapped].file;
  save();
  emit();
  if (autoplay) {
    state.wantsMusic = true;
    save();
    tryPlay();
  }
}

export function nextTrack(autoplay = true) {
  selectTrack(state.index + 1, autoplay);
}

export function prevTrack() {
  selectTrack(state.index - 1, true);
}

export function setMusicVolume(volume) {
  state.volume = Math.min(1, Math.max(0, volume));
  if (state.volume > 0) state.muted = false;
  const el = ensureAudio();
  if (el) el.volume = state.muted ? 0 : state.volume;
  save();
  emit();
}

export function toggleMute() {
  state.muted = !state.muted;
  const el = ensureAudio();
  if (el) el.volume = state.muted ? 0 : state.volume;
  save();
  emit();
}

export function setSfxVolumeState(volume) {
  state.sfxVolume = Math.min(1, Math.max(0, volume));
  save();
  emit();
}

export function getSfxVolume() {
  return state.sfxVolume;
}