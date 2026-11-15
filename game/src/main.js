// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the display's rate.
// ?shot=start|mid|plant|end with &seed=N sets up a deterministic frame for a capture,
// renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES, ATTACKER_SPAWNS, DEFENDER_SPAWNS } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeaponView, WEAPONS, GRENADE_PRICE, createGrenades } from './weapons.js';
import { createBots, stepBots, resetBot, killBot } from './bots.js';
import {
  createMatch, startMatch, startRound, beginLive, roundOutcome, endRound, nextRound,
  BUY_SECONDS, BOMB_SECONDS,
} from './rounds.js';
import { createHud } from './hud.js';
import { sfx } from './audio.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 28, 95);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const hud = createHud(world);
const player = createPlayer(world.colliders);
const weaponView = createWeaponView(camera);
const grenades = createGrenades(scene, world.colliders);
const bots = createBots(scene, world.colliders);
const match = createMatch();
const input = createInput(renderer.domElement, onLockChange);
const shootRay = new THREE.Raycaster();
shootRay.far = 120;
const losRay = new THREE.Raycaster();
losRay.far = 60;

// The player as a fighter, so bots and bullets treat it like any other combatant.
const playerFighter = {
  kind: 'player', name: 'You', team: 'ember', state: player.state, alive: true, hp: 100,
};
const fighters = [playerFighter, ...bots];
const noise = [];

// --- Tracers: a fixed pool of lines, reused, never allocated per shot. ---
const tracers = [];
for (let i = 0; i < 24; i += 1) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  line.frustumCulled = false;
  scene.add(line);
  tracers.push({ line, life: 0 });
}
function spawnTracer(a, b) {
  const slot = tracers.find((t) => t.life <= 0) ?? tracers[0];
  const attr = slot.line.geometry.getAttribute('position');
  attr.setXYZ(0, a.x, a.y, a.z);
  attr.setXYZ(1, b.x, b.y, b.z);
  attr.needsUpdate = true;
  slot.line.visible = true;
  slot.life = 0.09;
}

// --- Explosion flash + debris: one light, one Points cloud, reused. ---
const explosionLight = new THREE.PointLight(new THREE.Color('#ff7a1a'), 0, 22, 1.6);
scene.add(explosionLight);
const PARTICLE_COUNT = 48;
const particleGeo = new THREE.BufferGeometry();
const particlePos = new Float32Array(PARTICLE_COUNT * 3);
const particleVel = new Float32Array(PARTICLE_COUNT * 3);
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
const particleMat = new THREE.PointsMaterial({ color: 0xffa040, size: 0.14, transparent: true, opacity: 0 });
const particles = new THREE.Points(particleGeo, particleMat);
particles.frustumCulled = false;
scene.add(particles);
let particleLife = 0;

function explode(at) {
  explosionLight.position.copy(at);
  explosionLight.intensity = 90;
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    particlePos[i * 3] = at.x;
    particlePos[i * 3 + 1] = at.y;
    particlePos[i * 3 + 2] = at.z;
    const a = random() * Math.PI * 2;
    const up = random() * 6 + 2;
    particleVel[i * 3] = Math.cos(a) * (2 + random() * 5);
    particleVel[i * 3 + 1] = up;
    particleVel[i * 3 + 2] = Math.sin(a) * (2 + random() * 5);
  }
  particleGeo.getAttribute('position').needsUpdate = true;
  particleLife = 0.8;
  sfx.explosion();
  for (const fighter of fighters) {
    if (!fighter.alive) continue;
    const fx = fighter.kind === 'bot' ? fighter.mover.state.position : fighter.state.position;
    const d = Math.hypot(fx.x - at.x, fx.z - at.z) + Math.abs((fighter.kind === 'bot' ? 1 : 1) - at.y) * 0.4;
    if (d < 6) damageFighter(fighter, Math.max(15, Math.round(110 - d * 15)), null, 'body');
  }
}

// --- The bomb: a small charge with a blinking light, carried, dropped or planted. ---
const bombGroup = new THREE.Group();
const bombMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.34, 0.18, 0.24),
  new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2f26'), roughness: 0.5, metalness: 0.6 }),
);
const bombLight = new THREE.PointLight(new THREE.Color('#ff3b1f'), 0, 6, 1.6);
const bombDot = new THREE.Mesh(
  new THREE.BoxGeometry(0.08, 0.05, 0.08),
  new THREE.MeshStandardMaterial({ color: new THREE.Color('#ff3b1f'), emissive: new THREE.Color('#ff3b1f'), emissiveIntensity: 2 }),
);
bombDot.position.y = 0.12;
bombGroup.add(bombMesh, bombDot, bombLight);
bombGroup.visible = false;
scene.add(bombGroup);

const body = player.state;
let ownedPrimary = 'rifle';
let grenadeCount = 0;
let started = false;
let frozen = false;
let elapsed = 0;
let accumulator = 0;
let lastTime = performance.now();
let prevFiring = false;
let minimapTimer = 0;
let beepTimer = 0;
let plantProgress = 0;
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

// Reused across shots: the raycast list is rebuilt, never reallocated.
const shootableList = [];
function shootables() {
  shootableList.length = 0;
  shootableList.push(...world.shootables);
  for (const fighter of fighters) {
    if (fighter.kind === 'bot' && fighter.alive) shootableList.push(...fighter.hitMeshes);
  }
  return shootableList;
}

function hasLineOfSight(from, to) {
  tmpDir.copy(to).sub(from);
  const dist = tmpDir.length();
  if (dist < 0.01) return true;
  losRay.set(from, tmpDir.normalize());
  losRay.far = dist;
  return losRay.intersectObjects(world.shootables, false).length === 0;
}

function damageFighter(target, amount, attacker, part) {
  if (!target.alive) return;
  target.hp -= amount;
  if (target.kind === 'player') {
    hud.damageFlash();
    sfx.hurt();
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      match.deaths += 1;
      hud.showMessage('You are down — your squad fights on', 3000);
      if (match.bomb.carrier === 'player') {
        match.bomb.state = 'dropped';
        match.bomb.carrier = null;
        match.bomb.x = body.position.x;
        match.bomb.z = body.position.z;
        hud.killfeed('Charge dropped');
      }
    }
    return;
  }
  if (target.hp <= 0) {
    target.hp = 0;
    killBot(target);
    const byPlayer = attacker === playerFighter;
    hud.killfeed(`${byPlayer ? 'You' : attacker?.name ?? '?'} ▸ ${target.name} [${attacker === playerFighter ? weaponView.state.def.name : 'VK-7'}]`);
    if (byPlayer) {
      match.kills += 1;
      match.money += 300;
      sfx.kill();
    }
    if (match.bomb.carrier === target) {
      match.bomb.state = 'dropped';
      match.bomb.carrier = null;
      match.bomb.x = target.mover.state.position.x;
      match.bomb.z = target.mover.state.position.z;
      hud.killfeed('Charge dropped');
    }
  }
}

function playerShoot() {
  const def = weaponView.state.def;
  if (!weaponView.takeRound()) {
    sfx.dryClick();
    weaponView.reload();
    return;
  }
  camera.getWorldDirection(tmpDir);
  const spread = weaponView.spread(player.groundSpeed());
  tmpDir.x += (random() * 2 - 1) * spread;
  tmpDir.y += (random() * 2 - 1) * spread;
  tmpDir.z += (random() * 2 - 1) * spread;
  tmpDir.normalize();
  scene.updateMatrixWorld(true);
  shootRay.set(camera.position, tmpDir);
  const hits = shootRay.intersectObjects(shootables(), false);
  const hit = hits[0];
  const end = hit ? hit.point : tmpC.copy(camera.position).addScaledVector(tmpDir, 90);
  tmpA.copy(camera.position).addScaledVector(tmpDir, 0.6);
  spawnTracer(tmpA, end);
  noise.push({ x: body.position.x, z: body.position.z, radius: 26 });
  sfx.shot(def.kind);
  weaponView.pullTrigger();
  player.recoil(def.recoil + random() * 0.004, (random() * 2 - 1) * 0.004);
  if (hit && hit.object.userData.fighter) {
    const target = hit.object.userData.fighter;
    const part = hit.object.userData.part;
    const dmg = Math.round(def.damage * (part === 'head' ? def.headMult : 1));
    const wasAlive = target.alive;
    damageFighter(target, dmg, playerFighter, part);
    if (wasAlive) {
      hud.hitMarker(!target.alive, target.alive ? 90 : 4000);
      if (target.alive) sfx.hit();
    }
  }
  hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, def.name);
}

function botShoot(bot, from, dir, damage) {
  shootRay.set(from, dir);
  const hits = shootRay.intersectObjects(shootables(), false);
  const hit = hits[0];
  const end = hit ? hit.point : tmpC.copy(from).addScaledVector(dir, 60);
  tmpA.copy(from).addScaledVector(dir, 0.7);
  spawnTracer(tmpA, end);
  noise.push({ x: bot.mover.state.position.x, z: bot.mover.state.position.z, radius: 22 });
  sfx.shot('rifle');
  if (hit && hit.object.userData.fighter) {
    const target = hit.object.userData.fighter;
    const part = hit.object.userData.part;
    damageFighter(target, Math.round(damage * (part === 'head' ? 2 : 1)), bot, part);
  }
}

function resetPositions() {
  player.teleport(ATTACKER_SPAWNS[0].x, ATTACKER_SPAWNS[0].z, ATTACKER_SPAWNS[0].yaw);
  playerFighter.hp = 100;
  playerFighter.alive = true;
  const site = match.round % 2 === 1 ? 'A' : 'B';
  const other = site === 'A' ? 'B' : 'A';
  const allies = bots.filter((b) => b.team === 'ember');
  const enemies = bots.filter((b) => b.team === 'ashen');
  resetBot(allies[0], ATTACKER_SPAWNS[1], 'ember', site);
  resetBot(allies[1], ATTACKER_SPAWNS[2], 'ember', other);
  resetBot(enemies[0], DEFENDER_SPAWNS[0], 'ashen', site);
  resetBot(enemies[1], DEFENDER_SPAWNS[1], 'ashen', other);
  resetBot(enemies[2], DEFENDER_SPAWNS[2], 'ashen', site);
  resetBot(enemies[3], DEFENDER_SPAWNS[3], 'ashen', other);
  grenades.clear();
  grenadeCount = 0;
  plantProgress = 0;
  match.bomb.state = 'carried';
  match.bomb.carrier = 'player';
  match.bomb.site = null;
  match.bomb.timer = BOMB_SECONDS;
  weaponView.equip(ownedPrimary);
  weaponView.refill();
  hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, weaponView.state.def.name);
  hud.setHealth(100);
  hud.hidePlant();
}

function startNewMatch() {
  startMatch(match);
  ownedPrimary = 'rifle';
  resetPositions();
  hud.setScore(0, 0);
  hud.setMoney(match.money);
  hud.showBuy(match.money, ownedPrimary);
  hud.showMessage('Round 1 — Buy phase. B opens the buy menu.', 4000);
}

function buy(id) {
  if (match.phase !== 'buy') return;
  if (id === 'grenade') {
    if (grenadeCount >= 2 || match.money < GRENADE_PRICE) return;
    match.money -= GRENADE_PRICE;
    grenadeCount += 1;
    hud.setGrenades(grenadeCount);
    hud.setMoney(match.money);
    hud.showBuy(match.money, ownedPrimary);
    return;
  }
  const def = WEAPONS[id];
  if (!def || match.money < def.price) return;
  if (ownedPrimary === id) {
    weaponView.restock(id);
  } else {
    match.money -= def.price;
    ownedPrimary = id;
    weaponView.equip(id);
    weaponView.refill();
  }
  hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, def.name);
  hud.setMoney(match.money);
  hud.showBuy(match.money, ownedPrimary);
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else if (started && (match.phase === 'live' || match.phase === 'buy')) {
    hud.showOverlay('paused');
  }
}

hud.onPlay(() => {
  if (shot) return;
  if (match.phase === 'menu' || match.phase === 'matchEnd') {
    startNewMatch();
    input.requestLock();
  } else if (match.phase === 'roundEnd') {
    if (nextRound(match)) {
      resetPositions();
      hud.showBuy(match.money, ownedPrimary);
      hud.showMessage(`Round ${match.round} — Buy phase`, 3000);
    } else {
      hud.showOverlay('matchEnd', match.matchWinner === 'ember'
        ? `Emberline takes the yard ${match.scoreEmber}–${match.scoreAshen}.`
        : `The Ashen crew takes the yard ${match.scoreAshen}–${match.scoreEmber}.`);
      if (document.pointerLockElement) document.exitPointerLock();
      return;
    }
    input.requestLock();
  } else {
    input.requestLock();
  }
});

function syncCamera() {
  const eye = playerFighter.alive ? body.eye : 0.6;
  camera.position.set(body.position.x, body.position.y + eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function step(dt) {
  elapsed += dt;
  const phase = match.phase;

  if (phase === 'buy') {
    match.phaseTime -= dt;
    if (match.phaseTime <= 0) {
      beginLive(match);
      hud.hideBuy();
      hud.showMessage('Go — plant the charge at A or B', 2600);
    }
  } else if (phase === 'live') {
    match.phaseTime -= dt;
    if (match.bomb.state === 'planted') {
      match.bomb.timer -= dt;
      beepTimer -= dt;
      if (beepTimer <= 0) {
        sfx.beep(match.bomb.timer < 10);
        beepTimer = match.bomb.timer < 10 ? 0.45 : 1;
      }
    }
    // Player plants the charge: hold E inside a site while carrying it.
    if (playerFighter.alive && match.bomb.carrier === 'player') {
      const site = Object.entries(SITES).find(([, s]) => Math.hypot(s.x - body.position.x, s.z - body.position.z) < s.r);
      if (site && input.state.keys.has('KeyE')) {
        plantProgress += dt;
        hud.showPlant('PLANTING CHARGE', plantProgress / 3);
        if (plantProgress >= 3) {
          plantProgress = 0;
          hud.hidePlant();
          match.bomb.state = 'planted';
          match.bomb.site = site[0];
          match.bomb.x = site[1].x;
          match.bomb.z = site[1].z;
          match.bomb.timer = BOMB_SECONDS;
          match.money += 300;
          sfx.plant();
          hud.showBanner(`Charge planted at ${site[0]} — ${BOMB_SECONDS} seconds`, 3400);
          hud.killfeed(`You planted the charge at ${site[0]}`);
        }
      } else {
        plantProgress = Math.max(0, plantProgress - dt * 2);
        if (plantProgress <= 0) hud.hidePlant();
      }
    }
    // Pick up a dropped charge by walking over it.
    if (playerFighter.alive && match.bomb.state === 'dropped'
      && Math.hypot(match.bomb.x - body.position.x, match.bomb.z - body.position.z) < 1.4) {
      match.bomb.state = 'carried';
      match.bomb.carrier = 'player';
      hud.showMessage('Charge recovered', 2000);
    }
    // Round end checks.
    const emberAlive = fighters.some((f) => f.team === 'ember' && f.alive);
    const ashenAlive = fighters.some((f) => f.team === 'ashen' && f.alive);
    const [winner, reason] = roundOutcome(match, emberAlive, ashenAlive);
    if (winner) {
      endRound(match, winner, reason);
      hud.showBanner(`${winner === 'ember' ? 'Emberline' : 'Ashen crew'} takes round ${match.round} — ${reason}`, 3800);
      if (winner === 'ember') sfx.roundWin();
      else sfx.roundLose();
      if (document.pointerLockElement) document.exitPointerLock();
      hud.showOverlay('roundEnd', `${reason}. Score Emberline ${match.scoreEmber} — ${match.scoreAshen} Ashen.`);
    }
  } else if (phase === 'roundEnd') {
    match.phaseTime -= dt;
    if (match.phaseTime <= 0 && !shot) {
      if (nextRound(match)) {
        resetPositions();
        hud.showBuy(match.money, ownedPrimary);
        hud.showMessage(`Round ${match.round} — Buy phase`, 3000);
        input.requestLock();
      } else {
        hud.showOverlay('matchEnd', match.matchWinner === 'ember'
          ? `Emberline takes the yard ${match.scoreEmber}–${match.scoreAshen}.`
          : `The Ashen crew takes the yard ${match.scoreAshen}–${match.scoreEmber}.`);
      }
    }
  }

  // Player movement and firing, only while a round is actually running.
  if ((phase === 'live' || phase === 'buy') && playerFighter.alive) {
    player.step(dt, input.state.keys);
  }
  if (phase === 'live' || phase === 'buy') weaponView.step(dt);

  // Bots run in buy (walking to positions) and live.
  if (phase === 'live' || phase === 'buy') {
    stepBots(bots, dt, {
      fighters,
      phase,
      noise,
      bomb: match.bomb,
      hasLineOfSight,
      botShoot,
      onBombPickup(bot) {
        match.bomb.state = 'carried';
        match.bomb.carrier = bot;
        hud.killfeed(`${bot.name} picked up the charge`);
      },
      onChannel(bot, kind, progress) {
        if (kind === 'plant') hud.showPlant(`${bot.name.toUpperCase()} PLANTING`, progress);
        else hud.showPlant(`${bot.name.toUpperCase()} DEFUSING`, progress);
        if (progress <= 0) hud.hidePlant();
      },
      onPlantComplete(bot) {
        const site = bot.assignedSite;
        match.bomb.state = 'planted';
        match.bomb.site = site;
        match.bomb.x = SITES[site].x;
        match.bomb.z = SITES[site].z;
        match.bomb.timer = BOMB_SECONDS;
        sfx.plant();
        hud.showBanner(`Charge planted at ${site} — ${BOMB_SECONDS} seconds`, 3400);
        hud.killfeed(`${bot.name} planted the charge at ${site}`);
        hud.hidePlant();
      },
      onDefuseComplete(bot) {
        hud.hidePlant();
        endRound(match, 'ashen', `${bot.name} defused the charge`);
        hud.showBanner(`Ashen crew takes round ${match.round} — charge defused`, 3800);
        sfx.roundLose();
        if (document.pointerLockElement) document.exitPointerLock();
        hud.showOverlay('roundEnd', `Charge defused. Score Emberline ${match.scoreEmber} — ${match.scoreAshen} Ashen.`);
      },
    });
  }

  grenades.step(dt, (pos) => explode(pos));

  // Bomb mesh follows its state.
  if (match.bomb.state === 'dropped') {
    bombGroup.visible = true;
    bombGroup.position.set(match.bomb.x, 0.12, match.bomb.z);
    bombLight.intensity = 1.5;
  } else if (match.bomb.state === 'planted') {
    bombGroup.visible = true;
    bombGroup.position.set(match.bomb.x, 0.12, match.bomb.z);
    bombLight.intensity = 2 + Math.sin(elapsed * 8) * 1.5;
  } else {
    bombGroup.visible = false;
    bombLight.intensity = 0;
  }

  noise.length = 0;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (playerFighter.alive) player.look(look.x, look.y);
    const pressed = input.takePressed();
    if (!shot) {
      if (match.phase === 'buy' && !hudBuyHidden()) {
        if (pressed.has('Digit1')) buy('rifle');
        if (pressed.has('Digit2')) buy('smg');
        if (pressed.has('Digit3')) buy('dmr');
        if (pressed.has('Digit4')) buy('grenade');
      } else if (match.phase === 'live' || match.phase === 'buy') {
        if (pressed.has('Digit1')) {
          weaponView.equip(ownedPrimary);
          hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, weaponView.state.def.name);
        }
        if (pressed.has('Digit2')) {
          weaponView.equip('pistol');
          hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, weaponView.state.def.name);
        }
        if (pressed.has('KeyQ')) {
          weaponView.equip(weaponView.state.def.id === 'pistol' ? ownedPrimary : 'pistol');
          hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, weaponView.state.def.name);
        }
        if (pressed.has('KeyG') && grenadeCount > 0 && playerFighter.alive) {
          grenadeCount -= 1;
          hud.setGrenades(grenadeCount);
          camera.getWorldDirection(tmpDir);
          tmpA.copy(camera.position).addScaledVector(tmpDir, 0.5);
          grenades.throwGrenade(tmpA, tmpDir);
          sfx.shot('pistol');
        }
        if (pressed.has('KeyR')) {
          const before = weaponView.state.reloadLeft;
          weaponView.reload();
          if (weaponView.state.reloadLeft > 0 && before === 0) sfx.reload();
        }
      }
      if (pressed.has('KeyB') && match.phase === 'buy') {
        if (hudBuyHidden()) hud.showBuy(match.money, ownedPrimary);
        else hud.hideBuy();
      }
      if (input.state.firing && playerFighter.alive && (match.phase === 'live' || match.phase === 'buy')) {
        const def = weaponView.state.def;
        if (weaponView.ready() && (def.auto || !prevFiring)) playerShoot();
      }
      prevFiring = input.state.firing;
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  // Per-frame visuals: tracers fade, explosion light decays, debris falls.
  for (const t of tracers) {
    if (t.life > 0) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.85;
      if (t.life <= 0) t.line.visible = false;
    }
  }
  explosionLight.intensity = Math.max(0, explosionLight.intensity - dt * 160);
  if (particleLife > 0) {
    particleLife -= dt;
    const pos = particleGeo.getAttribute('position');
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      particleVel[i * 3 + 1] -= 9 * dt;
      pos.array[i * 3] += particleVel[i * 3] * dt;
      pos.array[i * 3 + 1] += particleVel[i * 3 + 1] * dt;
      pos.array[i * 3 + 2] += particleVel[i * 3 + 2] * dt;
      if (pos.array[i * 3 + 1] < 0.05) pos.array[i * 3 + 1] = 0.05;
    }
    pos.needsUpdate = true;
    particleMat.opacity = Math.max(0, particleLife / 0.8);
  }
  // HUD numbers, every frame; minimap at ~5 Hz.
  syncHud();
  minimapTimer -= dt;
  if (minimapTimer <= 0) {
    minimapTimer = 0.2;
    hud.drawMinimap(player, bots, match.bomb);
  }
  renderer.render(scene, camera);
}

// One place that pushes the whole HUD state, used by the frame loop and by captures.
function syncHud() {
  hud.setHealth(playerFighter.hp);
  hud.setMoney(match.money);
  hud.setScore(match.scoreEmber, match.scoreAshen);
  hud.setSpread(weaponView.spread(player.groundSpeed()));
  if (match.phase === 'buy') hud.setTimer(match.phaseTime, `R${match.round} BUY`);
  else if (match.phase === 'live') hud.setTimer(match.phaseTime, `R${match.round}`);
  else if (match.phase === 'menu') hud.setTimer(100, `R${match.round}`);
  else hud.setTimer(0, `R${match.round}`);
  hud.setBombStatus(
    match.bomb.state === 'carried' && match.bomb.carrier === 'player' ? 'CHARGE: WITH YOU'
      : match.bomb.state === 'carried' ? `CHARGE: ${match.bomb.carrier?.name?.toUpperCase() ?? 'WITH YOU'}`
        : match.bomb.state === 'planted' ? `CHARGE PLANTED ${match.bomb.site} — ${Math.max(0, Math.ceil(match.bomb.timer))}s`
          : match.bomb.state === 'dropped' ? 'CHARGE: DROPPED'
            : 'CHARGE: —',
  );
}

function hudBuyHidden() {
  return document.getElementById('buy-menu').hidden;
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuy();
  hud.hideMessage();
  hud.hideBanner();
  if (name === 'start') {
    resetPositions();
    body.position.set(0, 0, 14);
    body.yaw = 0;
    body.pitch = 0;
    syncCamera();
    hud.showOverlay('start');
    paintTwiceThenReady();
    return;
  }
  startNewMatch();
  hud.hideBuy();
  beginLive(match);
  resetPositions();
  if (name === 'mid') {
    body.position.set(-2, 0, 6);
    body.yaw = 0.25;
    body.pitch = 0;
    settle(170);
    // Stage the fight: one enemy in the open lane ahead, an ally on the right
    // edge, so the frame shows a firefight instead of an empty corridor.
    const staged = bots.find((b) => b.team === 'ashen' && b.alive);
    if (staged) staged.mover.teleport(-6, -2, Math.PI * 0.9);
    const ally = bots.find((b) => b.team === 'ember' && b.alive);
    if (ally) ally.mover.teleport(0.5, 1.5, -0.4);
    // Aim at the nearest living enemy and fire three times, two fixed steps
    // apart: the last tracer and muzzle flash are still lit when the frame
    // is captured.
    let best = null;
    let bestD = Infinity;
    for (const bot of bots) {
      if (!bot.alive || bot.team === 'ember') continue;
      const d = Math.hypot(bot.mover.state.position.x - body.position.x, bot.mover.state.position.z - body.position.z);
      if (d < bestD) {
        bestD = d;
        best = bot;
      }
    }
    if (best) {
      tmpA.set(best.mover.state.position.x, 1.3, best.mover.state.position.z);
      aimAt(tmpA);
      playerShoot();
      settle(2);
      playerShoot();
      settle(2);
      playerShoot();
      settle(2);
    }
    settle(2);
  } else if (name === 'plant') {
    match.bomb.state = 'planted';
    match.bomb.site = 'A';
    match.bomb.x = SITES.A.x;
    match.bomb.z = SITES.A.z;
    match.bomb.timer = 28;
    // West lane down to Site A: a clear sightline past the containers. The
    // defender stands in the open lane, clear of the teal container's footprint.
    body.position.set(-17, 0, -3.5);
    settle(90);
    const enemy = bots.find((b) => b.team === 'ashen' && b.alive);
    if (enemy) enemy.mover.teleport(-15.5, -7, Math.PI * 0.75);
    tmpA.set(SITES.A.x, 1.2, SITES.A.z);
    aimAt(tmpA);
    settle(6);
  } else if (name === 'end') {
    endRound(match, 'ember', 'Site A secured — charge detonated');
    body.position.set(-14, 0, -7);
    settle(20);
    tmpA.set(SITES.A.x, 1.4, SITES.A.z);
    aimAt(tmpA);
    hud.showOverlay('roundEnd', `Site A secured — charge detonated. Score Emberline ${match.scoreEmber} — ${match.scoreAshen} Ashen.`);
  }
  hud.setScore(match.scoreEmber, match.scoreAshen);
  hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, weaponView.state.def.name);
  hud.setHealth(playerFighter.hp);
  hud.setMoney(match.money);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  // Captures never run the frame loop, so push the HUD and minimap once here.
  syncHud();
  hud.drawMinimap(player, bots, match.bomb);
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, weaponView.state.def.name);
hud.setHealth(100);
hud.setMoney(match.money);
hud.setGrenades(0);
hud.setScore(0, 0);
// Read-only handle for debugging and automated play-tests.
window.__emberline = { match, player: playerFighter, bots, weapon: weaponView };
if (shot) runShot(shot);
else requestAnimationFrame(frame);
