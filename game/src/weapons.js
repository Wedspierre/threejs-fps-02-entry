// Weapons: four guns and three grenades, each with its own numbers. Accuracy is the
// game: spread grows with movement and with sustained fire, recoil kicks the aim up,
// and the DMR punishes a miss harder than the SMG forgives one. The view model is a
// rifle you can read at a glance — receiver, barrel, handguard, magazine, stock and
// sights in two tones, not a slab. A grenade is a real projectile with gravity, bounce
// and a fuse: HE hurts, smoke blocks sight, flash whites out whoever looks at it.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P-9 Sidewinder', price: 0, kind: 'pistol',
    mag: 12, reserve: 36, damage: 24, headMult: 3, gap: 0.16, reload: 1.3,
    spreadStill: 0.004, spreadMove: 0.02, recoil: 0.008, auto: false, muzzle: -0.68,
  },
  rifle: {
    id: 'rifle', name: 'VK-7 Carbine', price: 2700, kind: 'rifle',
    mag: 30, reserve: 90, damage: 33, headMult: 4, gap: 0.11, reload: 2.0,
    spreadStill: 0.0022, spreadMove: 0.028, recoil: 0.011, auto: true, muzzle: -1.22,
  },
  smg: {
    id: 'smg', name: 'Moth-9', price: 1500, kind: 'smg',
    mag: 32, reserve: 96, damage: 22, headMult: 3, gap: 0.07, reload: 1.6,
    spreadStill: 0.006, spreadMove: 0.034, recoil: 0.007, auto: true, muzzle: -1.15,
  },
  dmr: {
    id: 'dmr', name: 'Longshot DMR', price: 4750, kind: 'dmr',
    mag: 10, reserve: 30, damage: 78, headMult: 3, gap: 0.5, reload: 2.8,
    spreadStill: 0.0009, spreadMove: 0.05, recoil: 0.03, auto: false, muzzle: -1.45,
  },
};

export const GRENADE_DEFS = {
  he: { id: 'he', name: 'HE Grenade', short: 'HE', price: 300, fuse: 1.5 },
  smoke: { id: 'smoke', name: 'Smoke Grenade', short: 'SMK', price: 200, fuse: 1.5 },
  flash: { id: 'flash', name: 'Flash Grenade', short: 'FLS', price: 200, fuse: 1.5 },
};
export const GRENADE_PRICE = GRENADE_DEFS.he.price;
export const GRENADE_MAX = 2;
const MOVE_REFERENCE = 5.2;

function buildViewModel(def) {
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color('#23262a'), roughness: 0.45, metalness: 0.55 });
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.3,
  });
  const model = new THREE.Group();
  const scale = def.kind === 'pistol' ? 0.72 : def.kind === 'dmr' ? 1.3 : 1;
  const s = (v) => v * scale;
  if (def.kind === 'pistol') {
    // A pistol reads as a slide and a grip, not a box.
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.3), steel);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.26), grip);
    frame.position.set(0, -0.045, 0.01);
    const pgrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.15, 0.07), grip);
    pgrip.position.set(0, -0.11, 0.12);
    pgrip.rotation.x = 0.22;
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.015), accent);
    frontSight.position.set(0, 0.045, -0.13);
    model.add(slide, frame, pgrip, frontSight);
  } else {
    // Receiver, handguard, barrel, muzzle, magazine, stock, grip, sights.
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.44 * scale), steel);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.24 * scale), grip);
    handguard.position.set(0, 0.01, -0.3 * scale);
    const barrelLen = def.kind === 'dmr' ? 0.56 : def.kind === 'smg' ? 0.3 : 0.42;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, barrelLen, 10), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.025, -(0.42 * scale + barrelLen / 2 - 0.06));
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.07), grip);
    muzzle.position.set(0, 0.025, -(0.42 * scale + barrelLen - 0.05));
    const magLen = def.kind === 'smg' ? 0.3 : 0.2;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, magLen, 0.08), grip);
    mag.position.set(0, -(0.05 + magLen / 2), -0.04);
    mag.rotation.x = 0.16;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.24 * scale), grip);
    stock.position.set(0, -0.015, 0.32 * scale);
    const pgrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), grip);
    pgrip.position.set(0, -0.11, 0.14);
    pgrip.rotation.x = 0.25;
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), accent);
    rearSight.position.set(0, 0.075, 0.16);
    const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.015), accent);
    frontPost.position.set(0, 0.07, -0.4 * scale);
    // Amber stripe along the handguard and three vent slots, so the barrel end
    // reads as a handguard instead of a plain tube.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.012, 0.2 * scale), accent);
    stripe.position.set(0, 0.058, -0.3 * scale);
    model.add(receiver, handguard, barrel, muzzle, mag, stock, pgrip, rearSight, frontPost, stripe);
    if (def.kind === 'dmr') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.18, 12), steel);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.1, 0.02);
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.1), grip);
      mount.position.set(0, 0.07, 0.02);
      model.add(scope, mount);
    }
    if (def.kind === 'smg') {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 10), grip);
      can.rotation.x = Math.PI / 2;
      can.position.set(0, 0.025, -(0.42 * scale + barrelLen - 0.02));
      model.add(can);
    }
  }
  model.position.set(0.24, -0.24, -0.55);
  model.rotation.y = 0.05;
  model.scale.setScalar(0.85);
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
  flash.position.set(0.24, -0.2, WEAPONS.pistol.muzzle);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.18, WEAPONS.pistol.muzzle + 0.35);
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
    model.position.z = -0.55 + state.kick;
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
    flash.position.z = state.def.muzzle;
    flashLight.position.z = state.def.muzzle + 0.35;
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

// Grenades: a live projectile per throw, a sphere that bounces off the world's
// boxes, fuses after 1.5 s and then does its kind's job — HE hurts everything in a
// 6 m radius, smoke lays a cloud that blocks sight, flash whites out whoever looks
// at it. The step reuses one scratch vector; nothing is allocated per frame.
const grenadeNext = new THREE.Vector3();
const GRENADE_MATS = {
  he: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2f26'), roughness: 0.6, metalness: 0.5 }),
  smoke: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a8478'), roughness: 0.8, metalness: 0.1 }),
  flash: new THREE.MeshStandardMaterial({ color: new THREE.Color('#efe8da'), roughness: 0.4, metalness: 0.3 }),
};

export function createGrenades(scene, colliders) {
  const live = [];
  const meshGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const probe = new THREE.Box3();

  function throwGrenade(origin, direction, kind = 'he', power = 13) {
    const mesh = new THREE.Mesh(meshGeo, GRENADE_MATS[kind] ?? GRENADE_MATS.he);
    mesh.position.copy(origin);
    mesh.castShadow = true;
    scene.add(mesh);
    live.push({
      mesh,
      kind,
      velocity: direction.clone().multiplyScalar(power).add(new THREE.Vector3(0, 4.5, 0)),
      fuse: GRENADE_DEFS[kind]?.fuse ?? 1.5,
      bounced: 0,
    });
  }

  function step(dt, detonate) {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const g = live[i];
      g.fuse -= dt;
      g.velocity.y -= 18 * dt;
      const next = grenadeNext.copy(g.mesh.position).addScaledVector(g.velocity, dt);
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
        detonate(g.mesh.position, g.kind);
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
