import { useEffect, useState } from "react";
import { getState, postMove, resetGame } from "./api";
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

// Celeste (Negras) arriba, Rosa (Blancas) abajo: se recorre el tablero
// de la fila 7 a la 0 en vez de 0 a 7, solo para dibujarlo — la lógica
// de movimientos sigue usando las filas reales que maneja el backend.
const ROW_ORDER = [7, 6, 5, 4, 3, 2, 1, 0];

const BOARD_SIZE = 8;

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getPossibleMoves(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];

  const moves = [];
  const addMove = (targetRow, targetCol) => {
    if (!isInsideBoard(targetRow, targetCol)) return false;

    const targetPiece = board[targetRow][targetCol];
    if (!targetPiece) {
      moves.push({ row: targetRow, col: targetCol });
      return true;
    }

    if (targetPiece.color !== piece.color) {
      moves.push({ row: targetRow, col: targetCol });
    }
    return false;
  };

  const addSlidingMoves = (directions) => {
    directions.forEach(([rowStep, colStep]) => {
      let targetRow = row + rowStep;
      let targetCol = col + colStep;
      while (addMove(targetRow, targetCol)) {
        targetRow += rowStep;
        targetCol += colStep;
      }
    });
  };

  if (piece.type === "PAWN") {
    const direction = piece.color === "WHITE" ? 1 : -1;
    const startRow = piece.color === "WHITE" ? 1 : 6;
    const oneStepRow = row + direction;

    if (isInsideBoard(oneStepRow, col) && !board[oneStepRow][col]) {
      moves.push({ row: oneStepRow, col });
      const twoStepRow = row + direction * 2;
      if (row === startRow && !board[twoStepRow][col]) {
        moves.push({ row: twoStepRow, col });
      }
    }

    [-1, 1].forEach((colStep) => {
      const targetRow = row + direction;
      const targetCol = col + colStep;
      if (
        isInsideBoard(targetRow, targetCol) &&
        board[targetRow][targetCol] &&
        board[targetRow][targetCol].color !== piece.color
      ) {
        moves.push({ row: targetRow, col: targetCol });
      }
    });
  }

  if (piece.type === "KNIGHT") {
    [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ].forEach(([rowStep, colStep]) => addMove(row + rowStep, col + colStep));
  }

  if (piece.type === "BISHOP" || piece.type === "QUEEN") {
    addSlidingMoves([
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]);
  }

  if (piece.type === "ROOK" || piece.type === "QUEEN") {
    addSlidingMoves([
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]);
  }

  if (piece.type === "KING") {
    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let colStep = -1; colStep <= 1; colStep += 1) {
        if (rowStep !== 0 || colStep !== 0) {
          addMove(row + rowStep, col + colStep);
        }
      }
    }
  }

  return moves;
}

function App() {
  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState("WHITE");
  const [gameState, setGameState] = useState("IN_PROGRESS");
  const [selected, setSelected] = useState(null); // { row, col }
  const [message, setMessage] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const possibleMoves = selected
    ? getPossibleMoves(board, selected.row, selected.col)
    : [];

  function isPossibleMove(row, col) {
    return possibleMoves.some(
      (move) => move.row === row && move.col === col
    );
  }

  function applyState(state) {
    setBoard(state.board);
    setTurn(state.turn);
    setGameState(state.gameState);
    setConnectionError(false);
  }

  async function loadState() {
    try {
      const state = await getState();
      applyState(state);
    } catch (err) {
      setConnectionError(true);
    }
  }

  useEffect(() => {
    loadState();
  }, []);

  async function handleSquareClick(row, col) {
    if (!board) return;

    // Nada seleccionado todavía: seleccionar si hay una pieza propia ahí
    if (!selected) {
      const piece = board[row][col];
      if (piece && piece.color === turn) {
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

    // Permitir cambiar la selección directamente a otra pieza propia
    const piece = board[row][col];
    if (piece && piece.color === turn) {
      setSelected({ row, col });
      setMessage("");
      return;
    }

    const response = await postMove(selected.row, selected.col, row, col);
    applyState(response.state);
    setSelected(null);

    if (response.result !== "SUCCESS") {
      setMessage(
        response.result === "NOT_YOUR_TURN"
          ? "No es tu turno"
          : "Movimiento inválido"
      );
    } else {
      setMessage("");
    }
  }

  async function handleReset() {
    const state = await resetGame();
    applyState(state);
    setSelected(null);
    setMessage("");
  }

  if (connectionError) {
    return (
      <div className="app">
        <div className="title-sticker">
          <h1>Ajedrez Crossing</h1>
        </div>
        <p className="error">
          No me pude conectar al backend en <code>http://localhost:8080</code>.
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

  return (
    <div className="app">
      <div className="title-sticker">
        <span className="paw paw-left">🐾</span>
        <h1>Ajedrez Crossing</h1>
        <span className="paw paw-right">🐾</span>
      </div>

      <div className="status">
        <span className={`turn-badge ${turn === "WHITE" ? "pink" : "cyan"}`}>
          Turno: {turn === "WHITE" ? "Rosa" : "Celeste"}
        </span>
        {gameState !== "IN_PROGRESS" && (
          <span className="game-state">{gameState}</span>
        )}
        {message && <span className="message">{message}</span>}
      </div>

      <div className="board-frame">
        <span className="side-tag side-tag-top">Celeste</span>

        <div className="board">
          {ROW_ORDER.map((row) => (
            <div className="board-row" key={row}>
              {board[row].map((piece, col) => {
                const isDark = (row + col) % 2 === 1;
                const isSelected =
                  selected && selected.row === row && selected.col === col;
                const isPossible = isPossibleMove(row, col);
                return (
                  <div
                    key={col}
                    className={`square ${isDark ? "dark" : "light"} ${
                      isSelected ? "selected" : ""
                    } ${isPossible ? "possible-move" : ""} ${
                      isPossible && piece ? "possible-capture" : ""
                    }`}
                    onClick={() => handleSquareClick(row, col)}
                  >
                    {piece && (
                      <img
                        className="piece"
                        src={PIECE_IMAGE[piece.color][piece.type]}
                        alt={`${piece.type} ${piece.color}`}
                        title={piece.type}
                        draggable={false}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <span className="side-tag side-tag-bottom">Rosa</span>
      </div>

      <button className="reset-btn" onClick={handleReset}>
        Reiniciar partida
      </button>
    </div>
  );
}

export default App;
