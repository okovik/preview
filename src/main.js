const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const objectiveEl = document.querySelector('#objective');
const statsEl = document.querySelector('#stats');
const messageEl = document.querySelector('#message');

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
let last = performance.now();
let messageTimer = 0;

const state = {
  mode: 'explore',
  spores: 0,
  hasCompanion: false,
  enemyDefeated: false,
  anomalyStable: false,
  camera: { x: 0, y: 0 },
  player: { x: 0, y: 150, r: 18, hp: 100, energy: 100, facing: 0 },
  seed: { x: -420, y: -150, r: 14, collected: false, pulse: 0 },
  companion: { x: 0, y: 0, r: 13, cooldown: 0 },
  enemy: { x: 475, y: -110, r: 24, hp: 90, maxHp: 90, aggro: false, phase: 0 },
  anomaly: { x: 110, y: 255, r: 78, intensity: 0 },
  arena: { x: 0, y: 0, r: 210, alpha: 0 },
  bolts: [],
  motes: [],
};

const mushrooms = [
  [-560, -230, 72, '#55f4df'], [-470, 95, 48, '#c27cff'], [-330, -20, 95, '#67f0ff'],
  [-160, -240, 54, '#f7a7ff'], [-30, 15, 120, '#8b7cff'], [190, -235, 60, '#72ffd8'],
  [310, 90, 92, '#f6d46a'], [520, -10, 68, '#ff6c8b'], [600, 210, 52, '#78ffd7'],
  [-610, 255, 64, '#a18cff'], [-230, 260, 78, '#5fffe7'], [50, -365, 50, '#ff8bd6'],
];

const crystals = [[-90, -120], [150, -55], [410, -260], [-520, 210], [285, 300], [-665, -60]];

function resetGame() {
  state.mode = 'explore';
  state.spores = 0;
  state.hasCompanion = false;
  state.enemyDefeated = false;
  state.anomalyStable = false;
  Object.assign(state.player, { x: 0, y: 150, hp: 100, energy: 100, facing: 0 });
  Object.assign(state.seed, { x: -420, y: -150, collected: false, pulse: 0 });
  Object.assign(state.enemy, { x: 475, y: -110, hp: 90, aggro: false, phase: 0 });
  state.bolts.length = 0;
  state.motes.length = 0;
  showMessage('Welcome to TOI-1338 X. Find the luminous spore seed.');
}

function showMessage(text, duration = 2800) {
  messageEl.textContent = text;
  messageEl.classList.add('visible');
  messageTimer = duration;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function update(dt) {
  messageTimer -= dt * 1000;
  if (messageTimer <= 0) messageEl.classList.remove('visible');

  const p = state.player;
  let dx = 0;
  let dy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  const len = Math.hypot(dx, dy) || 1;
  const speed = state.mode === 'arena' ? 230 : 190;
  p.x = clamp(p.x + (dx / len) * speed * dt, -700, 700);
  p.y = clamp(p.y + (dy / len) * speed * dt, -390, 390);
  if (dx || dy) p.facing = Math.atan2(dy, dx);

  if (!state.seed.collected) state.seed.pulse += dt * 5;
  if (!state.seed.collected && dist(p, state.seed) < 42) {
    state.seed.collected = true;
    state.spores = 1;
    showMessage('Spore seed collected. Press E to grow a companion creature.');
  }

  if (state.hasCompanion) {
    const c = state.companion;
    const targetAngle = p.facing + Math.PI * 0.78;
    const tx = p.x - Math.cos(targetAngle) * 56;
    const ty = p.y - Math.sin(targetAngle) * 56;
    c.x += (tx - c.x) * Math.min(1, dt * 5);
    c.y += (ty - c.y) * Math.min(1, dt * 5);
    c.cooldown = Math.max(0, c.cooldown - dt);
  }

  const enemy = state.enemy;
  if (!state.enemyDefeated && dist(p, enemy) < 150 && state.mode === 'explore') {
    state.mode = 'arena';
    enemy.aggro = true;
    state.arena.x = (p.x + enemy.x) / 2;
    state.arena.y = (p.y + enemy.y) / 2;
    showMessage('A corrupted fungal guardian drags you into limbo combat!');
  }

  if (state.mode === 'arena' && !state.enemyDefeated) {
    state.arena.alpha = Math.min(1, state.arena.alpha + dt * 2);
    const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
    enemy.phase += dt;
    enemy.x += Math.cos(angle) * 72 * dt;
    enemy.y += Math.sin(angle) * 72 * dt;
    if (dist(p, enemy) < p.r + enemy.r + 5) p.hp = Math.max(0, p.hp - 18 * dt);
    const ad = Math.hypot(p.x - state.arena.x, p.y - state.arena.y);
    if (ad > state.arena.r - p.r) {
      p.x = state.arena.x + ((p.x - state.arena.x) / ad) * (state.arena.r - p.r);
      p.y = state.arena.y + ((p.y - state.arena.y) / ad) * (state.arena.r - p.r);
    }
    if (p.hp <= 0) showMessage('You were overgrown by corruption. Press R to restart.', 999999);
  } else {
    state.arena.alpha = Math.max(0, state.arena.alpha - dt * 2);
  }

  for (const bolt of state.bolts) {
    bolt.x += Math.cos(bolt.a) * bolt.speed * dt;
    bolt.y += Math.sin(bolt.a) * bolt.speed * dt;
    bolt.life -= dt;
    if (!state.enemyDefeated && dist(bolt, enemy) < enemy.r + 12) {
      enemy.hp -= bolt.damage;
      bolt.life = 0;
      burst(enemy.x, enemy.y, '#ff3e68', 10);
      if (enemy.hp <= 0) {
        state.enemyDefeated = true;
        state.mode = 'explore';
        showMessage('Guardian cleansed. The companion learned Verdant Pulse.');
      }
    }
  }
  state.bolts = state.bolts.filter((b) => b.life > 0);

  const inAnomaly = dist(p, state.anomaly) < state.anomaly.r;
  state.anomaly.intensity += ((inAnomaly ? 1 : 0.35) - state.anomaly.intensity) * dt * 2;
  if (inAnomaly && !state.anomalyStable) {
    p.energy = Math.max(0, p.energy - 15 * dt);
    if (state.hasCompanion && state.enemyDefeated) {
      state.anomalyStable = true;
      showMessage('Verdant Pulse harmonized the anomaly zone. Vertical slice complete!');
    }
  } else {
    p.energy = Math.min(100, p.energy + 9 * dt);
  }

  for (const mote of state.motes) {
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
    mote.life -= dt;
  }
  state.motes = state.motes.filter((m) => m.life > 0);
  if (Math.random() < dt * 12) burst(Math.random() * 1400 - 700, Math.random() * 760 - 380, '#68fff1', 1, 0.8);

  state.camera.x += (p.x - state.camera.x) * dt * 3;
  state.camera.y += (p.y - state.camera.y) * dt * 3;
  updateHud();
}

function interact() {
  if (state.spores && !state.hasCompanion) {
    state.hasCompanion = true;
    state.companion.x = state.player.x - 48;
    state.companion.y = state.player.y + 40;
    showMessage('Myco-ling hatched! It will amplify your spore bolts.');
  } else if (!state.seed.collected && dist(state.player, state.seed) < 80) {
    state.seed.collected = true;
    state.spores = 1;
    showMessage('Spore seed collected. Press E again to hatch it.');
  }
}

function fireBolt() {
  const p = state.player;
  if (p.energy < 12 || p.hp <= 0) return;
  p.energy -= 12;
  const damage = state.hasCompanion ? 24 : 14;
  state.bolts.push({ x: p.x, y: p.y, a: p.facing, speed: 430, life: 1.4, damage });
  if (state.hasCompanion && state.companion.cooldown <= 0) {
    state.companion.cooldown = 0.55;
    state.bolts.push({ x: state.companion.x, y: state.companion.y, a: p.facing + 0.12, speed: 390, life: 1.2, damage: 12 });
  }
}

function burst(x, y, color, count, power = 1) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = (40 + Math.random() * 90) * power;
    state.motes.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.7, color });
  }
}

function updateHud() {
  const objective = state.anomalyStable
    ? 'Prototype complete: seed bonded, companion grown, guardian cleansed, anomaly stabilized.'
    : state.enemyDefeated
      ? 'Enter the red anomaly zone with your companion to stabilize it.'
      : state.mode === 'arena'
        ? 'Limbo arena: keep distance and fire spore bolts at the corrupted guardian.'
        : state.hasCompanion
          ? 'Explore east. A corrupted guardian waits near the crimson caps.'
          : state.seed.collected
            ? 'Press E to grow your first companion from the spore seed.'
            : 'Find the luminous spore seed hidden among the blue mushrooms.';
  objectiveEl.textContent = objective;
  statsEl.innerHTML = `
    <strong>Explorer Vitals</strong><br />
    Health: ${Math.ceil(state.player.hp)} / 100<br />
    Spore Energy: ${Math.ceil(state.player.energy)} / 100<br />
    Seed: ${state.seed.collected ? 'Collected' : 'Unfound'}<br />
    Companion: ${state.hasCompanion ? 'Myco-ling' : 'Dormant'}<br />
    Arena: ${state.mode === 'arena' ? 'Active' : 'Open world'}
  `;
}

function worldToScreen(x, y) {
  return { x: x - state.camera.x + W / 2, y: y - state.camera.y + H / 2 };
}

function draw() {
  const t = performance.now() / 1000;
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#081325');
  grd.addColorStop(0.55, '#17254a');
  grd.addColorStop(1, '#24122d');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2 - state.camera.x, H / 2 - state.camera.y);
  drawCaveFloor(t);
  drawAnomaly(t);
  for (const [x, y] of crystals) drawCrystal(x, y, t);
  for (const m of mushrooms) drawMushroom(...m, t);
  drawSeed(t);
  drawArena(t);
  if (!state.enemyDefeated) drawEnemy(t);
  drawPlayer(t);
  if (state.hasCompanion) drawCompanion(t);
  for (const bolt of state.bolts) drawGlowCircle(bolt.x, bolt.y, 9, '#b9fff6', 0.95);
  for (const mote of state.motes) drawGlowCircle(mote.x, mote.y, 3 + mote.life * 3, mote.color, mote.life);
  ctx.restore();
}

function drawCaveFloor(t) {
  ctx.fillStyle = 'rgba(104,255,241,0.05)';
  for (let x = -760; x <= 760; x += 80) {
    for (let y = -430; y <= 430; y += 80) {
      const pulse = Math.sin(t + x * 0.01 + y * 0.015) * 0.5 + 0.5;
      drawGlowCircle(x, y, 2 + pulse * 2, '#68fff1', 0.18);
    }
  }
}

function drawMushroom(x, y, size, color, t) {
  ctx.fillStyle = '#31405f';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.24, size * 0.16, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawGlowCircle(x, y - size * 0.22, size * 0.48 + Math.sin(t * 2 + x) * 3, color, 0.28);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.32, size * 0.55, size * 0.24, 0, Math.PI, 0);
  ctx.fill();
}

function drawCrystal(x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#80fff0';
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(0, -36 - Math.sin(t) * 5);
  ctx.lineTo(18, 18);
  ctx.lineTo(0, 34);
  ctx.lineTo(-18, 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSeed(t) {
  if (state.seed.collected) return;
  const r = state.seed.r + Math.sin(state.seed.pulse) * 4;
  drawGlowCircle(state.seed.x, state.seed.y, r * 3, '#f5ff89', 0.26);
  drawGlowCircle(state.seed.x, state.seed.y, r, '#f5ff89', 1);
}

function drawAnomaly(t) {
  const a = state.anomaly;
  const color = state.anomalyStable ? '#65ffd6' : '#ff3e68';
  drawGlowCircle(a.x, a.y, a.r + Math.sin(t * 4) * 10, color, 0.2 + a.intensity * 0.25);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawArena(t) {
  if (state.arena.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = state.arena.alpha;
  ctx.strokeStyle = '#ff3e68';
  ctx.lineWidth = 8;
  ctx.setLineDash([18, 16]);
  ctx.lineDashOffset = -t * 40;
  ctx.beginPath();
  ctx.arc(state.arena.x, state.arena.y, state.arena.r, 0, Math.PI * 2);
  ctx.stroke();
  drawGlowCircle(state.arena.x, state.arena.y, state.arena.r, '#ff3e68', 0.08);
  ctx.restore();
}

function drawPlayer(t) {
  const p = state.player;
  drawGlowCircle(p.x, p.y, p.r + 7, '#9f7cff', 0.25);
  ctx.fillStyle = '#dddcff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#68fff1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.facing) * 28, p.y + Math.sin(p.facing) * 28);
  ctx.stroke();
}

function drawCompanion(t) {
  const c = state.companion;
  drawGlowCircle(c.x, c.y, 28 + Math.sin(t * 5) * 4, '#65ffd6', 0.24);
  ctx.fillStyle = '#65ffd6';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, c.r * 1.2, c.r, Math.sin(t) * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#17254a';
  ctx.beginPath();
  ctx.arc(c.x + 5, c.y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(t) {
  const e = state.enemy;
  drawGlowCircle(e.x, e.y, 42 + Math.sin(t * 8) * 6, '#ff3e68', 0.25);
  ctx.fillStyle = '#5b1427';
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + t;
    ctx.strokeStyle = '#ff6d8d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(a) * 42, e.y + Math.sin(a) * 42);
    ctx.stroke();
  }
  const w = 72;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(e.x - w / 2, e.y - 48, w, 8);
  ctx.fillStyle = '#ff3e68';
  ctx.fillRect(e.x - w / 2, e.y - 48, w * Math.max(0, e.hp / e.maxHp), 8);
}

function drawGlowCircle(x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

document.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space') {
    event.preventDefault();
    fireBolt();
  }
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyR') resetGame();
});
document.addEventListener('keyup', (event) => keys.delete(event.code));

resetGame();
requestAnimationFrame(frame);
