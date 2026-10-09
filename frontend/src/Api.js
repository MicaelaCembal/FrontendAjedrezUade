const API_URL = "http://localhost:8080/api";

export async function getState() {
  const res = await fetch(`${API_URL}/state`);
  return res.json();
}

export async function postMove(fromRow, fromCol, toRow, toCol) {
  const res = await fetch(`${API_URL}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromRow, fromCol, toRow, toCol }),
  });
  return res.json();
}

export async function resetGame() {
  const res = await fetch(`${API_URL}/reset`, { method: "POST" });
  return res.json();
}