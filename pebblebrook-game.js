// ============================================================
//  PEBBLEBROOK - game engine
//  World building, drawing, walking, pets, quests and saving.
// ============================================================
(function () {
  'use strict';

  const W = WORLD.W, D = WORLD.D, H = WORLD.H, SEA = WORLD.SEA, GROUND = WORLD.GROUND;
  const VC = WORLD.VILLAGE, PC = WORLD.POND, HC = WORLD.HILL;
  const TEST = location.search.indexOf('test') >= 0;
  const SAVE_KEY = 'pebblebrook-save-v1';
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------
  //  Noise helpers
  // ---------------------------------------------------------------
  function hash2(x, z) {
    let n = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + WORLD.SEED) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  const smooth = t => t * t * (3 - 2 * t);
  function smoothstep(a, b, x) { return smooth(clamp((x - a) / (b - a), 0, 1)); }
  function vnoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  function fbm(x, z) {
    return vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 17, z * 2.1 + 5) * 0.28 + vnoise(x * 4.3 + 3, z * 4.3 + 29) * 0.12;
  }

  // ---------------------------------------------------------------
  //  World data
  // ---------------------------------------------------------------
  const world = new Uint8Array(W * D * H);
  const hmap = new Int16Array(W * D);
  const edits = new Map();          // changes made by the player (saved)
  const inBounds = (x, y, z) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H;
  const idx = (x, y, z) => x + z * W + y * W * D;
  function getB(x, y, z) { return inBounds(x, y, z) ? world[idx(x, y, z)] : 0; }
  function rawSet(x, y, z, id) { if (inBounds(x, y, z)) world[idx(x, y, z)] = id; }
  function isSolid(x, y, z) {
    if (y < 0) return true;
    if (x < 0 || x >= W || z < 0 || z >= D) return true;   // invisible wall at the edge of the world
    if (y >= H) return false;
    const id = world[idx(x, y, z)];
    return id !== 0 && BLOCKS[id].solid;
  }

  function baseHeight(x, z) {
    const dx = (x - W / 2) / (W / 2), dz = (z - D / 2) / (D / 2);
    const island = 1 - smoothstep(0.55, 1.0, Math.sqrt(dx * dx + dz * dz));
    return SEA - 5 + island * (8 + fbm(x / 22, z / 22) * 8);
  }
  function heightAt(x, z) {
    const nat = baseHeight(x, z);
    const mask = 1 - smoothstep(18, 36, Math.hypot(x - VC.x, z - VC.z));
    const dh = Math.hypot(x - HC.x, z - HC.z);
    const bump = 12 * Math.exp(-dh * dh / 98);
    return Math.floor(nat + (GROUND - nat) * mask + bump * (1 - mask) + 0.001);
  }
  const topY = (x, z) => hmap[x + z * W];

  function generateWorld() {
    const rnd = mulberry32(WORLD.SEED);
    // --- terrain ---
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const h = clamp(heightAt(x, z), 1, H - 12);
      hmap[x + z * W] = h;
      const sandy = h <= SEA + 1;
      for (let y = 0; y <= h; y++) {
        let id = B.STONE;
        if (y === 0) id = B.BEDROCK;
        else if (sandy && y > h - 3) id = B.SAND;
        else if (y === h) id = B.GRASS;
        else if (y > h - 4) id = B.DIRT;
        rawSet(x, y, z, id);
      }
      for (let y = h + 1; y <= SEA; y++) rawSet(x, y, z, B.WATER);
    }

    // --- village square ---
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++)
      if (dx * dx + dz * dz <= 22) rawSet(VC.x + dx, GROUND, VC.z + dz, B.PATH);

    // --- pond ---
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx, dz), x = PC.x + dx, z = PC.z + dz;
      if (d <= 4.2) {
        rawSet(x, GROUND, z, B.WATER);
        rawSet(x, GROUND - 1, z, d <= 3 ? B.WATER : B.SAND);
        rawSet(x, GROUND - 2, z, B.SAND);
      } else if (d <= 5.4) rawSet(x, GROUND, z, B.SAND);
    }
    [[5, 1], [-5, -1], [1, 5]].forEach(p => rawSet(PC.x + p[0], GROUND + 1, PC.z + p[1], B.NEST));

    // --- houses ---
    function house(x0, z0, door, roof) {
      for (let dz = 0; dz < 5; dz++) for (let dx = 0; dx < 5; dx++) {
        rawSet(x0 + dx, GROUND, z0 + dz, B.PLANKS);
        const edge = dx === 0 || dx === 4 || dz === 0 || dz === 4;
        for (let y = 1; y <= 3; y++) rawSet(x0 + dx, GROUND + y, z0 + dz, edge ? B.PLANKS : B.AIR);
      }
      const mids = { e: [4, 2], w: [0, 2], s: [2, 4], n: [2, 0] };
      for (const k in mids) {
        const m = mids[k];
        if (k === door) { rawSet(x0 + m[0], GROUND + 1, z0 + m[1], 0); rawSet(x0 + m[0], GROUND + 2, z0 + m[1], 0); }
        else rawSet(x0 + m[0], GROUND + 2, z0 + m[1], 0);   // window
      }
      for (let layer = 0; layer < 4; layer++) {
        const r = 3 - layer;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
          rawSet(x0 + 2 + dx, GROUND + 4 + layer, z0 + 2 + dz, roof);
      }
      rawSet(x0 + 1, GROUND + 1, z0 + 1, B.BED);
      rawSet(x0 + 3, GROUND + 3, z0 + 3, B.LANTERN);
    }
    house(VC.x - 13, VC.z - 2, 'e', B.BRICK);
    house(VC.x + 9, VC.z - 2, 'w', B.CANDY_MINT);
    house(VC.x - 2, VC.z - 13, 's', B.CANDY_LILAC);
    rawSet(VC.x + 8, GROUND + 1, VC.z - 3, B.OVEN);       // the baker's oven
    rawSet(VC.x + 8, GROUND + 2, VC.z - 3, B.CAKE);

    // --- wheat field ---
    for (let x = VC.x - 12; x <= VC.x - 8; x++) for (let z = VC.z + 6; z <= VC.z + 9; z++) {
      rawSet(x, GROUND, z, B.DIRT); rawSet(x, GROUND + 1, z, B.WHEAT);
    }

    // --- crystal cave in the hill ---
    const hb = Math.floor(baseHeight(HC.x, HC.z));
    const fy = Math.max(hb, GROUND) + 1;                     // cave floor level
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) for (let y = fy; y <= fy + 3; y++)
      if (dx * dx + dz * dz <= 11 - (y - fy) * 2) rawSet(HC.x + dx, y, HC.z + dz, 0);
    [[2, 1], [-2, 1], [0, -3], [-3, -1], [1, 3]].forEach(p => rawSet(HC.x + p[0], fy, HC.z + p[1], B.CRYSTAL));
    {
      // tunnel from the cave towards the village, until it opens onto the hillside
      const len = Math.hypot(VC.x - HC.x, VC.z - HC.z);
      const ux = (VC.x - HC.x) / len, uz = (VC.z - HC.z) / len;
      let ex = HC.x, ez = HC.z;
      for (let s = 2; s < 34; s += 0.5) {
        const x = Math.floor(HC.x + ux * s), z = Math.floor(HC.z + uz * s);
        ex = x; ez = z;
        if (topY(x, z) < fy && topY(x + 1, z) < fy && topY(x, z + 1) < fy) break;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let y = fy; y <= fy + 2; y++)
          if (getB(x + a, y, z + b) !== B.CRYSTAL) rawSet(x + a, y, z + b, 0);
      }
      const lx = Math.round(ex - uz * 2), lz = Math.round(ez + ux * 2);
      rawSet(lx, topY(lx, lz) + 1, lz, B.LANTERN);
      WORLD.CAVE_ENTRANCE = { x: ex, z: ez };
    }

    // --- trees ---
    const treeSpots = [];
    function tree(x, z, blossom, hive) {
      const h = topY(x, z);
      if (getB(x, h + 1, z) !== 0) return;
      const th = 4 + Math.floor(rnd() * 2), leaf = blossom ? B.BLOSSOM : B.LEAVES;
      for (let dy = th - 1; dy <= th + 2; dy++) {
        const r = dy <= th ? 2 : 1;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rnd() < 0.6) continue;
          if (getB(x + dx, h + dy, z + dz) === 0) rawSet(x + dx, h + dy, z + dz, leaf);
        }
      }
      for (let y = 1; y <= th; y++) rawSet(x, h + y, z, B.LOG);
      if (hive) rawSet(x + 1, h + th - 2, z, B.HIVE);
      treeSpots.push([x, z]);
    }
    const farFromTrees = (x, z) => treeSpots.every(t => Math.abs(t[0] - x) > 2 || Math.abs(t[1] - z) > 2);
    // a few trees that always have beehives, just outside the village
    [[VC.x - 21, VC.z + 3], [VC.x + 21, VC.z + 8], [VC.x + 3, VC.z - 22], [VC.x - 12, VC.z + 19]]
      .forEach((p, i) => tree(p[0], p[1], i % 2 === 0, true));
    for (let z = 4; z < D - 4; z++) for (let x = 4; x < W - 4; x++) {
      if (getB(x, topY(x, z), z) !== B.GRASS) continue;
      if (Math.hypot(x - VC.x, z - VC.z) < 21) continue;
      const forest = vnoise(x / 14 + 40, z / 14 + 40) + (x < VC.x - 10 ? 0.15 : 0);
      const density = forest > 0.55 ? 0.07 : 0.012;
      if (rnd() < density && farFromTrees(x, z)) tree(x, z, rnd() < 0.3, rnd() < 0.2);
    }

    // --- flowers and berry bushes ---
    const flowers = [B.FLOWER_PINK, B.FLOWER_YELLOW, B.FLOWER_BLUE];
    for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
      const h = topY(x, z);
      if (getB(x, h, z) !== B.GRASS || getB(x, h + 1, z) !== 0) continue;
      const r = rnd();
      if (r < 0.035) rawSet(x, h + 1, z, flowers[Math.floor(rnd() * 3)]);
      else if (r < 0.047) rawSet(x, h + 1, z, B.BERRY_BUSH);
    }
    [[7, 7], [-7, 8], [9, -8], [-8, -8], [0, 9], [12, 2], [-14, 4], [6, -11]].forEach(p => {
      const x = VC.x + p[0], z = VC.z + p[1], h = topY(x, z);
      if (getB(x, h, z) === B.GRASS && getB(x, h + 1, z) === 0) rawSet(x, h + 1, z, B.BERRY_BUSH);
    });
  }

  // ---------------------------------------------------------------
  //  Renderer, scene, materials
  // ---------------------------------------------------------------
  const canvas = $('game');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const SKY_DAY = new THREE.Color('#bfe6ff'), SKY_DUSK = new THREE.Color('#ffc4d6'), SKY_NIGHT = new THREE.Color('#4a4580');
  scene.background = SKY_DAY.clone();
  scene.fog = new THREE.Fog(scene.background.getHex(), 45, 150);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
  camera.rotation.order = 'YXZ';
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffe2cc, 0.85);
  const sun = new THREE.DirectionalLight(0xfff2dd, 0.5);
  sun.position.set(0.5, 1, 0.3);
  scene.add(hemi, sun);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.magFilter = THREE.NearestFilter; atlas.minFilter = THREE.NearestFilter; atlas.generateMipmaps = false;
  const MATS = {
    opaque: new THREE.MeshLambertMaterial({ map: atlas }),
    cutout: new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.5, side: THREE.DoubleSide }),
    water: new THREE.MeshLambertMaterial({ map: atlas, transparent: true, opacity: 0.72, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ map: atlas })
  };
  for (const id in BLOCKS) if (BLOCKS[id].tiles) BLOCKS[id].t = BLOCKS[id].tiles.map(n => TILE_INDEX[n]);

  // ---------------------------------------------------------------
  //  Chunk meshing
  // ---------------------------------------------------------------
  const CS = 16, CW = W / CS, CD = D / CS;
  const chunks = [];
  for (let i = 0; i < CW * CD; i++) chunks.push({ meshes: {}, dirty: true });
  const FACES = [
    { dir: [-1, 0, 0], c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
    { dir: [1, 0, 0], c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
    { dir: [0, -1, 0], c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
    { dir: [0, 1, 0], c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
    { dir: [0, 0, -1], c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
    { dir: [0, 0, 1], c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] }
  ];
  const CROSS = [
    [[0, 0, 0, 0, 0], [1, 0, 1, 1, 0], [0, 1, 0, 0, 1], [1, 1, 1, 1, 1]],
    [[1, 0, 0, 0, 0], [0, 0, 1, 1, 0], [1, 1, 0, 0, 1], [0, 1, 1, 1, 1]]
  ];
  function pushUV(arr, t, u, v) {
    const e = 0.02, col = t % ATLAS_N, row = Math.floor(t / ATLAS_N);
    arr.push((col + e + u * (1 - 2 * e)) / ATLAS_N, 1 - (row + 1 - (e + v * (1 - 2 * e))) / ATLAS_N);
  }
  function buildChunk(cx, cz) {
    const bl = {};
    for (const k in MATS) bl[k] = { pos: [], nor: [], uv: [], ind: [] };
    for (let y = 0; y < H; y++) for (let z = cz * CS; z < cz * CS + CS; z++) for (let x = cx * CS; x < cx * CS + CS; x++) {
      const id = world[idx(x, y, z)];
      if (!id) continue;
      const def = BLOCKS[id], b = bl[def.layer];
      if (def.shape === 'cross') {
        for (const quad of CROSS) {
          const n = b.pos.length / 3;
          for (const c of quad) { b.pos.push(x + c[0], y + c[1], z + c[2]); b.nor.push(0, 1, 0); pushUV(b.uv, def.t[1], c[3], c[4]); }
          b.ind.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
        }
        continue;
      }
      const small = def.shape === 'small';
      const lower = id === B.WATER && getB(x, y + 1, z) !== B.WATER;
      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        if (!small) {
          const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
          if (nx < 0 || nx >= W || nz < 0 || nz >= D || ny < 0) continue;
          const nid = ny >= H ? 0 : world[idx(nx, ny, nz)];
          if (nid) {
            if (BLOCKS[nid].opaque) continue;
            if (nid === id && def.layer !== 'opaque') continue;
          }
        }
        const t = f === 3 ? def.t[0] : f === 2 ? def.t[2] : def.t[1];
        const n = b.pos.length / 3;
        for (const c of face.c) {
          let px = c[0], py = c[1], pz = c[2];
          if (small) { px = 0.25 + px * 0.5; py = py * 0.7; pz = 0.25 + pz * 0.5; }
          if (lower && py === 1) py = 0.88;
          b.pos.push(x + px, y + py, z + pz);
          b.nor.push(face.dir[0], face.dir[1], face.dir[2]);
          pushUV(b.uv, t, c[3], c[4]);
        }
        b.ind.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
      }
    }
    const chunk = chunks[cx + cz * CW];
    for (const k in MATS) {
      const old = chunk.meshes[k];
      if (old) { scene.remove(old); old.geometry.dispose(); chunk.meshes[k] = null; }
      const b = bl[k];
      if (!b.ind.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setIndex(b.ind);
      const mesh = new THREE.Mesh(geo, MATS[k]);
      if (k === 'water') mesh.renderOrder = 2;
      scene.add(mesh);
      chunk.meshes[k] = mesh;
    }
    chunk.dirty = false;
  }
  function markDirty(x, z) {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const mark = (a, b) => { if (a >= 0 && a < CW && b >= 0 && b < CD) chunks[a + b * CW].dirty = true; };
    mark(cx, cz);
    if (x % CS === 0) mark(cx - 1, cz);
    if (x % CS === CS - 1) mark(cx + 1, cz);
    if (z % CS === 0) mark(cx, cz - 1);
    if (z % CS === CS - 1) mark(cx, cz + 1);
  }
  function rebuildDirty() {
    for (let cz = 0; cz < CD; cz++) for (let cx = 0; cx < CW; cx++)
      if (chunks[cx + cz * CW].dirty) buildChunk(cx, cz);
  }
  function setBlock(x, y, z, id) {
    if (!inBounds(x, y, z)) return;
    world[idx(x, y, z)] = id;
    edits.set(idx(x, y, z), id);
    markDirty(x, z);
  }

  // ---------------------------------------------------------------
  //  Scenery: sea around the island, clouds, fireflies
  // ---------------------------------------------------------------
  function buildScenery() {
    const seaMat = new THREE.MeshLambertMaterial({ color: 0x8fd3f4, transparent: true, opacity: 0.8 });
    const far = 500, y = SEA + 0.88;
    [[-far, -far, W + far, 0], [-far, D, W + far, D + far], [-far, 0, 0, D], [W, 0, W + far, D]].forEach(r => {
      const g = new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]);
      const m = new THREE.Mesh(g, seaMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((r[0] + r[2]) / 2, y, (r[1] + r[3]) / 2);
      scene.add(m);
    });
  }
  const clouds = [];
  function buildClouds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
    const rnd = mulberry32(99);
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const n = 2 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(6 + rnd() * 8, 2 + rnd() * 1.5, 5 + rnd() * 5), mat);
        m.position.set(j * 5 - n * 2.5, rnd() * 1.5, rnd() * 4 - 2);
        g.add(m);
      }
      g.position.set(rnd() * 300 - 100, 58 + rnd() * 12, rnd() * 300 - 100);
      scene.add(g); clouds.push(g);
    }
  }
  const FIREFLY_N = 60;
  const fireflyData = [];
  const fireflyGeo = new THREE.BufferGeometry();
  fireflyGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(FIREFLY_N * 3), 3));
  const fireflyMat = new THREE.PointsMaterial({ color: 0xfff3a0, size: 0.14, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  fireflies.frustumCulled = false; fireflies.visible = false;
  scene.add(fireflies);
  for (let i = 0; i < FIREFLY_N; i++) fireflyData.push({ x: 0, y: -99, z: 0, p: Math.random() * 10 });

  // ---------------------------------------------------------------
  //  Game state
  // ---------------------------------------------------------------
  const player = { x: VC.x + 0.5, y: GROUND + 1, z: VC.z + 6.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false, inWater: false };
  const HW = 0.3, PH = 1.7, EYE = 1.55;
  const inv = {};
  const hotbar = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let sel = 0;
  const quest = { index: 0, stage: 'offer', progress: [] };
  const flags = { fireflies: false, finished: false };
  let ducks = [];            // 'lost' | 'follow' | 'home' for each quest duckling
  let dayTime = 0.08;
  let time = 0;
  let locked = false, invOpen = false, noSave = false;
  let fireworksTimer = 0, fireworksNext = 0;
  const keys = {};

  // ---------------------------------------------------------------
  //  Sound
  // ---------------------------------------------------------------
  let actx = null;
  function tone(freq, dur, type, vol, delay, slideTo) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + (delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* sound is optional */ }
  }
  const sfx = {
    dig() { tone(220, 0.09, 'triangle', 0.09, 0, 120); },
    place() { tone(420, 0.07, 'sine', 0.07, 0, 520); },
    pickup() { tone(880, 0.07, 'sine', 0.05); tone(1320, 0.1, 'sine', 0.05, 0.06); },
    talk() { tone(620, 0.05, 'square', 0.025); tone(740, 0.05, 'square', 0.025, 0.06); },
    heart() { tone(700, 0.12, 'sine', 0.06, 0, 1050); },
    quest() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.11)); },
    quack() { tone(520, 0.08, 'sawtooth', 0.03, 0, 380); tone(520, 0.08, 'sawtooth', 0.03, 0.1, 380); },
    boom() { tone(160, 0.3, 'triangle', 0.08, 0, 60); tone(1200, 0.25, 'sine', 0.03, 0.05, 2000); }
  };

  // ---------------------------------------------------------------
  //  HUD: toasts, hotbar, backpack, dialog, tracker
  // ---------------------------------------------------------------
  function toast(text, big) {
    const el = document.createElement('div');
    el.className = 'toast panel' + (big ? ' big' : '');
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, big ? 4500 : 2600);
  }
  function slotEl(item, count, key, selected) {
    const el = document.createElement('div');
    el.className = 'slot' + (selected ? ' sel' : '');
    if (item) {
      el.style.backgroundImage = 'url(' + tileIcon(BLOCKS[item].icon) + ')';
      el.title = BLOCKS[item].name;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = count; el.appendChild(n);
    }
    if (key) { const k = document.createElement('span'); k.className = 'k'; k.textContent = key; el.appendChild(k); }
    return el;
  }
  function renderHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    hotbar.forEach((item, i) => bar.appendChild(slotEl(item, inv[item] || 0, i + 1, i === sel)));
    $('itemName').textContent = hotbar[sel] ? BLOCKS[hotbar[sel]].name : '';
    if (invOpen) renderInventory();
  }
  function renderInventory() {
    const grid = $('invGrid');
    grid.innerHTML = '';
    const items = Object.keys(inv).map(Number).filter(i => inv[i] > 0);
    if (!items.length) grid.textContent = 'Your backpack is empty. Break some blocks to fill it!';
    items.forEach(item => {
      const el = slotEl(item, inv[item]);
      el.addEventListener('click', () => {
        const at = hotbar.indexOf(item);
        if (at >= 0) hotbar[at] = hotbar[sel];
        hotbar[sel] = item;
        renderHotbar();
      });
      grid.appendChild(el);
    });
  }
  function give(item, n, quiet) {
    inv[item] = (inv[item] || 0) + n;
    if (hotbar.indexOf(item) < 0) {
      const empty = hotbar[sel] === 0 ? sel : hotbar.indexOf(0);
      if (empty >= 0) hotbar[empty] = item;
    }
    if (!quiet) toast('+' + n + ' ' + BLOCKS[item].name);
    renderHotbar();
    questEvent('collect', { item: item, n: n });
  }
  function take(item, n) {
    inv[item] = Math.max(0, (inv[item] || 0) - n);
    if (inv[item] === 0) { const at = hotbar.indexOf(item); if (at >= 0) hotbar[at] = 0; }
    renderHotbar();
  }
  function toggleInventory(open) {
    invOpen = open;
    $('inventory').style.display = open ? 'block' : 'none';
    if (open) { renderInventory(); document.exitPointerLock(); }
    else if (!TEST) canvas.requestPointerLock();
  }

  let dialog = null, dialogAt = 0;
  function showDialog(who, lines, onDone) {
    dialog = { who: who, lines: lines, i: 0, onDone: onDone };
    dialogAt = performance.now();
    $('dialog').style.display = 'block';
    $('dialog').querySelector('.who').textContent = who;
    $('dialog').querySelector('.text').textContent = lines[0];
    sfx.talk();
  }
  function advanceDialog() {
    if (!dialog || performance.now() - dialogAt < 250) return;
    dialogAt = performance.now();
    dialog.i++;
    if (dialog.i < dialog.lines.length) {
      $('dialog').querySelector('.text').textContent = dialog.lines[dialog.i];
      sfx.talk();
    } else {
      const done = dialog.onDone;
      dialog = null;
      $('dialog').style.display = 'none';
      if (done) done();
    }
  }

  // ---------------------------------------------------------------
  //  Quests
  // ---------------------------------------------------------------
  const currentQuest = () => QUESTS[quest.index];
  function goalProgress(i) {
    const g = currentQuest().goals[i];
    if (g.type === 'have') return Math.min(g.count, inv[g.item] || 0);
    if (g.type === 'petsAt') {
      const c = WORLD[g.near];
      return Math.min(g.count, entities.filter(e => e.pet && Math.hypot(e.x - c.x, e.z - c.z) <= g.radius).length);
    }
    return Math.min(g.count, quest.progress[i] || 0);
  }
  function questReady() {
    const q = currentQuest();
    return !!q && quest.stage === 'active' && q.goals.every((g, i) => goalProgress(i) >= g.count);
  }
  let wasReady = false;
  function renderTracker() {
    const el = $('tracker'), q = currentQuest();
    if (!q) {
      el.innerHTML = '<h3>All quests complete!</h3><div class="hint">Pebblebrook is yours to build. Have fun!</div>';
      return;
    }
    const giver = VILLAGERS[q.giver].name;
    let html = '<h3>' + q.title + '</h3>';
    if (quest.stage === 'offer') html += '<div class="hint">Talk to <b>' + giver + '</b> in the village square.</div>';
    else {
      q.goals.forEach((g, i) => {
        const p = goalProgress(i), done = p >= g.count;
        html += '<div class="goal' + (done ? ' done' : '') + '">' + (done ? '&#10004; ' : '&#9675; ') + g.text + ' (' + p + '/' + g.count + ')</div>';
      });
      if (questReady()) html += '<div class="hint"><b>Done! Go back to ' + giver + '.</b></div>';
    }
    el.innerHTML = html;
    const ready = questReady();
    if (ready && !wasReady) { toast('Quest ready! Go and see ' + giver + '.'); sfx.pickup(); }
    wasReady = ready;
  }
  function questEvent(type, data) {
    const q = currentQuest();
    if (!q || quest.stage !== 'active') return;
    q.goals.forEach((g, i) => {
      let add = 0;
      if (g.type === 'collect' && type === 'collect' && g.item === data.item) add = data.n;
      else if (g.type === 'place' && type === 'place') {
        const c = g.near ? WORLD[g.near] : null;
        if ((!g.items || g.items.indexOf(data.item) >= 0) && (!c || Math.hypot(data.x - c.x, data.z - c.z) <= g.radius)) add = 1;
      } else if (g.type === 'befriend' && type === 'befriend' && g.pet === data.pet) add = 1;
      else if (g.type === 'event' && type === g.event) add = 1;
      if (add) quest.progress[i] = Math.min(g.count, (quest.progress[i] || 0) + add);
    });
    renderTracker();
  }
  function startQuest() {
    const q = currentQuest();
    quest.stage = 'active';
    quest.progress = q.goals.map(g => {
      if (g.type === 'collect') return Math.min(g.count, inv[g.item] || 0);
      if (g.type === 'befriend') return Math.min(g.count, entities.filter(e => e.pet && e.type === g.pet).length);
      return 0;
    });
    if (q.onStart) runEffect(q.onStart);
    toast('New quest: ' + q.title);
    sfx.pickup();
    wasReady = false;
    renderTracker();
    save();
  }
  function completeQuest() {
    const q = currentQuest();
    (q.take || []).forEach(t => take(t[0], t[1]));
    (q.rewards || []).forEach(r => give(r[0], r[1]));
    toast('Quest complete: ' + q.title + '!', true);
    sfx.quest();
    quest.index++; quest.stage = 'offer'; quest.progress = [];
    if (q.onComplete) runEffect(q.onComplete);
    wasReady = false;
    renderTracker();
    save();
  }
  function talkTo(v) {
    const q = currentQuest();
    if (q && q.giver === v.id) {
      if (quest.stage === 'offer') showDialog(v.name, q.offer, startQuest);
      else if (questReady()) showDialog(v.name, q.done, completeQuest);
      else showDialog(v.name, [q.remind]);
    } else {
      const lines = v.def.chatter;
      showDialog(v.name, [flags.finished && Math.random() < 0.4 ? 'Best pet parade ever. We should do it every week!' : lines[Math.floor(Math.random() * lines.length)]]);
    }
  }
  const DUCK_SPOTS = [[VC.x - 30, VC.z + 8], [VC.x + 6, VC.z + 30], [VC.x + 26, VC.z + 6]];
  function runEffect(name) {
    if (name === 'spawnDucklings') {
      ducks = ['lost', 'lost', 'lost'];
      spawnQuestDucks();
    } else if (name === 'fireflies') {
      flags.fireflies = true;
      dayTime = 0.54;
    } else if (name === 'duckPet') {
      let d = entities.find(e => e.type === 'duck' && e.state === 'home');
      if (!d) d = spawnAnimal('duck', PC.x + 0.5, PC.z + 0.5);
      makePet(d);
    } else if (name === 'kitten') {
      const hb = entities.find(e => e.id === 'honeybun');
      const k = spawnAnimal('kitten', hb.x + 1, hb.z + 1);
      makePet(k);
    } else if (name === 'fireworks') {
      flags.finished = true;
      fireworksTimer = 30;
      if (dayTime < 0.54 || dayTime > 0.9) dayTime = 0.56;
    }
  }

  // ---------------------------------------------------------------
  //  Creatures and villagers
  // ---------------------------------------------------------------
  const entities = [];
  const lamberts = {};
  const lam = c => lamberts[c] || (lamberts[c] = new THREE.MeshLambertMaterial({ color: c }));
  function box(parent, w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function pill(ctx, x, y, w, h) {
    const r = h / 2;
    ctx.beginPath(); ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath(); ctx.fill();
  }
  function makeLabel(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.font = 'bold 30px Trebuchet MS, Verdana, sans-serif';
    const w = Math.min(244, x.measureText(text).width + 36);
    x.fillStyle = 'rgba(255,250,244,0.92)'; pill(x, 128 - w / 2, 10, w, 44);
    x.fillStyle = '#e0679a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 33);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.scale.set(1.6, 0.4, 1);
    return s;
  }
  function makeMarker(ch, bg) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fill();
    x.lineWidth = 5; x.strokeStyle = '#ffffff'; x.stroke();
    x.fillStyle = '#ffffff'; x.font = 'bold 42px Trebuchet MS, Verdana, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, 32, 35);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
    s.scale.set(0.6, 0.6, 1);
    return s;
  }
  const heartTex = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = '#ff7fae';
    x.beginPath(); x.arc(10, 11, 7, 0, Math.PI * 2); x.arc(22, 11, 7, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(3.5, 14); x.lineTo(16, 29); x.lineTo(28.5, 14); x.closePath(); x.fill();
    x.fillStyle = '#ffd1e3'; x.fillRect(7, 7, 4, 3);
    return new THREE.CanvasTexture(c);
  })();
  const heartMat = new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false });

  function modelBunny(c) {
    const g = new THREE.Group();
    box(g, 0.42, 0.34, 0.55, c, 0, 0.27, 0);
    box(g, 0.36, 0.32, 0.32, c, 0, 0.52, 0.3);
    box(g, 0.09, 0.3, 0.07, c, -0.1, 0.82, 0.26); box(g, 0.09, 0.3, 0.07, c, 0.1, 0.82, 0.26);
    box(g, 0.05, 0.22, 0.02, '#ffc1d6', -0.1, 0.82, 0.3); box(g, 0.05, 0.22, 0.02, '#ffc1d6', 0.1, 0.82, 0.3);
    box(g, 0.15, 0.15, 0.12, '#ffffff', 0, 0.34, -0.32);
    box(g, 0.05, 0.06, 0.02, '#4a3b5c', -0.1, 0.57, 0.465); box(g, 0.05, 0.06, 0.02, '#4a3b5c', 0.1, 0.57, 0.465);
    box(g, 0.05, 0.04, 0.02, '#ff8fab', 0, 0.5, 0.47);
    box(g, 0.07, 0.04, 0.02, '#ffc1d6', -0.14, 0.48, 0.463); box(g, 0.07, 0.04, 0.02, '#ffc1d6', 0.14, 0.48, 0.463);
    [[-0.13, 0.2], [0.13, 0.2], [-0.13, -0.2], [0.13, -0.2]].forEach(p => box(g, 0.12, 0.1, 0.14, c, p[0], 0.05, p[1]));
    return g;
  }
  function modelDuck() {
    const g = new THREE.Group(), c = '#ffe27a';
    box(g, 0.34, 0.28, 0.42, c, 0, 0.24, 0);
    box(g, 0.26, 0.26, 0.26, c, 0, 0.5, 0.16);
    box(g, 0.14, 0.06, 0.12, '#ffab5c', 0, 0.46, 0.34);
    box(g, 0.05, 0.06, 0.02, '#4a3b5c', -0.08, 0.54, 0.295); box(g, 0.05, 0.06, 0.02, '#4a3b5c', 0.08, 0.54, 0.295);
    box(g, 0.04, 0.16, 0.24, '#f5cf55', -0.19, 0.26, -0.02); box(g, 0.04, 0.16, 0.24, '#f5cf55', 0.19, 0.26, -0.02);
    box(g, 0.1, 0.1, 0.08, c, 0, 0.36, -0.24);
    box(g, 0.1, 0.1, 0.12, '#ffab5c', -0.09, 0.05, 0.02); box(g, 0.1, 0.1, 0.12, '#ffab5c', 0.09, 0.05, 0.02);
    return g;
  }
  function modelKitten() {
    const g = new THREE.Group(), c = '#f6b98a', w = '#fff6ea';
    box(g, 0.36, 0.3, 0.6, c, 0, 0.31, 0);
    box(g, 0.38, 0.32, 0.3, c, 0, 0.54, 0.36);
    box(g, 0.1, 0.1, 0.06, c, -0.13, 0.75, 0.36); box(g, 0.1, 0.1, 0.06, c, 0.13, 0.75, 0.36);
    box(g, 0.2, 0.12, 0.02, w, 0, 0.46, 0.515);
    box(g, 0.05, 0.07, 0.02, '#4a3b5c', -0.1, 0.59, 0.515); box(g, 0.05, 0.07, 0.02, '#4a3b5c', 0.1, 0.59, 0.515);
    box(g, 0.05, 0.04, 0.02, '#ff8fab', 0, 0.5, 0.53);
    const tail = box(g, 0.08, 0.36, 0.08, c, 0, 0.56, -0.33); tail.rotation.x = -0.5;
    box(g, 0.08, 0.1, 0.08, w, 0, 0.74, -0.42);
    [[-0.12, 0.22], [0.12, 0.22], [-0.12, -0.22], [0.12, -0.22]].forEach(p => box(g, 0.1, 0.16, 0.1, w, p[0], 0.08, p[1]));
    return g;
  }
  function modelVillager(d) {
    const g = new THREE.Group();
    box(g, 0.18, 0.4, 0.18, '#7a6a8c', -0.13, 0.2, 0); box(g, 0.18, 0.4, 0.18, '#7a6a8c', 0.13, 0.2, 0);
    box(g, 0.58, 0.62, 0.36, d.dress, 0, 0.7, 0);
    box(g, 0.66, 0.14, 0.44, d.dress, 0, 0.45, 0);
    box(g, 0.14, 0.5, 0.16, d.dress, -0.36, 0.72, 0); box(g, 0.14, 0.5, 0.16, d.dress, 0.36, 0.72, 0);
    box(g, 0.14, 0.1, 0.16, d.skin, -0.36, 0.44, 0); box(g, 0.14, 0.1, 0.16, d.skin, 0.36, 0.44, 0);
    box(g, 0.5, 0.48, 0.46, d.skin, 0, 1.26, 0);
    box(g, 0.56, 0.16, 0.52, d.hair, 0, 1.54, 0);
    box(g, 0.56, 0.42, 0.1, d.hair, 0, 1.34, -0.25);
    box(g, 0.07, 0.09, 0.02, '#4a3b5c', -0.12, 1.3, 0.235); box(g, 0.07, 0.09, 0.02, '#4a3b5c', 0.12, 1.3, 0.235);
    box(g, 0.09, 0.05, 0.02, '#ffb3c8', -0.19, 1.19, 0.235); box(g, 0.09, 0.05, 0.02, '#ffb3c8', 0.19, 1.19, 0.235);
    box(g, 0.12, 0.03, 0.02, '#c9627f', 0, 1.14, 0.235);
    if (d.hat) { box(g, 0.44, 0.22, 0.44, d.hat, 0, 1.72, 0); box(g, 0.52, 0.14, 0.52, d.hat, 0, 1.86, 0); }
    return g;
  }

  function surfaceY(x, z, fromY) {
    const xi = Math.floor(x), zi = Math.floor(z);
    let y = Math.min(H - 1, Math.floor(fromY + 0.01) + 1);
    while (y >= 0 && !isSolid(xi, y, zi)) y--;
    const g = y + 1;
    if (getB(xi, g, zi) === B.WATER) {
      let wy = g;
      while (getB(xi, wy + 1, zi) === B.WATER) wy++;
      return { y: wy + 0.55, water: true };
    }
    return { y: g, water: false };
  }
  function addEntity(e) {
    e.group.position.set(e.x, e.y, e.z);
    scene.add(e.group);
    entities.push(e);
    return e;
  }
  function removeEntity(e) {
    scene.remove(e.group);
    const i = entities.indexOf(e);
    if (i >= 0) entities.splice(i, 1);
  }
  const BUNNY_COLORS = ['#ffffff', '#fff1dc', '#e9d5c0', '#d8d3e6', '#ffe3ec'];
  function spawnAnimal(type, x, z, yHint) {
    const g = type === 'bunny' ? modelBunny(BUNNY_COLORS[Math.floor(Math.random() * BUNNY_COLORS.length)])
      : type === 'duck' ? modelDuck() : modelKitten();
    const y = surfaceY(x, z, yHint === undefined ? topY(clamp(Math.floor(x), 0, W - 1), clamp(Math.floor(z), 0, D - 1)) + 1 : yHint).y;
    return addEntity({
      type: type, group: g, x: x, y: y, z: z, height: 0.7, state: 'wander', anchor: { x: x, z: z, r: 6 },
      target: null, timer: Math.random() * 3, fed: 0, pet: false, phase: Math.random() * 6, stuck: 0, moving: false, joy: 0
    });
  }
  function setMarker(e, on) {
    if (on && !e.marker) { e.marker = makeMarker('!', '#ffc94d'); e.marker.position.y = e.height + 0.75; e.group.add(e.marker); }
    if (e.marker) e.marker.visible = on;
  }
  function usedNames() { return entities.filter(e => e.pet).map(e => e.name); }
  function makePet(e, name) {
    if (!name) {
      const free = PET_NAMES.filter(n => usedNames().indexOf(n) < 0);
      name = (free.length ? free : PET_NAMES)[Math.floor(Math.random() * (free.length || PET_NAMES.length))];
    }
    e.pet = true; e.state = 'follow'; e.name = name;
    setMarker(e, false);
    e.label = makeLabel(name); e.label.position.y = e.height + 0.3; e.group.add(e.label);
    const nice = { bunny: 'bunny', duck: 'duckling', kitten: 'kitten' }[e.type];
    toast(name + ' the ' + nice + ' is now your pet!', true);
    hearts(e, 5); sfx.quest();
    questEvent('befriend', { pet: e.type });
    renderTracker();
  }
  function hearts(e, n) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(heartMat);
      s.scale.set(0.3, 0.3, 1);
      s.position.set(e.x + (Math.random() - 0.5) * 0.6, e.y + e.height + Math.random() * 0.3, e.z + (Math.random() - 0.5) * 0.6);
      scene.add(s);
      particles.push({ m: s, vx: 0, vy: 0.9 + Math.random() * 0.5, vz: 0, g: 0, life: 1.1 + i * 0.12, max: 1.1 + i * 0.12, s: 0.3 });
    }
    e.joy = 0.8;
  }
  function spawnVillagers() {
    for (const id in VILLAGERS) {
      const d = VILLAGERS[id];
      const x = VC.x + 0.5 + d.pos[0], z = VC.z + 0.5 + d.pos[1];
      const e = addEntity({ type: 'villager', id: id, def: d, name: d.name, group: modelVillager(d), x: x, y: GROUND + 1, z: z, height: 1.7, state: 'static', phase: Math.random() * 6 });
      const label = makeLabel(d.name); label.position.y = 2.25; e.group.add(label);
      e.offer = makeMarker('!', '#ffc94d'); e.offer.position.y = 2.8; e.group.add(e.offer);
      e.ready = makeMarker('★', '#6fd19a'); e.ready.position.y = 2.8; e.group.add(e.ready);
    }
  }
  function spawnWildlife() {
    [[VC.x + 12.5, VC.z + 7.5], [VC.x - 5.5, VC.z + 13.5], [VC.x + 7.5, VC.z - 9.5], [VC.x - 9.5, VC.z - 7.5]]
      .forEach(p => spawnAnimal('bunny', p[0], p[1]));
    const rnd = mulberry32(WORLD.SEED + 7);
    let made = 0;
    for (let i = 0; i < 200 && made < 7; i++) {
      const x = 6 + Math.floor(rnd() * (W - 12)), z = 6 + Math.floor(rnd() * (D - 12)), h = topY(x, z);
      if (getB(x, h, z) !== B.GRASS || isSolid(x, h + 1, z) || Math.hypot(x - VC.x, z - VC.z) < 20) continue;
      spawnAnimal('bunny', x + 0.5, z + 0.5); made++;
    }
  }
  function spawnQuestDucks() {
    ducks.forEach((st, i) => {
      if (st === 'home') {
        const d = spawnAnimal('duck', PC.x + 0.5 + i - 1, PC.z + 0.5);
        d.state = 'home'; d.duck = i; d.anchor = { x: PC.x + 0.5, z: PC.z + 0.5, r: 3.5 };
      } else {
        ducks[i] = 'lost';
        const d = spawnAnimal('duck', DUCK_SPOTS[i][0] + 0.5, DUCK_SPOTS[i][1] + 0.5);
        d.state = 'wander'; d.duck = i; d.anchor.r = 2.5; d.lost = true;
        setMarker(d, true); d.marker.scale.set(1.1, 1.1, 1); d.marker.position.y = 1.9;
      }
    });
  }
  function teleportNearPlayer(e) {
    const a = Math.random() * Math.PI * 2;
    e.x = clamp(player.x + Math.cos(a) * 1.8, 1, W - 1); e.z = clamp(player.z + Math.sin(a) * 1.8, 1, D - 1);
    e.y = surfaceY(e.x, e.z, player.y + 1).y;
    e.stuck = 0;
  }
  function interact(e) {
    if (e.type === 'villager') { talkTo(e); return; }
    if (e.pet) { hearts(e, 3); sfx.heart(); toast(e.name + ' loves you!'); return; }
    if (e.type === 'bunny') {
      if ((inv[B.BERRY] || 0) > 0) {
        take(B.BERRY, 1); e.fed++; hearts(e, 2); sfx.heart();
        if (e.fed >= 3) makePet(e);
        else toast('The bunny munches the berry. ' + (3 - e.fed) + ' more to go!');
      } else toast('Bunnies love berries. Find a berry bush and pick some!');
      return;
    }
    if (e.type === 'duck') {
      if (e.lost && e.state !== 'follow') {
        e.state = 'follow'; ducks[e.duck] = 'follow'; setMarker(e, false);
        hearts(e, 2); sfx.quack(); toast('Quack! The duckling is following you. Lead it to the pond!');
      } else { hearts(e, 1); sfx.quack(); }
    }
  }
  function updateEntities(dt) {
    const q = currentQuest();
    let petIndex = 0;
    for (const e of entities) {
      if (e.type === 'villager') {
        const s = surfaceY(e.x, e.z, e.y);
        e.y += (s.y - e.y) * Math.min(1, dt * 10);
        const dx = player.x - e.x, dz = player.z - e.z;
        const want = Math.hypot(dx, dz) < 9 ? Math.atan2(dx, dz) : Math.atan2(VC.x + 0.5 - e.x, VC.z + 2.5 - e.z);
        let diff = want - e.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.group.rotation.y += diff * Math.min(1, dt * 6);
        e.group.position.set(e.x, e.y + Math.sin(time * 2 + e.phase) * 0.02, e.z);
        const mine = q && q.giver === e.id;
        e.offer.visible = !!mine && quest.stage === 'offer';
        e.ready.visible = !!mine && questReady();
        const bob = 2.8 + Math.sin(time * 4) * 0.08;
        e.offer.position.y = bob; e.ready.position.y = bob;
        continue;
      }
      let tx = null, tz = null, speed = 1.3;
      if (e.state === 'follow') {
        const k = petIndex++;
        const gx = player.x + Math.cos(k * 2.4) * 2.1, gz = player.z + Math.sin(k * 2.4) * 2.1;
        const dist = Math.hypot(gx - e.x, gz - e.z);
        if (dist > 28 || e.stuck > 1.6) teleportNearPlayer(e);
        else if (dist > 1.1) { tx = gx; tz = gz; speed = dist > 6 ? 7.5 : dist > 3 ? 5 : 2.6; }
        if (e.lost && Math.hypot(e.x - PC.x - 0.5, e.z - PC.z - 0.5) < 7.5) {
          e.state = 'home'; e.lost = false; ducks[e.duck] = 'home';
          e.anchor = { x: PC.x + 0.5, z: PC.z + 0.5, r: 3.5 }; e.target = null;
          setMarker(e, false); hearts(e, 4); sfx.quack();
          toast('The duckling is home! Splash!');
          questEvent('duckHome');
          save();
        }
      } else {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 2 + Math.random() * 4;
          if (Math.random() < 0.3) e.target = null;
          else {
            const a = Math.random() * Math.PI * 2, r = Math.random() * e.anchor.r;
            e.target = { x: e.anchor.x + Math.cos(a) * r, z: e.anchor.z + Math.sin(a) * r };
          }
        }
        if (e.target) {
          if (Math.hypot(e.target.x - e.x, e.target.z - e.z) < 0.3) e.target = null;
          else { tx = e.target.x; tz = e.target.z; }
        }
      }
      e.moving = false;
      if (tx !== null) {
        const dx = tx - e.x, dz = tz - e.z, len = Math.hypot(dx, dz) || 1;
        const nx = e.x + dx / len * speed * dt, nz = e.z + dz / len * speed * dt;
        const s = surfaceY(nx, nz, e.y);
        const following = e.state === 'follow';
        const ok = s.y - e.y <= 1.2 && (following || (e.y - s.y <= 3 && (!s.water || e.type === 'duck')));
        if (ok) { e.x = nx; e.z = nz; e.moving = true; e.stuck = 0; e.group.rotation.y = Math.atan2(dx, dz); }
        else if (following) e.stuck += dt; else e.target = null;
      }
      const s = surfaceY(e.x, e.z, e.y);
      e.y += (s.y - e.y) * Math.min(1, dt * 12);
      e.joy = Math.max(0, e.joy - dt);
      const hop = e.moving ? Math.abs(Math.sin(time * 11 + e.phase)) * 0.13 : e.joy > 0 ? Math.abs(Math.sin(time * 14)) * 0.2 : 0;
      e.group.position.set(e.x, e.y + hop - (s.water ? 0.25 : 0), e.z);
      if (e.marker && e.marker.visible) e.marker.position.y = (e.lost ? 1.9 : e.height + 0.75) + Math.sin(time * 4) * 0.1;
    }
  }
  function pickEntity(ox, oy, oz, dx, dy, dz) {
    let best = null;
    for (const e of entities) {
      const vx = e.x - ox, vy = e.y + e.height / 2 - oy, vz = e.z - oz;
      const t = vx * dx + vy * dy + vz * dz;
      if (t < 0 || t > 5) continue;
      const r = e.type === 'villager' ? 0.75 : 0.5;
      if (vx * vx + vy * vy + vz * vz - t * t < r * r && (!best || t < best.t)) best = { e: e, t: t };
    }
    return best;
  }

  // ---------------------------------------------------------------
  //  Particles (block crumbs, hearts, fireworks)
  // ---------------------------------------------------------------
  const particles = [];
  const crumbGeo = new THREE.BoxGeometry(1, 1, 1);
  const basics = {};
  const basicMat = c => basics[c] || (basics[c] = new THREE.MeshBasicMaterial({ color: c, fog: false }));
  function burst(x, y, z, color, n, speed, size, gravity, life, lit) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(crumbGeo, lit ? basicMat(color) : lam(color));
      m.scale.setScalar(size);
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), sp = speed * (0.5 + Math.random() * 0.5);
      scene.add(m);
      particles.push({ m: m, vx: Math.sin(b) * Math.cos(a) * sp, vy: Math.cos(b) * sp + (lit ? 0 : 2), vz: Math.sin(b) * Math.sin(a) * sp, g: gravity, life: life, max: life, s: size });
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const k = Math.min(1, p.life / p.max * 2) * p.s;
      if (p.m.isSprite) p.m.scale.set(k, k, 1); else p.m.scale.setScalar(k);
    }
  }
  const FIREWORK_COLORS = ['#ff8fbd', '#ffe27a', '#aef0d1', '#b8f3ff', '#d5bbff', '#ffffff', '#ffb347'];
  function updateFireworks(dt) {
    if (fireworksTimer <= 0) return;
    fireworksTimer -= dt; fireworksNext -= dt;
    if (fireworksNext <= 0) {
      fireworksNext = 0.3 + Math.random() * 0.4;
      const c = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      burst(VC.x + (Math.random() - 0.5) * 22, GROUND + 11 + Math.random() * 9, VC.z + (Math.random() - 0.5) * 22, c, 30, 7, 0.22, 4, 1.5, true);
      sfx.boom();
    }
  }

  // ---------------------------------------------------------------
  //  Looking at, breaking and placing blocks
  // ---------------------------------------------------------------
  function lookDir() {
    const cp = Math.cos(player.pitch);
    return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
  }
  function raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tx = dx ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let t = 0, px = null, py = null, pz = null;
    while (t <= maxT) {
      const id = getB(x, y, z);
      if (id && id !== B.WATER) return { x: x, y: y, z: z, id: id, px: px, py: py, pz: pz, t: t };
      px = x; py = y; pz = z;
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; }
      else { z += sz; t = tz; tz += tdz; }
    }
    return null;
  }
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }));
  outline.visible = false;
  scene.add(outline);

  function breakBlock(hit) {
    const def = BLOCKS[hit.id];
    if (!def.breakable || hit.y <= 0) return;
    const x = hit.x, y = hit.y, z = hit.z;
    const above = getB(x, y + 1, z);
    if (above && BLOCKS[above].shape === 'cross') { setBlock(x, y + 1, z, 0); give(BLOCKS[above].drop, 1); }
    const wet = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(d => getB(x + d[0], y + d[1], z + d[2]) === B.WATER);
    setBlock(x, y, z, wet ? B.WATER : 0);
    burst(x + 0.5, y + 0.5, z + 0.5, def.color, 7, 2.2, 0.13, 12, 0.5, false);
    sfx.dig();
    give(def.drop, 1);
  }
  function placeBlock(hit) {
    const item = hotbar[sel];
    if (!item || !(inv[item] > 0)) return;
    const def = BLOCKS[item];
    if (!def.placeable) { toast(def.name + ' cannot be placed. It is for a friend!'); return; }
    if (hit.px === null) return;
    const x = hit.px, y = hit.py, z = hit.pz;
    if (!inBounds(x, y, z) || y >= H - 1) return;
    const cur = getB(x, y, z);
    if (cur !== 0 && cur !== B.WATER) return;
    if (def.shape === 'cross' && !isSolid(x, y - 1, z)) return;
    if (def.solid && player.x - HW < x + 1 && player.x + HW > x && player.y < y + 1 && player.y + PH > y && player.z - HW < z + 1 && player.z + HW > z) return;
    setBlock(x, y, z, item);
    take(item, 1);
    sfx.place();
    questEvent('place', { item: item, x: x, z: z });
  }
  function doAction(button) {
    if (dialog) { advanceDialog(); return false; }
    const d = lookDir(), ox = player.x, oy = player.y + EYE, oz = player.z;
    const hit = raycast(ox, oy, oz, d[0], d[1], d[2], 5.5);
    const ent = pickEntity(ox, oy, oz, d[0], d[1], d[2]);
    if (ent && (!hit || ent.t < hit.t)) { interact(ent.e); return false; }
    if (!hit) return false;
    if (button === 0) breakBlock(hit); else placeBlock(hit);
    return true;
  }

  // ---------------------------------------------------------------
  //  Input
  // ---------------------------------------------------------------
  const mouse = { down: -1, timer: 0 };
  $('overlay').addEventListener('click', () => { canvas.requestPointerLock(); });
  $('newWorld').addEventListener('click', ev => {
    ev.stopPropagation();
    if (confirm('Start a brand new world? Your buildings, pets and quests will be reset.')) {
      noSave = true;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      location.reload();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked && invOpen) { invOpen = false; $('inventory').style.display = 'none'; }
    $('overlay').style.display = (locked || invOpen || TEST) ? 'none' : 'flex';
    if (!locked) { mouse.down = -1; for (const k in keys) keys[k] = false; save(); }
  });
  document.addEventListener('mousemove', ev => {
    if (!locked) return;
    player.yaw -= ev.movementX * 0.0023;
    player.pitch = clamp(player.pitch - ev.movementY * 0.0023, -1.55, 1.55);
  });
  canvas.addEventListener('mousedown', ev => {
    if (!locked) return;
    const b = ev.button === 2 ? 2 : 0;
    if (doAction(b)) { mouse.down = b; mouse.timer = 0.28; }
  });
  document.addEventListener('mouseup', () => { mouse.down = -1; });
  document.addEventListener('contextmenu', ev => ev.preventDefault());
  document.addEventListener('wheel', ev => {
    if (!locked) return;
    sel = (sel + (ev.deltaY > 0 ? 1 : 8)) % 9;
    renderHotbar();
  });
  document.addEventListener('keydown', ev => {
    if (ev.code === 'KeyE' && !ev.repeat && (locked || invOpen)) {
      if (dialog) advanceDialog(); else toggleInventory(!invOpen);
      return;
    }
    if (!locked) return;
    keys[ev.code] = true;
    if (ev.code === 'Space' || ev.code === 'Tab') ev.preventDefault();
    if (dialog && (ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'KeyF') && !ev.repeat) { advanceDialog(); return; }
    if (ev.code === 'KeyF' && !ev.repeat) doAction(2);
    if (/^Digit[1-9]$/.test(ev.code)) { sel = Number(ev.code.slice(5)) - 1; renderHotbar(); }
  });
  document.addEventListener('keyup', ev => { keys[ev.code] = false; });

  // ---------------------------------------------------------------
  //  Player movement
  // ---------------------------------------------------------------
  function boxCollides(x, y, z) {
    const x0 = Math.floor(x - HW), x1 = Math.floor(x + HW), y0 = Math.floor(y), y1 = Math.floor(y + PH), z0 = Math.floor(z - HW), z1 = Math.floor(z + HW);
    for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) for (let i = x0; i <= x1; i++)
      if (isSolid(i, j, k)) return true;
    return false;
  }
  function physicsStep(dt) {
    const p = player;
    p.inWater = getB(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === B.WATER;
    let f = 0, s = 0;
    if (!dialog && locked) {
      f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    }
    const len = Math.hypot(f, s) || 1;
    let speed = (keys.ShiftLeft || keys.ShiftRight) ? 7.2 : 4.6;
    if (p.inWater) speed *= 0.6;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const wantX = (fx * f + rx * s) / len * speed, wantZ = (fz * f + rz * s) / len * speed;
    const grip = Math.min(1, dt * 14);
    p.vx += (wantX - p.vx) * grip; p.vz += (wantZ - p.vz) * grip;
    const jump = keys.Space && !dialog && locked;
    if (p.inWater) {
      p.vy -= 7 * dt;
      if (jump) p.vy += 22 * dt;
      p.vy = clamp(p.vy, -2.6, 3.6);
    } else {
      p.vy = Math.max(-30, p.vy - 26 * dt);
      if (jump && p.onGround) { p.vy = 8.4; p.onGround = false; }
    }
    let blocked = false;
    const nx = p.x + p.vx * dt;
    if (!boxCollides(nx, p.y, p.z)) p.x = nx; else { blocked = Math.abs(wantX) > 0.5; p.vx = 0; }
    const nz = p.z + p.vz * dt;
    if (!boxCollides(p.x, p.y, nz)) p.z = nz; else { blocked = blocked || Math.abs(wantZ) > 0.5; p.vz = 0; }
    // friendly auto-hop up single blocks
    if (blocked && (p.onGround || p.inWater)) {
      const ax = p.x + (Math.abs(wantX) > 0.5 ? Math.sign(wantX) * 0.25 : 0), az = p.z + (Math.abs(wantZ) > 0.5 ? Math.sign(wantZ) * 0.25 : 0);
      if (!boxCollides(ax, p.y + 1.1, az) && !boxCollides(p.x, p.y + 1.1, p.z)) { p.vy = p.inWater ? 5.5 : 8.4; p.onGround = false; }
    }
    const ny = p.y + p.vy * dt;
    if (!boxCollides(p.x, ny, p.z)) { p.y = ny; if (p.vy !== 0) p.onGround = false; }
    else {
      if (p.vy < 0) {
        const top = Math.floor(ny) + 1;
        if (top <= p.y && !boxCollides(p.x, top, p.z)) p.y = top;
        p.onGround = true;
      }
      p.vy = 0;
    }
    if (p.y < -5) { p.x = VC.x + 0.5; p.y = GROUND + 2; p.z = VC.z + 6.5; p.vy = 0; }
  }

  // ---------------------------------------------------------------
  //  Sky, light and time of day
  // ---------------------------------------------------------------
  const skyTmp = new THREE.Color();
  let daylight = 1;
  function updateSky(dt) {
    dayTime = (dayTime + dt / WORLD.DAY_LENGTH) % 1;
    const sunH = Math.sin(dayTime * Math.PI * 2) + 0.35;
    daylight = smoothstep(-0.25, 0.3, sunH);
    const dusk = clamp(1 - Math.abs(sunH) / 0.45, 0, 1);
    skyTmp.copy(SKY_NIGHT).lerp(SKY_DAY, daylight).lerp(SKY_DUSK, dusk * 0.7);
    scene.background.copy(skyTmp);
    scene.fog.color.copy(skyTmp);
    hemi.intensity = 0.42 + 0.28 * daylight;
    hemi.color.setRGB(0.78 + 0.22 * daylight, 0.8 + 0.2 * daylight, 1);
    sun.intensity = 0.06 + 0.3 * daylight;
    for (const c of clouds) { c.position.x += dt * 0.7; if (c.position.x > 220) c.position.x = -120; }

    const glow = flags.fireflies ? (1 - daylight) * 0.95 : 0;
    fireflies.visible = glow > 0.05;
    if (fireflies.visible) {
      fireflyMat.opacity = glow;
      const arr = fireflyGeo.attributes.position.array;
      for (let i = 0; i < FIREFLY_N; i++) {
        const f = fireflyData[i];
        if (f.y < -50 || Math.hypot(f.x - player.x, f.z - player.z) > 26) {
          f.x = clamp(player.x + (Math.random() - 0.5) * 40, 1, W - 2);
          f.z = clamp(player.z + (Math.random() - 0.5) * 40, 1, D - 2);
          f.y = surfaceY(f.x, f.z, H - 2).y + 0.6 + Math.random() * 2.5;
        }
        arr[i * 3] = f.x + Math.sin(time * 0.7 + f.p) * 1.2;
        arr[i * 3 + 1] = f.y + Math.sin(time * 1.3 + f.p * 2) * 0.4;
        arr[i * 3 + 2] = f.z + Math.cos(time * 0.6 + f.p) * 1.2;
      }
      fireflyGeo.attributes.position.needsUpdate = true;
    }
  }
  const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function updateCompass() {
    const dx = VC.x + 0.5 - player.x, dz = VC.z + 0.5 - player.z;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const dist = Math.round(Math.hypot(dx, dz));
    $('compassArrow').style.transform = dist < 4 ? 'none' : 'rotate(' + a + 'rad)';
    let heading = Math.atan2(fx, -fz);
    if (heading < 0) heading += Math.PI * 2;
    const facing = DIRS[Math.round(heading / (Math.PI / 4)) % 8];
    $('compassText').textContent = (dist < 4 ? 'You are in the village' : 'Village: ' + dist + ' blocks') + '  ·  facing ' + facing;
  }

  // ---------------------------------------------------------------
  //  Saving and loading
  // ---------------------------------------------------------------
  function save() {
    if (noSave || TEST) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, seed: WORLD.SEED, edits: Array.from(edits.entries()), inv: inv, hotbar: hotbar, sel: sel,
        player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch },
        quest: quest, flags: flags, ducks: ducks, dayTime: dayTime,
        pets: entities.filter(e => e.pet).map(e => ({ type: e.type, name: e.name }))
      }));
    } catch (e) { /* storage full or unavailable: keep playing */ }
  }
  function load() {
    if (TEST) return null;
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return s && s.v === 1 && s.seed === WORLD.SEED ? s : null;
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------
  //  Start up
  // ---------------------------------------------------------------
  generateWorld();
  const saved = load();
  if (saved) {
    saved.edits.forEach(e => { world[e[0]] = e[1]; edits.set(e[0], e[1]); });
    Object.assign(inv, saved.inv);
    saved.hotbar.forEach((h, i) => { hotbar[i] = h; });
    sel = saved.sel || 0;
    Object.assign(player, saved.player);
    quest.index = saved.quest.index; quest.stage = saved.quest.stage; quest.progress = saved.quest.progress || [];
    Object.assign(flags, saved.flags);
    ducks = saved.ducks || [];
    dayTime = saved.dayTime || 0.08;
  }
  buildScenery();
  buildClouds();
  rebuildDirty();
  spawnVillagers();
  spawnWildlife();
  if (saved) {
    (saved.pets || []).forEach(p => {
      const e = spawnAnimal(p.type, player.x + (Math.random() - 0.5) * 3, player.z + (Math.random() - 0.5) * 3, player.y + 1);
      e.pet = true; e.state = 'follow'; e.name = p.name;
      e.label = makeLabel(p.name); e.label.position.y = e.height + 0.3; e.group.add(e.label);
    });
    if (quest.index === 4 && quest.stage === 'active') spawnQuestDucks();
    else if (quest.index > 4) { ducks = ['home', 'home']; spawnQuestDucks(); }
  }
  renderHotbar();
  renderTracker();
  if (TEST) $('overlay').style.display = 'none';
  setInterval(save, 8000);
  window.addEventListener('beforeunload', save);

  let last = performance.now(), slow = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    const active = locked || TEST;
    if (active) {
      const steps = Math.max(1, Math.ceil(dt / 0.017));
      for (let i = 0; i < steps; i++) physicsStep(dt / steps);
      if (mouse.down >= 0 && !dialog) {
        mouse.timer -= dt;
        if (mouse.timer <= 0) { mouse.timer = 0.22; doAction(mouse.down); }
      }
      updateEntities(dt);
      updateFireworks(dt);
    }
    updateParticles(dt);
    updateSky(active ? dt : 0);
    rebuildDirty();

    camera.position.set(player.x, player.y + EYE, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    const d = lookDir();
    const hit = active && !dialog ? raycast(camera.position.x, camera.position.y, camera.position.z, d[0], d[1], d[2], 5.5) : null;
    outline.visible = !!hit;
    if (hit) outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    $('underwater').style.display = getB(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z)) === B.WATER ? 'block' : 'none';

    slow += dt;
    if (slow > 0.4) { slow = 0; updateCompass(); if (quest.stage === 'active') renderTracker(); }
    renderer.render(scene, camera);
  }
  updateCompass();
  requestAnimationFrame(frame);

  // handy for testing and tinkering from the browser console
  window.PB = { player: player, give: give, quest: quest, flags: flags, entities: entities, runEffect: runEffect,
    completeQuest: completeQuest, startQuest: startQuest, WORLD: WORLD, getB: getB, topY: topY,
    setTime: t => { dayTime = t; },
    _t: { breakBlock: breakBlock, placeBlock: placeBlock, interact: interact, advanceDialog: advanceDialog, questReady: questReady, isSolid: isSolid, hotbar: hotbar, inv: inv, select: i => { sel = i; }, particles: particles, press: (code, on) => { keys[code] = on; locked = true; }, tick: dt => { time += dt; physicsStep(dt); updateEntities(dt); } } };
})();
