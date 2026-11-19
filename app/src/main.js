// Neon Coast Cover Studio — editor wiring.
// Owns the cover state, the controls, panel click-to-crop, undo/redo and the
// PNG export. Rendering itself lives in ./cover.js; screenshot scenes in
// ./shots.js. Photos are read on the user's own machine and never uploaded.

import { drawCover, defaultState, layoutSlots, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const status = document.getElementById('status');
const panelName = document.getElementById('panelName');
const panelPhoto = document.getElementById('panelPhoto');
const panelZoom = document.getElementById('panelZoom');
const panelX = document.getElementById('panelX');
const panelY = document.getElementById('panelY');

const state = defaultState();
state.photos = [null, null, null];
let selected = 0;
let undoStack = [];
let redoStack = [];

function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    caption: state.caption, subtitle: state.subtitle, panels: state.panels,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  state.layout = s.layout;
  state.grade = s.grade;
  state.size = s.size;
  state.caption = s.caption;
  state.subtitle = s.subtitle;
  state.panels = s.panels;
  syncControls();
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function redraw() {
  drawCover(canvas, state, selected);
}

function syncControls() {
  captionInput.value = state.caption;
  subtitleInput.value = state.subtitle;
  document.querySelectorAll('#layouts button').forEach((b) =>
    b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades button').forEach((b) =>
    b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('#sizes button').forEach((b) =>
    b.classList.toggle('on', b.dataset.size === state.size));
  const panel = state.panels[selected] || state.panels[0];
  panelPhoto.value = String(panel.photo);
  panelZoom.value = String(panel.zoom);
  panelX.value = String(panel.ox);
  panelY.value = String(panel.oy);
  panelName.textContent = `Panel ${selected + 1} of ${state.panels.length} — ` +
    (panel.photo < 0 ? 'poster art' : `Photo ${panel.photo + 1}`) + '.';
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSample(name) {
  return loadImage(`samples/${name}.jpg`);
}

async function loadSamples() {
  try {
    state.photos[0] = await loadSample('boulevard');
    state.photos[1] = await loadSample('pier');
  } catch {
    status.textContent = 'Sample photos did not load — add your own photos above.';
  }
  redraw();
}

// Photo file inputs.
for (let i = 0; i < 3; i++) {
  document.getElementById(`photo${i}`).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pushHistory();
    state.photos[i] = await loadImage(URL.createObjectURL(file));
    redraw();
    status.textContent = `Photo ${i + 1} loaded.`;
  });
}
document.getElementById('samples').addEventListener('click', async () => {
  pushHistory();
  await loadSamples();
  status.textContent = 'Sample photos loaded.';
});

// Layout / grade / size buttons.
document.querySelectorAll('#layouts button').forEach((b) =>
  b.addEventListener('click', () => { pushHistory(); state.layout = b.dataset.layout; syncControls(); redraw(); }));
document.querySelectorAll('#grades button').forEach((b) =>
  b.addEventListener('click', () => { pushHistory(); state.grade = b.dataset.grade; syncControls(); redraw(); }));
document.querySelectorAll('#sizes button').forEach((b) =>
  b.addEventListener('click', () => { pushHistory(); state.size = b.dataset.size; syncControls(); redraw(); }));

// Caption words.
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

// Selected-panel crop controls.
function panelChanged() {
  const panel = state.panels[selected];
  panel.photo = Number(panelPhoto.value);
  panel.zoom = Number(panelZoom.value);
  panel.ox = Number(panelX.value);
  panel.oy = Number(panelY.value);
  syncControls();
  redraw();
}
panelPhoto.addEventListener('change', () => { pushHistory(); panelChanged(); });
panelZoom.addEventListener('input', panelChanged);
panelX.addEventListener('input', panelChanged);
panelY.addEventListener('input', panelChanged);

// Click a panel on the preview to select it.
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const [W, H] = SIZES[state.size];
  const px = ((e.clientX - rect.left) / rect.width) * W;
  const py = ((e.clientY - rect.top) / rect.height) * H;
  const slots = layoutSlots(state);
  let best = -1;
  let bestArea = Infinity;
  for (const s of slots) {
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) {
      const area = s.w * s.h;
      if (area < bestArea) { bestArea = area; best = s.slotIndex; }
    }
  }
  if (best >= 0) {
    selected = best;
    syncControls();
    redraw();
  }
});

// Undo / redo (settings and crops only; photos stay loaded).
document.getElementById('undo').addEventListener('click', () => {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  redraw();
});
document.getElementById('redo').addEventListener('click', () => {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  redraw();
});

// Export: render the cover at full size and download the PNG.
document.getElementById('export').addEventListener('click', () => {
  const [W, H] = SIZES[state.size];
  const off = document.createElement('canvas');
  drawCover(off, state, -1);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-${W}x${H}.png`;
    a.click();
    status.textContent = `Saved neon-coast-${W}x${H}.png`;
  }, 'image/png');
});

// The app object the screenshot scenes drive.
const app = {
  state,
  canvas,
  status,
  loadSample,
  loadSamples,
  apply(patch) {
    Object.assign(state, patch);
    syncControls();
  },
  selectNone() { selected = -1; },
  redraw,
};

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, app);
} else {
  loadSamples();
  syncControls();
  redraw();
}
