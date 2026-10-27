const MINI_SIZE = 5;

function miniPattern(type) {
  const center = [2, 2];
  const moves = new Set();
  const captures = new Set();
  const inside = (r, c) => r >= 0 && r < MINI_SIZE && c >= 0 && c < MINI_SIZE;
  const add = (r, c) => {
    if (inside(r, c)) moves.add(`${r}-${c}`);
  };
  const ray = (dr, dc) => {
    let r = center[0] + dr;
    let c = center[1] + dc;
    while (inside(r, c)) {
      moves.add(`${r}-${c}`);
      r += dr;
      c += dc;
    }
  };

  if (type === "PAWN") {
    const piece = [3, 2];
    add(2, 2);
    add(1, 2);
    captures.add("2-1");
    captures.add("2-3");
    return { piece, moves, captures };
  }
  if (type === "KNIGHT") {
    [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ].forEach(([dr, dc]) => add(center[0] + dr, center[1] + dc));
  }
  if (type === "KING") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr !== 0 || dc !== 0) add(center[0] + dr, center[1] + dc);
      }
    }
  }
  if (type === "ROOK" || type === "QUEEN") {
    [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].forEach(([dr, dc]) => ray(dr, dc));
  }
  if (type === "BISHOP" || type === "QUEEN") {
    [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ].forEach(([dr, dc]) => ray(dr, dc));
  }
  return { piece: center, moves, captures };
}


function MiniMoves({ type, image }) {
  const { piece, moves, captures } = miniPattern(type);
  const cells = [];
  for (let r = 0; r < MINI_SIZE; r += 1) {
    for (let c = 0; c < MINI_SIZE; c += 1) {
      const key = `${r}-${c}`;
      const isPiece = piece[0] === r && piece[1] === c;
      cells.push(
        <div
          key={key}
          className={`mini-cell ${(r + c) % 2 === 0 ? "light" : "dark"} ${
            moves.has(key) ? "mini-move" : ""
          } ${captures.has(key) ? "mini-capture" : ""}`}
        >
          {isPiece && <img src={image} alt="" draggable={false} />}
        </div>
      );
    }
  }
  return (
    <div className="mini-board" aria-hidden="true">
      {cells}
    </div>
  );
}

const PIECES = [
  {
    type: "PAWN",
    name: "Peón",
    text: "Avanza de a una casilla (la primera vez puede ir de a dos). Come en diagonal, para adelante, y nunca vuelve para atrás. Si llega al otro extremo del tablero corona: elegís si se convierte en Dama, Torre, Alfil o Caballo.",
  },
  {
    type: "ROOK",
    name: "Torre",
    text: "Va en línea recta, para adelante, atrás o a los costados, tantas casillas como quieras (mientras no tenga a otra pieza en el medio).",
  },
  {
    type: "KNIGHT",
    name: "Caballo",
    text: "Se mueve en forma de L: dos casillas en una dirección y una al costado. Es la única pieza que puede saltar por encima de las demás.",
  },
  {
    type: "BISHOP",
    name: "Alfil",
    text: "Va en diagonal, tantas casillas como quieras. Siempre se queda en casillas del mismo color.",
  },
  {
    type: "QUEEN",
    name: "Dama",
    text: "La más poderosa: se mueve como una torre y como un alfil juntos, en línea recta o en diagonal.",
  },
  {
    type: "KING",
    name: "Rey",
    text: "Va una sola casilla, en cualquier dirección. Es la pieza más importante: si lo atrapan, perdés la partida.",
  },
];

function HowToPlay({ pieceImage }) {
  return (
    <div className="howto">
      <p className="howto-intro">
        Guía rápida para jugar aunque nunca hayas tocado un ajedrez. Tocá cada
        sección para abrirla o cerrarla.
      </p>

      <details className="howto-section" open>
        <summary>¿De qué se trata?</summary>
        <div className="howto-body">
          <p>
            Juegan dos: <strong>vos sos Rosa</strong> (las piezas de abajo) y la
            computadora es <strong>Celeste</strong> (las de arriba). Se turnan
            para mover una pieza por vez, y empezás vos.
          </p>
          <p>
            <strong>Para ganar</strong> tenés que dejar al Rey de Celeste
            atrapado, sin forma de escapar. Eso se llama <em>jaque mate</em>.
          </p>
        </div>
      </details>

      <details className="howto-section">
        <summary>Cómo mover una pieza</summary>
        <div className="howto-body">
          <ol>
            <li>Tocá una de tus piezas rosas.</li>
            <li>
              Aparecen <strong>puntitos verdes</strong>: son los lugares a donde
              puede ir. Un <strong>aro verde</strong> sobre una pieza de Celeste
              quiere decir que te la podés comer.
            </li>
            <li>Tocá el lugar elegido y listo. Ahora juega Celeste.</li>
          </ol>
          <p>
            ¿Te arrepentiste antes de mover? Tocá de nuevo la misma pieza para
            soltarla. ¿Ya movés y te equivocaste? Usá el botón{" "}
            <strong>Deshacer</strong>.
          </p>
        </div>
      </details>

      <details className="howto-section">
        <summary>Las piezas y cómo se mueven</summary>
        <div className="howto-body">
          <p className="howto-legend">
            <span className="legend-dot" /> puede ir ahí
            <span className="legend-ring" /> puede comer ahí
          </p>
          <ul className="piece-list">
            {PIECES.map((piece) => (
              <li key={piece.type} className="piece-card">
                <MiniMoves type={piece.type} image={pieceImage[piece.type]} />
                <div className="piece-text">
                  <strong>{piece.name}</strong>
                  <p>{piece.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p>
            <strong>Comer</strong> es caer sobre una pieza rival: esa pieza
            sale del tablero y va a la bandeja de &quot;Comidas&quot;.
          </p>
        </div>
      </details>

      <details className="howto-section">
        <summary>Jaque, jaque mate y tablas</summary>
        <div className="howto-body">
          <p>
            <strong>Jaque:</strong> tu Rey está siendo atacado. Se marca con un
            titileo rojo y tenés que salvarlo en esa misma jugada: moviendo al
            Rey, tapando el ataque con otra pieza o comiéndote a la que ataca.
          </p>
          <p>
            <strong>Jaque mate:</strong> el Rey está atacado y no hay ninguna
            forma de salvarlo. Se termina la partida y pierde quien quedó en
            jaque mate.
          </p>
          <p>
            <strong>Tablas (empate):</strong> el jugador al que le toca no está
            en jaque, pero tampoco puede mover ninguna pieza sin dejar a su Rey
            en peligro. Nadie gana.
          </p>
          <p>
            <strong>Regla de oro:</strong> nunca podés hacer una jugada que deje
            a tu propio Rey atacado. Si el juego te dice &quot;Movimiento
            inválido&quot;, casi seguro es por eso.
          </p>
        </div>
      </details>

      <details className="howto-section">
        <summary>Tips para arrancar</summary>
        <div className="howto-body">
          <ul>
            <li>
              Antes de mover, fijate si la casilla a la que vas puede ser
              atacada por una pieza de Celeste. Si te la comen gratis, perdés
              material.
            </li>
            <li>
              Más o menos, cuánto vale cada pieza: Peón 1, Caballo y Alfil 3,
              Torre 5, Dama 9. Cambiar una pieza por otra de igual o mayor valor
              te conviene.
            </li>
            <li>
              Al principio, movés peones del centro y sacás caballos y alfiles
              para que tengan espacio.
            </li>
            <li>No dejes a tu Rey solo en el medio del tablero.</li>
          </ul>
        </div>
      </details>

      <details className="howto-section">
        <summary>Los botones y el reloj</summary>
        <div className="howto-body">
          <ul>
            <li>
              <strong>Reloj:</strong> cada uno tiene 10 minutos en total. Corre
              solo mientras es tu turno. Si se te acaba, perdés.
            </li>
            <li>
              <strong>Deshacer:</strong> vuelve atrás tu última jugada y la
              respuesta de Celeste. El tiempo gastado no se devuelve.
            </li>
            <li>
              <strong>Pista:</strong> te marca en el tablero la jugada que
              recomienda la computadora. Sirve para aprender, pero pensala
              vos primero.
            </li>
            <li>
              <strong>Reiniciar partida:</strong> vuelve a la pantalla de
              dificultad para arrancar un juego nuevo.
            </li>
            <li>
              <strong>Exportar partida:</strong> te da el texto de la partida
              (formato PGN) para copiarlo o descargarlo y verlo en otros
              programas de ajedrez.
            </li>
            <li>
              <strong>Dificultad:</strong> antes de empezar elegís entre Fácil,
              Medio y Difícil. En Fácil Celeste comete errores; en Difícil
              piensa varias jugadas por adelantado.
            </li>
            <li>
              <strong>Repasar la partida:</strong> con los botones del
              historial (o las flechas del teclado) volvés a ver cualquier
              momento de la partida. Con Fin o Esc volvés a la jugada actual.
            </li>
            <li>
              <strong>Música:</strong> el reproductor de abajo a la izquierda
              tiene varias canciones, pausa, siguiente y volumen. La flechita
              abre la lista y el volumen de los efectos de sonido.
            </li>
            <li>
              <strong>Fondo:</strong> los circulitos de la derecha cambian el
              fondo de pantalla.
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}

export default HowToPlay;
