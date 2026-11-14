// Weapons: four guns and one grenade, each with its own numbers. Accuracy is the game:
// spread grows with movement and with sustained fire, recoil kicks the aim up, and the
// DMR punishes a miss harder than the SMG forgives one. The view model is boxes on the
// camera; the grenade is a real projectile with gravity, bounce and a blast radius.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P-9 Sidewinder', price: 0, kind: 'pistol',
    mag: 12, reserve: 36, damage: 24, headMult: 3, gap: 0.16, reload: 1.3,
    spreadStill: 0.004, spreadMove: 0.02, recoil: 0.008, auto: false,
  },
  rifle: {
    id: 'rifle', name: 'VK-7 Carbine', price: 2700, kind: 'rifle',
    mag: 30, reserve: 90, damage: 33, headMult: 4, gap: 0.11, reload: 2.0,
    spreadStill: 0.0022, spreadMove: 0.028, recoil: 0.011, auto: true,
  },
  smg: {
    id: 'smg', name: 'Moth-9', price: 1500, kind: 'smg',
    mag: 32, reserve: 96, damage: 22, headMult: 3, gap: 0.07, reload: 1.6,
    spreadStill: 0.006, spreadMove: 0.034, recoil: 0.007, auto: true,
  },
  dmr: {
    id: 'dmr', name: 'Longshot DMR', price: 4750, kind: 'dmr',
    mag: 10, reserve: 30, damage: 78, headMult: 3, gap: 0.5, reload: 2.8,
    spreadStill: 0.0009, spreadMove: 0.05, recoil: 0.03, auto: false,
  },
};

export const GRENADE_PRICE = 300;
const MOVE_REFERENCE = 5.2;

function buildViewModel(def) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.3 });
  const model = new THREE.Group();
  const scale = def.kind === 'pistol' ? 0.7 : def.kind === 'dmr' ? 1.25 : 1;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09 * scale, 0.1, 0.42 * scale), body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4 * scale), grip);
  barrel.position.set(0, 0.025, -0.38 * scale);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22 * scale), grip);
  stock.position.set(0, -0.02, 0.3 * scale);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), accent);
  sight.position.set(0, 0.07, -0.05);
  model.add(receiver, barrel, stock, sight);
  if (def.kind === 'dmr') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), grip);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.1, 0.05);
    model.add(scope);
  }
  if (def.kind === 'smg') {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.07), grip);
    mag.position.set(0, -0.14, -0.05);
    model.add(mag);
  }
  model.position.set(0.22, -0.22, -0.5);
  model.scale.setScalar(0.72);
  return model;
}

export function createWeaponView(camera) {
  const models = {};
  for (const def of Object.values(WEAPONS)) {
    models[def.id] = buildViewModel(def);
    models[def.id].visible = false;
    camera.add(models[def.id]);
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.22, -0.2, -1.0);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.22, -0.18, -0.65);
  camera.add(flashLight);

  const state = {
    def: WEAPONS.pistol,
    mag: WEAPONS.pistol.mag,
    reserve: WEAPONS.pistol.reserve,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    bloom: 0,
  };
  models.pistol.visible = true;

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.bloom = Math.max(0, state.bloom - dt * 0.05);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.def.id];
    model.position.z = -0.5 + state.kick;
    model.rotation.x = state.kick * 2.2;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (state.def.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = state.def.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
  }

  return {
    state,
    step,
    equip(id) {
      const def = WEAPONS[id];
      if (!def || def.id === state.def.id) return false;
      models[state.def.id].visible = false;
      state.def = def;
      state.mag = def.mag;
      state.reserve = def.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.bloom = 0;
      models[def.id].visible = true;
      return true;
    },
    // Buying a gun the player already owns only tops the reserve up.
    restock(id) {
      const def = WEAPONS[id];
      if (!def) return;
      if (def.id === state.def.id) state.reserve = def.reserve;
    },
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = state.def.gap;
      state.flash = 0.06;
      state.kick = 0.055;
      state.bloom = Math.min(0.05, state.bloom + 0.006);
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || state.mag === state.def.mag || state.reserve === 0) return;
      state.reloadLeft = state.def.reload;
    },
    spread(speed) {
      const moving = Math.min(1, speed / MOVE_REFERENCE);
      return state.def.spreadStill + moving * state.def.spreadMove + state.bloom;
    },
    refill() {
      state.mag = state.def.mag;
      state.reserve = state.def.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.bloom = 0;
    },
  };
}

// Grenades: one live projectile at a time per thrower, a sphere that bounces off the
// world's boxes, fuses after 1.5 s and hurts everything in a 6 m radius, harder close in.
export function createGrenades(scene, colliders) {
  const live = [];
  const meshGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const meshMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2f26'), roughness: 0.6, metalness: 0.5 });
  const probe = new THREE.Box3();

  function throwGrenade(origin, direction, power = 13) {
    const mesh = new THREE.Mesh(meshGeo, meshMat);
    mesh.position.copy(origin);
    mesh.castShadow = true;
    scene.add(mesh);
    live.push({
      mesh,
      velocity: direction.clone().multiplyScalar(power).add(new THREE.Vector3(0, 4.5, 0)),
      fuse: 1.5,
      bounced: 0,
    });
  }

  function step(dt, damage) {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const g = live[i];
      g.fuse -= dt;
      g.velocity.y -= 18 * dt;
      const next = g.mesh.position.clone().addScaledVector(g.velocity, dt);
      probe.min.set(next.x - 0.09, next.y - 0.09, next.z - 0.09);
      probe.max.set(next.x + 0.09, next.y + 0.09, next.z + 0.09);
      let hit = null;
      for (const c of colliders) {
        if (probe.intersectsBox(c)) {
          hit = c;
          break;
        }
      }
      if (hit) {
        // Bounce: reflect the velocity component along the shallowest penetration axis.
        const px = Math.min(Math.abs(next.x - hit.min.x), Math.abs(next.x - hit.max.x));
        const py = Math.min(Math.abs(next.y - hit.min.y), Math.abs(next.y - hit.max.y));
        const pz = Math.min(Math.abs(next.z - hit.min.z), Math.abs(next.z - hit.max.z));
        if (px <= py && px <= pz) g.velocity.x *= -0.45;
        else if (py <= pz) g.velocity.y = Math.abs(g.velocity.y) * 0.45;
        else g.velocity.z *= -0.45;
        g.velocity.multiplyScalar(0.8);
        g.bounced += 1;
      } else {
        g.mesh.position.copy(next);
      }
      if (g.mesh.position.y < 0.09) {
        g.mesh.position.y = 0.09;
        g.velocity.y = Math.abs(g.velocity.y) * 0.45;
        g.velocity.x *= 0.8;
        g.velocity.z *= 0.8;
      }
      if (g.fuse <= 0) {
        damage(g.mesh.position);
        scene.remove(g.mesh);
        live.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const g of live) scene.remove(g.mesh);
    live.length = 0;
  }

  return { throwGrenade, step, clear, live };
}
