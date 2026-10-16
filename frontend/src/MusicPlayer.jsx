import { useState, useSyncExternalStore } from "react";
import {
  TRACKS,
  subscribe,
  getSnapshot,
  togglePlay,
  nextTrack,
  prevTrack,
  selectTrack,
  setMusicVolume,
  toggleMute,
  setSfxVolumeState,
} from "./music";
import { playSelectSound } from "./sound";

// Reproductor flotante abajo a la izquierda: una pastillita con la canción y
// los controles; al tocarla se abre la lista de canciones y los volúmenes.
function MusicPlayer() {
  const music = useSyncExternalStore(subscribe, getSnapshot);
  const [open, setOpen] = useState(false);
  const track = TRACKS[music.index];
  if (!track) return null; // no hay canciones en src/assets/music

  return (
    <div className={`music-player ${open ? "open" : ""}`} aria-label="Reproductor de música">
      {open && (
        <div className="music-panel">
          <p className="music-panel-title">Música</p>
          <ul className="music-tracks">
            {TRACKS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`music-track ${index === music.index ? "current" : ""}`}
                  onClick={() => selectTrack(index, true)}
                >
                  <span className="music-track-mark">{index === music.index && music.playing ? ">" : index + 1}</span>
                  {item.title}
                </button>
              </li>
            ))}
          </ul>

          <label className="music-slider">
            <span>Volumen de la música</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={music.muted ? 0 : music.volume}
              onChange={(event) => setMusicVolume(Number(event.target.value))}
            />
          </label>
          <label className="music-slider">
            <span>Volumen de los efectos</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={music.sfxVolume}
              onChange={(event) => setSfxVolumeState(Number(event.target.value))}
              onPointerUp={playSelectSound}
            />
          </label>
        </div>
      )}

      <div className="music-bar">
        <button
          type="button"
          className="music-btn"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Cerrar la lista de canciones" : "Abrir la lista de canciones"}
          title="Canciones y volumen"
        >
          {open ? "v" : "^"}
        </button>
        <div className="music-now">
          <span className="music-now-label">{music.playing ? "Sonando" : "En pausa"}</span>
          <span className="music-now-title">{track.title}</span>
        </div>
        <button type="button" className="music-btn" onClick={prevTrack} aria-label="Canción anterior" title="Anterior">
          |&lt;
        </button>
        <button
          type="button"
          className="music-btn music-play"
          onClick={togglePlay}
          aria-label={music.playing ? "Pausar la música" : "Reproducir la música"}
          title={music.playing ? "Pausar" : "Reproducir"}
        >
          {music.playing ? "II" : ">"}
        </button>
        <button type="button" className="music-btn" onClick={() => nextTrack(true)} aria-label="Canción siguiente" title="Siguiente">
          &gt;|
        </button>
        <button
          type="button"
          className={`music-btn ${music.muted ? "off" : ""}`}
          onClick={toggleMute}
          aria-label={music.muted ? "Activar el sonido de la música" : "Silenciar la música"}
          title={music.muted ? "Activar sonido" : "Silenciar"}
        >
          {music.muted ? "x" : "vol"}
        </button>
      </div>
    </div>
  );
}

export default MusicPlayer;
