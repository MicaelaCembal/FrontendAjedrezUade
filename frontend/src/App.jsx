import { useEffect, useRef, useState } from "react";
import { getState, postMove, resetGame, undoMove } from "./Api";
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCheckmateSound,
  playDrawSound,
  playPromotionSound,
  playTimeoutSound,
} from "./sound";
import "./App.css";

import rookPink from "./assets/pieces/rosa/rookPink.png";
import knightPink from "./assets/pieces/rosa/knightPink.png";
import bishopPink from "./assets/pieces/rosa/bishopPink.png";
import queenPink from "./assets/pieces/rosa/queenPink.png";
import kingPink from "./assets/pieces/rosa/kingPink.png";
import pawnPink from "./assets/pieces/rosa/pawnPink.png";

import rookCeleste from "./assets/pieces/celeste/rookLightBlue.png";
import knightCeleste from "./assets/pieces/celeste/knightLightBlue.png";
import bishopCeleste from "./assets/pieces/celeste/bishopLightBlue.png";
import queenCeleste from "./assets/pieces/celeste/queenLightBlue.png";
import kingCeleste from "./assets/pieces/celeste/kingLightBlue.png";
import pawnCeleste from "./assets/pieces/celeste/pawnLightBlue.png";

// Personajes de Animal Crossing por tipo de pieza y color (WHITE = rosa, BLACK = celeste)
const PIECE_IMAGE = {
  WHITE: {
    ROOK: rookPink,
    KNIGHT: knightPink,
    BISHOP: bishopPink,
    QUEEN: queenPink,
    KING: kingPink,
    PAWN: pawnPink,
  },
  BLACK: {
    ROOK: rookCeleste,
    KNIGHT: knightCeleste,
    BISHOP: bishopCeleste,
    QUEEN: queenCeleste,
    KING: kingCeleste,
    PAWN: pawnCeleste,
  },
};

// Celeste (Negras) arriba, Rosa (Blancas) abajo: se dibuja la fila de pantalla
// 7-row en vez de row directamente — la lógica de movimientos sigue usando
// las filas reales que maneja el backend.
function toScreenRow(row) {
  return 7 - row;
}

const BOARD_SIZE = 8;

// Los 5 fondos entre los que se puede elegir, todos con el mismo esquema de
// nombre (fondo1..fondo5) para que sea fácil agregar/sacar uno después. Los
// dos ".webp" son fotos propias (subidas por la usuaria a mano); los tres
// ".svg" son ilustraciones originales (no son arte de Nintendo ni de ningún
// juego: un patrón de hojitas, una isla y un bosque, dibujados de cero).
const BACKGROUNDS = [
  { id: "fondo1", label: "Bosque", file: "/backgrounds/fondo1.svg", mode: "cover" },
  { id: "fondo2", label: "Isla", file: "/backgrounds/fondo2.svg", mode: "cover" },
  { id: "fondo3", label: "Hojitas", file: "/backgrounds/fondo3.svg", mode: "tile" },
  { id: "fondo4", label: "Fondo 4", file: "/backgrounds/fondo4.webp", mode: "cover" },
  { id: "fondo5", label: "Fondo 5", file: "/backgrounds/fondo5.webp", mode: "cover" },
];
const DEFAULT_BACKGROUND_ID = "fondo5";

function loadSavedBackgroundId() {
  try {
    const saved = localStorage.getItem("ajedrezCrossingBackground");
    if (saved && BACKGROUNDS.some((bg) => bg.id === saved)) return saved;
  } catch {
    // localStorage puede no estar disponible (modo privado, etc.): no pasa nada
  }
  return DEFAULT_BACKGROUND_ID;
}

// Convierte el tablero (matriz 8x8) en una lista plana de piezas vivas,
// indexada por su id. Se usa tanto para dibujar la capa de piezas como para
// comparar "tablero anterior" contra "tablero nuevo" y detectar capturas y
// coronaciones.
function flattenBoard(board) {
  const byId = new Map();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece) {
        byId.set(piece.id, { ...piece, row, col });
      }
    }
  }
  return byId;
}

const USER_COLOR = "WHITE";

function isUserPiece(piece) {
  return Boolean(piece && piece.color === USER_COLOR);
}

// Reloj de ajedrez: 10 minutos por lado, formato partida "rápida" estándar.
// Es un reloj solo de frontend (el backend no sabe nada de esto), así que si
// se refresca la página se reinicia; para esta app alcanza y sobra.
const INITIAL_CLOCK_SECONDS = 10 * 60;

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

let ghostIdCounter = 0;

function App() {
  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState("WHITE");
  const [gameState, setGameState] = useState("IN_PROGRESS");
  const [legalMoves, setLegalMoves] = useState([]);
  const [checkingPiecePositions, setCheckingPiecePositions] = useState([]);
  const [kingInCheckPosition, setKingInCheckPosition] = useState(null);
  const [selected, setSelected] = useState(null); // { row, col }
  const [message, setMessage] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [capturedWhite, setCapturedWhite] = useState([]);
  const [capturedBlack, setCapturedBlack] = useState([]);
  const [checkChip, setCheckChip] = useState(null); // "them" | "you" | null, con un pop al aparecer
  const [sparklingIds, setSparklingIds] = useState(() => new Set());
  const [ghosts, setGhosts] = useState([]); // piezas capturadas "volando" hacia la bandeja
  const [backgroundId, setBackgroundId] = useState(loadSavedBackgroundId);
  const [whiteTime, setWhiteTime] = useState(INITIAL_CLOCK_SECONDS);
  const [blackTime, setBlackTime] = useState(INITIAL_CLOCK_SECONDS);
  const [timeoutColor, setTimeoutColor] = useState(null); // "WHITE" | "BLACK" | null: a quién se le acabó el tiempo

  const prevPiecesRef = useRef(new Map());
  const boardElRef = useRef(null);
  const trayWhiteRef = useRef(null);
  const trayBlackRef = useRef(null);

  const background = BACKGROUNDS.find((bg) => bg.id === backgroundId) ?? BACKGROUNDS[0];

  useEffect(() => {
    try {
      localStorage.setItem("ajedrezCrossingBackground", backgroundId);
    } catch {
      // sin localStorage no pasa nada, simplemente no se recuerda la próxima vez
    }
  }, [backgroundId]);

  // Estar en jaque no termina la partida: el jugador todavía debe poder
  // mover para salir del jaque. Jaque mate, ahogado (tablas) y que a alguien
  // se le acabe el tiempo del reloj sí la terminan, así que ahí se bloquea
  // el tablero.
  const gameOver = gameState === "CHECKMATE" || gameState === "DRAW" || Boolean(timeoutColor);
  const isUserTurn = turn === USER_COLOR && !gameOver;
  const selectedPiece =
    selected && board ? board[selected.row]?.[selected.col] : null;
  const possibleMoves =
    isUserTurn && isUserPiece(selectedPiece)
      ? legalMoves
          .filter(
            (move) =>
              move.fromRow === selected.row && move.fromCol === selected.col
          )
          .map((move) => ({ row: move.toRow, col: move.toCol }))
      : [];

  function isPossibleMove(row, col) {
    return possibleMoves.some(
      (move) => move.row === row && move.col === col
    );
  }

  function stateMovesForPiece(row, col) {
    return legalMoves
      .filter((move) => move.fromRow === row && move.fromCol === col)
      .map((move) => ({ row: move.toRow, col: move.toCol }));
  }

  // Aplica un estado nuevo del backend tal cual, sin animar nada. Se usa al
  // cargar la partida por primera vez, al reiniciar y al deshacer: en
  // ninguno de esos casos hay una "jugada" real que animar, así que no tiene
  // sentido hacer volar piezas a la bandeja ni mostrar el chip de jaque.
  function applyStateInstant(state) {
    setBoard(state.board);
    setTurn(state.turn);
    setGameState(state.gameState);
    setLegalMoves(state.legalMoves ?? []);
    setCheckingPiecePositions(state.checkingPiecePositions ?? []);
    setKingInCheckPosition(state.kingInCheckPosition ?? null);
    setCapturedWhite(state.capturedWhite ?? []);
    setCapturedBlack(state.capturedBlack ?? []);
    setConnectionError(false);
    prevPiecesRef.current = flattenBoard(state.board);
  }

  // Aplica un estado nuevo que viene de una jugada real (tuya o de la IA):
  // compara contra el tablero anterior para detectar capturas (piezas que
  // desaparecieron) y coronaciones (mismo id, mismo lugar, pero cambió de
  // tipo), y dispara las animaciones correspondientes.
  // Devuelve { capturedCount, promoted } para que quien llamó pueda decidir
  // qué sonido tiene más prioridad (esto cubre tanto la jugada del usuario
  // como la respuesta de la IA, que llegan juntas en el mismo estado nuevo).
  function applyStateAnimated(state) {
    const prevPieces = prevPiecesRef.current;
    const nextPieces = flattenBoard(state.board);

    const newlySparkling = new Set();
    const newGhosts = [];
    let promoted = false;

    for (const [id, before] of prevPieces) {
      const after = nextPieces.get(id);
      if (!after) {
        // Ya no está en el tablero: la capturaron. Si la medida del tablero
        // y de la bandeja están disponibles, arma el "vuelo" hacia ahí.
        const flight = buildCaptureGhost(id, before);
        if (flight) newGhosts.push(flight);
        continue;
      }
      if (after.type !== before.type) {
        newlySparkling.add(id);
        promoted = true;
      }
    }

    setBoard(state.board);
    setTurn(state.turn);
    setGameState(state.gameState);
    setLegalMoves(state.legalMoves ?? []);
    setCheckingPiecePositions(state.checkingPiecePositions ?? []);
    setKingInCheckPosition(state.kingInCheckPosition ?? null);
    setCapturedWhite(state.capturedWhite ?? []);
    setCapturedBlack(state.capturedBlack ?? []);
    setConnectionError(false);
    prevPiecesRef.current = nextPieces;

    if (newlySparkling.size > 0) {
      setSparklingIds(newlySparkling);
      setTimeout(() => setSparklingIds(new Set()), 650);
    }
    if (newGhosts.length > 0) {
      setGhosts((current) => [...current, ...newGhosts]);
    }

    return { capturedCount: newGhosts.length, promoted };
  }

  // Mide dónde estaba la pieza capturada (en la cuadrícula real del
  // tablero) y hacia dónde tiene que volar (la bandeja de su color), y arma
  // el objeto "fantasma" que se va a dibujar con position:fixed y animar
  // con una transición de top/left/opacity/scale.
  function buildCaptureGhost(id, piece) {
    const boardEl = boardElRef.current;
    if (!boardEl) return null;

    const boardRect = boardEl.getBoundingClientRect();
    const screenRow = toScreenRow(piece.row);
    const squareSize = boardRect.width / BOARD_SIZE;
    const startLeft = boardRect.left + piece.col * squareSize;
    const startTop = boardRect.top + screenRow * squareSize;

    // La pieza capturada la come quien tenía el turno en ese momento: si la
    // pieza comida es BLANCA, la comió Negras (va a la bandeja de Negras),
    // y viceversa.
    const trayEl = piece.color === "WHITE" ? trayBlackRef.current : trayWhiteRef.current;
    const trayRect = trayEl ? trayEl.getBoundingClientRect() : null;
    const endLeft = trayRect ? trayRect.left + trayRect.width / 2 - squareSize / 2 : startLeft;
    const endTop = trayRect ? trayRect.top + trayRect.height / 2 - squareSize / 2 : startTop;

    ghostIdCounter += 1;
    return {
      ghostId: ghostIdCounter,
      color: piece.color,
      type: piece.type,
      size: squareSize,
      start: { top: startTop, left: startLeft },
      end: { top: endTop, left: endLeft },
    };
  }

  function removeGhost(ghostId) {
    setGhosts((current) => current.filter((g) => g.ghostId !== ghostId));
  }

  async function loadState() {
    try {
      const state = await getState();
      applyStateInstant(state);
    } catch {
      setConnectionError(true);
    }
  }

  useEffect(() => {
    loadState();
  }, []);

  // Reloj de ajedrez: cada segundo le resta uno al tiempo de quien tiene el
  // turno. Se frena solo (sin crear el intervalo) si la partida ya terminó,
  // si no hay conexión con el backend, o si a alguien ya se le acabó el
  // tiempo. Al llegar a 0 marca el timeout y no sigue descontando de más.
  useEffect(() => {
    if (!board || gameOver || connectionError) return undefined;

    const interval = setInterval(() => {
      if (turn === "WHITE") {
        setWhiteTime((current) => {
          if (current <= 1) {
            setTimeoutColor("WHITE");
            return 0;
          }
          return current - 1;
        });
      } else {
        setBlackTime((current) => {
          if (current <= 1) {
            setTimeoutColor("BLACK");
            return 0;
          }
          return current - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [board, turn, gameOver, connectionError]);

  useEffect(() => {
    if (timeoutColor) playTimeoutSound();
  }, [timeoutColor]);

  function triggerCheckChip(who) {
    setCheckChip(null);
    // Se saca y se vuelve a poner en el próximo tick para que, si ya estaba
    // mostrando el chip, la animación de "pop" se vea de nuevo.
    requestAnimationFrame(() => {
      setCheckChip(who);
      setTimeout(() => setCheckChip(null), 1600);
    });
  }

  async function handleSquareClick(row, col) {
    if (!board) return;

    // El jaque no termina la partida: todavía hay que poder responderlo.
    if (!isUserTurn) {
      return;
    }

    const clickedPiece = board[row][col];

    // Nada seleccionado todavía: solo se puede seleccionar una pieza propia del usuario
    if (!selected) {
      if (isUserPiece(clickedPiece)) {
        const legalMoves = stateMovesForPiece(row, col);
        if (legalMoves.length === 0) {
          setMessage(
            gameState === "CHECK"
              ? "Esa pieza no puede resolver el jaque"
              : "Esa pieza no tiene movimientos válidos"
          );
          return;
        }
        setSelected({ row, col });
        setMessage("");
      }
      return;
    }

    // Click sobre la misma pieza: deseleccionar
    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    // Permitir cambiar la selección directamente a otra pieza propia del usuario
    if (isUserPiece(clickedPiece)) {
      const legalMoves = stateMovesForPiece(row, col);
      if (legalMoves.length === 0) {
        setSelected(null);
        setMessage(
          gameState === "CHECK"
            ? "Esa pieza no puede resolver el jaque"
            : "Esa pieza no tiene movimientos válidos"
        );
        return;
      }
      setSelected({ row, col });
      setMessage("");
      return;
    }

    // Click en otra casilla (vacía o pieza rival para capturar): intentar mover
    if (!isPossibleMove(row, col)) {
      setSelected(null);
      setMessage("Movimiento inválido");
      return;
    }

    const movedPieceType = selectedPiece.type;
    const response = await postMove(selected.row, selected.col, row, col);
    const { capturedCount, promoted } = applyStateAnimated(response.state);
    setSelected(null);

    if (response.result !== "SUCCESS") {
      setMessage(
        response.result === "NOT_YOUR_TURN"
          ? "No es tu turno"
          : "Movimiento inválido"
      );
      return;
    }

    setMessage("");

    // Prioridad de sonidos: primero lo que termina la partida, después jaque,
    // después coronación, después captura, y si no pasó nada de eso, el
    // sonido normal de la pieza que se movió. "capturedCount" cuenta tanto
    // las capturas propias como las que hizo la IA en su respuesta.
    if (response.state.gameState === "CHECKMATE") {
      const userWon = response.state.turn !== USER_COLOR;
      playCheckmateSound(userWon);
    } else if (response.state.gameState === "DRAW") {
      playDrawSound();
    } else if (response.gaveCheck) {
      triggerCheckChip("you");
      playCheckSound();
    } else if (response.state.gameState === "CHECK") {
      triggerCheckChip("them");
      playCheckSound();
    } else if (promoted) {
      playPromotionSound();
    } else if (capturedCount > 0) {
      playCaptureSound();
    } else {
      playMoveSound(movedPieceType);
    }
  }

  async function handleReset() {
    const state = await resetGame();
    applyStateInstant(state);
    setSelected(null);
    setMessage("");
    setGhosts([]);
    setCheckChip(null);
    setWhiteTime(INITIAL_CLOCK_SECONDS);
    setBlackTime(INITIAL_CLOCK_SECONDS);
    setTimeoutColor(null);
  }

  async function handleUndo() {
    const state = await undoMove();
    applyStateInstant(state);
    setSelected(null);
    setMessage("");
    setGhosts([]);
    setCheckChip(null);
    // El tiempo ya gastado no se devuelve (como en un reloj real), pero si se
    // había acabado el tiempo de alguien, deshacer permite seguir jugando.
    setTimeoutColor(null);
  }

  // Texto de fin de partida, en vez de mostrar el nombre crudo del estado
  // (CHECKMATE / DRAW). Si hay jaque mate, quien queda en jaque es quien
  // pierde, así que el otro color es el ganador.
  function gameOverInfo() {
    if (timeoutColor) {
      const userWon = timeoutColor !== USER_COLOR;
      return {
        tone: userWon ? "win" : "lose",
        title: userWon ? "¡Ganaste por tiempo! 🎉" : "Se te acabó el tiempo",
        subtitle: userWon
          ? "A Celeste se le acabó el reloj."
          : "Tu reloj llegó a cero.",
      };
    }
    if (gameState === "CHECKMATE") {
      const userWon = turn !== USER_COLOR;
      return {
        tone: userWon ? "win" : "lose",
        title: userWon ? "¡Ganaste! 🎉" : "Perdiste",
        subtitle: userWon
          ? "Le pusiste jaque mate a Celeste."
          : "Te pusieron jaque mate.",
      };
    }
    if (gameState === "DRAW") {
      return {
        tone: "draw",
        title: "Tablas",
        subtitle: "Ahogado: nadie tiene movimientos legales, pero nadie está en jaque.",
      };
    }
    return null;
  }

  if (connectionError) {
    return (
      <div className="app" data-bg-mode={background.mode}>
        <div className="title-sticker">
          <h1>Ajedrez Crossing</h1>
        </div>
        <p className="error">
          No me pude conectar al backend en <code>http://localhost:8081</code>.
          <br />
          Fijate que el <code>WebMain.java</code> esté corriendo en VS Code.
        </p>
        <button className="reset-btn" onClick={loadState}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!board) return <p className="loading">Conectando con el backend...</p>;

  const info = gameOverInfo();

  return (
    <div
      className="app"
      style={{ "--app-bg": `url("${background.file}")` }}
      data-bg-mode={background.mode}
    >
      <div className="title-sticker">
        <span className="sign-peg sign-peg-left" />
        <h1>Ajedrez Crossing</h1>
        <span className="sign-peg sign-peg-right" />
      </div>

      <div className="status">
        {!gameOver && gameState === "CHECK" && (
          <span className="game-state">¡Jaque!</span>
        )}
        {checkChip && (
          <span key={checkChip} className={`check-chip ${checkChip}`}>
            {checkChip === "you" ? "¡Pusiste en jaque!" : "¡Te pusieron en jaque!"}
          </span>
        )}
        {message && <span className="message">{message}</span>}
      </div>

      <div className="game-layout">
        <div className="board-frame">
          <div className="board" ref={boardElRef}>
            <div className="squares-grid">
              {Array.from({ length: BOARD_SIZE }, (_, screenRow) => {
                const row = toScreenRow(screenRow);
                return (
                  <div className="board-row" key={row}>
                    {board[row].map((piece, col) => {
                      const isDark = (row + col) % 2 === 1;
                      const isSelected =
                        isUserTurn &&
                        isUserPiece(piece) &&
                        selected &&
                        selected.row === row &&
                        selected.col === col;
                      const isPossible = isPossibleMove(row, col);
                      const isCheckingPiece = checkingPiecePositions.includes(
                        `${row}-${col}`
                      );
                      const isKingInCheck =
                        kingInCheckPosition &&
                        kingInCheckPosition.row === row &&
                        kingInCheckPosition.col === col;
                      return (
                        <div
                          key={col}
                          className={`square ${isDark ? "dark" : "light"} ${
                            isSelected ? "selected" : ""
                          } ${isPossible ? "possible-move" : ""} ${
                            isPossible && piece ? "possible-capture" : ""
                          } ${isCheckingPiece ? "checking-piece" : ""} ${
                            isKingInCheck ? "king-in-check" : ""
                          }`}
                          onClick={() => handleSquareClick(row, col)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="pieces-layer">
              {Array.from(flattenBoard(board).values()).map((piece) => {
                const screenRow = toScreenRow(piece.row);
                return (
                  <div
                    key={piece.id}
                    className={`piece-slot ${sparklingIds.has(piece.id) ? "sparkle" : ""}`}
                    style={{
                      top: `${(screenRow / BOARD_SIZE) * 100}%`,
                      left: `${(piece.col / BOARD_SIZE) * 100}%`,
                      width: `${100 / BOARD_SIZE}%`,
                      height: `${100 / BOARD_SIZE}%`,
                    }}
                  >
                    <img
                      className="piece"
                      src={PIECE_IMAGE[piece.color][piece.type]}
                      alt={`${piece.type} ${piece.color}`}
                      title={piece.type}
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>

            {info && (
              <div className={`game-over-overlay ${info.tone}`}>
                <div className="game-over-card">
                  <strong>{info.title}</strong>
                  <span>{info.subtitle}</span>
                  <button className="reset-btn" onClick={handleReset}>
                    Jugar de nuevo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="side-panel">
          <span className={`turn-badge ${turn === "WHITE" ? "pink" : "cyan"}`}>
            Turno: {turn === "WHITE" ? "Rosa" : "Celeste"}
          </span>

          <div className="clocks">
            <div
              className={`clock cyan ${turn === "BLACK" && !gameOver ? "active" : ""} ${
                blackTime <= 30 ? "low" : ""
              }`}
            >
              <span className="clock-label">Celeste</span>
              <span className="clock-time">{formatClock(blackTime)}</span>
            </div>
            <div
              className={`clock pink ${turn === "WHITE" && !gameOver ? "active" : ""} ${
                whiteTime <= 30 ? "low" : ""
              }`}
            >
              <span className="clock-label">Rosa</span>
              <span className="clock-time">{formatClock(whiteTime)}</span>
            </div>
          </div>

          <div className="tray-group">
            <p className="tray-label">Comidas por Celeste</p>
            <div className="captured-tray" ref={trayBlackRef}>
              {capturedBlack.map((piece) => (
                <img
                  key={piece.id}
                  className="captured-piece"
                  src={PIECE_IMAGE[piece.color][piece.type]}
                  alt={`${piece.type} ${piece.color} capturada`}
                />
              ))}
            </div>
          </div>

          <div className="tray-group">
            <p className="tray-label">Comidas por Rosa</p>
            <div className="captured-tray" ref={trayWhiteRef}>
              {capturedWhite.map((piece) => (
                <img
                  key={piece.id}
                  className="captured-piece"
                  src={PIECE_IMAGE[piece.color][piece.type]}
                  alt={`${piece.type} ${piece.color} capturada`}
                />
              ))}
            </div>
          </div>

          <div className="bg-picker">
            <p className="tray-label">Fondo</p>
            <div className="bg-swatches">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  className={`bg-swatch ${bg.id === backgroundId ? "active" : ""}`}
                  style={{ backgroundImage: `url("${bg.file}")` }}
                  title={bg.label}
                  aria-label={bg.label}
                  onClick={() => setBackgroundId(bg.id)}
                />
              ))}
            </div>
          </div>

          <div className="actions">
            <button className="undo-btn" onClick={handleUndo}>
              Deshacer
            </button>
            <button className="reset-btn" onClick={handleReset}>
              Reiniciar partida
            </button>
          </div>
        </div>
      </div>

      {ghosts.map((ghost) => (
        <CaptureGhost key={ghost.ghostId} ghost={ghost} onDone={() => removeGhost(ghost.ghostId)} />
      ))}
    </div>
  );
}

// Una pieza comida, dibujada con position:fixed (en coordenadas de pantalla,
// no del tablero) para poder volar desde su casilla hasta la bandeja aunque
// estén en contenedores distintos. Arranca parada en el punto de partida sin
// transición, y en el siguiente frame se le asigna el punto de llegada CON
// transición, que es lo que dispara la animación.
function CaptureGhost({ ghost, onDone }) {
  const [pos, setPos] = useState(ghost.start);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPos(ghost.end);
      setFaded(true);
    });
    const timeout = setTimeout(onDone, 650);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <img
      className={`capture-ghost ${faded ? "faded" : ""}`}
      style={{
        top: pos.top,
        left: pos.left,
        width: ghost.size,
        height: ghost.size,
      }}
      src={PIECE_IMAGE[ghost.color][ghost.type]}
      alt=""
    />
  );
}

export default App;
