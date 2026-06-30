const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const objectiveEl = document.querySelector('#objective');
const statsEl = document.querySelector('#stats');
const messageEl = document.querySelector('#message');
const promptEl = document.querySelector('#interaction-prompt');

const WORLD = { width: 1500, height: 860 };
const VIEW = { width: canvas.width, height: canvas.height };
const keys = new Set();

const GameMode = Object.freeze({ EXPLORE: 'explore', TRANSITION: 'transition', ARENA: 'arena', DOWNED: 'downed' });
const Element = Object.freeze({ LUMIN: 'Lumin', CORRUPTION: 'Corruption' });

const CompanionCreatures = Object.freeze({
  glowshroom: Object.freeze({
    id: 'glowshroom',
    name: 'Glowshroom',
    element: Element.LUMIN,
    role: 'Support / light creature',
    ability: Object.freeze({
      name: 'Light Pulse',
      cost: 24,
      cooldown: 2.6,
      damage: 26,
      projectileRadius: 18,
      color: '#f7ff9a',
      canActivateLightObjects: true,
    }),
  }),
});
const EnemyTypes = Object.freeze({
  redRotStalker: Object.freeze({
    id: 'redRotStalker',
    name: 'Red Rot Stalker',
    type: 'corrupted fungal creature',
    element: Element.CORRUPTION,
    lore: 'A crawling predator carrying the Red Rot infection.',
    maxHp: 120,
    contactDamagePerSecond: 18,
    color: '#ff3e68',
  }),
});

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
  basicDamage: 16,
  arenaTriggerDistance: 155,
  limboTransitionDuration: 0.85,
});

let last = performance.now();
let messageTimer = 0;

const level = {
  spawn: { x: 0, y: 160 },
  seed: { id: 'seed-01', type: 'SporeSeed', creatureId: 'glowshroom', x: -430, y: -155, r: 16, collected: false, pulse: 0 },
  enemy: { id: 'red-rot-stalker-01', enemyTypeId: 'redRotStalker', x: 485, y: -115, r: 25, hp: EnemyTypes.redRotStalker.maxHp, maxHp: EnemyTypes.redRotStalker.maxHp, defeated: false, active: false, stun: 0 },
  anomaly: { id: 'anomaly-01', x: 155, y: 280, r: 82, stabilized: false, intensity: 0 },
  corruption: { x: 470, y: -105, r: 145 },
  arena: { x: 0, y: 0, r: 215, alpha: 0, active: false },
  limboSpawn: { player: { x: -95, y: 65 }, companion: { x: -142, y: 96 }, enemy: { x: 118, y: -45 } },
  mushrooms: [
    [-560, -230, 72, '#55f4df'], [-470, 95, 48, '#c27cff'], [-330, -20, 95, '#67f0ff'],
    [-160, -240, 54, '#f7a7ff'], [-30, 15, 120, '#8b7cff'], [190, -235, 60, '#72ffd8'],
    [310, 90, 92, '#f6d46a'], [520, -10, 68, '#ff6c8b'], [600, 210, 52, '#78ffd7'],
    [-610, 255, 64, '#a18cff'], [-230, 260, 78, '#5fffe7'], [50, -365, 50, '#ff8bd6'],
  ],
  crystals: [[-90, -120], [150, -55], [410, -260], [-520, 210], [285, 300], [-665, -60]],
  roots: [
    { x: -690, y: 270, length: 360, angle: -0.22, width: 22 },
    { x: -250, y: 325, length: 320, angle: 0.14, width: 18 },
    { x: 65, y: 220, length: 260, angle: -0.55, width: 16 },
    { x: 365, y: 205, length: 310, angle: 0.42, width: 20 },
    { x: -520, y: -320, length: 350, angle: 0.36, width: 18 },
    { x: 45, y: -330, length: 295, angle: -0.18, width: 14 },
  ],
  rocks: [
    { x: -610, y: -40, rx: 42, ry: 24 }, { x: -375, y: 235, rx: 55, ry: 30 },
    { x: -125, y: 95, rx: 36, ry: 22 }, { x: 245, y: -315, rx: 46, ry: 28 },
    { x: 600, y: 125, rx: 58, ry: 32 }, { x: 675, y: -245, rx: 36, ry: 22 },
  ],
  pathMarkers: [
    { x: -430, y: -155, label: 'Spore Seed' },
    { x: 485, y: -115, label: 'Red Rot Stalker' },
    { x: 155, y: 280, label: 'Anomaly Zone' },
  ],
};

const game = {
  mode: GameMode.EXPLORE,
  loopStep: LoopStep.FIND_SEED,
  camera: { x: 0, y: 0 },
  player: { x: 0, y: 160, z: 0, vz: 0, r: 18, hp: TUNING.playerHealth, energy: TUNING.playerEnergy, facing: 0, isRunning: false, isGrounded: true },
  unlockedCreatureIds: [],
  companion: { creatureId: null, x: 0, y: 0, r: 13, abilityCooldown: 0 },
  limbo: { transition: null, timer: 0, savedExplorationPosition: null },
  projectiles: [],
  effects: [],
};

function resetGame() {
  game.mode = GameMode.EXPLORE;
  game.loopStep = LoopStep.FIND_SEED;
  Object.assign(game.player, { ...level.spawn, z: 0, vz: 0, hp: TUNING.playerHealth, energy: TUNING.playerEnergy, facing: 0, isRunning: false, isGrounded: true });
  game.unlockedCreatureIds = [];
  Object.assign(game.companion, { creatureId: null, x: level.spawn.x - 48, y: level.spawn.y + 42, abilityCooldown: 0 });
  Object.assign(level.seed, { collected: false, pulse: 0 });
  Object.assign(level.enemy, { x: 485, y: -115, hp: getEnemyType(level.enemy).maxHp, maxHp: getEnemyType(level.enemy).maxHp, defeated: false, active: false, stun: 0 });
  Object.assign(level.anomaly, { stabilized: false, intensity: 0 });
  Object.assign(level.arena, { x: 0, y: 0, active: false, alpha: 0 });
  Object.assign(game.limbo, { transition: null, timer: 0, savedExplorationPosition: null });
  game.projectiles.length = 0;
  game.effects.length = 0;
  showMessage('Explore TOI-1338 X and find the glowing spore seed.');
}

function update(dt) {
  updateMessage(dt);
  updateLimboTransition(dt);
  PlayerMovement.update(dt);
  PlayerInteraction.update(dt);
  updateCompanion(dt);
  updateArenaTrigger();
  updateEnemy(dt);
  updateAnomaly(dt);
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
    if (game.mode === GameMode.DOWNED || game.mode === GameMode.TRANSITION) return;

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
    if (game.mode === GameMode.DOWNED || game.mode === GameMode.TRANSITION || !game.player.isGrounded) return;
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
    if (game.mode !== GameMode.EXPLORE) return;
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
  unlockCreatureFromSeed(level.seed);
  game.loopStep = LoopStep.SUMMON_COMPANION;
  spawnEffect(level.seed.x, level.seed.y, getCreature(level.seed.creatureId).ability.color, 16);
  showMessage('Creature unlocked: Glowshroom, Lumin support companion. Press E to grow it.');
}

function unlockCreatureFromSeed(seed) {
  if (!game.unlockedCreatureIds.includes(seed.creatureId)) {
    game.unlockedCreatureIds.push(seed.creatureId);
  }
}

function summonCompanion() {
  if (!level.seed.collected || game.companion.creatureId) return;
  spawnCompanion(level.seed.creatureId);
}

function spawnCompanion(creatureId) {
  const creature = getCreature(creatureId);
  if (!creature || !game.unlockedCreatureIds.includes(creatureId)) return;

  game.companion.creatureId = creatureId;
  game.companion.x = game.player.x - 52;
  game.companion.y = game.player.y + 38;
  game.companion.abilityCooldown = 0;
  game.loopStep = LoopStep.FIND_ENEMY;
  spawnEffect(game.companion.x, game.companion.y, creature.ability.color, 20);
  showMessage(`${creature.name} grown. Press Q to trigger ${creature.ability.name}.`);
}

function updateCompanion(dt) {
  if (!game.companion.creatureId) return;

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
  if (game.mode !== GameMode.EXPLORE || level.enemy.defeated || !game.companion.creatureId) return;
  if (distance(game.player, level.enemy) > TUNING.arenaTriggerDistance) return;

  beginLimboTransition();
}

function beginLimboTransition() {
  game.mode = GameMode.TRANSITION;
  game.loopStep = LoopStep.FIGHT_ENEMY;
  game.limbo.transition = 'enter';
  game.limbo.timer = 0;
  game.limbo.savedExplorationPosition = { x: game.player.x, y: game.player.y, facing: game.player.facing };
  showMessage('The Red Rot Stalker senses you. Limbo is forming.');
}

function updateLimboTransition(dt) {
  if (!game.limbo.transition) return;

  game.limbo.timer += dt;
  const complete = game.limbo.timer >= TUNING.limboTransitionDuration;
  if (!complete) return;

  if (game.limbo.transition === 'enter') {
    spawnLimboCombatants();
    game.mode = GameMode.ARENA;
    showMessage('Red Rot Stalker pulls you into Limbo. Space: attack. Q: Light Pulse.');
  } else if (game.limbo.transition === 'exit') {
    returnToExplorationPosition();
    game.mode = GameMode.EXPLORE;
    showMessage('Limbo dissolved. You return to the fungal cave.');
  }

  game.limbo.transition = null;
  game.limbo.timer = 0;
}

function spawnLimboCombatants() {
  level.arena.active = true;
  level.arena.alpha = 1;
  level.arena.x = 0;
  level.arena.y = 0;
  level.enemy.active = true;
  level.enemy.maxHp = getEnemyType(level.enemy).maxHp;
  level.enemy.hp = level.enemy.maxHp;
  level.enemy.stun = 0;
  Object.assign(game.player, { x: level.limboSpawn.player.x, y: level.limboSpawn.player.y, z: 0, vz: 0, hp: TUNING.playerHealth, isGrounded: true, facing: 0 });
  Object.assign(level.enemy, { x: level.limboSpawn.enemy.x, y: level.limboSpawn.enemy.y });
  if (game.companion.creatureId) Object.assign(game.companion, { x: level.limboSpawn.companion.x, y: level.limboSpawn.companion.y, abilityCooldown: 0 });
  game.projectiles.length = 0;
}

function beginLimboExit() {
  level.enemy.active = false;
  level.arena.active = false;
  game.limbo.transition = 'exit';
  game.limbo.timer = 0;
  game.mode = GameMode.TRANSITION;
}

function returnToExplorationPosition() {
  const saved = game.limbo.savedExplorationPosition ?? level.spawn;
  Object.assign(game.player, { x: saved.x, y: saved.y, z: 0, vz: 0, facing: saved.facing ?? 0, isGrounded: true });
  if (game.companion.creatureId) {
    game.companion.x = game.player.x - 52;
    game.companion.y = game.player.y + 38;
  }
  game.limbo.savedExplorationPosition = null;
}

function restartLimboCombat() {
  showMessage('Limbo overwhelms you. Combat restarts.', 1600);
  spawnLimboCombatants();
  game.mode = GameMode.ARENA;
}

function updateAnomaly(dt) {
  const inside = distance(game.player, level.anomaly) < level.anomaly.r;
  level.anomaly.intensity = lerp(level.anomaly.intensity, inside ? 1 : 0.35, dt * 2.2);

  if (inside && level.enemy.defeated && hasActiveCompanionAbilityTag('canActivateLightObjects') && !level.anomaly.stabilized) {
    level.anomaly.stabilized = true;
    spawnEffect(level.anomaly.x, level.anomaly.y, getActiveCompanion()?.ability.color ?? '#f7ff9a', 26);
    showMessage('Anomaly stabilized. The cave remains open for exploration.');
  }
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
    game.player.hp = Math.max(0, game.player.hp - getEnemyType(level.enemy).contactDamagePerSecond * dt);
    if (game.player.hp <= 0) {
      restartLimboCombat();
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
  if (game.mode === GameMode.DOWNED || game.mode === GameMode.TRANSITION || game.player.energy < TUNING.basicAttackCost) return;

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
  const creature = getActiveCompanion();
  if (!creature || game.mode !== GameMode.ARENA) return;
  if (game.companion.abilityCooldown > 0 || game.player.energy < creature.ability.cost) return;

  game.player.energy -= creature.ability.cost;
  game.companion.abilityCooldown = creature.ability.cooldown;
  game.projectiles.push({
    type: 'companionAbility',
    abilityName: creature.ability.name,
    owner: creature.id,
    element: creature.element,
    x: game.companion.x,
    y: game.companion.y,
    r: creature.ability.projectileRadius,
    angle: Math.atan2(level.enemy.y - game.companion.y, level.enemy.x - game.companion.x),
    speed: 360,
    damage: creature.ability.damage,
    life: 1.6,
    color: creature.ability.color,
  });
  showMessage(`${creature.name} used ${creature.ability.name}.`);
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
  spawnEffect(level.enemy.x, level.enemy.y, sourceType === 'companionAbility' ? getActiveCompanion()?.ability.color ?? '#f7ff9a' : '#ff3e68', sourceType === 'companionAbility' ? 18 : 9);

  if (level.enemy.hp <= 0) completeCombat();
}

function completeCombat() {
  level.enemy.defeated = true;
  game.loopStep = LoopStep.EXPLORE_AFTER_VICTORY;
  game.projectiles.length = 0;
  spawnEffect(level.enemy.x, level.enemy.y, '#68fff1', 28);
  showMessage('Victory! Red Rot Stalker defeated.', 2600);
  beginLimboExit();
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
    [LoopStep.SUMMON_COMPANION]: '2-4/9 SporeSeed collected. Press E to grow Glowshroom.',
    [LoopStep.FIND_ENEMY]: '5/9 Companion active. Explore east and approach the Red Rot Stalker.',
    [LoopStep.FIGHT_ENEMY]: '6-7/9 Limbo combat: defeat the Red Rot Stalker with attacks and Light Pulse.',
    [LoopStep.EXPLORE_AFTER_VICTORY]: level.anomaly.stabilized
      ? 'Alien biome complete: seed, enemy, and anomaly are all readable and playable.'
      : '8-9/9 Enemy defeated. Explore the south anomaly zone to stabilize it.',
  };

  objectiveEl.textContent = objectives[game.loopStep];
  updateInteractionPrompt();
  statsEl.innerHTML = game.mode === GameMode.ARENA
    ? combatHudTemplate()
    : explorationHudTemplate();
}

function updateInteractionPrompt() {
  const nearSeed = !level.seed.collected && distance(game.player, level.seed) <= game.player.r + level.seed.r + 34 && game.mode === GameMode.EXPLORE;
  const canGrowCompanion = level.seed.collected && !game.companion.creatureId && game.mode === GameMode.EXPLORE;
  const prompt = nearSeed ? 'Press E to collect SporeSeed' : canGrowCompanion ? 'Press E to grow Glowshroom' : '';
  promptEl.textContent = prompt;
  promptEl.classList.toggle('visible', Boolean(prompt));
}

function explorationHudTemplate() {
  const companion = getActiveCompanion();
  return `
    <strong class="hud-title">Exploration</strong>
    ${barTemplate('Player Health', game.player.hp, TUNING.playerHealth, 'health')}
    ${barTemplate('Spore Energy', game.player.energy, TUNING.playerEnergy, 'energy')}
    <div class="companion-card">
      <span class="icon">${companion ? '🍄' : '○'}</span>
      <span>${companion ? `${companion.name}<br /><small>${companion.element} • ${companion.role}</small>` : 'No companion grown'}</span>
    </div>
    <div class="hint">${level.seed.collected ? 'Seed: Collected' : 'Find the glowing SporeSeed'}</div>
  `;
}

function combatHudTemplate() {
  const companion = getActiveCompanion();
  const enemyType = getEnemyType(level.enemy);
  return `
    <strong class="hud-title">Combat: Limbo</strong>
    ${barTemplate('Player Health', game.player.hp, TUNING.playerHealth, 'health')}
    ${barTemplate(enemyType.name, level.enemy.hp, level.enemy.maxHp, 'enemy')}
    <div class="ability-card">
      <span class="icon">✨</span>
      <span>${companion ? `${companion.ability.name} (Q)<br /><small>Cooldown: ${game.companion.abilityCooldown.toFixed(1)}s</small>` : 'No companion ability'}</span>
    </div>
    <div class="hint">Space: basic attack • Q: companion ability</div>
  `;
}

function barTemplate(label, value, max, kind) {
  const percent = clamp((value / max) * 100, 0, 100);
  return `
    <div class="hud-row"><span>${label}</span><span>${Math.ceil(value)} / ${max}</span></div>
    <div class="bar"><div class="bar-fill ${kind}" style="--value: ${percent}"></div></div>
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
  drawLimboTransitionOverlay();
}

function drawLimboTransitionOverlay() {
  if (!game.limbo.transition) return;
  const progress = clamp(game.limbo.timer / TUNING.limboTransitionDuration, 0, 1);
  const alpha = game.limbo.transition === 'enter' ? progress : 1 - progress;
  ctx.save();
  ctx.fillStyle = `rgba(5, 2, 12, ${0.18 + alpha * 0.72})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = `rgba(255, 62, 104, ${0.08 + alpha * 0.22})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.75;
  ctx.font = '24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(game.limbo.transition === 'enter' ? 'Entering Limbo' : 'Returning to Exploration', VIEW.width / 2, VIEW.height / 2);
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

  drawPlayablePath();
  drawCorruptedArea(time);
  drawAnomalyZone(time);
  for (const root of level.roots) drawRootPlaceholder(root);
  for (const rock of level.rocks) drawRockPlaceholder(rock);
  for (const [x, y, size, color] of level.mushrooms) drawMushroomPlaceholder(x, y, size, color, time);
  for (const [x, y] of level.crystals) drawCrystalPlaceholder(x, y, time);
  for (const marker of level.pathMarkers) drawLevelMarker(marker);
  drawSeedPlaceholder(time);
  drawArenaPlaceholder(time);
}

function drawEntities(time) {
  if (!level.enemy.defeated) drawEnemyPlaceholder(time);
  drawPlayerPlaceholder();
  if (game.companion.creatureId) drawCompanionPlaceholder(time);
  for (const projectile of game.projectiles) drawGlowCircle(projectile.x, projectile.y, projectile.r * 2.3, projectile.color, 0.75);
  for (const effect of game.effects) drawGlowCircle(effect.x, effect.y, 4 + effect.life * 4, effect.color, effect.life);
}

function drawPlayablePath() {
  ctx.save();
  ctx.strokeStyle = 'rgba(104, 255, 241, 0.18)';
  ctx.lineWidth = 52;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(level.spawn.x, level.spawn.y);
  ctx.quadraticCurveTo(-250, 45, level.seed.x, level.seed.y);
  ctx.moveTo(level.spawn.x, level.spawn.y);
  ctx.quadraticCurveTo(230, 45, level.enemy.x, level.enemy.y);
  ctx.moveTo(level.spawn.x, level.spawn.y);
  ctx.quadraticCurveTo(20, 260, level.anomaly.x, level.anomaly.y);
  ctx.stroke();
  ctx.restore();
}

function drawCorruptedArea(time) {
  const area = level.corruption;
  drawGlowCircle(area.x, area.y, area.r + Math.sin(time * 3) * 8, '#ff3e68', 0.16);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 62, 104, 0.55)';
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 10]);
  ctx.lineDashOffset = -time * 32;
  ctx.beginPath();
  ctx.arc(area.x, area.y, area.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawAnomalyZone(time) {
  const anomaly = level.anomaly;
  const color = anomaly.stabilized ? '#65ffd6' : '#ff3e68';
  drawGlowCircle(anomaly.x, anomaly.y, anomaly.r + 14 * level.anomaly.intensity + Math.sin(time * 4) * 5, color, anomaly.stabilized ? 0.18 : 0.2);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = anomaly.stabilized ? 0.65 : 0.85;
  ctx.beginPath();
  ctx.arc(anomaly.x, anomaly.y, anomaly.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRootPlaceholder(root) {
  ctx.save();
  ctx.translate(root.x, root.y);
  ctx.rotate(root.angle);
  ctx.strokeStyle = '#31405f';
  ctx.lineWidth = root.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-root.length / 2, 0);
  ctx.bezierCurveTo(-root.length * 0.2, -26, root.length * 0.2, 26, root.length / 2, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(104, 255, 241, 0.18)';
  ctx.lineWidth = Math.max(3, root.width * 0.18);
  ctx.stroke();
  ctx.restore();
}

function drawRockPlaceholder(rock) {
  ctx.fillStyle = '#25334d';
  ctx.beginPath();
  ctx.ellipse(rock.x, rock.y, rock.rx, rock.ry, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(128, 255, 240, 0.12)';
  ctx.stroke();
}

function drawLevelMarker(marker) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 10, 20, 0.58)';
  ctx.strokeStyle = 'rgba(104, 255, 241, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(marker.x - 54, marker.y + 34, 108, 24, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#dffefa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(marker.label, marker.x, marker.y + 50);
  ctx.restore();
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
  const creature = getActiveCompanion();
  const glowColor = creature?.ability.color ?? '#f7ff9a';
  drawGlowCircle(game.companion.x, game.companion.y, 34 + Math.sin(time * 5) * 4, glowColor, 0.26);

  ctx.fillStyle = '#f7f0d0';
  ctx.beginPath();
  ctx.ellipse(game.companion.x, game.companion.y + 7, game.companion.r * 0.72, game.companion.r, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.ellipse(game.companion.x, game.companion.y - 5, game.companion.r * 1.35, game.companion.r * 0.7, Math.sin(time) * 0.15, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#17254a';
  ctx.beginPath();
  ctx.arc(game.companion.x - 4, game.companion.y + 4, 2.4, 0, Math.PI * 2);
  ctx.arc(game.companion.x + 5, game.companion.y + 4, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyPlaceholder(time) {
  const enemy = level.enemy;
  const enemyType = getEnemyType(enemy);
  const facing = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
  drawGlowCircle(enemy.x, enemy.y, 48 + Math.sin(time * 8) * 5, enemyType.color, enemy.active ? 0.32 : 0.2);

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(facing);

  ctx.fillStyle = enemy.active ? '#7d1731' : '#4a2431';
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.r * 1.45, enemy.r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemyType.color;
  ctx.beginPath();
  ctx.ellipse(enemy.r * 1.12, 0, enemy.r * 0.58, enemy.r * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ff6d8d';
  ctx.lineWidth = 4;
  for (let side of [-1, 1]) {
    for (let i = -1; i <= 1; i += 1) {
      const legX = -enemy.r * 0.35 + i * enemy.r * 0.5;
      ctx.beginPath();
      ctx.moveTo(legX, side * enemy.r * 0.45);
      ctx.lineTo(legX - enemy.r * 0.35, side * (enemy.r * 0.95 + Math.sin(time * 8 + i) * 3));
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#ffd2da';
  ctx.beginPath();
  ctx.arc(enemy.r * 1.42, -5, 3, 0, Math.PI * 2);
  ctx.arc(enemy.r * 1.42, 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (enemy.active) {
    const width = 92;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(enemy.x - width / 2, enemy.y - 58, width, 8);
    ctx.fillStyle = enemyType.color;
    ctx.fillRect(enemy.x - width / 2, enemy.y - 58, width * (enemy.hp / enemy.maxHp), 8);
    ctx.fillStyle = '#ffdce3';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(enemyType.name, enemy.x, enemy.y - 66);
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

function getEnemyType(enemy) {
  return EnemyTypes[enemy.enemyTypeId] ?? EnemyTypes.redRotStalker;
}

function getCreature(creatureId) {
  return CompanionCreatures[creatureId] ?? null;
}

function getActiveCompanion() {
  return getCreature(game.companion.creatureId);
}

function hasActiveCompanionAbilityTag(tag) {
  const creature = getActiveCompanion();
  return Boolean(creature?.ability?.[tag]);
}

resetGame();
requestAnimationFrame(frame);
