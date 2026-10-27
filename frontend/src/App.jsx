import { useEffect, useRef, useState } from "react";
import { getState, postMove, resetGame, undoMove, getHint, getPositions } from "./Api";
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCheckmateSound,
  playDrawSound,
  playPromotionSound,
  playTimeoutSound,
  playCastleSound,
  playSelectSound,
  playInvalidSound,
  playAiMoveSound,
  preloadSamples,
} from "./sound";
import { startIfWanted } from "./music";
import MusicPlayer from "./MusicPlayer";
import HowToPlay from "./HowToPlay";
import "./App.css";

import logo from "./assets/logo.png";
import avatarPink from "./assets/pieces/rosa/playerPink.png";
import avatarCeleste from "./assets/pieces/celeste/playerLightBlue.png";

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

function toScreenRow(row) {
  return 7 - row;
}

const BOARD_SIZE = 8;

const PIECE_NAME = {
  PAWN: "Peón",
  KNIGHT: "Caballo",
  BISHOP: "Alfil",
  ROOK: "Torre",
  QUEEN: "Dama",
  KING: "Rey",
};
const PROMOTION_CHOICES = ["QUEEN", "ROOK", "BISHOP", "KNIGHT"];
const PIECE_VALUE = { PAWN: 1, KNIGHT: 3, BISHOP: 3, ROOK: 5, QUEEN: 9, KING: 0 };
const COLOR_NAME = { WHITE: "Rosa", BLACK: "Celeste" };

function totalPoints(pieces) {
  return pieces.reduce((sum, piece) => sum + (PIECE_VALUE[piece.type] ?? 0), 0);
}

function pieceTooltip(piece) {
  const points = PIECE_VALUE[piece.type];
  const worth = points > 0 ? `vale ${points} ${points === 1 ? "punto" : "puntos"}` : "no se puede comer";
  return `${PIECE_NAME[piece.type]} ${COLOR_NAME[piece.color]} · ${worth}`;
}

const BACKGROUNDS = [
  { id: "fondo1", label: "Bosque", file: "/backgrounds/fondo1.jpg", mode: "cover" },
  { id: "fondo2", label: "Isla", file: "/backgrounds/fondo2.svg", mode: "cover" },
  { id: "fondo3", label: "Hojitas", file: "/backgrounds/fondo3.jfif", mode: "tile" },
  { id: "fondo4", label: "Fondo 4", file: "/backgrounds/fondo4.webp", mode: "cover" },
  { id: "fondo5", label: "Fondo 5", file: "/backgrounds/fondo5.webp", mode: "cover" },
  { id: "fondo6", label: "Sendero", file: "/backgrounds/fondo6.webp", mode: "cover" },
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

const DIFFICULTIES = [
  {
    id: "EASY",
    name: "Fácil",
    text: "Celeste juega rápido y se equivoca seguido. Ideal para aprender.",
  },
  {
    id: "MEDIUM",
    name: "Medio",
    text: "Mira un par de jugadas por adelantado. Un rival parejo.",
  },
  {
    id: "HARD",
    name: "Difícil",
    text: "Piensa varias jugadas y casi no regala piezas. Puede tardar un poco.",
  },
];
const DIFFICULTY_NAME = { EASY: "Fácil", MEDIUM: "Medio", HARD: "Difícil" };

const PGN_LETTER = { R: "K", D: "Q", T: "R", A: "B", C: "N" };
function toPgnMove(move) {
  return move
    .replace(/^[RDTAC]/, (letter) => PGN_LETTER[letter])
    .replace(/=([DTAC])/, (_, letter) => `=${PGN_LETTER[letter]}`);
}

function buildPgn(history, result, difficulty) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
  const headers = [
    ["Event", "Ajedrez Crossing"],
    ["Site", "Local"],
    ["Date", date],
    ["White", "Rosa (jugador)"],
    ["Black", `Celeste (IA ${DIFFICULTY_NAME[difficulty] ?? ""})`.replace(" )", ")")],
    ["Result", result],
  ]
    .map(([key, value]) => `[${key} "${value}"]`)
    .join("\n");
  const moves = [];
  for (let i = 0; i < history.length; i += 2) {
    const white = toPgnMove(history[i]);
    const black = history[i + 1] ? ` ${toPgnMove(history[i + 1])}` : "";
    moves.push(`${i / 2 + 1}. ${white}${black}`);
  }
  return `${headers}\n\n${moves.join(" ")}${moves.length ? " " : ""}${result}\n`;
}

const USER_COLOR = "WHITE";

function isUserPiece(piece) {
  return Boolean(piece && piece.color === USER_COLOR);
}

const INITIAL_CLOCK_SECONDS = 10 * 60;

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const DRAW_REASON_TEXT = {
  STALEMATE: "Ahogado: nadie tiene movimientos legales, pero nadie está en jaque.",
  THREEFOLD_REPETITION: "La misma posición se repitió tres veces.",
  INSUFFICIENT_MATERIAL: "No quedan piezas suficientes para dar jaque mate.",
  FIFTY_MOVE_RULE: "Pasaron 50 jugadas sin mover un peón ni comer ninguna pieza.",
};

let ghostIdCounter = 0;

function App() {
  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState("WHITE");
  const [gameState, setGameState] = useState("IN_PROGRESS");
  const [drawReason, setDrawReason] = useState("NONE"); // STALEMATE, THREEFOLD_REPETITION, INSUFFICIENT_MATERIAL, FIFTY_MOVE_RULE
  const [legalMoves, setLegalMoves] = useState([]);
  const [checkingPiecePositions, setCheckingPiecePositions] = useState([]);
  const [kingInCheckPosition, setKingInCheckPosition] = useState(null);
  const [selected, setSelected] = useState(null); // { row, col }
  const [message, setMessage] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [capturedWhite, setCapturedWhite] = useState([]);
  const [capturedBlack, setCapturedBlack] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [history, setHistory] = useState([]); // jugadas en notación algebraica, la primera es de Rosa
  const [lastMove, setLastMove] = useState(null); // { fromRow, fromCol, toRow, toCol } de la última jugada
  const [checkChip, setCheckChip] = useState(null); // "them" | "you" | null, con un pop al aparecer
  const [sparklingIds, setSparklingIds] = useState(() => new Set());
  const [ghosts, setGhosts] = useState([]); // piezas capturadas "volando" hacia la bandeja
  const [backgroundId, setBackgroundId] = useState(loadSavedBackgroundId);
  const [whiteTime, setWhiteTime] = useState(INITIAL_CLOCK_SECONDS);
  const [blackTime, setBlackTime] = useState(INITIAL_CLOCK_SECONDS);
  const [timeoutColor, setTimeoutColor] = useState(null); // "WHITE" | "BLACK" | null: a quién se le acabó el tiempo
  const [menuOpen, setMenuOpen] = useState(false); // menú de las 3 barritas ("Cómo se juega")
  const [started, setStarted] = useState(false); // false = pantalla de elegir dificultad
  const [difficulty, setDifficulty] = useState("MEDIUM"); // nivel de la partida en curso
  const [chosenDifficulty, setChosenDifficulty] = useState("MEDIUM"); // nivel marcado en la pantalla de inicio
  const [thinking, setThinking] = useState(false); // Celeste está pensando su respuesta
  const [hint, setHint] = useState(null); // { fromRow, fromCol, toRow, toCol } sugerida
  const [hintLoading, setHintLoading] = useState(false);
  const [review, setReview] = useState(null); // null = partida en vivo; si no { boards, moves, index }
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState(null); // jugada de coronación esperando que se elija la pieza
  const [copied, setCopied] = useState(false);

  const busyRef = useRef(false); // true mientras se espera al backend: evita jugadas dobles por doble click
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

  const gameOver = gameState === "CHECKMATE" || gameState === "DRAW" || Boolean(timeoutColor);
  const isUserTurn = turn === USER_COLOR && !gameOver && !review;
  // En modo repaso se muestra una posición vieja y no se puede jugar.
  const viewBoard = review ? review.boards[review.index] : board;
  const viewLastMove = review ? review.moves[review.index - 1] ?? null : lastMove;
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

  function applyStateInstant(state) {
    setBoard(state.board);
    setTurn(state.turn);
    setGameState(state.gameState);
    setDrawReason(state.drawReason ?? "NONE");
    setLegalMoves(state.legalMoves ?? []);
    setCheckingPiecePositions(state.checkingPiecePositions ?? []);
    setKingInCheckPosition(state.kingInCheckPosition ?? null);
    setCapturedWhite(state.capturedWhite ?? []);
    setCapturedBlack(state.capturedBlack ?? []);
    setCanUndo(Boolean(state.canUndo));
    setHistory(state.history ?? []);
    setLastMove(state.lastMove ?? null);
    if (state.difficulty) setDifficulty(state.difficulty);
    setHint(null);
    setReview(null);
    setConnectionError(false);
    prevPiecesRef.current = flattenBoard(state.board);
  }


  function applyStateAnimated(state) {
    const prevPieces = prevPiecesRef.current;
    const nextPieces = flattenBoard(state.board);

    const newlySparkling = new Set();
    const newGhosts = [];
    let promoted = false;

    for (const [id, before] of prevPieces) {
      const after = nextPieces.get(id);
      if (!after) {
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
    setDrawReason(state.drawReason ?? "NONE");
    setLegalMoves(state.legalMoves ?? []);
    setCheckingPiecePositions(state.checkingPiecePositions ?? []);
    setKingInCheckPosition(state.kingInCheckPosition ?? null);
    setCapturedWhite(state.capturedWhite ?? []);
    setCapturedBlack(state.capturedBlack ?? []);
    setCanUndo(Boolean(state.canUndo));
    setHistory(state.history ?? []);
    setLastMove(state.lastMove ?? null);
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


  function buildCaptureGhost(id, piece) {
    const boardEl = boardElRef.current;
    if (!boardEl) return null;

    const boardRect = boardEl.getBoundingClientRect();
    const screenRow = toScreenRow(piece.row);
    const squareSize = boardRect.width / BOARD_SIZE;
    const startLeft = boardRect.left + piece.col * squareSize;
    const startTop = boardRect.top + screenRow * squareSize;

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
    preloadSamples();
  }, []);

  useEffect(() => {
    if (!board || !started || gameOver || connectionError) return undefined;

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
  }, [board, started, turn, gameOver, connectionError]);

  useEffect(() => {
    if (timeoutColor) playTimeoutSound(timeoutColor !== USER_COLOR);
  }, [timeoutColor]);

  useEffect(() => {
    if (!pendingPromotion) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPendingPromotion(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingPromotion]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function goToPosition(index) {
    if (!started || busyRef.current) return;
    const total = history.length;
    const target = Math.max(0, Math.min(total, index));
    if (target >= total) {
      setReview(null);
      return;
    }
    setSelected(null);
    setHint(null);
    if (review) {
      setReview({ ...review, index: target });
      return;
    }
    try {
      const data = await getPositions();
      if (data.boards.length !== total + 1) return;
      setReview({ boards: data.boards, moves: data.moves, index: target });
    } catch {
      setConnectionError(true);
    }
  }

  const reviewIndexNow = review ? review.index : history.length;
  const goToPositionRef = useRef(goToPosition);
  const reviewIndexRef = useRef(reviewIndexNow);
  useEffect(() => {
    goToPositionRef.current = goToPosition;
    reviewIndexRef.current = reviewIndexNow;
  });

  useEffect(() => {
    if (!started || menuOpen || exportOpen || pendingPromotion) return undefined;
    const onKeyDown = (event) => {
      const go = goToPositionRef.current;
      const current = reviewIndexRef.current;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(current - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(current + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        go(0);
      } else if (event.key === "End" || event.key === "Escape") {
        go(Number.MAX_SAFE_INTEGER);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [started, menuOpen, exportOpen, pendingPromotion]);

  async function handleHint() {
    if (!isUserTurn || busyRef.current || hintLoading) return;
    setHintLoading(true);
    setSelected(null);
    try {
      const data = await getHint();
      if (data.hint) {
        setHint(data.hint);
        setMessage("");
      } else {
        setMessage("No hay pista disponible");
      }
    } catch {
      setConnectionError(true);
    } finally {
      setHintLoading(false);
    }
  }

  function gameResult() {
    if (timeoutColor) return timeoutColor === USER_COLOR ? "0-1" : "1-0";
    if (gameState === "CHECKMATE") return turn === USER_COLOR ? "0-1" : "1-0";
    if (gameState === "DRAW") return "1/2-1/2";
    return "*";
  }

  const pgnText = buildPgn(history, gameResult(), difficulty);

  async function handleCopyPgn() {
    try {
      await navigator.clipboard.writeText(pgnText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("No se pudo copiar: seleccioná el texto y copialo a mano");
    }
  }

  function handleDownloadPgn() {
    const blob = new Blob([pgnText], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ajedrez-crossing.pgn";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function triggerCheckChip(who) {
    setCheckChip(null);
    requestAnimationFrame(() => {
      setCheckChip(who);
      setTimeout(() => setCheckChip(null), 1600);
    });
  }

  async function handleSquareClick(row, col) {
    if (!board || busyRef.current || review || pendingPromotion) return;

    if (!isUserTurn) {
      return;
    }

    const clickedPiece = board[row][col];

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
        playSelectSound();
      }
      return;
    }

    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

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
      playSelectSound();
      return;
    }

    if (!isPossibleMove(row, col)) {
      setSelected(null);
      setMessage("Movimiento inválido");
      playInvalidSound();
      return;
    }

    const movedPieceType = selectedPiece.type;
    const move = { fromRow: selected.row, fromCol: selected.col, toRow: row, toCol: col };

    if (movedPieceType === "PAWN" && row === BOARD_SIZE - 1) {
      setPendingPromotion(move);
      return;
    }

    await submitMove(move, movedPieceType);
  }

  async function choosePromotion(type) {
    const move = pendingPromotion;
    if (!move) return;
    setPendingPromotion(null);
    await submitMove(move, "PAWN", type);
  }

  function cancelPromotion() {
    setPendingPromotion(null);
  }

  async function submitMove({ fromRow, fromCol, toRow, toCol }, movedPieceType, promotion) {
    const historyBefore = history.length;
    const isCastling = movedPieceType === "KING" && Math.abs(toCol - fromCol) === 2;
    let response;
    busyRef.current = true;
    setHint(null);
    setThinking(true);
    try {
      response = await postMove(fromRow, fromCol, toRow, toCol, promotion);
    } catch {
      setConnectionError(true);
      return;
    } finally {
      busyRef.current = false;
      setThinking(false);
    }
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
      if (isCastling) playCastleSound();
      else playMoveSound(movedPieceType);
      if ((response.state.history?.length ?? 0) >= historyBefore + 2) {
        setTimeout(playAiMoveSound, 450);
      }
    }
  }

  function handleReset() {
    setChosenDifficulty(difficulty);
    setExportOpen(false);
    setStarted(false);
  }

  async function handleStart() {
    let state;
    try {
      state = await resetGame(chosenDifficulty);
    } catch {
      setConnectionError(true);
      return;
    }
    applyStateInstant(state);
    setStarted(true);
    startIfWanted();
    setSelected(null);
    setMessage("");
    setGhosts([]);
    setCheckChip(null);
    setWhiteTime(INITIAL_CLOCK_SECONDS);
    setBlackTime(INITIAL_CLOCK_SECONDS);
    setTimeoutColor(null);
  }

  async function handleUndo() {
    if (!canUndo || busyRef.current || review) return;
    let state;
    try {
      state = await undoMove();
    } catch {
      setConnectionError(true);
      return;
    }
    applyStateInstant(state);
    setSelected(null);
    setMessage("");
    setGhosts([]);
    setCheckChip(null);
    setTimeoutColor(null);
  }

  function gameOverInfo() {
    if (timeoutColor) {
      const userWon = timeoutColor !== USER_COLOR;
      return {
        tone: userWon ? "win" : "lose",
        title: userWon ? "¡Ganaste por tiempo!" : "Se te acabó el tiempo",
        subtitle: userWon
          ? "A Celeste se le acabó el reloj."
          : "Tu reloj llegó a cero.",
      };
    }
    if (gameState === "CHECKMATE") {
      const userWon = turn !== USER_COLOR;
      return {
        tone: userWon ? "win" : "lose",
        title: userWon ? "¡Ganaste!" : "Perdiste",
        subtitle: userWon
          ? "Le pusiste jaque mate a Celeste."
          : "Te pusieron jaque mate.",
      };
    }
    if (gameState === "DRAW") {
      return {
        tone: "draw",
        title: "Tablas",
        subtitle: DRAW_REASON_TEXT[drawReason] ?? DRAW_REASON_TEXT.STALEMATE,
      };
    }
    return null;
  }

  if (connectionError) {
    return (
      <div className="app" data-bg-mode={background.mode}>
        <img className="game-logo" src={logo} alt="Crossing Chess" draggable={false} />
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

  if (!started) {
    return (
      <div
        className="app"
        style={{ "--app-bg": `url("${background.file}")` }}
        data-bg-mode={background.mode}
      >
        <img className="game-logo" src={logo} alt="Crossing Chess" draggable={false} />

        <section className="setup-card" aria-label="Elegí la dificultad">
          <div className="setup-versus">
            <div className="setup-player pink">
              <img src={avatarPink} alt="Tu avatar, Rosa" draggable={false} />
              <span>Vos (Rosa)</span>
            </div>
            <span className="setup-vs">VS</span>
            <div className="setup-player cyan">
              <img src={avatarCeleste} alt="Avatar de la computadora, Celeste" draggable={false} />
              <span>Celeste (IA)</span>
            </div>
          </div>

          <h2 className="setup-title">Elegí la dificultad</h2>
          <div className="difficulty-list" role="radiogroup" aria-label="Dificultad de Celeste">
            {DIFFICULTIES.map((level) => (
              <button
                key={level.id}
                type="button"
                role="radio"
                aria-checked={chosenDifficulty === level.id}
                className={`difficulty-option ${level.id.toLowerCase()} ${
                  chosenDifficulty === level.id ? "selected" : ""
                }`}
                onClick={() => setChosenDifficulty(level.id)}
              >
                <strong>{level.name}</strong>
                <span>{level.text}</span>
              </button>
            ))}
          </div>

          <button type="button" className="reset-btn start-btn" onClick={handleStart}>
            Empezar a jugar
          </button>
        </section>
        <MusicPlayer />
      </div>
    );
  }

  return (
    <div
      className="app"
      style={{ "--app-bg": `url("${background.file}")` }}
      data-bg-mode={background.mode}
    >
      <button
        type="button"
        className={`menu-btn ${menuOpen ? "open" : ""}`}
        aria-label={menuOpen ? "Cerrar la guía" : "Abrir la guía de cómo se juega"}
        aria-expanded={menuOpen}
        aria-controls="howto-drawer"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="menu-bar" />
        <span className="menu-bar" />
        <span className="menu-bar" />
      </button>

      <div
        className={`help-backdrop ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        id="howto-drawer"
        className={`help-drawer ${menuOpen ? "open" : ""}`}
        aria-hidden={!menuOpen}
        aria-label="Cómo se juega"
      >
        <h2 className="help-title">Cómo se juega</h2>
        <HowToPlay pieceImage={PIECE_IMAGE.WHITE} />
      </aside>

      <img className="game-logo" src={logo} alt="Crossing Chess" draggable={false} />

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
                    {viewBoard[row].map((piece, col) => {
                      // En un tablero de ajedrez la casilla de abajo a la izquierda (a1)
                      // es oscura; fila 0 / columna 0 es esa esquina.
                      const isDark = (row + col) % 2 === 0;
                      const isLastFrom =
                        viewLastMove && viewLastMove.fromRow === row && viewLastMove.fromCol === col;
                      const isLastTo =
                        viewLastMove && viewLastMove.toRow === row && viewLastMove.toCol === col;
                      const isHintFrom =
                        hint && !review && hint.fromRow === row && hint.fromCol === col;
                      const isHintTo =
                        hint && !review && hint.toRow === row && hint.toCol === col;
                      const isSelected =
                        isUserTurn &&
                        isUserPiece(piece) &&
                        selected &&
                        selected.row === row &&
                        selected.col === col;
                      const isPossible = isPossibleMove(row, col);
                      const isCheckingPiece = !review && checkingPiecePositions.includes(
                        `${row}-${col}`
                      );
                      const isKingInCheck =
                        !review &&
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
                          } ${isLastFrom ? "last-from" : ""} ${isLastTo ? "last-to" : ""} ${
                            isHintFrom ? "hint-from" : ""
                          } ${isHintTo ? "hint-to" : ""} ${
                            isCheckingPiece ? "checking-piece" : ""
                          } ${isKingInCheck ? "king-in-check" : ""}`}
                          onClick={() => handleSquareClick(row, col)}
                        >
                          {piece && (
                            <span
                              className={`piece-tip ${screenRow === 0 ? "below" : ""} ${
                                col === 0 ? "edge-left" : ""
                              } ${col === BOARD_SIZE - 1 ? "edge-right" : ""}`}
                              role="tooltip"
                            >
                              {pieceTooltip(piece)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="pieces-layer">
              {Array.from(flattenBoard(viewBoard).values()).map((piece) => {
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
                      alt={`${PIECE_NAME[piece.type]} ${COLOR_NAME[piece.color]}`}
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>

            {info && !review && (
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
            {review
              ? `Repaso: jugada ${review.index} de ${history.length}`
              : `Turno: ${turn === "WHITE" ? "Rosa" : "Celeste"}`}
          </span>

          <div className="players">
            <div
              className={`player-card cyan ${turn === "BLACK" && !gameOver ? "active" : ""} ${
                blackTime <= 30 ? "low" : ""
              }`}
            >
              <img className="player-avatar" src={avatarCeleste} alt="Avatar de Celeste" draggable={false} />
              <div className="player-info">
                <span className="clock-label">Celeste (IA {DIFFICULTY_NAME[difficulty]})</span>
                <span className="clock-time">{formatClock(blackTime)}</span>
                {thinking && <span className="thinking">Pensando...</span>}
              </div>
            </div>
            <div
              className={`player-card pink ${turn === "WHITE" && !gameOver ? "active" : ""} ${
                whiteTime <= 30 ? "low" : ""
              }`}
            >
              <img className="player-avatar" src={avatarPink} alt="Tu avatar" draggable={false} />
              <div className="player-info">
                <span className="clock-label">Rosa (vos)</span>
                <span className="clock-time">{formatClock(whiteTime)}</span>
              </div>
            </div>
          </div>

          <div className="tray-group">
            <div className="tray-head">
              <p className="tray-label">Comidas por Celeste</p>
              <span className="tray-points">{totalPoints(capturedBlack)} pts</span>
            </div>
            <div className="captured-tray" ref={trayBlackRef}>
              {capturedBlack.map((piece) => (
                <CapturedPiece key={piece.id} piece={piece} />
              ))}
            </div>
          </div>

          <div className="tray-group">
            <div className="tray-head">
              <p className="tray-label">Comidas por Rosa</p>
              <span className="tray-points">{totalPoints(capturedWhite)} pts</span>
            </div>
            <div className="captured-tray" ref={trayWhiteRef}>
              {capturedWhite.map((piece) => (
                <CapturedPiece key={piece.id} piece={piece} />
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
        </div>

        <div className="history-group">
          <MoveHistory
            history={history}
            position={reviewIndexNow}
            onGo={goToPosition}
          />
          <div className="side-col">
          <div className="actions">
            <button className="hint-btn" onClick={handleHint} disabled={!isUserTurn || hintLoading || thinking}>
              {hintLoading ? "Buscando..." : "Pista"}
            </button>
            <button className="undo-btn" onClick={handleUndo} disabled={!canUndo || Boolean(review)}>
              Deshacer
            </button>
            <button className="export-btn" onClick={() => setExportOpen(true)} disabled={history.length === 0}>
              Exportar partida
            </button>
            <button className="reset-btn" onClick={handleReset}>
              Reiniciar partida
            </button>
          </div>
          <MusicPlayer docked />
          </div>
        </div>
      </div>

      {pendingPromotion && (
        <div className="promo-backdrop" onClick={cancelPromotion}>
          <div
            className="promo-card"
            role="dialog"
            aria-modal="true"
            aria-label="Elegí la pieza para coronar"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Coronación</h2>
            <p>Tu peón llegó al final del tablero. Elegí en qué pieza se convierte.</p>
            <div className="promo-options">
              {PROMOTION_CHOICES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="promo-option"
                  onClick={() => choosePromotion(type)}
                >
                  <img src={PIECE_IMAGE[USER_COLOR][type]} alt="" draggable={false} />
                  <strong>{PIECE_NAME[type]}</strong>
                  <span>{PIECE_VALUE[type]} puntos</span>
                </button>
              ))}
            </div>
            <button type="button" className="promo-cancel" onClick={cancelPromotion}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="export-backdrop" onClick={() => setExportOpen(false)}>
          <div
            className="export-card"
            role="dialog"
            aria-modal="true"
            aria-label="Exportar partida"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Exportar partida</h2>
            <p>
              Formato PGN, el estándar para guardar partidas. Lo podés pegar en
              Lichess o Chess.com para analizarla.
            </p>
            <textarea className="export-text" readOnly value={pgnText} onFocus={(e) => e.target.select()} />
            <div className="export-actions">
              <button type="button" className="reset-btn" onClick={handleCopyPgn}>
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button type="button" className="undo-btn" onClick={handleDownloadPgn}>
                Descargar .pgn
              </button>
              <button type="button" className="export-btn" onClick={() => setExportOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {ghosts.map((ghost) => (
        <CaptureGhost key={ghost.ghostId} ghost={ghost} onDone={() => removeGhost(ghost.ghostId)} />
      ))}
    </div>
  );
}

function CapturedPiece({ piece }) {
  return (
    <span className="captured-item" title={pieceTooltip(piece)}>
      <img
        className="captured-piece"
        src={PIECE_IMAGE[piece.color][piece.type]}
        alt={`${PIECE_NAME[piece.type]} ${COLOR_NAME[piece.color]} capturada`}
      />
      <span className="captured-value">{PIECE_VALUE[piece.type]}</span>
    </span>
  );
}

function MoveHistory({ history, position, onGo }) {
  const listRef = useRef(null);

  // Siempre se muestra la jugada que se está viendo (la más reciente si no se está repasando)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const current = list.querySelector(".history-cell.latest");
    if (current && position < history.length) {
      current.scrollIntoView({ block: "nearest" });
    } else {
      list.scrollTop = list.scrollHeight;
    }
  }, [history.length, position]);

  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ number: i / 2 + 1, pink: history[i], cyan: history[i + 1], index: i });
  }
  const currentIndex = position - 1;
  const atStart = position <= 0;
  const atEnd = position >= history.length;

  function Cell({ index }) {
    const text = history[index];
    if (!text) return <span className="history-cell" />;
    return (
      <button
        type="button"
        className={`history-cell history-jump ${index === currentIndex ? "latest" : ""}`}
        onClick={() => onGo(index + 1)}
        title="Ver el tablero en esta jugada"
      >
        {text}
      </button>
    );
  }

  return (
    <aside className="history-panel" aria-label="Historial de movimientos">
      <h2 className="history-title">Historial de movimientos</h2>
      <div className="history-head">
        <span className="history-num">#</span>
        <span className="history-cell pink">Rosa</span>
        <span className="history-cell cyan">Celeste</span>
      </div>
      <ol className="history-list" ref={listRef}>
        {rows.length === 0 && <li className="history-empty">Todavía no hay jugadas</li>}
        {rows.map((row) => (
          <li key={row.number} className="history-row">
            <span className="history-num">{row.number}.</span>
            {Cell({ index: row.index })}
            {Cell({ index: row.index + 1 })}
          </li>
        ))}
      </ol>
      <div className="history-nav" role="group" aria-label="Navegar el historial">
        <button type="button" onClick={() => onGo(0)} disabled={atStart} aria-label="Ir al inicio" title="Inicio (tecla Inicio)">
          {NAV_ICON_FIRST}
        </button>
        <button type="button" onClick={() => onGo(position - 1)} disabled={atStart} aria-label="Jugada anterior" title="Anterior (flecha izquierda)">
          {NAV_ICON_PREV}
        </button>
        <button type="button" onClick={() => onGo(position + 1)} disabled={atEnd} aria-label="Jugada siguiente" title="Siguiente (flecha derecha)">
          {NAV_ICON_NEXT}
        </button>
        <button type="button" onClick={() => onGo(history.length)} disabled={atEnd} aria-label="Volver a la jugada actual" title="Actual (tecla Fin o Esc)">
          {NAV_ICON_LAST}
        </button>
      </div>
    </aside>
  );
}

function NavIcon({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const NAV_ICON_FIRST = (
  <NavIcon>
    <rect x="4.5" y="5" width="3" height="14" rx="1.5" />
    <path d="M19.5 6.6v10.8a1.2 1.2 0 0 1-1.85 1l-8.4-5.4a1.2 1.2 0 0 1 0-2l8.4-5.4a1.2 1.2 0 0 1 1.85 1z" />
  </NavIcon>
);
const NAV_ICON_PREV = (
  <NavIcon>
    <path d="M17 6.6v10.8a1.2 1.2 0 0 1-1.85 1l-8.4-5.4a1.2 1.2 0 0 1 0-2l8.4-5.4A1.2 1.2 0 0 1 17 6.6z" />
  </NavIcon>
);
const NAV_ICON_NEXT = (
  <NavIcon>
    <path d="M7 6.6v10.8a1.2 1.2 0 0 0 1.85 1l8.4-5.4a1.2 1.2 0 0 0 0-2l-8.4-5.4A1.2 1.2 0 0 0 7 6.6z" />
  </NavIcon>
);
const NAV_ICON_LAST = (
  <NavIcon>
    <rect x="16.5" y="5" width="3" height="14" rx="1.5" />
    <path d="M4.5 6.6v10.8a1.2 1.2 0 0 0 1.85 1l8.4-5.4a1.2 1.2 0 0 0 0-2l-8.4-5.4A1.2 1.2 0 0 0 4.5 6.6z" />
  </NavIcon>
);

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
