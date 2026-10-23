const API_URL = "http://localhost:8081/api";

export async function getState() {
  const res = await fetch(`${API_URL}/state`);
  return res.json();
}

// promotion (opcional): "QUEEN" | "ROOK" | "BISHOP" | "KNIGHT", la pieza a la que corona un peón.
// Si no se manda, el backend corona a Dama.
export async function postMove(fromRow, fromCol, toRow, toCol, promotion) {
  const res = await fetch(`${API_URL}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      promotion ? { fromRow, fromCol, toRow, toCol, promotion } : { fromRow, fromCol, toRow, toCol }
    ),
  });
  return res.json();
}

// difficulty: "EASY" | "MEDIUM" | "HARD". Sin nivel, el backend mantiene el que ya tenía.
export async function resetGame(difficulty) {
  const res = await fetch(`${API_URL}/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(difficulty ? { difficulty } : {}),
  });
  return res.json();
}

export async function undoMove() {
  const res = await fetch(`${API_URL}/undo`, { method: "POST" });
  return res.json();
}

// Mejor jugada sugerida para el jugador: { hint: { fromRow, fromCol, toRow, toCol } | null }
export async function getHint() {
  const res = await fetch(`${API_URL}/hint`);
  return res.json();
}

// Todas las posiciones de la partida (para navegar el historial): { boards: [...], moves: [...] }
// boards[0] es la posición inicial y boards[i] la posición luego de la jugada i.
export async function getPositions() {
  const res = await fetch(`${API_URL}/positions`);
  return res.json();
}