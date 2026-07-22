// ===== lib/games/asteroids.ts =====
// Engine de Asteroides portado 1:1 desde references/started-games/02-asteroids/game.js.
// Agnóstico de React: encapsula estado, input y loop dentro de createAsteroidsGame().
// El canvas solo dibuja el juego; el HUD y el overlay de fin los maneja React vía onChange.

export type AsteroidsState = "playing" | "dead" | "gameover";

export interface AsteroidsSnapshot {
  score: number;
  lives: number;
  level: number;
  state: AsteroidsState;
}

export interface AsteroidsGameHandle {
  start(): void; // arranca el loop (requestAnimationFrame)
  pause(): void; // congela loop y tiempo
  resume(): void; // reanuda
  forceGameOver(): void; // FIN → state = "gameover"
  restart(): void; // reinicia desde cero
  destroy(): void; // cancela RAF y quita listeners de teclado
}

const W = 800;
const H = 600;

// ── Constantes ──────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

// Teclas del juego (se les hace preventDefault para no scrollear la página)
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  onChange: (snap: AsteroidsSnapshot) => void,
): AsteroidsGameHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // ── Input ─────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  // ── Bullet ──────────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;

    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      ctx!.fillStyle = "#fff";
      ctx!.beginPath();
      ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  // ── Asteroid ──────────────────────────────────────────────────────────────
  const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
  const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
  const POINTS = [0, 100, 50, 20]; // puntos por tamaño

  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead = false;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: Array<[number, number]> = [];

    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [new Asteroid(this.x, this.y, this.size - 1), new Asteroid(this.x, this.y, this.size - 1)];
    }

    draw() {
      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(this.rot);
      ctx!.strokeStyle = "#fff";
      ctx!.lineWidth = 1.5;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      ctx!.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++) ctx!.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx!.closePath();
      ctx!.stroke();
      ctx!.restore();
    }
  }

  // ── PowerUp ─────────────────────────────────────────────────────────────────
  class PowerUp {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius = 12;
    ttl = POWERUP_TTL;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(20, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
      const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(Math.PI / 4);
      ctx!.strokeStyle = "#0ff";
      ctx!.lineWidth = 2;
      const r = this.radius * pulse;
      ctx!.strokeRect(-r, -r, r * 2, r * 2);
      ctx!.restore();
      ctx!.fillStyle = "#0ff";
      ctx!.font = "bold 12px monospace";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText("3x", this.x, this.y);
    }
  }

  // ── Ship ──────────────────────────────────────────────────────────────────
  class Ship {
    x = W / 2;
    y = H / 2;
    angle = -Math.PI / 2;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 3;
    shootCooldown = 0;
    tripleShot = 0;
    dead = false;

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }

    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.tripleShot > 0) this.tripleShot -= dt;

      const ROT = 3.5; // rad/s
      const THRUST = 260; // px/s²
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (this.tripleShot > 0) {
        return [
          new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
          new Bullet(ox, oy, this.angle),
          new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
        ];
      }
      return [new Bullet(ox, oy, this.angle)];
    }

    draw() {
      if (this.dead) return;
      // Parpadeo durante invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(this.angle);
      ctx!.strokeStyle = "#fff";
      ctx!.lineWidth = 1.5;
      ctx!.lineJoin = "round";

      // Silueta clásica: triángulo con muesca trasera
      ctx!.beginPath();
      ctx!.moveTo(20, 0); // nariz
      ctx!.lineTo(-12, -9); // ala izquierda
      ctx!.lineTo(-7, 0); // muesca trasera
      ctx!.lineTo(-12, 9); // ala derecha
      ctx!.closePath();
      ctx!.stroke();

      // Llama del propulsor
      if (this.thrusting && Math.random() > 0.35) {
        ctx!.beginPath();
        ctx!.moveTo(-8, -4);
        ctx!.lineTo(-8 - rand(6, 14), 0);
        ctx!.lineTo(-8, 4);
        ctx!.strokeStyle = "rgba(255, 130, 0, 0.85)";
        ctx!.stroke();
      }

      ctx!.restore();
    }
  }

  // ── Partículas (explosión) ──────────────────────────────────────────────────
  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
    }

    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      ctx!.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(this.x, this.y);
      ctx!.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx!.stroke();
    }
  }

  // ── Estado del juego ────────────────────────────────────────────────────────
  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: AsteroidsState;
  let deadTimer = 0;
  let powerUpSpawned: boolean;
  let killsSinceSpawn: number;

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      // El reinicio lo dispara React (JUGAR DE NUEVO → restart()); aquí solo se
      // dejan morir las partículas de la explosión final.
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  // Nota: el HUD (SCORE/NIVEL/vidas) y el overlay GAME OVER del engine original se
  // eliminaron; React los maneja con el estado real recibido vía onChange.
  function draw() {
    ctx!.fillStyle = "#000";
    ctx!.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerUps.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();
  }

  // ── Snapshot hacia React ────────────────────────────────────────────────────
  let last: AsteroidsSnapshot | null = null;

  function emitIfChanged() {
    if (last && last.score === score && last.lives === lives && last.level === level && last.state === state) {
      return;
    }
    last = { score, lives, level, state };
    onChange(last);
  }

  // ── Loop principal ────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let paused = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    emitIfChanged();
    rafId = requestAnimationFrame(loop);
  }

  function run() {
    if (rafId !== null) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Estado inicial
  initGame();

  return {
    start() {
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      paused = false;
      run();
      emitIfChanged();
    },
    pause() {
      paused = true;
      stopLoop();
    },
    resume() {
      if (!paused) return;
      paused = false;
      run();
    },
    forceGameOver() {
      state = "gameover";
      emitIfChanged();
    },
    restart() {
      initGame();
      paused = false;
      run();
      emitIfChanged();
    },
    destroy() {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
