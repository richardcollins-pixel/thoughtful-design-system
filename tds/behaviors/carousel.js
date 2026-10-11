// Carousel behaviour: as a [data-carousel] row scrolls, each item's --carousel-focus goes from 1 (locked in place) to 0 (a whole
// item away), so the fade happens in step with the scroll. Include this once; it finds carousels on the page now and later.
const rows = new WeakSet();

function update(row) {
  const style = getComputedStyle(row);
  const start = row.getBoundingClientRect().left + (parseFloat(style.scrollPaddingInlineStart) || 0);
  const gap = parseFloat(style.columnGap) || 0;
  let best = null, bestFocus = -1;
  for (const item of row.children) {
    const r = item.getBoundingClientRect();
    const focus = 1 - Math.min(1, Math.abs(r.left - start) / (r.width + gap));
    item.style.setProperty('--carousel-focus', focus.toFixed(3));
    if (focus > bestFocus) { best = item; bestFocus = focus; }
  }
  for (const item of row.children) item.toggleAttribute('data-focused', item === best);
  // progress dots: a [data-carousel-dots] right after the row holds a .dots that follows the focused item
  const dots = row.nextElementSibling && row.nextElementSibling.matches('[data-carousel-dots]') ? row.nextElementSibling.querySelector('.dots') : null;
  if (dots) { dots.dataset.current = String(Math.min(6, [...row.children].indexOf(best) + 1)); dots.dataset.count = String(Math.min(6, row.children.length)); }
}

function attach(row) {
  if (rows.has(row)) return;
  rows.add(row);
  let frame = 0;
  const queue = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(row); }); };
  row.addEventListener('scroll', queue, { passive: true });
  new ResizeObserver(queue).observe(row);
  new MutationObserver(queue).observe(row, { childList: true });
  update(row);
}

const scan = (root = document) => root.querySelectorAll('[data-carousel]').forEach(attach);
scan();
new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { if (n.matches('[data-carousel]')) attach(n); scan(n); } }).observe(document.documentElement, { childList: true, subtree: true });
