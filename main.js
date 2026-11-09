import * as THREE from 'three';

/* =========================================================
   庄园小游戏 · Three.js
   第三人称角色 + 收集苹果 + 相机跟随/环绕
   ========================================================= */

// ---------- 基础三件套 ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0x9fd8ff, 60, 145);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);

// ---------- 光照 ----------
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a6b3a, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d6, 2.1);
sun.position.set(38, 55, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.0004;
scene.add(sun);

// ---------- 天空球 & 云 ----------
(function buildSky() {
  const geo = new THREE.SphereGeometry(240, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x4aa3ff) },
      bottomColor: { value: new THREE.Color(0xdff1ff) },
      offset: { value: 30 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 bottomColor;
      uniform float offset; uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
})();

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);
function makeCloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.92 });
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const s = 3 + Math.random() * 3;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mat);
    puff.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6);
    puff.scale.y = 0.6;
    g.add(puff);
  }
  const a = Math.random() * Math.PI * 2;
  const r = 40 + Math.random() * 70;
  g.position.set(Math.cos(a) * r, 42 + Math.random() * 22, Math.sin(a) * r);
  g.scale.setScalar(1 + Math.random());
  return g;
}
for (let i = 0; i < 9; i++) cloudGroup.add(makeCloud());

// ---------- 地面 ----------
const groundMat = new THREE.MeshStandardMaterial({ color: 0x6dbf4b, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 96), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 草地波纹（用一圈圈深浅圆形做视觉层次）
const patchMat = new THREE.MeshStandardMaterial({ color: 0x5aa93f, roughness: 1 });
for (let i = 0; i < 26; i++) {
  const r = 2 + Math.random() * 6;
  const patch = new THREE.Mesh(new THREE.CircleGeometry(r, 20), patchMat);
  patch.rotation.x = -Math.PI / 2;
  const a = Math.random() * Math.PI * 2;
  const dist = Math.random() * 120;
  patch.position.set(Math.cos(a) * dist, 0.01, Math.sin(a) * dist);
  scene.add(patch);
}

// 中央石板路
const pathMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.95 });
const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 90), pathMat);
path.rotation.x = -Math.PI / 2;
path.position.set(0, 0.02, 10);
path.receiveShadow = true;
scene.add(path);

// =========================================================
//  碰撞体登记（简单的圆形碰撞）
// =========================================================
const colliders = []; // {x,z,r}
function addCollider(x, z, r) { colliders.push({ x, z, r }); }

// =========================================================
//  建筑 / 装饰工厂函数
// =========================================================

// --- 小屋 ---
function makeHouse(x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb5462f, roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.4, emissive: 0x2a4a5a, emissiveIntensity: 0.25 });

  const W = 8, H = 5, D = 7;

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
  body.position.y = H / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // 屋顶（四棱锥）
  const roof = new THREE.Mesh(new THREE.ConeGeometry(W * 0.82, 3.6, 4), roofMat);
  roof.position.y = H + 1.8;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  // 门
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.25), woodMat);
  door.position.set(0, 1.6, D / 2 + 0.05);
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 0.8, roughness: 0.3 }));
  knob.position.set(0.6, 1.6, D / 2 + 0.18);
  g.add(knob);

  // 窗
  for (const sx of [-2.4, 2.4]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.2), glassMat);
    win.position.set(sx, 3.2, D / 2 + 0.05);
    g.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.12), woodMat);
    frame.position.set(sx, 3.2, D / 2 + 0.02);
    g.add(frame);
  }

  // 烟囱
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), new THREE.MeshStandardMaterial({ color: 0x9a5a44, roughness: 0.9 }));
  chimney.position.set(-2.4, H + 2.4, -1.5);
  chimney.castShadow = true;
  g.add(chimney);

  scene.add(g);
  addCollider(x, z, Math.max(W, D) * 0.55);
  return g;
}

// --- 树 ---
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });
function makeTree(x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.5 * scale, 3 * scale, 7), trunkMat);
  trunk.position.y = 1.5 * scale;
  trunk.castShadow = true;
  g.add(trunk);

  const leafColors = [0x2f7d32, 0x3f9142, 0x49a84c, 0x2e6b30];
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColors[Math.floor(Math.random() * leafColors.length)], roughness: 1 });
  const blobs = 3;
  for (let i = 0; i < blobs; i++) {
    const s = (2.2 - i * 0.4) * scale;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leafMat);
    blob.position.set((Math.random() - 0.5) * scale, (3.4 + i * 1.1) * scale, (Math.random() - 0.5) * scale);
    blob.castShadow = true;
    g.add(blob);
  }
  scene.add(g);
  addCollider(x, z, 0.7 * scale);
  return g;
}

// --- 灌木 ---
function makeBush(x, z, s = 1) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x4f9c3a, roughness: 1 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry((0.8 + Math.random() * 0.5) * s, 1), mat);
    b.position.set((Math.random() - 0.5) * s, 0.5 * s, (Math.random() - 0.5) * s);
    b.castShadow = true;
    g.add(b);
  }
  scene.add(g);
  addCollider(x, z, 1.0 * s);
}

// --- 围栏的一段 ---
function makeFenceSegment(x, z, rotY) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xb98a58, roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (const dx of [-1.5, 0, 1.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), mat);
    post.position.set(dx, 0.8, 0);
    post.castShadow = true;
    g.add(post);
  }
  for (const dy of [0.5, 1.1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 0.1), mat);
    rail.position.set(0, dy, 0);
    g.add(rail);
  }
  scene.add(g);
}

// --- 水井 ---
function makeWell(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.1, 16), stoneMat);
  base.position.y = 0.55; base.castShadow = true; base.receiveShadow = true;
  g.add(base);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), new THREE.MeshStandardMaterial({ color: 0x2e8bc0, roughness: 0.2, metalness: 0.5 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.9;
  g.add(water);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a3b2f, roughness: 0.8 });
  for (const dx of [-1.1, 1.1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), trunkMat);
    post.position.set(dx, 1.6, 0); post.castShadow = true;
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.2, 4), roofMat);
  roof.position.y = 3.1; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(roof);
  scene.add(g);
  addCollider(x, z, 1.9);
}

// --- 路灯 ---
const lampGlassMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffcc55, emissiveIntensity: 1.4, roughness: 0.4 });
function makeLamp(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 8), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.6, roughness: 0.5 }));
  pole.position.y = 2.1; pole.castShadow = true;
  g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), lampGlassMat);
  lamp.position.y = 4.3;
  g.add(lamp);
  const pl = new THREE.PointLight(0xffcc66, 12, 14, 2);
  pl.position.set(x, 4.3, z);
  scene.add(pl);
  scene.add(g);
  addCollider(x, z, 0.3);
}

// =========================================================
//  布置庄园
// =========================================================
makeHouse(18, -12, -Math.PI / 5);
makeHouse(-20, -18, Math.PI / 4);
makeHouse(-2, -30, 0);

makeWell(3, -8);

// 树木
const treeSpots = [
  [-30, 5], [-26, 18], [-34, -6], [-24, 30],
  [28, 8], [34, 22], [24, 32], [40, -4],
  [-10, 22], [12, 26], [-38, 20], [36, 34],
  [8, -20], [-14, -8], [-30, 38], [20, -32],
];
treeSpots.forEach(([x, z], i) => makeTree(x, z, 0.8 + (i % 3) * 0.25));

// 灌木
const bushSpots = [[10, -6], [-8, 4], [14, 14], [-16, 10], [6, 18], [-6, -14], [22, 2], [-22, -2]];
bushSpots.forEach(([x, z]) => makeBush(x, z, 0.9 + Math.random() * 0.5));

// 路灯
[[-4, 4], [5, 12], [-6, 20], [4, -18]].forEach(([x, z]) => makeLamp(x, z));

// 围栏（围绕边界的四段）
for (let x = -14; x <= 14; x += 3.3) makeFenceSegment(x, 46, 0);
for (let x = -14; x <= 14; x += 3.3) makeFenceSegment(x, -46, 0);

// 石头
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 1 });
for (let i = 0; i < 14; i++) {
  const s = 0.4 + Math.random() * 1.1;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneMat);
  const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 34;
  rock.position.set(Math.cos(a) * d, s * 0.5, Math.sin(a) * d);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true; rock.receiveShadow = true;
  scene.add(rock);
}

// =========================================================
//  玩家角色
// =========================================================
const player = new THREE.Group();
player.position.set(0, 0, 24);
scene.add(player);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 });
const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbc0, roughness: 0.7 });
const hatMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

// 身体
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.9, 6, 12), bodyMat);
torso.position.y = 1.55;
torso.castShadow = true;
player.add(torso);

// 头
const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 16), skinMat);
head.position.y = 2.55;
head.castShadow = true;
player.add(head);

// 帽子
const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 20), hatMat);
hatBrim.position.y = 2.9; hatBrim.castShadow = true;
player.add(hatBrim);
const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 20), hatMat);
hatTop.position.y = 3.2; hatTop.castShadow = true;
player.add(hatTop);

// 眼睛
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
for (const dx of [-0.17, 0.17]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
  eye.position.set(dx, 2.6, 0.44);
  player.add(eye);
}

// 手臂（存引用做摆动）
const armGeo = new THREE.CapsuleGeometry(0.16, 0.55, 4, 8);
function makeArm(side) {
  const pivot = new THREE.Group();
  pivot.position.set(0.62 * side, 2.0, 0);
  const arm = new THREE.Mesh(armGeo, skinMat);
  arm.position.y = -0.35;
  arm.castShadow = true;
  pivot.add(arm);
  player.add(pivot);
  return pivot;
}
const armL = makeArm(1);
const armR = makeArm(-1);

// 腿（存引用做摆动）
const legGeo = new THREE.CapsuleGeometry(0.19, 0.6, 4, 8);
function makeLeg(side) {
  const pivot = new THREE.Group();
  pivot.position.set(0.24 * side, 1.0, 0);
  const leg = new THREE.Mesh(legGeo, darkMat);
  leg.position.y = -0.4;
  leg.castShadow = true;
  pivot.add(leg);
  player.add(pivot);
  return pivot;
}
const legL = makeLeg(1);
const legR = makeLeg(-1);

// 角色朝向
let facing = Math.PI; // 面向 -z（画面里朝向里面）

// =========================================================
//  收集物（苹果）
// =========================================================
const apples = [];
const appleMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.35, metalness: 0.1, emissive: 0x661111, emissiveIntensity: 0.5 });
const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });
const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3fae3f, side: THREE.DoubleSide });

const appleSpots = [
  [8, 20], [-10, 16], [16, 4], [-16, -6], [0, 0],
  [22, 18], [-24, 12], [12, -14], [-8, -22], [20, -24],
  [-30, 2], [30, 8], [-4, 34], [10, 38], [-18, 30],
];

function createApple(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), appleMat);
  sphere.scale.y = 0.95;
  sphere.position.y = 1.0;
  sphere.castShadow = true;
  g.add(sphere);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), stemMat);
  stem.position.y = 1.45;
  g.add(stem);

  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), leafMat2);
  leaf.scale.set(1.4, 0.4, 0.8);
  leaf.position.set(0.18, 1.5, 0);
  leaf.rotation.z = 0.6;
  g.add(leaf);

  // 光晕
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.72, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.05;
  g.add(halo);

  const light = new THREE.PointLight(0xffbb33, 4, 6, 2);
  light.position.y = 1.0;
  g.add(light);

  scene.add(g);
  const item = { group: g, x, z, halo, light, alive: true, baseY: 0, phase: Math.random() * Math.PI * 2 };
  apples.push(item);
  return item;
}
appleSpots.forEach(([x, z]) => createApple(x, z));

// =========================================================
//  输入处理
// =========================================================
const keys = {};
const keyMap = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};
window.addEventListener('keydown', (e) => {
  if (keyMap[e.code]) { keys[keyMap[e.code]] = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) { keys[keyMap[e.code]] = false; e.preventDefault(); }
});

// 相机环绕（鼠标拖动）
const orbit = { theta: Math.PI, phi: 0.32, radius: 9, targetRadius: 9 };
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', (e) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch {} });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  orbit.theta -= dx * 0.005;
  orbit.phi = Math.max(-0.15, Math.min(0.9, orbit.phi + dy * 0.004));
});
canvas.addEventListener('wheel', (e) => {
  orbit.targetRadius = Math.max(4.5, Math.min(18, orbit.targetRadius + e.deltaY * 0.012));
  e.preventDefault();
}, { passive: false });

// =========================================================
//  游戏状态 & UI
// =========================================================
const scoreEl = document.getElementById('score');
const totalEl = document.getElementById('total');
const timerEl = document.getElementById('timer');
const overlay = document.getElementById('overlay');
const winOverlay = document.getElementById('winOverlay');
const winTimeEl = document.getElementById('winTime');
const startBtn = document.getElementById('startBtn');
const againBtn = document.getElementById('againBtn');

totalEl.textContent = apples.length;

let playing = false;
let startTime = 0;
let collected = 0;

startBtn.addEventListener('click', startGame);

// 便于截图/调试：?autostart=1 时自动开始
if (new URLSearchParams(location.search).has('autostart')) {
  setTimeout(startGame, 200);
}
againBtn.addEventListener('click', () => { resetGame(); startGame(); });

function startGame() {
  overlay.classList.add('hidden');
  winOverlay.classList.add('hidden');
  playing = true;
  startTime = performance.now();
}

function resetGame() {
  collected = 0;
  scoreEl.textContent = '0';
  timerEl.textContent = '00:00';
  player.position.set(0, 0, 24);
  facing = Math.PI;
  // 复活所有苹果
  apples.forEach((a) => {
    if (!a.alive) {
      a.alive = true;
      a.group.visible = true;
    }
  });
}

let winShown = false;
function checkWin() {
  if (collected >= apples.length && !winShown) {
    winShown = true;
    playing = false;
    const sec = (performance.now() - startTime) / 1000;
    winTimeEl.textContent = formatTime(sec);
    setTimeout(() => winOverlay.classList.remove('hidden'), 350);
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// =========================================================
//  主循环
// =========================================================
const clock = new THREE.Clock();
const tmpDir = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();

const PLAYER_RADIUS = 0.7;
const WALK_SPEED = 9;
const RUN_SPEED = 16;

function resolveCollision(pos) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const minDist = c.r + PLAYER_RADIUS;
    const dist = Math.hypot(dx, dz);
    if (dist < minDist && dist > 0.0001) {
      const push = (minDist - dist);
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    }
  }
  // 世界边界
  const bound = 44;
  pos.x = Math.max(-bound, Math.min(bound, pos.x));
  pos.z = Math.max(-bound, Math.min(bound, pos.z));
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // ---- 玩家移动（相机相对方向）----
  let moving = false;
  if (playing) {
    let ix = 0, iz = 0;
    if (keys.up) iz -= 1;
    if (keys.down) iz += 1;
    if (keys.left) ix -= 1;
    if (keys.right) ix += 1;

    if (ix !== 0 || iz !== 0) {
      moving = true;
      // 输入方向基于相机朝向（theta）
      const camAngle = orbit.theta;
      // 相机前方（水平）
      const fwdX = Math.sin(camAngle);
      const fwdZ = Math.cos(camAngle);
      const rightX = Math.cos(camAngle);
      const rightZ = -Math.sin(camAngle);

      tmpDir.set(
        fwdX * (-iz) + rightX * ix,
        0,
        fwdZ * (-iz) + rightZ * ix
      ).normalize();

      const speed = keys.run ? RUN_SPEED : WALK_SPEED;
      player.position.x += tmpDir.x * speed * dt;
      player.position.z += tmpDir.z * speed * dt;

      resolveCollision(player.position);

      facing = Math.atan2(tmpDir.x, tmpDir.z);
    }
  }

  // 平滑转向
  let dAng = facing - player.rotation.y;
  while (dAng > Math.PI) dAng -= Math.PI * 2;
  while (dAng < -Math.PI) dAng += Math.PI * 2;
  player.rotation.y += dAng * Math.min(1, dt * 12);

  // 走路动画
  const swingSpeed = keys.run ? 16 : 11;
  if (moving) {
    const swing = Math.sin(t * swingSpeed) * 0.6;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    // 身体轻微上下
    player.position.y = Math.abs(Math.sin(t * swingSpeed)) * 0.08;
  } else {
    legL.rotation.x *= 0.8;
    legR.rotation.x *= 0.8;
    armL.rotation.x *= 0.8;
    armR.rotation.x *= 0.8;
    player.position.y *= 0.8;
  }

  // ---- 相机跟随（第三人称环绕）----
  orbit.radius += (orbit.targetRadius - orbit.radius) * Math.min(1, dt * 8);
  const cx = player.position.x - Math.sin(orbit.theta) * Math.cos(orbit.phi) * orbit.radius;
  const cy = player.position.y + 2.4 + Math.sin(orbit.phi) * orbit.radius;
  const cz = player.position.z - Math.cos(orbit.theta) * Math.cos(orbit.phi) * orbit.radius;
  desiredCamPos.set(cx, cy, cz);
  camera.position.lerp(desiredCamPos, Math.min(1, dt * 6));
  camTarget.set(player.position.x, player.position.y + 1.9, player.position.z);
  camera.lookAt(camTarget);

  // ---- 苹果动画 & 拾取 ----
  for (const a of apples) {
    if (!a.alive) continue;
    const bob = Math.sin(t * 2 + a.phase) * 0.18;
    a.group.position.y = 0;
    a.group.children[0].position.y = 1.0 + bob;
    a.group.rotation.y += dt * 1.6;
    a.halo.scale.setScalar(1 + Math.sin(t * 3 + a.phase) * 0.15);
    a.light.intensity = 3.5 + Math.sin(t * 4 + a.phase) * 1.5;

    if (playing) {
      const dx = player.position.x - a.x;
      const dz = player.position.z - a.z;
      if (Math.hypot(dx, dz) < 1.2) {
        a.alive = false;
        a.group.visible = false;
        collected++;
        scoreEl.textContent = collected;
        checkWin();
      }
    }
  }

  // ---- 云漂浮 ----
  cloudGroup.children.forEach((c, i) => {
    c.position.x += dt * (0.6 + (i % 3) * 0.3);
    if (c.position.x > 120) c.position.x = -120;
  });

  // ---- 计时 ----
  if (playing) {
    const sec = (performance.now() - startTime) / 1000;
    timerEl.textContent = formatTime(sec);
  }

  renderer.render(scene, camera);
}

// ---------- 窗口尺寸 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 初始化相机位置，避免第一帧跳变
camera.position.set(0, 6, 33);
camera.lookAt(0, 2, 24);

animate();
