// tokens (array) -> tokens.css text. Runs in the browser, so the editor works on a static host.
const fmt = (n) => { n = Number(n); return Number.isInteger(n) ? String(n) : String(+n.toFixed(4)); };

function roleValue(t, mode) {
  const v = t.values[mode], ref = `var(--${v.ref})`, op = Number(v.opacity ?? 100);
  return op >= 100 ? ref : `color-mix(in srgb, ${ref} ${fmt(op)}%, transparent)`;
}

// Figma mesh gradient: a solid base fill under three soft corner glows (colors fade to transparent).
export function gradientCss(t) {
  const c = (hex) => hex;
  return [
    `radial-gradient(ellipse 68% 60% at 100% 0%, ${c(t.topRight)}, transparent)`,
    `radial-gradient(ellipse 43% 40% at 0% 0%, ${c(t.topLeft)}, transparent)`,
    `radial-gradient(ellipse 94% 82% at 100% 100%, ${c(t.bottomRight)}, transparent)`,
    c(t.base),
  ].join(', ');
}

export function buildCss(tokens, schema) {
  const stacks = Object.fromEntries(schema.fontFamilies.map((f) => [f.key, f.stack]));
  const of = (kind) => tokens.filter((t) => t.kind === kind);
  const out = ['/* GENERATED from tokens.json by tools/build-tokens.js — edit in the editor, not here. */\n'];
  const block = (selector, lines) => out.push(`${selector} {\n${lines.map((l) => '  ' + l).join('\n')}\n}\n`);

  const prims = of('primitive');
  block(':root', prims.map((t) => `--${t.name}: ${t.hex};`));
  // Wireframe = accent color out: primitives drop to zero chroma (same lightness), except the base
  // surfaces flagged keepInWireframe.
  block(':root[data-fidelity="wireframe"]', prims.filter((t) => !t.keepInWireframe).map((t) => `--${t.name}: oklch(from ${t.hex} l 0 h);`));

  const roles = of('role');
  block(':root, [data-surface="normal"]', roles.flatMap((t) => [`--${t.name}: ${roleValue(t, 'base')};`, `--${t.name}-inverse: ${roleValue(t, 'inverse')};`]));
  block('[data-surface="inverse"]', roles.flatMap((t) => [`--${t.name}: ${roleValue(t, 'inverse')};`, `--${t.name}-inverse: ${roleValue(t, 'base')};`]));
  // Text over a light gradient (a gradient token with foreground "dark") must be dark to be readable. Only the colors of text, icons
  // and borders flip: fills (like the white of a filled button) and the "-inverse" companions stay as they are, so buttons and
  // other pieces designed to stay put don't change. Charcoal flattens every gradient to a dark fill, so it keeps light text.
  block(':root:not([data-fidelity="wireframe"]) [data-foreground="dark"]', roles.filter((t) => ['text', 'icon', 'border'].includes(t.group)).map((t) => `--${t.name}: ${roleValue(t, 'inverse')};`));
  out.push(':root { color-scheme: dark; }\n');

  const grads = of('gradient');
  block(':root', grads.map((t) => `--${t.name}: ${gradientCss(t)};`));
  // wireframe: gradients flatten to a plain elevation fill
  block(':root[data-fidelity="wireframe"]', grads.map((t) => `--${t.name}: linear-gradient(var(--bg-elevation-20), var(--bg-elevation-20));`));

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
