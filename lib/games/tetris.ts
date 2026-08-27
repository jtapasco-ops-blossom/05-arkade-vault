// Engine de Tetris portado de references/started-games/03-tetris/game.js a
// TypeScript, agnóstico de React. Todo el estado vive en la closure de
// createTetrisGame; no hay globals en window ni manipulación del DOM del HUD
// (el HUD, el overlay de pausa y el modal de fin los maneja React vía onChange).
// Física, rotación con wall-kicks, puntajes, velocidad por nivel y las 8 piezas
// (incluida la "tuerca") son idénticas al original.

import type { GameSnapshot } from "@/lib/games/types";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // → tablero 300×600
const NEXT_BLOCK = 30; // preview 120×120 (grilla 4×4)

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
  [[8, 8, 8], [8, 0, 8], [8, 8, 8]], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Teclas del juego que consumimos (preventDefault para no scrollear la página).
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "Space"]);

const GRID_LINE = "rgba(255,255,255,0.06)";

type Cell = number; // 0 vacío; 1..8 índice de color
type Board = Cell[][];
interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  onChange: (snap: GameSnapshot) => void,
): {
  start(): void;
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
  destroy(): void;
} {
  const ctx = canvas.getContext("2d")!;
  const nextCtx = nextCanvas.getContext("2d")!;

  let board!: Board;
  let current!: Piece;
  let next!: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let dropAccum = 0;
  let dropInterval = 1000;
  let lastTime: number | null = null;
  let rafId: number | null = null;

  // ── Snapshot (Tetris no usa vidas: lives=0 → el HUD muestra "—") ──
  let last: GameSnapshot | null = null;
  function snapshot(): GameSnapshot {
    return { score, lives: 0, level, state: gameOver ? "gameover" : "playing" };
  }
  function emitIfChanged() {
    const s = snapshot();
    if (last && last.score === s.score && last.lives === s.lives && last.level === s.level && last.state === s.state) {
      return;
    }
    last = s;
    onChange(s);
  }

  // ── Lógica de tablero y piezas ──
  function createBoard(): Board {
    return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result[c][rows - 1 - r] = shape[r][c];
      }
    }
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<Cell>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function endGame() {
    gameOver = true;
    stopLoop();
  }

  // ── Dibujo (solo el juego; sin HUD ni overlay) ──
  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    context.globalAlpha = alpha;
    context.fillStyle = COLORS[colorIndex]!;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);
    }

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
      }
    }

    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
      }
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;

    // Centrar por el bounding box real de la pieza (ignora filas/columnas vacías
    // del molde), no por el tamaño de la matriz, para que quede centrada en su cajón.
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
    const gridW = nextCanvas.width / NEXT_BLOCK;
    const gridH = nextCanvas.height / NEXT_BLOCK;
    const offX = (gridW - (maxC - minC + 1)) / 2 - minC;
    const offY = (gridH - (maxR - minR + 1)) / 2 - minR;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
    }
  }

  // ── Loop (acumulador de caída, dt en ms) ──
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece(); // puede terminar la partida (spawn con colisión)
    }
    draw();
    emitIfChanged();
    rafId = gameOver ? null : requestAnimationFrame(loop);
  }

  function run() {
    if (rafId !== null) return;
    lastTime = null; // reinicia la base de dt (evita saltos tras pausa/tab-blur)
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ── Input (registrado en start, quitado en destroy) ──
  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ShiftLeft":
      case "ShiftRight":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    draw();
    emitIfChanged();
  };

  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    lastTime = null;
    next = randomPiece();
    spawn();
    draw();
  }

  // ── API pública ──
  return {
    start() {
      window.addEventListener("keydown", onKeyDown);
      init();
      run();
      emitIfChanged();
    },
    pause() {
      if (gameOver || paused) return;
      paused = true;
      stopLoop();
    },
    resume() {
      if (gameOver || !paused) return;
      paused = false;
      run();
    },
    forceGameOver() {
      if (gameOver) return;
      endGame();
      emitIfChanged();
    },
    restart() {
      init();
      run();
      emitIfChanged();
    },
    destroy() {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
