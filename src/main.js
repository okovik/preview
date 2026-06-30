const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const objectiveEl = document.querySelector('#objective');
const statsEl = document.querySelector('#stats');
const messageEl = document.querySelector('#message');

const WORLD = { width: 1500, height: 860 };
const VIEW = { width: canvas.width, height: canvas.height };
const keys = new Set();

const GameMode = Object.freeze({ EXPLORE: 'explore', ARENA: 'arena', DOWNED: 'downed' });
const LoopStep = Object.freeze({
  FIND_SEED: 'findSeed',
  SUMMON_COMPANION: 'summonCompanion',
  FIND_ENEMY: 'findEnemy',
  FIGHT_ENEMY: 'fightEnemy',
  EXPLORE_AFTER_VICTORY: 'exploreAfterVictory',
});

const TUNING = Object.freeze({
  walkSpeed: 185,
  runSpeed: 285,
  arenaWalkSpeed: 205,
  arenaRunSpeed: 245,
  jumpVelocity: 520,
  gravity: 1450,
  enemySpeed: 78,
  playerHealth: 100,
  playerEnergy: 100,
  basicAttackCost: 10,
  companionAbilityCost: 28,
  basicDamage: 16,
  companionDamage: 34,
  arenaTriggerDistance: 155,
  enemyTouchDamagePerSecond: 18,
});

let last = performance.now();
let messageTimer = 0;

const level = {
  spawn: { x: 0, y: 160 },
  seed: { id: 'seed-01', x: -430, y: -155, r: 16, collected: false, pulse: 0 },
  enemy: { id: 'guardian-01', x: 485, y: -115, r: 25, hp: 120, maxHp: 120, defeated: false, active: false, stun: 0 },
  arena: { x: 0, y: 0, r: 215, alpha: 0, active: false },
  mushrooms: [
    [-560, -230, 72, '#55f4df'], [-470, 95, 48, '#c27cff'], [-330, -20, 95, '#67f0ff'],
    [-160, -240, 54, '#f7a7ff'], [-30, 15, 120, '#8b7cff'], [190, -235, 60, '#72ffd8'],
    [310, 90, 92, '#f6d46a'], [520, -10, 68, '#ff6c8b'], [600, 210, 52, '#78ffd7'],
    [-610, 255, 64, '#a18cff'], [-230, 260, 78, '#5fffe7'], [50, -365, 50, '#ff8bd6'],
  ],
  crystals: [[-90, -120], [150, -55], [410, -260], [-520, 210], [285, 300], [-665, -60]],
};

const game = {
  mode: GameMode.EXPLORE,
  loopStep: LoopStep.FIND_SEED,
  camera: { x: 0, y: 0 },
  player: { x: 0, y: 160, z: 0, vz: 0, r: 18, hp: TUNING.playerHealth, energy: TUNING.playerEnergy, facing: 0, isRunning: false, isGrounded: true },
  companion: { unlocked: false, x: 0, y: 0, r: 13, abilityCooldown: 0, abilityMaxCooldown: 3.2 },
  projectiles: [],
  effects: [],
};

function resetGame() {
  game.mode = GameMode.EXPLORE;
  game.loopStep = LoopStep.FIND_SEED;
  Object.assign(game.player, { ...level.spawn, z: 0, vz: 0, hp: TUNING.playerHealth, energy: TUNING.playerEnergy, facing: 0, isRunning: false, isGrounded: true });
  Object.assign(game.companion, { unlocked: false, x: level.spawn.x - 48, y: level.spawn.y + 42, abilityCooldown: 0 });
  Object.assign(level.seed, { collected: false, pulse: 0 });
  Object.assign(level.enemy, { x: 485, y: -115, hp: level.enemy.maxHp, defeated: false, active: false, stun: 0 });
  Object.assign(level.arena, { x: 0, y: 0, active: false, alpha: 0 });
  game.projectiles.length = 0;
  game.effects.length = 0;
  showMessage('Explore TOI-1338 X and find the glowing spore seed.');
}

function update(dt) {
  updateMessage(dt);
  PlayerMovement.update(dt);
  PlayerInteraction.update(dt);
  updateCompanion(dt);
  updateArenaTrigger();
  updateEnemy(dt);
  PlayerCombat.updateProjectiles(dt);
  updateEffects(dt);
  updateCamera(dt);
  updateHud();
}

const Input = {
  moveVector() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    const magnitude = Math.hypot(x, y);
    return magnitude ? { x: x / magnitude, y: y / magnitude, magnitude } : { x: 0, y: 0, magnitude: 0 };
  },
  wantsRun() {
    return keys.has('ShiftLeft') || keys.has('ShiftRight');
  },
};

const PlayerMovement = {
  update(dt) {
    if (game.mode === GameMode.DOWNED) return;

    const move = Input.moveVector();
    const speed = this.currentSpeed();
    game.player.x = clamp(game.player.x + move.x * speed * dt, -WORLD.width / 2, WORLD.width / 2);
    game.player.y = clamp(game.player.y + move.y * speed * dt, -WORLD.height / 2, WORLD.height / 2);
    game.player.isRunning = Input.wantsRun() && move.magnitude > 0 && game.player.isGrounded;
    if (move.magnitude > 0) game.player.facing = Math.atan2(move.y, move.x);

    this.updateJump(dt);
    if (level.arena.active) keepPlayerInsideArena();
    game.player.energy = Math.min(TUNING.playerEnergy, game.player.energy + 12 * dt);
  },
  currentSpeed() {
    if (game.mode === GameMode.ARENA) return Input.wantsRun() ? TUNING.arenaRunSpeed : TUNING.arenaWalkSpeed;
    return Input.wantsRun() ? TUNING.runSpeed : TUNING.walkSpeed;
  },
  jump() {
    if (game.mode === GameMode.DOWNED || !game.player.isGrounded) return;
    game.player.vz = TUNING.jumpVelocity;
    game.player.isGrounded = false;
  },
  updateJump(dt) {
    if (game.player.isGrounded) return;
    game.player.z += game.player.vz * dt;
    game.player.vz -= TUNING.gravity * dt;
    if (game.player.z <= 0) {
      game.player.z = 0;
      game.player.vz = 0;
      game.player.isGrounded = true;
    }
  },
};

const PlayerInteraction = {
  update(dt) {
    updateSeed(dt);
  },
  interact() {
    if (!level.seed.collected && distance(game.player, level.seed) <= game.player.r + level.seed.r + 34) {
      collectSeed();
      return;
    }
    summonCompanion();
  },
};

function updateSeed(dt) {
  if (level.seed.collected) return;
  level.seed.pulse += dt * 5;

  if (distance(game.player, level.seed) <= game.player.r + level.seed.r + 34) {
    game.loopStep = LoopStep.FIND_SEED;
  }
}

function collectSeed() {
  level.seed.collected = true;
  game.loopStep = LoopStep.SUMMON_COMPANION;
  spawnEffect(level.seed.x, level.seed.y, '#f5ff89', 16);
  showMessage('Spore seed collected. Press E to summon its companion creature.');
}

function summonCompanion() {
  if (!level.seed.collected || game.companion.unlocked) return;
  game.companion.unlocked = true;
  game.companion.x = game.player.x - 52;
  game.companion.y = game.player.y + 38;
  game.loopStep = LoopStep.FIND_ENEMY;
  spawnEffect(game.companion.x, game.companion.y, '#65ffd6', 20);
  showMessage('Companion summoned. Find the corrupted guardian and use Q for its ability.');
}

function updateCompanion(dt) {
  if (!game.companion.unlocked) return;

  const followAngle = game.player.facing + Math.PI * 0.78;
  const target = {
    x: game.player.x - Math.cos(followAngle) * 58,
    y: game.player.y - Math.sin(followAngle) * 58,
  };
  game.companion.x = lerp(game.companion.x, target.x, Math.min(1, dt * 5.5));
  game.companion.y = lerp(game.companion.y, target.y, Math.min(1, dt * 5.5));
  game.companion.abilityCooldown = Math.max(0, game.companion.abilityCooldown - dt);
}

function updateArenaTrigger() {
  if (game.mode !== GameMode.EXPLORE || level.enemy.defeated || !game.companion.unlocked) return;
  if (distance(game.player, level.enemy) > TUNING.arenaTriggerDistance) return;

  game.mode = GameMode.ARENA;
  game.loopStep = LoopStep.FIGHT_ENEMY;
  level.enemy.active = true;
  level.arena.active = true;
  level.arena.x = (game.player.x + level.enemy.x) / 2;
  level.arena.y = (game.player.y + level.enemy.y) / 2;
  showMessage('Combat arena formed. Space: basic attack. Q: companion spore burst.');
}

function updateEnemy(dt) {
  if (!level.enemy.active || level.enemy.defeated || game.mode !== GameMode.ARENA) {
    level.arena.alpha = Math.max(0, level.arena.alpha - dt * 2.5);
    return;
  }

  level.arena.alpha = Math.min(1, level.arena.alpha + dt * 2.5);
  if (level.enemy.stun > 0) {
    level.enemy.stun -= dt;
    return;
  }

  const angle = Math.atan2(game.player.y - level.enemy.y, game.player.x - level.enemy.x);
  level.enemy.x += Math.cos(angle) * TUNING.enemySpeed * dt;
  level.enemy.y += Math.sin(angle) * TUNING.enemySpeed * dt;

  if (distance(game.player, level.enemy) < game.player.r + level.enemy.r + 4) {
    game.player.hp = Math.max(0, game.player.hp - TUNING.enemyTouchDamagePerSecond * dt);
    if (game.player.hp <= 0) {
      game.mode = GameMode.DOWNED;
      showMessage('You were overgrown. Press R to restart the loop.', 999999);
    }
  }
}

const PlayerCombat = {
  basicAttack() {
    fireBasicAttack();
  },
  companionAbility() {
    fireCompanionAbility();
  },
  updateProjectiles(dt) {
    updateProjectiles(dt);
  },
};

function fireBasicAttack() {
  if (game.mode === GameMode.DOWNED || game.player.energy < TUNING.basicAttackCost) return;

  game.player.energy -= TUNING.basicAttackCost;
  game.projectiles.push({
    type: 'basic',
    owner: 'player',
    x: game.player.x,
    y: game.player.y,
    r: 9,
    angle: game.player.facing,
    speed: 440,
    damage: TUNING.basicDamage,
    life: 1.35,
    color: '#b9fff6',
  });
}

function fireCompanionAbility() {
  if (!game.companion.unlocked || game.mode !== GameMode.ARENA) return;
  if (game.companion.abilityCooldown > 0 || game.player.energy < TUNING.companionAbilityCost) return;

  game.player.energy -= TUNING.companionAbilityCost;
  game.companion.abilityCooldown = game.companion.abilityMaxCooldown;
  game.projectiles.push({
    type: 'companionAbility',
    owner: 'companion',
    x: game.companion.x,
    y: game.companion.y,
    r: 16,
    angle: Math.atan2(level.enemy.y - game.companion.y, level.enemy.x - game.companion.x),
    speed: 360,
    damage: TUNING.companionDamage,
    life: 1.6,
    color: '#65ffd6',
  });
  showMessage('Companion ability: Verdant Burst launched.');
}

function updateProjectiles(dt) {
  for (const projectile of game.projectiles) {
    projectile.x += Math.cos(projectile.angle) * projectile.speed * dt;
    projectile.y += Math.sin(projectile.angle) * projectile.speed * dt;
    projectile.life -= dt;

    if (!level.enemy.defeated && distance(projectile, level.enemy) < projectile.r + level.enemy.r) {
      damageEnemy(projectile.damage, projectile.type);
      projectile.life = 0;
    }
  }
  game.projectiles = game.projectiles.filter((projectile) => projectile.life > 0);
}

function damageEnemy(amount, sourceType) {
  level.enemy.hp = Math.max(0, level.enemy.hp - amount);
  level.enemy.stun = sourceType === 'companionAbility' ? 0.45 : 0.12;
  spawnEffect(level.enemy.x, level.enemy.y, sourceType === 'companionAbility' ? '#65ffd6' : '#ff3e68', sourceType === 'companionAbility' ? 18 : 9);

  if (level.enemy.hp <= 0) completeCombat();
}

function completeCombat() {
  level.enemy.defeated = true;
  level.enemy.active = false;
  level.arena.active = false;
  game.mode = GameMode.EXPLORE;
  game.loopStep = LoopStep.EXPLORE_AFTER_VICTORY;
  game.projectiles.length = 0;
  spawnEffect(level.enemy.x, level.enemy.y, '#68fff1', 28);
  showMessage('Guardian defeated. Arena dissolved. Continue exploring TOI-1338 X.');
}

function keepPlayerInsideArena() {
  const d = distance(game.player, level.arena);
  const maxDistance = level.arena.r - game.player.r;
  if (d <= maxDistance) return;

  game.player.x = level.arena.x + ((game.player.x - level.arena.x) / d) * maxDistance;
  game.player.y = level.arena.y + ((game.player.y - level.arena.y) / d) * maxDistance;
}

function updateEffects(dt) {
  for (const effect of game.effects) {
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;
    effect.life -= dt;
  }
  game.effects = game.effects.filter((effect) => effect.life > 0);
}

function updateCamera(dt) {
  game.camera.x = lerp(game.camera.x, game.player.x, dt * 3);
  game.camera.y = lerp(game.camera.y, game.player.y, dt * 3);
}

function updateMessage(dt) {
  messageTimer -= dt * 1000;
  if (messageTimer <= 0) messageEl.classList.remove('visible');
}

function updateHud() {
  const objectives = {
    [LoopStep.FIND_SEED]: distance(game.player, level.seed) <= game.player.r + level.seed.r + 34
      ? '1-3/9 Spore seed found. Press E to collect it.'
      : '1/9 Explore the mushroom level and find the glowing spore seed.',
    [LoopStep.SUMMON_COMPANION]: '2-4/9 Seed collected. Press E to summon your companion creature.',
    [LoopStep.FIND_ENEMY]: '5/9 Companion active. Explore east and approach the corrupted guardian.',
    [LoopStep.FIGHT_ENEMY]: '6-7/9 Arena combat: Space for basic attacks, Q for companion ability.',
    [LoopStep.EXPLORE_AFTER_VICTORY]: '8-9/9 Enemy defeated. You are back in exploration mode; keep exploring.',
  };

  objectiveEl.textContent = objectives[game.loopStep];
  statsEl.innerHTML = `
    <strong>Core Loop Status</strong><br />
    Mode: ${game.mode}<br />
    Movement: ${game.player.isRunning ? 'Running' : 'Walking'} ${game.player.isGrounded ? '' : '(Jumping)'}<br />
    Health: ${Math.ceil(game.player.hp)} / ${TUNING.playerHealth}<br />
    Energy: ${Math.ceil(game.player.energy)} / ${TUNING.playerEnergy}<br />
    Seed: ${level.seed.collected ? 'Collected' : 'Unfound'}<br />
    Companion: ${game.companion.unlocked ? `Ready (${game.companion.abilityCooldown.toFixed(1)}s)` : 'Locked'}<br />
    Enemy: ${level.enemy.defeated ? 'Defeated' : `${Math.ceil(level.enemy.hp)} HP`}
  `;
}

function showMessage(text, duration = 2800) {
  messageEl.textContent = text;
  messageEl.classList.add('visible');
  messageTimer = duration;
}

function spawnEffect(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 110;
    game.effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.45 + Math.random() * 0.75, color });
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function draw() {
  const time = performance.now() / 1000;
  drawBackground();
  ctx.save();
  ctx.translate(VIEW.width / 2 - game.camera.x, VIEW.height / 2 - game.camera.y);
  drawLevel(time);
  drawEntities(time);
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, VIEW.width, VIEW.height);
  gradient.addColorStop(0, '#081325');
  gradient.addColorStop(0.55, '#17254a');
  gradient.addColorStop(1, '#24122d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawLevel(time) {
  ctx.strokeStyle = 'rgba(104, 255, 241, 0.08)';
  ctx.lineWidth = 1;
  for (let x = -WORLD.width / 2; x <= WORLD.width / 2; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, -WORLD.height / 2);
    ctx.lineTo(x, WORLD.height / 2);
    ctx.stroke();
  }
  for (let y = -WORLD.height / 2; y <= WORLD.height / 2; y += 80) {
    ctx.beginPath();
    ctx.moveTo(-WORLD.width / 2, y);
    ctx.lineTo(WORLD.width / 2, y);
    ctx.stroke();
  }

  for (const [x, y, size, color] of level.mushrooms) drawMushroomPlaceholder(x, y, size, color, time);
  for (const [x, y] of level.crystals) drawCrystalPlaceholder(x, y, time);
  drawSeedPlaceholder(time);
  drawArenaPlaceholder(time);
}

function drawEntities(time) {
  if (!level.enemy.defeated) drawEnemyPlaceholder(time);
  drawPlayerPlaceholder();
  if (game.companion.unlocked) drawCompanionPlaceholder(time);
  for (const projectile of game.projectiles) drawGlowCircle(projectile.x, projectile.y, projectile.r * 2.3, projectile.color, 0.75);
  for (const effect of game.effects) drawGlowCircle(effect.x, effect.y, 4 + effect.life * 4, effect.color, effect.life);
}

function drawMushroomPlaceholder(x, y, size, color, time) {
  ctx.fillStyle = '#31405f';
  ctx.fillRect(x - size * 0.08, y - size * 0.1, size * 0.16, size * 0.5);
  drawGlowCircle(x, y - size * 0.2, size * 0.55 + Math.sin(time * 2 + x) * 2, color, 0.22);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.28, size * 0.5, size * 0.22, 0, Math.PI, 0);
  ctx.fill();
}

function drawCrystalPlaceholder(x, y, time) {
  drawGlowCircle(x, y, 38, '#80fff0', 0.12);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#80fff0';
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(0, -32 - Math.sin(time) * 4);
  ctx.lineTo(16, 16);
  ctx.lineTo(0, 30);
  ctx.lineTo(-16, 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSeedPlaceholder(time) {
  if (level.seed.collected) return;
  const radius = level.seed.r + Math.sin(level.seed.pulse) * 4;
  drawGlowCircle(level.seed.x, level.seed.y, radius * 3, '#f5ff89', 0.24);
  ctx.fillStyle = '#f5ff89';
  ctx.beginPath();
  ctx.arc(level.seed.x, level.seed.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawArenaPlaceholder(time) {
  if (level.arena.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = level.arena.alpha;
  drawGlowCircle(level.arena.x, level.arena.y, level.arena.r, '#ff3e68', 0.08);
  ctx.strokeStyle = '#ff3e68';
  ctx.lineWidth = 7;
  ctx.setLineDash([18, 14]);
  ctx.lineDashOffset = -time * 48;
  ctx.beginPath();
  ctx.arc(level.arena.x, level.arena.y, level.arena.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlayerPlaceholder() {
  const lift = game.player.z * 0.35;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(game.player.x, game.player.y + 14, game.player.r * 1.1, game.player.r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawGlowCircle(game.player.x, game.player.y - lift, game.player.r + 12, '#9f7cff', 0.22);
  ctx.fillStyle = game.player.isRunning ? '#ffffff' : '#dddcff';
  ctx.beginPath();
  ctx.arc(game.player.x, game.player.y - lift, game.player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#68fff1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(game.player.x, game.player.y - lift);
  ctx.lineTo(game.player.x + Math.cos(game.player.facing) * 30, game.player.y - lift + Math.sin(game.player.facing) * 30);
  ctx.stroke();
}

function drawCompanionPlaceholder(time) {
  drawGlowCircle(game.companion.x, game.companion.y, 32 + Math.sin(time * 5) * 4, '#65ffd6', 0.22);
  ctx.fillStyle = '#65ffd6';
  ctx.beginPath();
  ctx.ellipse(game.companion.x, game.companion.y, game.companion.r * 1.25, game.companion.r, Math.sin(time) * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#17254a';
  ctx.beginPath();
  ctx.arc(game.companion.x + 5, game.companion.y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyPlaceholder(time) {
  const enemy = level.enemy;
  drawGlowCircle(enemy.x, enemy.y, 44 + Math.sin(time * 8) * 5, '#ff3e68', enemy.active ? 0.3 : 0.18);
  ctx.fillStyle = enemy.active ? '#6e1831' : '#3f2635';
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + time;
    ctx.strokeStyle = '#ff6d8d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(enemy.x + Math.cos(angle) * 40, enemy.y + Math.sin(angle) * 40);
    ctx.stroke();
  }

  if (enemy.active) {
    const width = 78;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(enemy.x - width / 2, enemy.y - 52, width, 8);
    ctx.fillStyle = '#ff3e68';
    ctx.fillRect(enemy.x - width / 2, enemy.y - 52, width * (enemy.hp / enemy.maxHp), 8);
  }
}

function drawGlowCircle(x, y, radius, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
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
    PlayerCombat.basicAttack();
  }
  if (event.code === 'KeyQ') PlayerCombat.companionAbility();
  if (event.code === 'KeyJ') PlayerMovement.jump();
  if (event.code === 'KeyE') PlayerInteraction.interact();
  if (event.code === 'KeyR') resetGame();
});

document.addEventListener('keyup', (event) => keys.delete(event.code));

resetGame();
requestAnimationFrame(frame);
