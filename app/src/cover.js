// Neon Coast Cover Studio — cover renderer.
// Draws an original multi-panel poster on a 2D canvas: the user's photos in a
// comic-book panel grid, procedural sunset/neon poster art in the spare panels,
// and bold block lettering. No Rockstar assets, no downloaded art: every line
// of art here is drawn from code. Fully deterministic: one fixed seed drives
// every random choice, so the same state always draws the same bytes.

export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

export const GRADES = {
  sunset: { top: '#2a1052', mid: '#c2277e', bot: '#ff7a3d', tint: 'rgba(255,90,60,0.30)', accent: '#ffb347', ink: '#160a2e', filter: 'saturate(1.25)' },
  neon: { top: '#0b1030', mid: '#7a1e8f', bot: '#ff2e88', tint: 'rgba(255,46,136,0.32)', accent: '#37f2d4', ink: '#0a0620', filter: 'saturate(1.35)' },
  gold: { top: '#1d2b12', mid: '#8a6d1f', bot: '#ffb347', tint: 'rgba(255,179,71,0.28)', accent: '#ffe9a8', ink: '#1c1503', filter: 'saturate(1.2)' },
  teal: { top: '#062a33', mid: '#0f766e', bot: '#37f2d4', tint: 'rgba(55,242,212,0.24)', accent: '#ff7a3d', ink: '#04222a', filter: 'saturate(1.2)' },
  noir: { top: '#111111', mid: '#3d3d3d', bot: '#ff2e88', tint: 'rgba(255,46,136,0.26)', accent: '#ffffff', ink: '#000000', filter: 'grayscale(0.9) contrast(1.15)' },
};

/** Deterministic PRNG (mulberry32): every decorative choice replays exactly. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function defaultPanels() {
  return Array.from({ length: 8 }, (_, i) => ({
    photo: [0, 1, 2, 0, 1, 2, 0, 1][i],
    zoom: 1, ox: 0, oy: 0,
  }));
}

export function defaultState() {
  return {
    layout: 'grid9',
    grade: 'sunset',
    size: 'wide',
    caption: 'Neon Coast',
    subtitle: 'Vice City nights',
    panels: defaultPanels(),
  };
}

// ---------------------------------------------------------------- layouts
// A slot is one cell of the poster. kind 'photo' shows a user photo (slotIndex
// picks its crop settings from state.panels), 'art' is procedural poster art,
// 'title' is the caption block. Tilted slots are drawn rotated like snapshots.

function slotsFor(layout, W, H) {
  const g = Math.max(6, Math.round(W * 0.011));
  if (layout === 'hero') {
    const band = Math.round(H * 0.2);
    const leftW = Math.round(W * 0.62);
    const topH = H - band - 2 * g;
    const rightX = leftW + g;
    const rightW = W - rightX - g;
    const halfH = Math.round((topH - g) / 2);
    return [
      { kind: 'photo', slotIndex: 0, x: g, y: g, w: leftW - g, h: topH },
      { kind: 'photo', slotIndex: 1, x: rightX, y: g, w: rightW, h: halfH },
      { kind: 'photo', slotIndex: 2, x: rightX, y: g + halfH + g, w: rightW, h: topH - halfH - g },
      { kind: 'title', mode: 'band', x: 0, y: H - band, w: W, h: band },
    ];
  }
  if (layout === 'tilted') {
    const pw = Math.round(W * 0.34);
    const ph = Math.round(H * 0.3);
    return [
      { kind: 'photo', slotIndex: 0, x: 0, y: 0, w: W, h: H },
      { kind: 'photo', slotIndex: 1, x: Math.round(W * 0.05), y: Math.round(H * 0.5), w: pw, h: ph, tilt: -0.06 },
      { kind: 'photo', slotIndex: 2, x: Math.round(W * 0.35), y: Math.round(H * 0.56), w: pw, h: ph, tilt: 0.05 },
      { kind: 'art', art: 'skyline', x: Math.round(W * 0.64), y: Math.round(H * 0.5), w: pw, h: ph, tilt: -0.04 },
      { kind: 'title', mode: 'float', x: Math.round(W * 0.04), y: Math.round(H * 0.05), w: Math.round(W * 0.72), h: Math.round(H * 0.32) },
    ];
  }
  if (layout === 'strip') {
    const stripH = Math.round(H * 0.2);
    const band = Math.round(H * 0.2);
    const cellW = Math.round((W - 4 * g) / 3);
    return [
      { kind: 'photo', slotIndex: 0, x: g, y: g, w: cellW, h: stripH },
      { kind: 'photo', slotIndex: 1, x: 2 * g + cellW, y: g, w: cellW, h: stripH },
      { kind: 'photo', slotIndex: 2, x: 3 * g + 2 * cellW, y: g, w: cellW, h: stripH },
      { kind: 'photo', slotIndex: 3, x: g, y: stripH + 2 * g, w: W - 2 * g, h: H - stripH - band - 3 * g },
      { kind: 'title', mode: 'band', x: 0, y: H - band, w: W, h: band },
    ];
  }
  // grid9 (default): 3x3 comic grid, title block in the middle cell.
  const cellW = Math.round((W - 4 * g) / 3);
  const cellH = Math.round((H - 4 * g) / 3);
  const plan = [
    { kind: 'photo', photo: 0 }, { kind: 'art', art: 'skyline' }, { kind: 'photo', photo: 1 },
    { kind: 'photo', photo: 2 }, { kind: 'title', mode: 'band' }, { kind: 'photo', photo: 0 },
    { kind: 'photo', photo: 1 }, { kind: 'art', art: 'palms' }, { kind: 'photo', photo: 2 },
  ];
  let photoSlot = 0;
  return plan.map((cell, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const slot = {
      ...cell,
      x: g + col * (cellW + g),
      y: g + row * (cellH + g),
      w: cellW,
      h: cellH,
    };
    if (cell.kind === 'photo') slot.slotIndex = photoSlot++;
    return slot;
  });
}

/** Photo slots in canvas pixels, for click hit-testing in the editor. */
export function layoutSlots(state) {
  const [W, H] = SIZES[state.size];
  return slotsFor(state.layout, W, H).filter((s) => s.kind === 'photo');
}

// ---------------------------------------------------------------- photos
function resolvePhoto(photos, want) {
  if (photos[want]) return photos[want];
  for (const p of photos) if (p) return p;
  return null;
}

function drawPhoto(ctx, img, r, grade, panel) {
  const zoom = panel ? panel.zoom : 1;
  const ox = panel ? panel.ox : 0;
  const oy = panel ? panel.oy : 0;
  const s = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * s;
  const ph = img.naturalHeight * s;
  const cx = r.x + r.w / 2 + ox * r.w;
  const cy = r.y + r.h / 2 + oy * r.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.filter = grade.filter;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.filter = 'none';
  const tint = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  tint.addColorStop(0, 'rgba(0,0,0,0)');
  tint.addColorStop(0.55, 'rgba(0,0,0,0)');
  tint.addColorStop(1, grade.tint);
  ctx.fillStyle = tint;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

// ---------------------------------------------------------------- poster art
// All drawn from code: a dusk skyline, a palm sunset, a sun-over-sea panel.

function drawSky(ctx, r, grade) {
  const sky = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  sky.addColorStop(0, grade.top);
  sky.addColorStop(0.55, grade.mid);
  sky.addColorStop(1, grade.bot);
  ctx.fillStyle = sky;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

function drawSunArt(ctx, r, grade, rng) {
  drawSky(ctx, r, grade);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h * 0.42;
  const rad = Math.min(r.w, r.h) * 0.26;
  const glow = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad * 2.2);
  glow.addColorStop(0, 'rgba(255,220,120,0.85)');
  glow.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  // Sun cut by horizontal scanlines, poster style.
  ctx.fillStyle = grade.mid;
  for (let i = 0; i < 4; i++) {
    const y = cy + rad * 0.25 + i * rad * 0.22;
    ctx.fillRect(cx - rad, y, rad * 2, Math.max(2, rad * 0.07));
  }
  ctx.fillStyle = grade.ink;
  ctx.fillRect(r.x, r.y + r.h * 0.72, r.w, r.h * 0.28);
  ctx.fillStyle = 'rgba(255,233,168,0.5)';
  for (let i = 0; i < 5; i++) {
    const w = r.w * (0.12 + rng() * 0.25);
    ctx.fillRect(cx - w / 2, r.y + r.h * (0.76 + i * 0.045), w, 2);
  }
}

function drawSkyline(ctx, r, grade, rng) {
  drawSky(ctx, r, grade);
  const horizon = r.y + r.h * 0.68;
  ctx.fillStyle = grade.ink;
  let x = r.x;
  while (x < r.x + r.w) {
    const bw = r.w * (0.08 + rng() * 0.12);
    const bh = r.h * (0.18 + rng() * 0.38);
    ctx.fillRect(x, horizon - bh, bw, bh);
    if (rng() > 0.5) {
      ctx.fillRect(x + bw * 0.3, horizon - bh - r.h * 0.06, bw * 0.4, r.h * 0.06);
    }
    x += bw + r.w * 0.015;
  }
  ctx.fillRect(r.x, horizon, r.w, r.h - (horizon - r.y));
  // Lit windows.
  ctx.fillStyle = grade.accent;
  for (let i = 0; i < 40; i++) {
    const wx = r.x + rng() * r.w;
    const wy = r.y + r.h * 0.3 + rng() * r.h * 0.36;
    if (rng() > 0.45) ctx.fillRect(wx, wy, Math.max(2, r.w * 0.008), Math.max(2, r.h * 0.012));
  }
  // Moon.
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(r.x + r.w * 0.78, r.y + r.h * 0.2, Math.min(r.w, r.h) * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function drawPalms(ctx, r, grade, rng) {
  drawSunArt(ctx, r, grade, rng);
  ctx.strokeStyle = grade.ink;
  ctx.lineCap = 'round';
  const ground = r.y + r.h * 0.86;
  for (const [fx, lean, size] of [[0.22, -1, 1], [0.78, 1, 0.8]]) {
    const bx = r.x + r.w * fx;
    const topX = bx + lean * r.w * 0.1;
    const topY = r.y + r.h * (0.3 + 0.14 * (1 - size));
    ctx.lineWidth = Math.max(4, r.w * 0.02 * size);
    ctx.beginPath();
    ctx.moveTo(bx, ground);
    ctx.quadraticCurveTo(bx + lean * r.w * 0.05, (ground + topY) / 2, topX, topY);
    ctx.stroke();
    // Fronds: seven arcs fanning from the crown.
    ctx.lineWidth = Math.max(3, r.w * 0.012 * size);
    for (let i = 0; i < 7; i++) {
      const a = (-0.15 + i * 0.19) * Math.PI;
      const len = r.w * 0.22 * size;
      const ex = topX + Math.cos(a) * len;
      const ey = topY + Math.sin(a) * len * 0.55 + r.h * 0.05;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.5, topY - r.h * 0.06, ex, ey);
      ctx.stroke();
    }
  }
}

function drawArt(ctx, r, art, grade, rng) {
  if (art === 'skyline') drawSkyline(ctx, r, grade, rng);
  else if (art === 'palms') drawPalms(ctx, r, grade, rng);
  else drawSunArt(ctx, r, grade, rng);
}

// ---------------------------------------------------------------- lettering
function fitFont(ctx, text, fontName, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${size}px "${fontName}", sans-serif`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px "${fontName}", sans-serif`;
  }
  return size;
}

function drawTitle(ctx, r, state, grade, mode) {
  const caption = (state.caption || 'Neon Coast').trim().toUpperCase() || 'NEON COAST';
  const subtitle = (state.subtitle || '').trim();
  if (mode === 'band') {
    const bg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    bg.addColorStop(0, grade.ink);
    bg.addColorStop(1, grade.top);
    ctx.fillStyle = bg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Halftone dots across the band.
    ctx.fillStyle = grade.accent;
    ctx.globalAlpha = 0.12;
    const step = Math.max(12, r.h * 0.16);
    for (let y = r.y + step / 2; y < r.y + r.h; y += step) {
      for (let x = r.x + step / 2; x < r.x + r.w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, step * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = grade.accent;
    ctx.fillRect(r.x, r.y, r.w, Math.max(3, r.h * 0.04));
  }
  const cx = r.x + r.w / 2;
  const capSize = fitFont(ctx, caption, 'Anton', Math.round(r.h * (mode === 'band' ? 0.52 : 0.42)), r.w * 0.92);
  const capY = mode === 'band' ? r.y + r.h * 0.58 : r.y + r.h * 0.45;
  // Pink drop shadow, then ink outline, then white face.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${capSize}px "Anton", sans-serif`;
  ctx.fillStyle = '#ff2e88';
  ctx.fillText(caption, cx + capSize * 0.05, capY + capSize * 0.06);
  ctx.lineWidth = Math.max(2, capSize * 0.09);
  ctx.strokeStyle = grade.ink;
  ctx.lineJoin = 'round';
  ctx.strokeText(caption, cx, capY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(caption, cx, capY);
  if (subtitle) {
    const subSize = fitFont(ctx, subtitle, 'Pacifico', Math.round(capSize * 0.34), r.w * 0.8);
    ctx.font = `${subSize}px "Pacifico", cursive`;
    ctx.fillStyle = grade.accent;
    ctx.fillText(subtitle, cx, capY + capSize * 0.62);
  }
}

// ---------------------------------------------------------------- the poster
/** Draws the whole cover onto canvas at its export size. `selected` is the
 *  slotIndex of the panel the editor highlights, or -1 for none. */
export function drawCover(canvas, state, selected = -1) {
  const [W, H] = SIZES[state.size];
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d');
  const grade = GRADES[state.grade] || GRADES.sunset;
  const rng = mulberry32(20261119);
  ctx.fillStyle = grade.ink;
  ctx.fillRect(0, 0, W, H);
  const slots = slotsFor(state.layout, W, H);
  const border = Math.max(3, Math.round(W * 0.004));
  for (const slot of slots) {
    ctx.save();
    if (slot.tilt) {
      ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.rotate(slot.tilt);
      ctx.translate(-slot.w / 2, -slot.h / 2);
      // Snapshot white border and drop shadow.
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.shadowOffsetY = Math.round(W * 0.008);
      ctx.fillStyle = '#f8f4ec';
      ctx.fillRect(-10, -10, slot.w + 20, slot.h + 20);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    const r = { x: slot.tilt ? 0 : slot.x, y: slot.tilt ? 0 : slot.y, w: slot.w, h: slot.h };
    if (slot.kind === 'title') {
      drawTitle(ctx, r, state, grade, slot.mode);
    } else if (slot.kind === 'art') {
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      drawArt(ctx, r, slot.art, grade, rng);
    } else {
      const panel = state.panels[slot.slotIndex] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
      let img = null;
      if (panel.photo >= 0) img = resolvePhoto(state.photos, panel.photo);
      if (img) {
        drawPhoto(ctx, img, r, grade, panel);
      } else {
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
        drawArt(ctx, r, panel.photo < 0 ? 'skyline' : 'sun', grade, rng);
      }
    }
    ctx.restore();
    // Ink frame around the panel.
    ctx.save();
    if (slot.tilt) {
      ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.rotate(slot.tilt);
      ctx.translate(-slot.w / 2, -slot.h / 2);
      ctx.strokeStyle = grade.ink;
      ctx.lineWidth = border;
      ctx.strokeRect(0, 0, slot.w, slot.h);
    } else if (slot.kind !== 'title' || slot.mode === 'band') {
      ctx.strokeStyle = grade.ink;
      ctx.lineWidth = border;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
    }
    ctx.restore();
    if (slot.kind === 'photo' && slot.slotIndex === selected) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(4, border * 2);
      ctx.setLineDash([Math.round(W * 0.02), Math.round(W * 0.012)]);
      if (slot.tilt) {
        ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
        ctx.rotate(slot.tilt);
        ctx.translate(-slot.w / 2, -slot.h / 2);
        ctx.strokeRect(0, 0, slot.w, slot.h);
      } else {
        ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      }
      ctx.restore();
    }
  }
  // Film grain, seeded so it replays exactly.
  ctx.save();
  for (let i = 0; i < 900; i++) {
    const x = rng() * W;
    const y = rng() * H;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
  // Vignette.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}
