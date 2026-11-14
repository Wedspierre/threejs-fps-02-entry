// Kestrel Foundry: an original decommissioned foundry yard, 46 x 34 m, three lanes to two
// bomb sites. Attackers spawn south, defenders north. Site A (Crane Bay) sits west under
// the old gantry crane, Site B (Furnace Hall) east beside the cold furnace. Every box is a
// collider for walkers and a surface a bullet stops on. Plain geometry only, no models,
// no textures from anywhere: the site letters are drawn on a canvas at runtime.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const SITES = {
  A: { x: -17, z: -11, r: 3.4 },
  B: { x: 17, z: -11, r: 3.4 },
};

export const ATTACKER_SPAWNS = [
  { x: -2, z: 14, yaw: 0 },
  { x: 0, z: 15, yaw: 0 },
  { x: 2, z: 14, yaw: 0 },
  { x: -4, z: 13, yaw: 0.4 },
  { x: 4, z: 13, yaw: -0.4 },
];

export const DEFENDER_SPAWNS = [
  { x: -2, z: -14, yaw: Math.PI },
  { x: 0, z: -15, yaw: Math.PI },
  { x: 2, z: -14, yaw: Math.PI },
  { x: -4, z: -13, yaw: Math.PI - 0.4 },
  { x: 4, z: -13, yaw: Math.PI + 0.4 },
];

// Waypoint graph the bots walk. Nodes are open floor; edges are straight, clear runs.
const NODES = [
  { x: 0, z: 14 }, // 0 attacker spawn
  { x: -8, z: 10 }, // 1 A approach
  { x: 8, z: 10 }, // 2 B approach
  { x: 0, z: 7 }, // 3 mid entry
  { x: -14, z: 6 }, // 4 A lane
  { x: 14, z: 6 }, // 5 B lane
  { x: -18, z: 1 }, // 6 A lane low
  { x: 18, z: 1 }, // 7 B lane low
  { x: -7, z: 0 }, // 8 mid-left flank
  { x: 7, z: 0 }, // 9 mid-right flank
  { x: 0, z: -7 }, // 10 mid north
  { x: -15, z: -6 }, // 11 A hold
  { x: 15, z: -6 }, // 12 B hold
  { x: -17, z: -11 }, // 13 site A
  { x: 17, z: -11 }, // 14 site B
  { x: -8, z: -9 }, // 15 A connector
  { x: 8, z: -9 }, // 16 B connector
  { x: 0, z: -13 }, // 17 defender spawn
  { x: -12, z: -13 }, // 18 defender A
  { x: 12, z: -13 }, // 19 defender B
  { x: -18, z: -13 }, // 20 A back
  { x: 18, z: -13 }, // 21 B back
  { x: 0, z: 11 }, // 22 attacker mid
];
const EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 22], [22, 3], [22, 1], [22, 2],
  [1, 4], [2, 5], [3, 8], [3, 9], [4, 6], [5, 7], [4, 8], [5, 9],
  [8, 10], [9, 10], [6, 11], [7, 12], [6, 8], [7, 9],
  [8, 15], [9, 16], [10, 15], [10, 16], [10, 17],
  [11, 13], [12, 14], [11, 15], [12, 16], [15, 17], [16, 17],
  [15, 18], [16, 19], [13, 20], [14, 21], [17, 18], [17, 19],
  [18, 20], [19, 21], [13, 15], [14, 16],
];
const ADJACENCY = NODES.map(() => []);
for (const [a, b] of EDGES) {
  ADJACENCY[a].push(b);
  ADJACENCY[b].push(a);
}

export function nearestNode(x, z) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < NODES.length; i += 1) {
    const d = (NODES[i].x - x) ** 2 + (NODES[i].z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// Breadth-first route between nodes, returned as a list of {x, z} waypoints.
export function findPath(fromNode, toNode) {
  if (fromNode === toNode) return [NODES[toNode]];
  const prev = new Array(NODES.length).fill(-1);
  const queue = [fromNode];
  prev[fromNode] = fromNode;
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === toNode) break;
    for (const next of ADJACENCY[current]) {
      if (prev[next] === -1) {
        prev[next] = current;
        queue.push(next);
      }
    }
  }
  if (prev[toNode] === -1) return [NODES[toNode]];
  const path = [];
  let node = toNode;
  while (node !== fromNode) {
    path.unshift(NODES[node]);
    node = prev[node];
  }
  return path;
}

function siteLetterTexture(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(232,163,61,0.92)';
  ctx.font = '700 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' ? 0.5 : 0.92,
      metalness: name === 'hairline' || name === 'surface' ? 0.25 : 0.03,
    });
  }
  const glow = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent),
    emissive: new THREE.Color(PALETTE.accent),
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const furnaceGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3a1c08'),
    emissive: new THREE.Color('#ff7a1a'),
    emissiveIntensity: 2.2,
    roughness: 0.6,
  });

  const colliders = [];
  const shootables = [];
  const wallRects = [];

  function box(width, height, depth, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
      wallRects.push({ x, z, w: width, d: depth });
    }
    return mesh;
  }

  // Floor and outer walls, 46 x 34 m, 5 m high, open to the dusk sky.
  box(46.4, 0.4, 34.4, 0, -0.2, 0, 'surface');
  box(0.4, 5, 34.4, -23.2, 2.5, 0, 'surface');
  box(0.4, 5, 34.4, 23.2, 2.5, 0, 'surface');
  box(46.4, 5, 0.4, 0, 2.5, -17.2, 'surface');
  box(46.4, 5, 0.4, 0, 2.5, 17.2, 'surface');

  // The cold furnace: the map's centrepiece, a block that splits mid into two flanks.
  box(8, 4.5, 3, 0, 2.25, -3, 'hairline');
  box(8.6, 0.5, 3.6, 0, 4.75, -3, 'surface');
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.3), furnaceGlow);
  mouth.position.set(0, 1.1, -1.42);
  group.add(mouth);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.18, 0.18), glow);
  strip.position.set(0, 3.1, -1.44);
  group.add(strip);

  // Gantry crane over Site A: pillars collide, the beam hangs above head height.
  box(0.8, 5, 0.8, -20.5, 2.5, -11, 'hairline');
  box(0.8, 5, 0.8, -13.5, 2.5, -11, 'hairline');
  const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.9), materials.surface);
  beam.position.set(-17, 4.7, -11);
  beam.castShadow = true;
  group.add(beam);

  // Shipping containers: tall cover on both lanes.
  box(2.6, 2.6, 6, -12, 1.3, 4, 'rust');
  box(2.6, 2.6, 6, 12, 1.3, 4, 'rust');
  box(6, 2.6, 2.6, -12, 1.3, -8, 'teal');
  box(6, 2.6, 2.6, 12, 1.3, -8, 'teal');

  // Mid barriers and low walls: crouch cover that shapes the sightlines.
  box(0.6, 2.2, 6, -8, 1.1, 2, 'surface');
  box(0.6, 2.2, 6, 8, 1.1, 2, 'surface');
  box(4, 1.1, 0.8, -4, 0.55, 8, 'hairline');
  box(4, 1.1, 0.8, 4, 0.55, 8, 'hairline');
  box(4, 1.1, 0.8, -4, 0.55, -9.5, 'hairline');
  box(4, 1.1, 0.8, 4, 0.55, -9.5, 'hairline');

  // Crates scattered as low cover.
  box(1.4, 1.4, 1.4, -16, 0.7, 2, 'hairline');
  box(1.4, 1.4, 1.4, 16, 0.7, 2, 'hairline');
  box(1.2, 1.2, 1.2, -4, 0.6, -8, 'hairline');
  box(1.2, 1.2, 1.2, 4, 0.6, -8, 'hairline');
  box(1.2, 1.2, 1.2, 0, 0.6, 10, 'hairline');
  box(1.2, 1.2, 1.2, -19, 0.6, -5, 'hairline');
  box(1.2, 1.2, 1.2, 19, 0.6, -5, 'hairline');
  box(1.6, 0.8, 1.6, -10, 0.4, -13.5, 'hairline');
  box(1.6, 0.8, 1.6, 10, 0.4, -13.5, 'hairline');

  // Pipes along the north wall, visual only.
  for (const z of [-16.6, -16.1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 44, 10), materials.hairline);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 3.4, z);
    pipe.castShadow = true;
    group.add(pipe);
  }

  // Bomb site markers: a glowing floor decal and a floating letter.
  for (const [key, site] of Object.entries(SITES)) {
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(site.r * 2, site.r * 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.16, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(site.x, 0.03, site.z);
    group.add(decal);
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: siteLetterTexture(key), transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    letter.position.set(site.x, 3.4, site.z);
    group.add(letter);
  }

  // Light: dusk hemisphere, a warm low sun with shadows, the furnace's orange spill.
  const sky = new THREE.HemisphereLight(new THREE.Color('#454b58'), new THREE.Color(PALETTE.canvas), 1.5);
  scene.add(sky);

  const key = new THREE.DirectionalLight(new THREE.Color('#ffd9a0'), 3.0);
  key.position.set(14, 18, 10);
  key.target.position.set(0, 0, -3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 0.8);
  fill.position.set(-12, 10, 14);
  scene.add(fill);

  const furnaceLight = new THREE.PointLight(new THREE.Color('#ff7a1a'), 26, 18, 1.8);
  furnaceLight.position.set(0, 1.6, -1);
  scene.add(furnaceLight);

  return { colliders, shootables, group, wallRects };
}
