// Engine de Arkanoid portado de references/started-games/04-arkanoid
// (game.js + levels.js + assets/spritesheet.js) a TypeScript, agnóstico de
// React. Todo el estado vive en la closure de createBloqueBusterGame; no hay
// globals en window ni manipulación del DOM (el HUD, el overlay de pausa y el
// modal de fin los maneja React vía onChange). Física, puntajes (10 pts por
// bloque), vidas, explosiones y los 5 niveles son idénticos al original.

import type { GameEngineRef, GameSnapshot, GameState } from "@/lib/games/types";

const W = 800;
const H = 600; // buffer del canvas, escalado por CSS

const PADDLE_SPEED = 400; // px/s
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150; // ms, 4 frames
const LIVES_START = 3;
const POINTS_PER_BLOCK = 10;

// Teclas del juego que consumimos (preventDefault para no scrollear la página).
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

type BlockColor =
  | "red"
  | "yellow"
  | "cyan"
  | "magenta"
  | "hotpink"
  | "green"
  | "gray";

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

// Definición de nivel: posición en la grilla, no en píxeles.
interface BlockSpec {
  col: number;
  row: number;
  color: BlockColor;
}

interface Level {
  speed: number;
  blocks: BlockSpec[];
}

// Recorte del spritesheet.
interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Los 5 niveles del original (levels.js): parrilla, pirámide, ajedrez, filas
// con huecos y marco+cruz. Las velocidades son las literales del original.
const LEVELS: Level[] = (() => {
  const rowColors1: BlockColor[] = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2: BlockColor[] = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4: BlockColor[] = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) l1.push({ col, row, color: rowColors1[row] });

  const l2: BlockSpec[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  const l5: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === BLOCK_COLS - 1 || row === 0 || row === BLOCK_ROWS - 1;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// Recortes del spritesheet (assets/spritesheet.js del original).
const SPRITES: {
  paddle: SpriteRect;
  ball: SpriteRect;
  blocks: Record<BlockColor, SpriteRect>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

// 4 frames de explosión por color de bloque.
const explosionRow = (sy: number): SpriteRect[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

// Color de respaldo cuando el spritesheet no carga: el juego sigue jugable.
const FALLBACK_COLORS: Record<BlockColor, string> = {
  red: "#e57373",
  yellow: "#ffd54f",
  cyan: "#4dd0e1",
  magenta: "#ba68c8",
  hotpink: "#f06292",
  green: "#81c784",
  gray: "#9e9e9e",
};

const SPRITESHEET_SRC = "/games/bloque-buster/spritesheet-breakout.png";


export function createBloqueBusterGame(
  canvas: HTMLCanvasElement,
  onChange: (snap: GameSnapshot) => void,
): GameEngineRef & { start(): void; destroy(): void } {
  const ctx = canvas.getContext("2d")!;

  // --- estado (los globals del original, ahora en la closure) ---
  const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = LIVES_START;
  let currentLevel = 1;
  let state: GameState = "playing";

  let rafId: number | null = null;
  let last: number | null = null;

  // Teclas pulsadas; los listeners se registran en start() (paso 3).
  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

  // Spritesheet cargado por instancia (sin caché de módulo). Si falla, el juego
  // sigue jugable dibujando rectángulos de color.
  let sheet: HTMLImageElement | null = null;
  let loaded = false;

  // --- snapshot ---
  let lastSnap: GameSnapshot | null = null;

  function emitIfChanged() {
    if (
      lastSnap &&
      lastSnap.score === score &&
      lastSnap.lives === lives &&
      lastSnap.level === currentLevel &&
      lastSnap.state === state
    ) {
      return;
    }
    lastSnap = { score, lives, level: currentLevel, state };
    onChange(lastSnap);
  }

  // --- setup ---
  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function placeBall(speed: number) {
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function initBall() {
    placeBall(LEVELS[currentLevel - 1].speed);
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    placeBall(level.speed);
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  // --- update ---
  function update(dt: number) {
    if (state !== "playing") return;

    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en muros (izquierda, derecha, techo).
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    // Rebote en el paddle.
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    // Colisión con bloques: uno por frame, como el original.
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += POINTS_PER_BLOCK;
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          // Limpiar el último nivel termina la partida (victoria): el modal de
          // fin de React muestra el score acumulado.
          if (currentLevel < LEVELS.length) loadLevel(currentLevel + 1);
          else state = "gameover";
        }
        break;
      }
    }

    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida.
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        state = "gameover";
      } else {
        initBall();
      }
    }
  }

  // --- draw ---
  function drawSprite(sp: SpriteRect, x: number, y: number, w: number, h: number) {
    if (!loaded || !sheet) return;
    ctx.drawImage(sheet, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (const block of blocks) {
      if (!block.alive) continue;
      if (loaded) drawSprite(SPRITES.blocks[block.color], block.x, block.y, block.w, block.h);
      else {
        ctx.fillStyle = FALLBACK_COLORS[block.color];
        ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
      }
    }

    if (loaded) {
      for (const exp of explosions) {
        const i = Math.min(Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4), 3);
        drawSprite(EXPLOSION_FRAMES[exp.color][i], exp.x, exp.y, exp.w, exp.h);
      }
      drawSprite(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
      drawSprite(SPRITES.ball, ball.x, ball.y, ball.w, ball.h);
    } else {
      ctx.fillStyle = "#e8e8f0";
      ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
      ctx.fillRect(ball.x, ball.y, ball.w, ball.h);
    }
  }

  // --- loop ---
  function frame(ts: number) {
    if (last === null) last = ts;
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;

    update(dt);
    draw();
    emitIfChanged();

    rafId = requestAnimationFrame(frame);
  }

  function runLoop() {
    if (rafId !== null) return;
    last = null;
    rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function loadSheet() {
    const img = new Image();
    img.onload = () => {
      sheet = img;
      loaded = true;
      runLoop();
    };
    // Sin spritesheet el juego arranca igual, con el respaldo de rectángulos.
    img.onerror = () => runLoop();
    img.src = SPRITESHEET_SRC;
  }

  // --- input (registrado en start(), retirado en destroy()) ---
  function onKeyDown(e: KeyboardEvent) {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault(); // no scrollear la página con las flechas
    keys[e.code] = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    if (!GAME_KEYS.has(e.code)) return;
    keys[e.code] = false;
  }

  // El buffer 800×600 se estira dentro del .crt-screen, así que la coordenada
  // del ratón hay que llevarla del espacio de la pantalla al del canvas.
  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  }

  return {
    start() {
      initPaddle();
      loadLevel(1);
      draw();
      emitIfChanged();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      canvas.addEventListener("mousemove", onMouseMove);
      loadSheet();
    },
    pause() {
      stopLoop();
    },
    resume() {
      if (state !== "playing") return;
      runLoop();
    },
    forceGameOver() {
      state = "gameover";
      stopLoop();
      emitIfChanged();
    },
    restart() {
      score = 0;
      lives = LIVES_START;
      state = "playing";
      initPaddle();
      loadLevel(1);
      emitIfChanged();
      runLoop();
    },
    destroy() {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}
