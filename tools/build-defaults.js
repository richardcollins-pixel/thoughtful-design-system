// Components' saved defaults (the "defaults" map in each meta.json) -> one stylesheet, applied after the components'
// own CSS so it wins. Runs in the browser, like build-tokens.js.
const TIERS = ['atoms', 'molecules', 'organisms', 'patterns'];

export const selectorFor = (meta) => meta.selector || '.' + ((/class="([^"\s]+)/.exec(meta.markup) || [])[1] || 'unknown');

export function buildDefaultsCss(components) {
  const byTier = {};
  for (const c of components) {
    const d = c.meta.defaults;
    if (!d || !Object.keys(d).length) continue;
    const decls = Object.entries(d).map(([k, v]) => `    ${k}: ${v};`).join('\n');
    (byTier[c.tier] ||= []).push(`  ${selectorFor(c.meta)} {\n${decls}\n  }`);
  }
  const out = ['/* GENERATED from each component\'s "defaults" in its meta.json by tools/build-defaults.js — edit in the editor. */'];
  for (const t of TIERS) if (byTier[t]) out.push(`@layer ${t} {\n${byTier[t].join('\n')}\n}`);
  return out.join('\n\n') + '\n';
}
