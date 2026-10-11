// type styles (array) -> type.css text. Runs in the browser, so the editor works on a static host.
// Each style becomes two custom properties (--text-<id> for `font`, --text-<id>-ls for `letter-spacing`) and a .text-<id> class.
// Components use the properties, so a style edited here changes everywhere it is used.
export function buildTypeCss(styles) {
  const font = (s) => `${s.italic ? 'italic ' : ''}var(--${s.weight}) var(--${s.size})/var(--${s.lineHeight}) var(--${s.family})`;
  const vars = styles.map((s) => `  --text-${s.id}: ${font(s)};\n  --text-${s.id}-ls: var(--${s.letterSpacing});`).join('\n');
  const classes = styles.map((s) => `.text-${s.id} { font: var(--text-${s.id}); letter-spacing: var(--text-${s.id}-ls); }`).join('\n');
  return ['/* GENERATED from type.json by tools/build-type.js — edit in the editor (styles > type), not here. */\n', `:root {\n${vars}\n}\n`, `${classes}\n`].join('\n');
}
