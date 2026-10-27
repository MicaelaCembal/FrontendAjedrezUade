const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8081") + "/api";
const SESSION_KEY = "ajedrezCrossingSession";

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

let memorySessionId = null;

function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = createSessionId();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    if (!memorySessionId) memorySessionId = createSessionId();
    return memorySessionId;
  }
}

function sessionHeaders(extra = {}) {
  return { "X-Session-Id": getSessionId(), ...extra };
}

export async function getState() {
  const res = await fetch(`${API_URL}/state`, { headers: sessionHeaders() });
  return res.json();
}

export async function postMove(fromRow, fromCol, toRow, toCol, promotion) {
  const res = await fetch(`${API_URL}/move`, {
    method: "POST",
    headers: sessionHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(
      promotion ? { fromRow, fromCol, toRow, toCol, promotion } : { fromRow, fromCol, toRow, toCol }
    ),
  });
  return res.json();
}

export async function resetGame(difficulty) {
  const res = await fetch(`${API_URL}/reset`, {
    method: "POST",
    headers: sessionHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(difficulty ? { difficulty } : {}),
  });
  return res.json();
}

export async function undoMove() {
  const res = await fetch(`${API_URL}/undo`, { method: "POST", headers: sessionHeaders() });
  return res.json();
}

export async function getHint() {
  const res = await fetch(`${API_URL}/hint`, { headers: sessionHeaders() });
  return res.json();
}

export async function getPositions() {
  const res = await fetch(`${API_URL}/positions`, { headers: sessionHeaders() });
  return res.json();
}
