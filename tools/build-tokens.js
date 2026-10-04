// tokens (array) -> tokens.css text. Runs in the browser, so the editor works on a static host.
const fmt = (n) => { n = Number(n); return Number.isInteger(n) ? String(n) : String(+n.toFixed(4)); };

function roleValue(t, mode) {
  const v = t.values[mode], ref = `var(--${v.ref})`, op = Number(v.opacity ?? 100);
  return op >= 100 ? ref : `color-mix(in srgb, ${ref} ${fmt(op)}%, transparent)`;
}

export function buildCss(tokens, schema) {
  const stacks = Object.fromEntries(schema.fontFamilies.map((f) => [f.key, f.stack]));
  const of = (kind) => tokens.filter((t) => t.kind === kind);
  const out = ['/* GENERATED from tokens.json by tools/build-tokens.js — edit in the editor, not here. */\n'];
  const block = (selector, lines) => out.push(`${selector} {\n${lines.map((l) => '  ' + l).join('\n')}\n}\n`);

  block(':root', of('primitive').map((t) => `--${t.name}: ${t.hex};`));

  const roles = of('role'), pal = [];
  for (const t of roles) {
    const l = roleValue(t, 'light'), d = roleValue(t, 'dark');
    pal.push(`--t-${t.name}: light-dark(${l}, ${d});`, `--t-${t.name}-i: light-dark(${d}, ${l});`);
  }
  block(':root', pal);
  block(':root, [data-surface="normal"]', roles.flatMap((t) => [`--${t.name}: var(--t-${t.name});`, `--${t.name}-inverse: var(--t-${t.name}-i);`]));
  block('[data-surface="inverse"]', roles.flatMap((t) => [`--${t.name}: var(--t-${t.name}-i);`, `--${t.name}-inverse: var(--t-${t.name});`]));
  out.push(':root, [data-theme="light"] { color-scheme: light; }\n[data-theme="dark"] { color-scheme: dark; }\n');

  block(':root', ['padding', 'spacing', 'radius'].flatMap((k) => of(k).map((t) => `--${t.name}: ${fmt(t.px)}px;`)));
  block(':root', [
    ...of('font-family').map((t) => `--${t.name}: ${stacks[t.value] ?? t.value};`),
    ...of('font-weight').map((t) => `--${t.name}: ${fmt(t.value)};`),
    ...of('font-size').map((t) => `--${t.name}: ${fmt(t.px / 16)}rem;`),
    ...of('line-height').map((t) => `--${t.name}: ${fmt(t.percent / 100)};`),
    ...of('letter-spacing').map((t) => `--${t.name}: ${fmt(t.percent / 100)}em;`),
  ]);
  block(':root', [
    ...of('duration').map((t) => `--${t.name}: ${fmt(t.ms)}ms;`),
    ...of('easing').map((t) => `--${t.name}: cubic-bezier(${t.bezier.map(fmt).join(', ')});`),
  ]);
  out.push(`@media (prefers-reduced-motion: reduce) {\n  :root { ${of('duration').map((t) => `--${t.name}: 0.01ms;`).join(' ')} }\n}\n`);
  return out.join('\n');
}
