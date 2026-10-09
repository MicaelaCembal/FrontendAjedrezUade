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

function App() {
  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState("WHITE");
  const [gameState, setGameState] = useState("IN_PROGRESS");
  const [selected, setSelected] = useState(null); // { row, col }
  const [message, setMessage] = useState("");
  const [connectionError, setConnectionError] = useState(false);

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
        <h1>🐾 Ajedrez Crossing 🐾</h1>
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

  return (
    <div className="app">
      <h1>🐾 Ajedrez Crossing 🐾</h1>

      <div className="status">
        <span className={`turn-badge ${turn === "WHITE" ? "pink" : "cyan"}`}>
          Turno: {turn === "WHITE" ? "Rosa" : "Celeste"}
        </span>
        {gameState !== "IN_PROGRESS" && (
          <span className="game-state">{gameState}</span>
        )}
        {message && <span className="message">{message}</span>}
      </div>

      <div className="board">
        {board.map((rowPieces, row) => (
          <div className="board-row" key={row}>
            {rowPieces.map((piece, col) => {
              const isDark = (row + col) % 2 === 1;
              const isSelected =
                selected && selected.row === row && selected.col === col;
              return (
                <div
                  key={col}
                  className={`square ${isDark ? "dark" : "light"} ${
                    isSelected ? "selected" : ""
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

      <button className="reset-btn" onClick={handleReset}>
        Reiniciar partida
      </button>
    </div>
  );
}

export default App;
