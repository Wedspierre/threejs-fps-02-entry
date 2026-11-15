// The yard's own art: every texture is drawn on a canvas at runtime, so the game
// ships no image files and loads nothing. A seeded generator keeps the wear identical
// every run. Floor concrete, wall panels, stencilled crates, hazard stripes and the
// dusk sky are all made here; world.js only hangs them on geometry.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function rng(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

function speckle(ctx, size, random, count, alpha) {
  for (let i = 0; i < count; i += 1) {
    const v = random();
    ctx.fillStyle = v < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,240,210,${alpha * 0.7})`;
    const r = 1 + random() * 2.5;
    ctx.fillRect(random() * size, random() * size, r, r);
  }
}

export function floorTexture() {
  const random = rng(11);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#6a5c4a';
    ctx.fillRect(0, 0, s, s);
    // Large poured-concrete slabs.
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        const tone = 0.9 + random() * 0.2;
        ctx.fillStyle = `rgb(${Math.round(106 * tone)},${Math.round(92 * tone)},${Math.round(74 * tone)})`;
        ctx.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
      }
    }
    ctx.strokeStyle = 'rgba(28,22,16,0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(s, i * 128); ctx.stroke();
    }
    // Oil stains and wear near the middle of each slab.
    for (let i = 0; i < 14; i += 1) {
      const x = random() * s;
      const y = random() * s;
      const r = 18 + random() * 46;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, 'rgba(20,16,12,0.35)');
      grad.addColorStop(1, 'rgba(20,16,12,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    speckle(ctx, s, random, 2600, 0.12);
  }, 6, 5);
}

export function wallTexture() {
  const random = rng(23);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#7d6c58';
    ctx.fillRect(0, 0, s, s);
    // Riveted steel panels: two rows, three columns.
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const tone = 0.92 + random() * 0.16;
        ctx.fillStyle = `rgb(${Math.round(125 * tone)},${Math.round(108 * tone)},${Math.round(88 * tone)})`;
        ctx.fillRect(col * 171 + 3, row * 256 + 3, 165, 250);
      }
    }
    ctx.strokeStyle = 'rgba(30,24,18,0.8)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 3; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 171, 0); ctx.lineTo(i * 171, s); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(s, 256); ctx.stroke();
    // Rivets along every seam.
    ctx.fillStyle = 'rgba(40,32,24,0.9)';
    for (let x = 14; x < s; x += 28) {
      for (const y of [10, 246, 266, 502]) {
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Grime creeping up from the floor.
    const grad = ctx.createLinearGradient(0, s - 130, 0, s);
    grad.addColorStop(0, 'rgba(24,18,12,0)');
    grad.addColorStop(1, 'rgba(24,18,12,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, s - 130, s, 130);
    speckle(ctx, s, random, 1400, 0.1);
  }, 4, 1);
}

export function crateTexture(base, label) {
  const random = rng(base.length * 31 + label.length * 7 + 5);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // Painted frame and cross-brace, the way yard crates are stencilled.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, s - 20, s - 20);
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(s - 14, s - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s - 14, 14); ctx.lineTo(14, s - 14); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (const [x, y] of [[18, 18], [s - 18, 18], [18, s - 18], [s - 18, s - 18]]) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (label) {
      ctx.fillStyle = 'rgba(239,232,218,0.88)';
      ctx.font = '700 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, s / 2, s / 2 + 2);
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText('KESTREL FOUNDRY', s / 2, s / 2 + 34);
    }
    speckle(ctx, s, random, 700, 0.12);
  });
}

export function hazardTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#17130f';
    for (let x = -s; x < s * 2; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, s);
      ctx.lineTo(x + 32, s);
      ctx.lineTo(x + 32 + s, 0);
      ctx.lineTo(x + s, 0);
      ctx.closePath();
      ctx.fill();
    }
  }, 3, 1);
}

export function glowTexture() {
  // A furnace mouth: white-hot core cooling to ember orange at the edges.
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 64, 4, 128, 64, 130);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(0.35, '#ffc23c');
  grad.addColorStop(0.7, '#ff7a1a');
  grad.addColorStop(1, '#7a2c08');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0d1526');
  grad.addColorStop(0.42, '#2c3550');
  grad.addColorStop(0.68, '#8a4a28');
  grad.addColorStop(0.82, '#e88030');
  grad.addColorStop(1, '#f7a44a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  // Low sun glow on the horizon.
  const sun = ctx.createRadialGradient(512, 430, 8, 512, 430, 260);
  sun.addColorStop(0, 'rgba(255,214,140,0.9)');
  sun.addColorStop(0.4, 'rgba(255,150,60,0.35)');
  sun.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);
  // Faint early stars high up.
  const random = rng(97);
  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = `rgba(239,232,218,${0.25 + random() * 0.5})`;
    ctx.fillRect(random() * 1024, random() * 170, 1.6, 1.6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
