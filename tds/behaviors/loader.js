// Loader. Plays a loading state (organisms/loading-state): T morphs between shapes and the caption changes with it.
// Ported from the blob morph loading prototype (v4). Markup it looks for:
//   <section data-loader data-loader-shapes="blob,pencil,bubble" data-loader-themes="ember,bloom,bloom">
//     ... <span class="blob" data-theme="ember"> ... <div class="loading-state__captions"><p class="loading-state__line">...</p> x N</div>
// One beat per line, and the line only changes while T is a plain blob:
//   caption in (from below) -> a short stay as the blob -> morph to the line's shape -> long stay in shape, caption still ->
//   caption out (upward) -> morph back to the blob (no caption on screen) -> next line.
// A line whose shape is "blob" has no shape change: it just shows its text (a quiet, longer beat). Reduced motion: no script runs,
// the first line stays up.
const TEXT_IN = 500, BLOB_HOLD = 600, MORPH = 1100, SHAPE_HOLD = 3000, TEXT_OUT = 500, QUIET_HOLD = 1400;
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new WeakSet();

function play(root) {
  if (live.has(root) || reduce) return;
  const lines = [...root.querySelectorAll('.loading-state__line')];
  const blob = root.querySelector('.blob');
  if (lines.length < 1 || !blob) return;
  live.add(root);
  root.dataset.playing = '';
  const shapes = (root.dataset.loaderShapes || '').split(',').map((s) => s.trim());
  const themes = (root.dataset.loaderThemes || '').split(',').map((s) => s.trim());
  const home = themes[0] || 'ember';
  let i = -1;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const alive = () => root.isConnected;
  async function beat() {
    if (!alive()) return;
    i = (i + 1) % lines.length;
    const line = lines[i], shape = shapes[i] || 'blob', theme = themes[i] || home;
    line.dataset.state = 'in'; void line.offsetWidth;
    requestAnimationFrame(() => { line.dataset.state = 'live'; });
    await wait(TEXT_IN);
    if (shape !== 'blob') {
      await wait(BLOB_HOLD); if (!alive()) return;
      blob.dataset.shape = shape; blob.dataset.theme = theme;
      await wait(MORPH + SHAPE_HOLD); if (!alive()) return;
      line.dataset.state = 'out';
      await wait(TEXT_OUT); if (!alive()) return;
      blob.dataset.shape = 'blob'; blob.dataset.theme = home;
      await wait(MORPH);
    } else {
      await wait(QUIET_HOLD); if (!alive()) return;
      line.dataset.state = 'out';
      await wait(TEXT_OUT);
    }
    beat();
  }
  beat();
}

const scan = (n) => { if (n.nodeType !== 1) return; if (n.matches && n.matches('[data-loader]')) play(n); n.querySelectorAll && n.querySelectorAll('[data-loader]').forEach(play); };
if (typeof document !== 'undefined') {
  scan(document.documentElement);
  new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true });
}
