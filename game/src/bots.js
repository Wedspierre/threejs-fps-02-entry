// Bots: the other nine fighters of a 5v5. Each one walks a waypoint graph, holds
// positions, reacts to what it sees (a raycast line of sight) and hears (gunfire
// noise), and shoots back with aim that steadies the longer it stands still.
// Attackers carry the bomb to a site and plant it; defenders retake and defuse.
// A flash grenade blinds a bot: while blind it cannot see, shoot or route. One mover
// drives them, the same one as the player.
import * as THREE from 'three';
import { createMover } from './player.js';
import { findPath, nearestNode, SITES } from './world.js';

const BOT_HP = 100;
const BOT_SPEED = 4.2;
const BOT_DAMAGE = 14;
const BOT_BURST = 3;
const BOT_BURST_GAP = 0.13;
const BOT_BURST_PAUSE = 0.8;
const THINK_EVERY = 0.2;
const SEE_RANGE = 46;
const FOV_COS = 0.15; // ~81 degrees half-angle

const ALLY_NAMES = ['Kestrel', 'Vex', 'Rook', 'Juno'];
const ENEMY_NAMES = ['Ash', 'Cinder', 'Soot', 'Flint', 'Slag'];

function botColors(team) {
  return team === 'ember'
    ? { torso: '#2f6f66', legs: '#23282c', head: '#c9a37a', trim: '#3fb8a6' }
    : { torso: '#7a3a24', legs: '#2a2320', head: '#c9a37a', trim: '#e8a33d' };
}

export function createBot(scene, name, team) {
  const colors = botColors(team);
  const group = new THREE.Group();
  const torsoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.torso), roughness: 0.85 });
  const legsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.legs), roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.head), roughness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.trim), emissive: new THREE.Color(colors.trim), emissiveIntensity: 0.7, roughness: 0.5,
  });
  const gunMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d1f1c'), roughness: 0.45, metalness: 0.5 });
  const gunAccent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.trim), emissive: new THREE.Color(colors.trim), emissiveIntensity: 0.5, roughness: 0.5,
  });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.8, 0.22), legsMat);
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), torsoMat);
  torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), headMat);
  head.position.y = 1.6;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.05), trimMat);
  visor.position.set(0, 1.62, -0.15);
  // A rifle the eye can actually read: receiver, barrel, magazine and stock, held
  // across the body with the barrel past the torso, so a bot at range still reads
  // as an armed fighter and not a capsule dummy.
  const gun = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.44), gunMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.38);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.07), gunMat);
  mag.position.set(0, -0.14, -0.02);
  mag.rotation.x = 0.18;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.2), gunMat);
  stock.position.set(0, -0.01, 0.3);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.06), gunAccent);
  sight.position.set(0, 0.08, 0.02);
  gun.add(receiver, barrel, mag, stock, sight);
  gun.position.set(0.22, 1.18, -0.28);
  gun.rotation.x = 0.12;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.32), trimMat);
  stripe.position.y = 1.32;
  group.add(legs, torso, head, visor, gun, stripe);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
    }
  });
  scene.add(group);

  const bot = {
    kind: 'bot',
    name,
    team,
    group,
    hp: BOT_HP,
    alive: true,
    state: 'route',
    mover: null,
    path: [],
    pathIndex: 0,
    target: null,
    aimTime: 0,
    burstLeft: 0,
    fireTimer: 0,
    thinkTimer: Math.random() * THINK_EVERY,
    holdTimer: 0,
    holdNode: 0,
    patrolAt: 0,
    assignedSite: 'A',
    channel: 0,
    channelKind: null,
    lastHeard: null,
    strafeDir: 1,
    strafeTimer: 0,
    blindUntil: 0,
    hitMeshes: [],
  };
  head.userData = { fighter: bot, part: 'head' };
  torso.userData = { fighter: bot, part: 'body' };
  legs.userData = { fighter: bot, part: 'legs' };
  bot.hitMeshes = [head, torso, legs];
  return bot;
}

export function createBots(scene, colliders) {
  const bots = [];
  for (const name of ALLY_NAMES) {
    const bot = createBot(scene, name, 'ember');
    bot.mover = createMover(colliders, { walkSpeed: BOT_SPEED });
    bots.push(bot);
  }
  for (const name of ENEMY_NAMES) {
    const bot = createBot(scene, name, 'ashen');
    bot.mover = createMover(colliders, { walkSpeed: BOT_SPEED });
    bots.push(bot);
  }
  return bots;
}

function eyePos(bot, out) {
  out.set(bot.mover.state.position.x, bot.mover.state.position.y + bot.mover.state.eye, bot.mover.state.position.z);
  return out;
}

function chestPos(fighter, out) {
  if (fighter.kind === 'bot') {
    out.set(fighter.mover.state.position.x, fighter.mover.state.position.y + 1.15, fighter.mover.state.position.z);
  } else {
    out.set(fighter.state.position.x, fighter.state.position.y + 1.25, fighter.state.position.z);
  }
  return out;
}

// Step every bot for one fixed step. env is the live game context main.js hands in:
// fighters (player + bots), raycaster, worldShootables, noise, bomb, phase, now,
// callbacks.
export function stepBots(bots, dt, env) {
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (const bot of bots) {
    if (!bot.alive) continue;
    const mover = bot.mover;
    const pos = mover.state.position;
    bot.thinkTimer -= dt;

    // Blind: a flash grenade whites a bot out. It stands still, sees nothing and
    // fires nothing until its sight comes back — and its steadied aim is gone.
    if (env.now < bot.blindUntil) {
      bot.target = null;
      bot.channel = 0;
      bot.aimTime = 0;
      bot.burstLeft = 0;
      mover.move(dt, 0, 0, BOT_SPEED, false);
      bot.group.position.copy(pos);
      bot.group.rotation.y = mover.state.yaw;
      continue;
    }

    // --- Perception, every THINK_EVERY seconds: nearest visible enemy. Only live
    // rounds have combat; during the buy phase bots hold their spawn positions. ---
    if (bot.thinkTimer <= 0 && env.phase === 'live') {
      bot.thinkTimer = THINK_EVERY;
      bot.target = null;
      let bestD = Infinity;
      for (const fighter of env.fighters) {
        if (fighter === bot || fighter.team === bot.team || !fighter.alive) continue;
        chestPos(fighter, to);
        const d = Math.hypot(to.x - pos.x, to.z - pos.z);
        if (d > SEE_RANGE || d > bestD) continue;
        eyePos(bot, from);
        dir.copy(to).sub(from).normalize();
        const fwd = new THREE.Vector3(-Math.sin(mover.state.yaw), 0, -Math.cos(mover.state.yaw));
        if (dir.x * fwd.x + dir.z * fwd.z < FOV_COS && d > 6) continue;
        if (!env.hasLineOfSight(from, to)) continue;
        bot.target = fighter;
        bestD = d;
      }
      if (bot.target) bot.state = 'combat';
      else if (bot.state === 'combat') bot.state = 'route';
      // Hearing: a recent gunshot nearby pulls a patrolling bot toward it.
      if (!bot.target && env.noise.length > 0 && (bot.state === 'route' || bot.state === 'hold')) {
        for (const n of env.noise) {
          const d = Math.hypot(n.x - pos.x, n.z - pos.z);
          if (d < n.radius) {
            bot.lastHeard = { x: n.x, z: n.z };
            bot.state = 'route';
            bot.path = findPath(nearestNode(pos.x, pos.z), nearestNode(n.x, n.z));
            bot.pathIndex = 0;
            break;
          }
        }
      }
    }

    // --- Objective behaviour when nothing is in sight. Bots walk to their
    // positions in the buy phase too, so the squad is visibly moving out while
    // the player buys; combat, planting and defusing are live-only. ---
    if (!bot.target && (env.phase === 'live' || env.phase === 'buy')) {
      if (bot.team === 'ember') {
        if (env.bomb.state === 'carried' && env.bomb.carrier === bot) {
          bot.state = 'route';
          if (bot.path.length === 0 || bot.pathTarget !== bot.assignedSite) {
            bot.pathTarget = bot.assignedSite;
            bot.path = findPath(nearestNode(pos.x, pos.z), bot.assignedSite === 'A' ? 13 : 14);
            bot.pathIndex = 0;
          }
          const site = SITES[bot.assignedSite];
          if (Math.hypot(site.x - pos.x, site.z - pos.z) < site.r * 0.8) {
            bot.state = 'plant';
          }
        } else if (env.bomb.state === 'dropped') {
          bot.state = 'route';
          if (bot.pathTarget !== 'bomb') {
            bot.pathTarget = 'bomb';
            bot.path = findPath(nearestNode(pos.x, pos.z), nearestNode(env.bomb.x, env.bomb.z));
            bot.pathIndex = 0;
          }
          if (Math.hypot(env.bomb.x - pos.x, env.bomb.z - pos.z) < 1.4) env.onBombPickup(bot);
        } else if (env.bomb.state === 'planted') {
          bot.state = 'hold';
          if (bot.path.length === 0 || bot.pathTarget !== 'guard') {
            bot.pathTarget = 'guard';
            const guardNode = bot.assignedSite === 'A' ? 11 : 12;
            bot.path = findPath(nearestNode(pos.x, pos.z), guardNode);
            bot.pathIndex = 0;
          }
        } else if (bot.state !== 'hold' || bot.path.length === 0) {
          bot.state = 'route';
          if (bot.path.length === 0) {
            const goal = bot.assignedSite === 'A' ? 4 : 5;
            bot.path = findPath(nearestNode(pos.x, pos.z), goal);
            bot.pathIndex = 0;
          }
        }
      } else if (bot.team === 'ashen') {
        if (env.bomb.state === 'planted') {
          const d = Math.hypot(env.bomb.x - pos.x, env.bomb.z - pos.z);
          if (d < 1.6) {
            bot.state = 'defuse';
          } else {
            bot.state = 'route';
            if (bot.pathTarget !== 'defuse') {
              bot.pathTarget = 'defuse';
              bot.path = findPath(nearestNode(pos.x, pos.z), nearestNode(env.bomb.x, env.bomb.z));
              bot.pathIndex = 0;
            }
          }
        } else if (bot.state === 'hold') {
          bot.holdTimer -= dt;
          if (bot.holdTimer <= 0) {
            // Patrol between the hold node and its neighbour, then back.
            const other = bot.holdNode === 11 ? 15 : bot.holdNode === 12 ? 16 : bot.holdNode;
            const next = bot.patrolAt === bot.holdNode ? other : bot.holdNode;
            bot.patrolAt = next;
            bot.path = findPath(nearestNode(pos.x, pos.z), next);
            bot.pathIndex = 0;
            bot.state = 'route';
            bot.holdTimer = 4 + Math.random() * 4;
          }
        } else if (bot.state !== 'route' || bot.path.length === 0) {
          bot.state = 'route';
          if (bot.path.length === 0) {
            bot.path = findPath(nearestNode(pos.x, pos.z), bot.holdNode);
            bot.pathIndex = 0;
          }
        }
      }
    }

    // --- Plant / defuse channels: stand still in the zone and the timer runs. ---
    if (bot.state === 'plant' || bot.state === 'defuse') {
      const kind = bot.state;
      bot.channel += dt;
      const need = kind === 'plant' ? 3 : 5;
      env.onChannel(bot, kind, bot.channel / need);
      if (bot.channel >= need) {
        bot.channel = 0;
        if (kind === 'plant') env.onPlantComplete(bot);
        else env.onDefuseComplete(bot);
        bot.state = 'route';
        bot.path = [];
      }
      mover.move(dt, 0, 0, BOT_SPEED, false);
    } else if (bot.target) {
      // --- Combat: face the target, keep a fighting distance, fire in bursts. ---
      bot.channel = 0;
      chestPos(bot.target, to);
      eyePos(bot, from);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const dist = Math.hypot(dx, dz);
      mover.state.yaw = Math.atan2(-dx, -dz);
      bot.aimTime += dt;
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
        bot.strafeTimer = 0.5 + Math.random() * 0.9;
      }
      let wishX = 0;
      let wishZ = 0;
      const fwdX = -Math.sin(mover.state.yaw);
      const fwdZ = -Math.cos(mover.state.yaw);
      if (dist > 22) {
        wishX = fwdX;
        wishZ = fwdZ;
      } else if (dist < 6) {
        wishX = -fwdX;
        wishZ = -fwdZ;
      }
      // Strafe perpendicular to the target.
      wishX += -fwdZ * bot.strafeDir * 0.7;
      wishZ += fwdX * bot.strafeDir * 0.7;
      const len = Math.hypot(wishX, wishZ) || 1;
      mover.move(dt, wishX / len, wishZ / len, BOT_SPEED * 0.55, false);

      bot.fireTimer -= dt;
      if (bot.fireTimer <= 0) {
        if (bot.burstLeft <= 0) {
          bot.burstLeft = BOT_BURST;
          bot.fireTimer = BOT_BURST_PAUSE;
        } else {
          bot.burstLeft -= 1;
          bot.fireTimer = BOT_BURST_GAP;
          // Aim error: wide while moving, tight after standing and aiming.
          const speed = mover.groundSpeed();
          const error = 0.02 + Math.min(1, speed / 5) * 0.09 + Math.max(0, 0.09 - bot.aimTime * 0.12);
          dir.set(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
          dir.x += (Math.random() * 2 - 1) * error;
          dir.y += (Math.random() * 2 - 1) * error;
          dir.z += (Math.random() * 2 - 1) * error;
          dir.normalize();
          env.botShoot(bot, from, dir, BOT_DAMAGE);
        }
      }
    } else if (bot.state === 'route' && bot.path.length > 0) {
      // --- Route: walk the waypoint list, one node at a time. ---
      bot.channel = 0;
      const wp = bot.path[bot.pathIndex];
      const dx = wp.x - pos.x;
      const dz = wp.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.7) {
        bot.pathIndex += 1;
        if (bot.pathIndex >= bot.path.length) {
          bot.path = [];
          bot.pathTarget = null;
          if (bot.team === 'ashen' && env.bomb.state !== 'planted') {
            bot.state = 'hold';
            bot.holdTimer = 4 + Math.random() * 4;
          } else {
            bot.state = 'hold';
            bot.holdTimer = 2 + Math.random() * 3;
          }
        }
      } else {
        mover.state.yaw = Math.atan2(-dx, -dz);
        mover.move(dt, dx / dist, dz / dist, BOT_SPEED, false);
      }
    } else {
      // Holding a position: scan slowly, stay put.
      bot.channel = 0;
      mover.state.yaw += dt * 0.35;
      mover.move(dt, 0, 0, BOT_SPEED, false);
    }

    // Keep the mesh on the mover.
    bot.group.position.copy(pos);
    bot.group.rotation.y = mover.state.yaw;
  }
}

export function resetBot(bot, spawn, team, site) {
  bot.mover.teleport(spawn.x, spawn.z, spawn.yaw);
  bot.hp = BOT_HP;
  bot.alive = true;
  bot.team = team;
  bot.state = 'route';
  bot.path = [];
  bot.pathIndex = 0;
  bot.pathTarget = null;
  bot.target = null;
  bot.aimTime = 0;
  bot.burstLeft = 0;
  bot.fireTimer = 0;
  bot.channel = 0;
  bot.channelKind = null;
  bot.lastHeard = null;
  bot.assignedSite = site;
  bot.holdNode = team === 'ashen' ? (site === 'A' ? 11 : 12) : 0;
  bot.patrolAt = bot.holdNode;
  bot.blindUntil = 0;
  bot.group.visible = true;
  bot.group.rotation.set(0, spawn.yaw, 0);
  bot.group.position.set(spawn.x, 0, spawn.z);
}

export function killBot(bot) {
  bot.alive = false;
  bot.target = null;
  bot.group.rotation.set(-Math.PI / 2, bot.group.rotation.y, 0);
  bot.group.position.y = 0.15;
}
