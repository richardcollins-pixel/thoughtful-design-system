// The design system's data in one request. On the published site tools/build_bundle.py joins every component meta, the personas,
// environments, sample data and icon list into tds/bundle.json; here (running locally, or any time there is no bundle) the pages
// fall back to fetching the separate files, so editing against the live repo works exactly as before.
// Every page asks through this module, so the bundle is fetched once per document (and cached by the browser per deploy version).
const json = (url) => fetch(url, { cache: 'no-store' }).then((r) => r.json());
let bundle;

export function loadBundle(ver) {
  return (bundle ||= (async () => {
    try { const r = await fetch(`../tds/bundle.json${ver ? `?v=${ver}` : ''}`); if (r.ok) return await r.json(); } catch { /* no bundle */ }
    return null;
  })());
}

// { index, metas: {path: meta}, personas, environments, sample, glyphs } — from the bundle, else piece by piece.
export async function loadData(ver) {
  const b = await loadBundle(ver);
  if (b) return b;
  const index = (await json('../tds/index.json')).components;
  const metas = Object.fromEntries(await Promise.all(index.map(async (p) => [p, await json(`../tds/${p}/${p.split('/').pop()}.meta.json`)])));
  const [personas, environments, sample, glyphs] = await Promise.all([
    json('../tds/assets/personas.json'), json('../tds/environments.json').catch(() => ({})), json('../tds/sample-data.json'), json('../tds/atoms/icon/glyphs.json'),
  ]);
  return { index, metas, personas, environments, sample, glyphs };
}
