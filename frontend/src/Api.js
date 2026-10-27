const API_URL = "http://localhost:8081/api";

export async function getState() {
  const res = await fetch(`${API_URL}/state`);
  return res.json();
}

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

export async function getHint() {
  const res = await fetch(`${API_URL}/hint`);
  return res.json();
}

export async function getPositions() {
  const res = await fetch(`${API_URL}/positions`);
  return res.json();
}