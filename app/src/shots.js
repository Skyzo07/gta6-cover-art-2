// Fixed scenes for screenshots: ?shot=cover shows the exported cover alone,
// ?shot=editor shows the editor with a sample photo loaded. The query picks
// the layout, grade, size, photos and words. window.__shotReady is set once
// the fonts have loaded and the cover has painted.

function ready() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; resolve(); }));
  });
}

export async function runShot(shot, query, app) {
  const layout = query.get('layout') || 'grid9';
  const grade = query.get('grade') || 'sunset';
  const size = query.get('size') || 'wide';
  const caption = query.get('caption') || 'Neon Coast';
  const subtitle = query.get('subtitle') || 'Vice City nights';
  app.apply({ layout, grade, size, caption, subtitle });
  await app.loadSamples();
  const photo2 = query.get('photo2');
  if (photo2) {
    try { app.state.photos[2] = await app.loadSample(photo2); } catch { /* keep two photos */ }
  }
  await document.fonts.ready;
  // A cover shot shows the exported cover alone: no editor selection outline.
  if (shot === 'cover') app.selectNone();
  app.redraw();
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await ready();
}
