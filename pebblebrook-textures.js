// ============================================================
//  PEBBLEBROOK - textures
//  Every block picture is painted here in code, 16 x 16 pixels.
//  Change the colours to restyle the whole world.
// ============================================================

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const TILE = 16, ATLAS_N = 8;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = TILE * ATLAS_N;
const atlasCtx = atlasCanvas.getContext('2d');
const TILE_INDEX = {};
let tileCount = 0;

function makeTile(name, paint) {
  const i = tileCount++;
  TILE_INDEX[name] = i;
  const ox = (i % ATLAS_N) * TILE, oy = Math.floor(i / ATLAS_N) * TILE;
  const rnd = mulberry32(i * 7919 + 13);
  const g = {
    rnd: rnd,
    rect(x, y, w, h, c) { atlasCtx.fillStyle = c; atlasCtx.fillRect(ox + x, oy + y, w, h); },
    px(x, y, c) { g.rect(x, y, 1, 1, c); },
    fill(c) { g.rect(0, 0, TILE, TILE, c); },
    speckle(cols, density) {
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++)
        if (rnd() < density) g.px(x, y, cols[Math.floor(rnd() * cols.length)]);
    },
    holes(density) {
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++)
        if (rnd() < density) atlasCtx.clearRect(ox + x, oy + y, 1, 1);
    }
  };
  paint(g);
}

function paintFlower(g, petal, centre) {
  g.rect(7, 8, 2, 8, '#6cbf6c');
  g.px(6, 11, '#6cbf6c'); g.px(5, 10, '#6cbf6c'); g.px(9, 12, '#6cbf6c'); g.px(10, 11, '#6cbf6c');
  g.rect(5, 3, 6, 4, petal); g.rect(6, 2, 4, 6, petal);
  g.rect(7, 4, 2, 2, centre);
}
function paintCandy(g, base, light, dark) {
  g.fill(base);
  g.rect(0, 0, 16, 1, light); g.rect(0, 0, 1, 16, light);
  g.rect(0, 15, 16, 1, dark); g.rect(15, 0, 1, 16, dark);
  g.rect(3, 3, 4, 2, light); g.rect(3, 5, 2, 2, light);
  g.px(11, 11, light); g.px(12, 10, light);
}

makeTile('grass_top', g => {
  g.fill('#9be08a'); g.speckle(['#8ad67a', '#aeeb9c', '#a4e693'], 0.35);
  g.px(3, 4, '#fff6fb'); g.px(11, 9, '#ffd1e3'); g.px(7, 13, '#fff3a8');
});
makeTile('grass_side', g => {
  g.fill('#c49a74'); g.speckle(['#b88c66', '#d1a985'], 0.3);
  g.rect(0, 0, 16, 4, '#9be08a');
  for (let x = 0; x < 16; x++) if (g.rnd() < 0.5) g.px(x, 4, '#9be08a');
  for (let x = 0; x < 16; x++) if (g.rnd() < 0.3) g.px(x, Math.floor(g.rnd() * 3), '#aeeb9c');
});
makeTile('dirt', g => { g.fill('#c49a74'); g.speckle(['#b88c66', '#d1a985', '#bb916b'], 0.35); });
makeTile('stone', g => {
  g.fill('#b9b7c9'); g.speckle(['#a9a7bb', '#c8c6d6'], 0.3);
  g.rect(2, 5, 4, 1, '#a19fb4'); g.rect(9, 11, 5, 1, '#a19fb4'); g.rect(11, 3, 3, 1, '#cfcddc');
});
makeTile('sand', g => { g.fill('#f7e6b5'); g.speckle(['#f1dca3', '#fcefc8'], 0.3); });
makeTile('water', g => {
  g.fill('#8fd3f4'); g.speckle(['#86cbee', '#9bdaf7'], 0.25);
  g.rect(2, 3, 5, 1, '#c9eefd'); g.rect(9, 8, 5, 1, '#c9eefd'); g.rect(4, 12, 4, 1, '#c9eefd');
});
makeTile('log_side', g => {
  g.fill('#b58a62');
  for (let x = 0; x < 16; x += 3) g.rect(x, 0, 1, 16, '#a67b55');
  g.speckle(['#c0966e', '#a67b55'], 0.12);
});
makeTile('log_top', g => {
  g.fill('#b58a62'); g.rect(2, 2, 12, 12, '#e8c99c'); g.rect(4, 4, 8, 8, '#d9b582');
  g.rect(6, 6, 4, 4, '#e8c99c'); g.rect(7, 7, 2, 2, '#c9a06f');
});
makeTile('leaves', g => {
  g.fill('#7fcf8f'); g.speckle(['#6fc281', '#93dba0', '#a5e5ae'], 0.45); g.holes(0.1);
});
makeTile('blossom', g => {
  g.fill('#ffb7d0'); g.speckle(['#ffa3c4', '#ffcbdd', '#fff0f5'], 0.45); g.holes(0.1);
});
makeTile('planks', g => {
  g.fill('#f0cf9d');
  for (let y = 3; y < 16; y += 4) g.rect(0, y, 16, 1, '#d9b582');
  g.px(5, 1, '#d9b582'); g.px(12, 5, '#d9b582'); g.px(3, 9, '#d9b582'); g.px(9, 13, '#d9b582');
});
makeTile('flower_pink', g => paintFlower(g, '#ff9ec4', '#fff3a8'));
makeTile('flower_yellow', g => paintFlower(g, '#ffe27a', '#ffb347'));
makeTile('flower_blue', g => paintFlower(g, '#9cc9ff', '#ffffff'));
makeTile('flower_lilac', g => paintFlower(g, '#cfa9ff', '#fff3a8'));
makeTile('bush', g => {
  g.rect(2, 7, 12, 9, '#6fc281'); g.rect(4, 5, 8, 2, '#6fc281'); g.rect(1, 9, 14, 5, '#7fcf8f');
  g.speckle(['#93dba0'], 0.05);
  [[4, 8], [9, 7], [12, 10], [6, 12], [2, 11], [10, 13]].forEach(p => {
    g.rect(p[0], p[1], 2, 2, '#ff6f91'); g.px(p[0], p[1], '#ffb3c8');
  });
});
makeTile('wheat', g => {
  for (let x = 1; x < 16; x += 3) {
    const top = 2 + Math.floor(g.rnd() * 3);
    g.rect(x, top + 4, 1, 16 - top - 4, '#c9b24f');
    g.rect(x - 1, top, 3, 5, '#f2cf63'); g.px(x, top, '#fbe59a'); g.px(x, top + 2, '#d9b445');
  }
});
makeTile('lantern', g => {
  g.fill('#8a6248');
  g.rect(2, 2, 12, 12, '#ffe9a3'); g.rect(4, 4, 8, 8, '#fff7d6'); g.rect(6, 6, 4, 4, '#ffffff');
  g.rect(7, 0, 2, 16, '#8a6248'); g.rect(0, 7, 16, 2, '#8a6248');
  g.rect(6, 6, 4, 4, '#fff7d6');
});
makeTile('crystal', g => {
  g.fill('#b8f3ff');
  for (let i = 0; i < 16; i++) { g.px(i, i, '#ffffff'); g.px(i, 15 - i, '#8fd9f0'); }
  g.rect(3, 2, 3, 1, '#ffffff'); g.rect(10, 12, 3, 1, '#e3c9ff'); g.rect(11, 4, 2, 2, '#e3c9ff');
  g.rect(3, 10, 2, 2, '#d9fbff');
});
makeTile('cake_top', g => {
  g.fill('#ffc1d6'); g.speckle(['#ffffff', '#fff3a8', '#b8f3ff'], 0.08);
  g.rect(6, 6, 4, 4, '#ff6f91'); g.px(7, 7, '#ffb3c8');
});
makeTile('cake_side', g => {
  g.fill('#fbe3b5'); g.rect(0, 9, 16, 2, '#ff9ec4'); g.rect(0, 0, 16, 4, '#ffc1d6');
  for (let x = 1; x < 16; x += 4) g.rect(x, 4, 2, 2, '#ffc1d6');
  g.speckle(['#f3d49e'], 0.06);
});
makeTile('bed_top', g => {
  g.fill('#ffb3c8'); g.rect(0, 0, 16, 5, '#fff8fb'); g.rect(2, 1, 12, 3, '#ffffff');
  g.rect(0, 5, 16, 1, '#ff9ec4');
  [[3, 8], [10, 10], [5, 12]].forEach(p => { g.px(p[0], p[1], '#fff8fb'); g.px(p[0] + 2, p[1], '#fff8fb'); g.rect(p[0], p[1] + 1, 3, 1, '#fff8fb'); g.px(p[0] + 1, p[1] + 2, '#fff8fb'); });
});
makeTile('bed_side', g => {
  g.fill('#d9b582'); g.rect(0, 0, 16, 8, '#ffb3c8'); g.rect(0, 7, 16, 1, '#ff9ec4');
  g.rect(0, 13, 3, 3, '#b58a62'); g.rect(13, 13, 3, 3, '#b58a62');
});
makeTile('candy_pink', g => paintCandy(g, '#ffb3d1', '#ffd6e6', '#f595bb'));
makeTile('candy_mint', g => paintCandy(g, '#aef0d1', '#d3f9e7', '#8ddcb8'));
makeTile('candy_lilac', g => paintCandy(g, '#d5bbff', '#e9dbff', '#bb9cf0'));
makeTile('candy_lemon', g => paintCandy(g, '#fff3a3', '#fffad3', '#f0dd7a'));
makeTile('hive', g => {
  g.fill('#f4c257');
  for (let y = 2; y < 16; y += 4) g.rect(0, y, 16, 1, '#dba63c');
  g.rect(6, 8, 4, 4, '#8a6248'); g.px(3, 5, '#fff3a8'); g.px(12, 13, '#fff3a8');
});
makeTile('path', g => {
  g.fill('#e6d8c3'); g.speckle(['#dccbb2', '#efe4d3'], 0.3);
  g.rect(0, 5, 16, 1, '#d2c0a5'); g.rect(0, 11, 16, 1, '#d2c0a5');
  g.rect(5, 0, 1, 5, '#d2c0a5'); g.rect(11, 6, 1, 5, '#d2c0a5'); g.rect(3, 12, 1, 4, '#d2c0a5');
});
makeTile('brick', g => {
  g.fill('#f2a7a0');
  for (let y = 3; y < 16; y += 4) g.rect(0, y, 16, 1, '#fbe1d9');
  for (let r = 0; r < 4; r++) for (let x = (r % 2) * 4; x < 16; x += 8) g.rect(x, r * 4, 1, 3, '#fbe1d9');
  g.speckle(['#eb9992'], 0.08);
});
makeTile('oven', g => {
  g.fill('#b9b7c9'); g.speckle(['#a9a7bb', '#c8c6d6'], 0.25);
  g.rect(3, 6, 10, 8, '#5d5770'); g.rect(4, 9, 8, 5, '#ffb347'); g.rect(5, 11, 6, 3, '#ffe27a');
  g.rect(3, 2, 10, 2, '#8d8aa3');
});
makeTile('nest', g => {
  g.rect(2, 11, 12, 5, '#b58a62'); g.rect(1, 10, 14, 2, '#c9a06f');
  g.speckle(['#a67b55'], 0.04);
  g.rect(4, 6, 4, 5, '#fffdf5'); g.rect(5, 5, 2, 1, '#fffdf5');
  g.rect(9, 7, 3, 4, '#fff3dc'); g.px(10, 6, '#fff3dc');
});
makeTile('bedrock', g => { g.fill('#7d7a94'); g.speckle(['#6b6884', '#8d8aa3'], 0.4); });
makeTile('berry', g => {
  g.rect(3, 6, 5, 5, '#ff6f91'); g.rect(8, 8, 5, 5, '#ff6f91'); g.rect(6, 2, 4, 4, '#ff8fab');
  g.px(4, 7, '#ffd1e3'); g.px(9, 9, '#ffd1e3'); g.px(7, 3, '#ffe3ec');
  g.rect(8, 1, 3, 1, '#6cbf6c'); g.px(10, 0, '#6cbf6c');
});
makeTile('egg', g => {
  g.rect(5, 3, 6, 11, '#fffdf5'); g.rect(4, 6, 8, 6, '#fffdf5'); g.rect(6, 2, 4, 1, '#fffdf5');
  g.rect(6, 5, 2, 2, '#ffffff'); g.rect(9, 11, 2, 2, '#f3e6cc');
});
makeTile('honey', g => {
  g.rect(4, 5, 8, 10, '#ffc94d'); g.rect(3, 6, 10, 8, '#ffc94d');
  g.rect(5, 3, 6, 2, '#c9a06f'); g.rect(5, 7, 2, 4, '#ffe9a3'); g.rect(4, 12, 8, 2, '#f0a92e');
});

// Small picture of a tile, used for the hotbar and inventory.
const iconCache = {};
function tileIcon(name) {
  if (iconCache[name]) return iconCache[name];
  const i = TILE_INDEX[name];
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(atlasCanvas, (i % ATLAS_N) * TILE, Math.floor(i / ATLAS_N) * TILE, TILE, TILE, 0, 0, 48, 48);
  return (iconCache[name] = c.toDataURL());
}
