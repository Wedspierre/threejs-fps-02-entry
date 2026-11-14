// Movement: acceleration, friction, gravity, crouch and jump, resolved as a box against
// the world's colliders one axis at a time, so a wall never swallows the walker. One mover
// drives the player and every bot, so their collision behaviour is identical.
import * as THREE from 'three';

const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 9;
const FRICTION = 9;
const GRAVITY = 20;
const JUMP_SPEED = 6.2;

export function createMover(colliders, opts = {}) {
  const radius = opts.radius ?? 0.34;
  const mover = {
    position: new THREE.Vector3(opts.x ?? 0, 0, opts.z ?? 0),
    velocity: new THREE.Vector3(),
    yaw: opts.yaw ?? 0,
    pitch: 0,
    eye: STAND_EYE,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
    walkSpeed: opts.walkSpeed ?? 5.2,
    crouchSpeed: opts.crouchSpeed ?? 2.4,
  };
  const probe = new THREE.Box3();

  // lift keeps the feet and the crown out of the horizontal tests, so standing on the
  // floor is not read as walking into a wall.
  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - radius, y + lift, z - radius);
    probe.max.set(x + radius, y + height - lift, z + radius);
    for (const collider of colliders) if (probe.intersectsBox(collider)) return collider;
    return null;
  }

  function look(dx, dy, sensitivity = 0.0022) {
    mover.yaw -= dx * sensitivity;
    mover.pitch = Math.max(-1.45, Math.min(1.45, mover.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    mover.pitch = Math.min(1.45, mover.pitch + pitchKick);
    mover.yaw += yawKick;
  }

  // wishX/wishZ is a world-space direction (already normalised when non-zero).
  function move(dt, wishX, wishZ, speed, crouch) {
    if (crouch && !mover.crouching) {
      mover.crouching = true;
      mover.height = CROUCH_HEIGHT;
    } else if (!crouch && mover.crouching && !overlaps(mover.position.x, mover.position.y, mover.position.z, STAND_HEIGHT, 0.02)) {
      mover.crouching = false;
      mover.height = STAND_HEIGHT;
    }
    const eyeTarget = mover.crouching ? CROUCH_EYE : STAND_EYE;
    mover.eye += (eyeTarget - mover.eye) * Math.min(1, dt * 12);

    const blend = Math.min(1, (mover.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / speed);
    mover.velocity.x += (wishX * speed - mover.velocity.x) * blend;
    mover.velocity.z += (wishZ * speed - mover.velocity.z) * blend;
    if (mover.onGround && wishX === 0 && wishZ === 0) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      mover.velocity.x *= damp;
      mover.velocity.z *= damp;
    }

    mover.velocity.y -= GRAVITY * dt;

    const nextX = mover.position.x + mover.velocity.x * dt;
    if (!overlaps(nextX, mover.position.y, mover.position.z, mover.height, 0.04)) mover.position.x = nextX;
    else mover.velocity.x = 0;
    const nextZ = mover.position.z + mover.velocity.z * dt;
    if (!overlaps(mover.position.x, mover.position.y, nextZ, mover.height, 0.04)) mover.position.z = nextZ;
    else mover.velocity.z = 0;

    mover.position.y += mover.velocity.y * dt;
    mover.onGround = false;
    const hit = overlaps(mover.position.x, mover.position.y, mover.position.z, mover.height, 0);
    if (hit && mover.velocity.y <= 0) {
      mover.position.y = hit.max.y;
      mover.velocity.y = 0;
      mover.onGround = true;
    } else if (hit) {
      mover.position.y = hit.min.y - mover.height;
      mover.velocity.y = 0;
    }
    if (mover.position.y < 0) {
      mover.position.y = 0;
      mover.velocity.y = 0;
      mover.onGround = true;
    }
    mover.velocity.y = Math.max(-30, mover.velocity.y);
  }

  return {
    state: mover,
    move,
    look,
    recoil,
    jump() {
      if (mover.onGround) {
        mover.velocity.y = JUMP_SPEED;
        mover.onGround = false;
      }
    },
    groundSpeed() {
      return Math.hypot(mover.velocity.x, mover.velocity.z);
    },
    teleport(x, z, yaw) {
      mover.position.set(x, 0, z);
      mover.velocity.set(0, 0, 0);
      mover.yaw = yaw ?? mover.yaw;
      mover.pitch = 0;
    },
  };
}

// The player is a mover driven by the keyboard: WASD wish direction, Ctrl/C crouch,
// Space jump. The same fixed step drives it as everything else.
export function createPlayer(colliders) {
  const mover = createMover(colliders, { x: 0, z: 14, walkSpeed: 5.2, crouchSpeed: 2.4 });

  function step(dt, keys) {
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let wishX = 0;
    let wishZ = 0;
    if (forward || strafe) {
      const sin = Math.sin(mover.state.yaw);
      const cos = Math.cos(mover.state.yaw);
      wishX = -sin * forward + cos * strafe;
      wishZ = -cos * forward - sin * strafe;
      const length = Math.hypot(wishX, wishZ);
      wishX /= length;
      wishZ /= length;
    }
    const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (keys.has('Space')) mover.jump();
    const speed = mover.state.crouching ? mover.state.crouchSpeed : mover.state.walkSpeed;
    mover.move(dt, wishX, wishZ, speed, crouch);
  }

  return {
    state: mover.state,
    step,
    look: mover.look,
    recoil: mover.recoil,
    teleport: mover.teleport,
    groundSpeed: mover.groundSpeed,
  };
}
