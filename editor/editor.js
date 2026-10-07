import { buildCss, gradientCss } from '../tools/build-tokens.js';
import { buildDefaultsCss } from '../tools/build-defaults.js';
import * as gh from './github.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

let tokens = [], schema = { fontFamilies: [], fontWeights: [] };
let fidelity = 'styled';
let libraries = [], library = null, asset = null;
const freshPreview = () => ({ attrs: {}, state: '', vars: {}, example: 0, surface: 'normal' });
let components = [], component = null, editing = false, cstate = freshPreview();
let kind = 'primitive', navKey = 'foundations/tokens/color/primitives', selected = null, saveTimer;
const expanded = new Set(['foundations', 'foundations/tokens', 'foundations/tokens/color', 'foundations/tokens/layout', 'foundations/tokens/type', 'foundations/tokens/motion', 'atoms', 'molecules', 'organisms', 'patterns', 'assets', 'assets/images']);

/* ---------- color helpers ---------- */
const primHex = (name) => (tokens.find((t) => t.kind === 'primitive' && t.name === name) || { hex: '#000000' }).hex;
const rgba = (hex, op = 100) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${op / 100})`;
};
const sw = (hex, op = 100, lg = false) => `<i class="sw${lg ? ' lg' : ''}" style="--rgba:${rgba(hex, op)}"></i>`;
const refChip = (v) => `<span class="chip">${sw(primHex(v.ref), v.opacity)}${esc(v.ref)}${v.opacity < 100 ? ` <em>${v.opacity}%</em>` : ''}</span>`;
const family = (key) => (schema.fontFamilies.find((f) => f.key === key) || { stack: 'inherit', label: key });
const weightLabel = (v) => (schema.fontWeights.find((w) => w.value === v) || { label: '' }).label;

/* ---------- kind definitions ---------- */
const NAME = { key: 'name', label: 'Name (CSS variable)', type: 'name' };
const px = (key = 'px', label = 'Value (px)') => ({ key, label, type: 'number', min: 0, step: 1 });
const simple = (path, noun, make, fields, cols, preview) => ({ path, noun, make, fields: [NAME, ...fields], cols, preview });

const KINDS = {
  primitive: simple(['tokens', 'color', 'primitives'], 'primitive', () => ({ hex: '#7a4de8' }),
    [{ key: 'hex', label: 'Hex', type: 'hex' }, { key: 'keepInWireframe', label: 'Wireframe mode', type: 'bool', text: 'Keep this color (a base surface)' }],
    [['Value', (t) => `<span class="chip">${sw(t.hex)}${esc(t.hex)}</span>`]],
    (t) => sw(t.hex, 100, true)),
  role: {
    path: ['tokens', 'color', 'roles'], noun: 'role',
    make: () => ({ group: 'background', values: { base: { ref: 'gray-50', opacity: 100 }, inverse: { ref: 'gray-900', opacity: 100 } } }),
    fields: [
      { key: 'group', label: 'Group', type: 'text', list: true }, NAME,
      { section: 'Base' }, { key: 'values.base', label: 'Color + opacity', type: 'refop' },
      { section: 'Inverse' }, { key: 'values.inverse', label: 'Color + opacity', type: 'refop' },
    ],
    cols: [['Base', (t) => refChip(t.values.base)], ['Inverse', (t) => refChip(t.values.inverse)]],
    preview: (t) => `<div class="pair" style="grid-template-columns:1fr 1fr">${sw(primHex(t.values.base.ref), t.values.base.opacity, true)}${sw(primHex(t.values.inverse.ref), t.values.inverse.opacity, true)}</div>`,
  },
  gradient: simple(['styles', 'color'], 'gradient', () => ({ base: '#3f0786', topRight: '#3f0786', topLeft: '#5a1f9b', bottomRight: '#62c2e5' }),
    [{ key: 'base', label: 'Base fill', type: 'hex' }, { key: 'topRight', label: 'Glow — top right', type: 'hex' }, { key: 'topLeft', label: 'Glow — top left', type: 'hex' }, { key: 'bottomRight', label: 'Glow — bottom right', type: 'hex' }],
    [['Gradient', (t) => `<i class="gradsw" style="background:${gradientCss(t)}"></i>`], ['Colors', (t) => `<span class="mute">${[t.base, t.topRight, t.topLeft, t.bottomRight].join(' · ')}</span>`]],
    (t) => `<i class="gradsw lg" style="background:${gradientCss(t)}"></i>`),
  padding: simple(['tokens', 'layout', 'padding'], 'padding', () => ({ px: 16 }), [px()],
    [['px', (t) => `${t.px}px`], ['', (t) => `<div class="bar" style="width:${Math.min(t.px, 200)}px"></div>`]],
    (t) => `<div class="bar" style="width:${Math.min(t.px, 280)}px"></div>`),
  spacing: simple(['tokens', 'layout', 'spacing'], 'spacing', () => ({ px: 16 }), [px()],
    [['px', (t) => `${t.px}px`], ['', (t) => `<div class="bar" style="width:${Math.min(t.px, 200)}px"></div>`]],
    (t) => `<div class="bar" style="width:${Math.min(t.px, 280)}px"></div>`),
  radius: simple(['tokens', 'layout', 'radius'], 'radius', () => ({ px: 8 }), [px()],
    [['px', (t) => `${t.px}px`], ['', (t) => `<div class="box" style="border-radius:${Math.min(t.px, 22)}px"></div>`]],
    (t) => `<div class="box" style="width:80px;height:80px;border-radius:${Math.min(t.px, 40)}px"></div>`),
  'font-family': simple(['tokens', 'type', 'font family'], 'font family', () => ({ value: 'inter' }),
    [{ key: 'value', label: 'Font', type: 'select', options: () => schema.fontFamilies.map((f) => [f.key, f.label]) }],
    [['Font', (t) => esc(family(t.value).label)], ['', (t) => `<span class="sample" style="font-family:${esc(family(t.value).stack)}">Thoughtful design</span>`]],
    (t) => `<span class="sample" style="font-size:24px;font-family:${esc(family(t.value).stack)}">Aa Thoughtful</span>`),
  'font-weight': simple(['tokens', 'type', 'weight'], 'font weight', () => ({ value: 400 }),
    [{ key: 'value', label: 'Weight', type: 'select', numeric: true, options: () => schema.fontWeights.map((w) => [w.value, `${w.label} (${w.value})`]) }],
    [['Weight', (t) => `${weightLabel(t.value)} ${t.value}`], ['', (t) => `<span class="sample" style="font-family:Inter;font-weight:${t.value}">Thoughtful design</span>`]],
    (t) => `<span class="sample" style="font-size:24px;font-family:Inter;font-weight:${t.value}">Aa Thoughtful</span>`),
  'font-size': simple(['tokens', 'type', 'size'], 'font size', () => ({ px: 16 }), [px()],
    [['px', (t) => `${t.px}px`], ['', (t) => `<span style="font-family:Inter;font-size:${Math.min(t.px, 44)}px;line-height:1.1">Aa</span>`]],
    (t) => `<span style="font-family:Inter;font-size:${Math.min(t.px, 72)}px;line-height:1.1">Aa</span>`),
  'line-height': simple(['tokens', 'type', 'line height'], 'line height', () => ({ percent: 150 }), [{ key: 'percent', label: 'Line height (%)', type: 'number', min: 50, step: 5 }],
    [['%', (t) => `${t.percent}%`], ['', (t) => `<span style="display:block;font-size:12px;width:140px;line-height:${t.percent / 100}">Thoughtful design system</span>`]],
    (t) => `<span style="display:block;font-size:14px;width:200px;line-height:${t.percent / 100}">Thoughtful design system, tuned line by line.</span>`),
  'letter-spacing': simple(['tokens', 'type', 'letter spacing'], 'letter spacing', () => ({ percent: 0 }), [{ key: 'percent', label: 'Letter spacing (%)', type: 'number', step: 0.5 }],
    [['%', (t) => `${t.percent}%`], ['', (t) => `<span class="sample" style="font-family:Inter;letter-spacing:${t.percent / 100}em">Thoughtful</span>`]],
    (t) => `<span class="sample" style="font-size:24px;font-family:Inter;letter-spacing:${t.percent / 100}em">Thoughtful</span>`),
  duration: simple(['tokens', 'motion', 'duration'], 'duration', () => ({ ms: 200 }), [{ key: 'ms', label: 'Duration (ms)', type: 'number', min: 0, step: 10 }],
    [['ms', (t) => `${t.ms}ms`], ['', (t) => `<div class="dot-track"><div class="dot" style="--d:${Math.max(t.ms, 30) * 4}ms;animation-timing-function:ease-in-out"></div></div>`]],
    (t) => `<div class="dot-track"><div class="dot" style="--d:${Math.max(t.ms, 30) * 4}ms;animation-timing-function:ease-in-out"></div></div><p class="mute" style="margin-top:8px">Preview plays 4× slower</p>`),
  easing: simple(['tokens', 'motion', 'easing'], 'easing', () => ({ bezier: [0.2, 0, 0, 1] }), [{ key: 'bezier', label: 'cubic-bezier (x1, y1, x2, y2)', type: 'bezier' }],
    [['cubic-bezier', (t) => `<span class="mute">${t.bezier.join(', ')}</span>`], ['', (t) => curve(t.bezier, 40)]],
    (t) => curve(t.bezier, 120)),
};

function curve([x1, y1, x2, y2], size) {
  const s = 60, f = (v) => +(v * s).toFixed(2);
  return `<svg class="curve" width="${size}" height="${size * 1.4}" viewBox="-4 -24 68 108"><path d="M0 ${s} C${f(x1)} ${s - f(y1)} ${f(x2)} ${s - f(y2)} ${s} 0" fill="none" stroke="#7a4de8" stroke-width="3"/><path d="M0 ${s}H${s}M0 0H${s}" stroke="#ddd" stroke-dasharray="2 3"/></svg>`;
}

/* ---------- nav ---------- */
const NAV = [
  { label: 'foundations', children: [
    { label: 'tokens', children: [
      { label: 'color', children: [{ label: 'primitives', kind: 'primitive' }, { label: 'roles', kind: 'role' }] },
      { label: 'layout', children: [{ label: 'padding', kind: 'padding' }, { label: 'spacing', kind: 'spacing' }, { label: 'radius', kind: 'radius' }] },
      { label: 'type', children: [{ label: 'font family', kind: 'font-family' }, { label: 'weight', kind: 'font-weight' }, { label: 'size', kind: 'font-size' }, { label: 'line height', kind: 'line-height' }, { label: 'letter spacing', kind: 'letter-spacing' }] },
      { label: 'motion', children: [{ label: 'duration', kind: 'duration' }, { label: 'easing', kind: 'easing' }] },
    ] },
    { label: 'styles', children: [{ label: 'color', kind: 'gradient' }, { label: 'type' }, { label: 'elevation' }, { label: 'motion' }] },
    { label: 'layout utilities' }
  ] },
  { label: 'atoms' },
  { label: 'molecules' },
  { label: 'organisms' },
  { label: 'patterns' },
  { label: 'assets' },
];

const TIERS = ['atoms', 'molecules', 'organisms', 'patterns'];
const tierNav = (tier) => {
  const items = components.filter((c) => c.tier === tier);
  return items.length ? { label: tier, children: items.map((c) => ({ label: c.meta.name.toLowerCase(), component: c.path })) } : { label: tier };
};

const assetNav = () => ({ label: 'assets', children: libraries.map((l) => {
  const gs = l.groups.filter((g) => g.items.length);
  if (!gs.length) return { label: l.id };
  if (gs.length === 1 && gs[0].id === 'all') return { label: l.id, library: `${l.id}/all` };
  return { label: l.id, children: gs.map((g) => ({ label: g.id, library: `${l.id}/${g.id}` })) };
}) });

function renderNav() {
  const walk = (items, prefix) => `<ul>${items.map((n) => {
    const key = prefix ? `${prefix}/${n.label}` : n.label;
    if (n.children) {
      const open = expanded.has(key);
      return `<li><button class="row${n.kind ? '' : ' ph'}" data-toggle="${key}"><span class="caret">${open ? '▼' : '▶'}</span>${n.label}</button>${open ? walk(n.children, key) : ''}</li>`;
    }
    const cls = `row${key === navKey ? ' active' : ''}${n.kind || n.component || n.library ? '' : ' ph'}`;
    return `<li><button class="${cls}" data-nav="${key}" data-kind="${n.kind || ''}" data-component="${n.component || ''}" data-library="${n.library || ''}">${n.label}</button></li>`;
  }).join('')}</ul>`;
  $('#nav').innerHTML = `<h1>tds</h1>${walk(NAV.map((n) => (TIERS.includes(n.label) ? tierNav(n.label) : n.label === 'assets' ? assetNav() : n)), '')}`;
}

$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.toggle) { expanded.has(b.dataset.toggle) ? expanded.delete(b.dataset.toggle) : expanded.add(b.dataset.toggle); }
  if (b.dataset.nav) {
    navKey = b.dataset.nav; kind = b.dataset.kind || null; selected = null;
    component = components.find((c) => c.path === b.dataset.component) || null;
    library = null; asset = null;
    if (b.dataset.library) { const [lid, gid] = b.dataset.library.split('/'); const l = libraries.find((x) => x.id === lid); library = { lib: l, group: l.groups.find((g) => g.id === gid) }; }
    cstate = freshPreview(); editing = false;
    setCanvasSrc();
  }
  renderAll();
});

/* ---------- table ---------- */
function renderCrumbs() {
  const parts = navKey.split('/');
  $('#crumbs').innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${p}</b>` : p)).join(' / ');
}

const DESC = {
  primitive: 'The raw values. Reference these only when defining tokens, not in components.',
  role: 'Semantic tokens mapped to roles: background, text, icon, border, status.',
  gradient: 'Named gradient styles for surfaces and chat UI.',
};

function renderTable() {
  const body = $('#body');
  $('#sheet-desc').textContent = (!library && kind && DESC[kind]) || '';
  if (library) return renderLibrary();
  if (!kind) { body.innerHTML = '<p class="empty">Placeholder — coming in a later step.</p>'; return; }
  const def = KINDS[kind];
  const list = tokens.filter((t) => t.kind === kind);
  if (!list.length) { body.innerHTML = `<p class="empty">No ${def.noun}s yet. Use “Add token”.</p>`; return; }
  const cols = def.cols;
  let html = `<table><thead><tr><th>Name</th>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  let group = null;
  for (const t of list) {
    if (kind === 'role' && t.group !== group) { group = t.group; html += `<tr class="group"><td colspan="${cols.length + 1}">color / ${esc(group)}</td></tr>`; }
    html += `<tr class="item${t === selected ? ' sel' : ''}" data-i="${tokens.indexOf(t)}"><td class="name">${esc(t.name)}</td>${cols.map(([, f]) => `<td>${f(t)}</td>`).join('')}</tr>`;
  }
  body.innerHTML = html + '</tbody></table>';
}

$('#body').addEventListener('click', (e) => {
  const tr = e.target.closest('tr.item'); if (!tr) return;
  selected = tokens[+tr.dataset.i]; renderTable(); renderPanel();
});

/* ---------- panel ---------- */
function fieldHtml(f, t) {
  if (f.section) return `<div class="section">${f.section}</div>`;
  const v = getPath(t, f.key);
  const wrap = (inner, extra = '') => `<div class="field"><label>${f.label}</label>${inner}${extra}</div>`;
  switch (f.type) {
    case 'name': return wrap(`<input data-key="name" value="${esc(v)}" spellcheck="false">`, '<div class="err-msg" id="name-err"></div>');
    case 'text': return wrap(`<input data-key="${f.key}" value="${esc(v)}" ${f.list ? 'list="groups"' : ''}>`) + (f.list ? `<datalist id="groups">${[...new Set(tokens.filter((x) => x.kind === 'role').map((x) => x.group))].map((g) => `<option value="${esc(g)}">`).join('')}</datalist>` : '');
    case 'hex': return wrap(`<div class="hexrow"><input type="color" data-key="${f.key}" value="${esc(v)}"><input data-key="${f.key}" value="${esc(v)}" spellcheck="false"></div>`);
    case 'number': return wrap(`<input type="number" data-key="${f.key}" value="${v}" ${f.min != null ? `min="${f.min}"` : ''} step="${f.step || 1}">`);
    case 'select': return wrap(`<select data-key="${f.key}" ${f.numeric ? 'data-numeric' : ''}>${f.options().map(([val, label]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`);
    case 'refop': return wrap(`<div class="pair"><select data-key="${f.key}.ref">${tokens.filter((x) => x.kind === 'primitive').map((p) => `<option ${p.name === v.ref ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><input type="number" data-key="${f.key}.opacity" min="0" max="100" value="${v.opacity}" title="Opacity %"></div>`);
    case 'bool': return wrap(`<label class="check"><input type="checkbox" data-key="${f.key}" ${v ? 'checked' : ''}> ${f.text}</label>`);
    case 'bezier': return wrap(`<div class="bez">${v.map((n, i) => `<input type="number" step="0.05" data-key="bezier.${i}" value="${n}">`).join('')}</div>`);
  }
}

function renderPanel() {
  if (component) return renderComponentPanel();
  if (library) return renderLibraryPanel();
  const p = $('#panel-body');
  if (!selected) { p.innerHTML = '<h2>Variables and Properties</h2><p class="mute">Select a token to edit it.</p>'; return; }
  const def = KINDS[kind];
  p.innerHTML = `<h2>Variables and Properties</h2><div id="pv">${def.preview(selected)}</div>
    ${def.fields.map((f) => fieldHtml(f, selected)).join('')}
    <div class="spacer"></div><button class="btn" id="del">Delete token</button>`;
}

const HEX = /^#[0-9a-f]{6}$/i;
$('#panel').addEventListener('input', (e) => {
  const el = e.target, key = el.dataset.key; if (!key || key === 'name' || !selected) return;
  let v = el.value;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'number') { v = parseFloat(v); if (Number.isNaN(v)) return; }
  else if (el.hasAttribute('data-numeric')) v = Number(v);
  if (key === 'hex') {
    if (!HEX.test(v)) return;
    v = v.toLowerCase();
    el.closest('.hexrow').querySelectorAll('input').forEach((i) => { if (i !== el) i.value = v; });
  }
  setPath(selected, key, v);
  $('#pv').innerHTML = KINDS[kind].preview(selected);
  renderTable(); scheduleSave();
});

$('#panel').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.key === 'group') { renderTable(); renderPanel(); }
  if (el.dataset.key !== 'name' || !selected) return;
  const v = el.value.trim(), err = $('#name-err');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) { err.textContent = 'Use lowercase letters, numbers and dashes.'; return; }
  if (tokens.some((t) => t !== selected && t.name === v)) { err.textContent = 'That name is taken.'; return; }
  err.textContent = '';
  if (selected.kind === 'primitive') tokens.forEach((t) => { if (t.kind === 'role') for (const m of ['base', 'inverse']) if (t.values[m].ref === selected.name) t.values[m].ref = v; });
  selected.name = v; renderTable(); scheduleSave();
});

$('#panel').addEventListener('click', (e) => {
  if (e.target.id !== 'del' || !selected) return;
  if (selected.kind === 'primitive') {
    const users = tokens.filter((t) => t.kind === 'role' && ['base', 'inverse'].some((m) => t.values[m].ref === selected.name));
    if (users.length) { setStatus(`Can't delete: used by ${users.map((u) => u.name).join(', ')}`, true); return; }
  }
  tokens.splice(tokens.indexOf(selected), 1); selected = null;
  renderTable(); renderPanel(); scheduleSave();
});

$('#add').addEventListener('click', () => {
  if (!kind) return;
  const def = KINDS[kind];
  let base = `new-${def.noun.replace(' ', '-')}`, name = base, i = 2;
  while (tokens.some((t) => t.name === name)) name = `${base}-${i++}`;
  const t = { kind, name, ...structuredClone(def.make()) };
  const last = tokens.map((x) => x.kind).lastIndexOf(kind);
  tokens.splice(last + 1, 0, t); selected = t;
  renderTable(); renderPanel(); scheduleSave();
  const n = document.querySelector('[data-key="name"]'); n.focus(); n.select();
});

/* ---------- save / load ---------- */
const TOKENS_JSON = 'tds/foundations/tokens/tokens.json', TOKENS_CSS = 'tds/foundations/tokens/tokens.css';
let mode = 'local';                       // local: the python server; github: explicit commits
let dirtyTokens = false;
const dirtyComps = new Set();             // component paths whose defaults changed
const isDirty = () => dirtyTokens || dirtyComps.size > 0;
const baseName = (path) => path.split('/').pop();
const compByPath = (path) => components.find((c) => c.path === path);
const metaPath = (c) => `tds/${c.path}/${baseName(c.path)}.meta.json`;

function setStatus(msg, err) { const st = $('#status'); st.textContent = msg; st.className = 'status' + (err ? ' err' : ''); updateSavebar(); }

// The save bar belongs to whatever is being edited: token pages always, components only in edit mode.
function updateSavebar() {
  const onTokens = !component && !library && !!kind, editingComp = !!component && editing;
  const gm = mode === 'github', cfg = gh.getCfg(), canSave = gm && (editingComp || onTokens);
  $('#savebar').hidden = !(editingComp || (onTokens && (gm || !!$('#status').textContent)));
  $('#signin').hidden = !canSave; $('#commit').hidden = !canSave;
  $('#save').hidden = !(!gm && editingComp);
  $('#discard').hidden = !(editingComp && dirtyComps.has(component.path));
  $('#signin').textContent = cfg.token ? 'GitHub ✓' : 'Sign in';
  $('#commit').disabled = !isDirty();
  $('#save').disabled = !dirtyComps.size;
}

// Everything that has changed, as {path: text}. Components' edited metas plus the regenerated defaults.css.
function changedFiles() {
  const f = {};
  if (dirtyTokens) { f[TOKENS_JSON] = JSON.stringify({ tokens }, null, 2) + '\n'; f[TOKENS_CSS] = buildCss(tokens, schema); }
  if (dirtyComps.size) {
    for (const path of dirtyComps) { const c = compByPath(path); f[metaPath(c)] = JSON.stringify(c.meta, null, 2) + '\n'; }
    f['tds/defaults.css'] = buildDefaultsCss(components);
  }
  return f;
}
function markSaved() {
  for (const path of dirtyComps) { const c = compByPath(path); c.saved = structuredClone(c.meta.defaults || {}); }
  dirtyComps.clear(); dirtyTokens = false; updateSavebar();
}

// Push the current (possibly unsaved) tokens into the canvas as a layer-scoped stylesheet.
function applyLive() {
  const doc = screen.contentDocument; if (!doc || !doc.head || !tokens.length) return;
  let st = doc.getElementById('live-tokens');
  if (!st) { st = doc.createElement('style'); st.id = 'live-tokens'; doc.head.appendChild(st); }
  st.textContent = `@layer tokens {\n${buildCss(tokens, schema)}\n}`;
}

function scheduleSave() {
  applyLive(); dirtyTokens = true;
  if (mode === 'github') { setStatus('Unsaved changes'); return; }
  setStatus('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveLocal, 300);
}
async function saveLocal() {
  try {
    const r = await fetch('../api/tokens', { method: 'PUT', body: JSON.stringify({ tokens, css: buildCss(tokens, schema) }) });
    const j = await r.json();
    if (r.ok) dirtyTokens = false;
    setStatus(r.ok ? 'Saved' : j.error, !r.ok);
  } catch { setStatus('Save failed — is the server running?', true); }
}

$('#save').addEventListener('click', async () => {
  setStatus('Saving…');
  try {
    const r = await fetch('../api/files', { method: 'PUT', body: JSON.stringify({ files: changedFiles() }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error);
    markSaved(); setStatus('Saved');
  } catch (e) { setStatus(e.message || 'Save failed — is the server running?', true); }
});
$('#signin').addEventListener('click', () => {
  const c = gh.getCfg(); $('#g-token').value = c.token; $('#g-repo').value = c.repo; $('#g-branch').value = c.branch; $('#dlg').showModal();
});
$('#dlg').addEventListener('close', async () => {
  if ($('#dlg').returnValue !== 'ok') return;
  gh.setCfg({ token: $('#g-token').value.trim(), repo: $('#g-repo').value.trim(), branch: $('#g-branch').value.trim() || 'main' });
  updateSavebar();
  if (!isDirty()) await loadTokens();   // pick up the latest from the repo
});
$('#commit').addEventListener('click', async () => {
  if (!gh.getCfg().token) return $('#signin').click();
  const what = [dirtyTokens && 'design tokens', dirtyComps.size && `component defaults (${[...dirtyComps].map(baseName).join(', ')})`].filter(Boolean).join(' and ');
  setStatus('Committing…'); $('#commit').disabled = true;
  try {
    await gh.commit(changedFiles(), `Update ${what} via editor`);
    markSaved(); setStatus(`Committed to ${gh.getCfg().branch} — the site updates in about a minute`);
  } catch (e) { setStatus(e.message, true); }
});
$('#discard').addEventListener('click', () => {
  for (const path of [...dirtyComps]) {
    const c = compByPath(path); c.meta.defaults = structuredClone(c.saved);
    if (!Object.keys(c.meta.defaults).length) delete c.meta.defaults;
  }
  dirtyComps.clear(); syncVars(); renderComponentPanel(); setStatus('');
});
window.addEventListener('beforeunload', (e) => { if (isDirty()) e.preventDefault(); });

const normalize = (list) => list.map((t) => (t.kind === 'role' && t.values.light ? { ...t, values: { base: t.values.dark, inverse: t.values.light } } : t));

async function loadTokens() {
  const published = async () => normalize((await fetch(mode === 'local' ? '../api/tokens' : '../' + TOKENS_JSON, { cache: 'no-store' }).then((r) => r.json())).tokens);
  try {
    if (mode === 'github' && gh.getCfg().token) {
      try { tokens = normalize((await gh.load(TOKENS_JSON)).tokens); }
      catch (e) { tokens = await published(); setStatus(`${e.message} — showing the published tokens`, true); }   // a bad or expired token must not empty the editor
    } else tokens = await published();
    selected = null; renderAll(); applyLive();
    if (mode === 'github' && !gh.getCfg().token) setStatus('Read-only — sign in to commit changes');
  } catch (e) { setStatus(e.message, true); }
}

function renderAll() { renderNav(); renderCrumbs(); renderTable(); renderPanel(); renderView(); $('#add').disabled = !kind; updateSavebar(); }

/* ---------- assets ---------- */
const LIB_BASE = '../tds/assets/';
const assetUrl = (file) => LIB_BASE + file.split('/').map(encodeURIComponent).join('/');
const kb = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

async function loadLibraries() {
  try { libraries = (await fetch(LIB_BASE + 'index.json', { cache: 'no-store' }).then((r) => r.json())).libraries; } catch { libraries = []; }
}

function renderLibrary() {
  const items = library.group.items;
  $('#body').innerHTML = `<p class="mute" style="margin-bottom:12px">${items.length} ${esc(library.lib.id)}${library.group.id === 'all' ? '' : ' · ' + esc(library.group.label)}</p>
    <div class="lib-grid photos">${items.map((it, i) => `
      <button class="tile${it === asset ? ' sel' : ''}" data-i="${i}">
        <span class="thumb"><img src="${assetUrl(it.file)}" alt="${esc(it.name)}" loading="lazy"></span>
        <span class="cap">${esc(it.name)}</span>
      </button>`).join('')}</div>`;
}

$('#body').addEventListener('click', (e) => {
  const t = e.target.closest('.tile'); if (!t || !library) return;
  asset = library.group.items[+t.dataset.i]; renderLibrary(); renderLibraryPanel();
});

function renderLibraryPanel() {
  const p = $('#panel-body');
  if (!asset) { p.innerHTML = '<h2>Variables and Properties</h2><p class="mute">Select an asset to see its details.</p>'; return; }
  const url = assetUrl(asset.file), dims = asset.width ? `${Math.round(asset.width)} × ${Math.round(asset.height)}` : '—';
  const snippet = `<img src="tds/assets/${asset.file}" alt="">`;
  const ro = (label, v) => `<div class="field"><label>${label}</label><input readonly value="${esc(v)}"></div>`;
  p.innerHTML = `<h2>Variables and Properties</h2>
    <div class="asset-prev"><img src="${url}" alt="${esc(asset.name)}"></div>
    ${ro('Name', asset.name)}${ro('File', 'tds/assets/' + asset.file)}${ro('Dimensions', dims)}${ro('Size', kb(asset.bytes))}
    <div class="section">Usage</div>
    ${ro('Snippet', snippet)}
    <button class="btn" id="copy">Copy snippet</button>`;
  p.dataset.snippet = snippet;
}
$('#panel').addEventListener('click', async (e) => {
  if (e.target.id !== 'copy') return;
  try { await navigator.clipboard.writeText($('#panel-body').dataset.snippet); e.target.textContent = 'Copied'; setTimeout(() => (e.target.textContent = 'Copy snippet'), 1200); } catch { /* clipboard blocked */ }
});

/* ---------- components (atoms, molecules, organisms, patterns) ---------- */
async function loadComponents() {
  try {
    const idx = await fetch('../tds/index.json', { cache: 'no-store' }).then((r) => r.json());
    components = await Promise.all(idx.components.map(async (path) => ({
      path, tier: path.split('/')[0],
      meta: await fetch(`../tds/${path}/${path.split('/').pop()}.meta.json`, { cache: 'no-store' }).then((r) => r.json()),
    })));
    components.forEach((c) => { c.saved = structuredClone(c.meta.defaults || {}); });
  } catch { components = []; }
}

function setCanvasSrc() {
  if (!component) return;
  const want = `../preview/component.html?c=${component.path}${window.__V ? `&v=${window.__V}` : ''}`;
  if (screen.getAttribute('src') !== want) screen.setAttribute('src', want);
}

const tokenOptions = (type) => {
  const of = (k) => tokens.filter((t) => t.kind === k);
  const opts = (list) => list.map((t) => `<option value="var(--${esc(t.name)})">${esc(t.name)}</option>`).join('');
  if (type === 'color') return `<optgroup label="Roles">${opts(of('role'))}</optgroup><optgroup label="Primitives">${opts(of('primitive'))}</optgroup>`;
  if (type === 'radius') return opts(of('radius'));
  if (type === 'padding') return `<optgroup label="Padding">${opts(of('padding'))}</optgroup><optgroup label="Spacing">${opts(of('spacing'))}</optgroup>`;
  return '';
};

const isSingle = (c) => ['organisms', 'patterns'].includes(c.tier);   // organisms and beyond: one instance, variants in the panel
const field = (label, control) => `<div class="field"><label>${esc(label)}</label>${control}</div>`;
const select = (attr, options, current) => `<select ${attr}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(current) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const varControl = (k, type, cur, attr) => (type === 'number'
  ? `<input type="number" step="0.01" ${attr}="${esc(k)}" value="${esc(cur)}" placeholder="default">`
  : `<select ${attr}="${esc(k)}"><option value="">Default</option>${tokenOptions(type).replace(`value="${cur}"`, `value="${cur}" selected`)}</select>`);

function renderComponentPanel() {
  const m = component.meta, p = $('#panel-body');
  const about = `<p class="mute">${esc(m.name)} · ${esc(m.tier)} · ${m.stateful ? 'stateful' : 'stateless'}${(m.uses || []).length ? ' · uses ' + m.uses.join(', ') : ''}</p>`;
  if (editing) {
    const vars = Object.entries(m.variables || {}).map(([k, type]) => field(k, varControl(k, type, (m.defaults || {})[k] || '', 'data-cdef'))).join('');
    p.innerHTML = `<div class="between"><h2>Editing ${esc(m.name)}</h2><button class="link" id="edit-back">← Back</button></div>${about}
      <div class="section">Defaults</div>${vars}
      <p class="mute">What you set here becomes this component's default. It's saved in its meta.json and in tds/defaults.css.</p>`;
    return;
  }
  const examples = (m.examples || []).length ? field('variant', select('data-cexample="1"', m.examples.map((e, i) => [i, e.name]), cstate.example)) : '';
  const attrs = Object.entries(m.attributes || {}).map(([k, a]) => field(k, select(`data-cattr="${esc(k)}"`, a.values.map((v) => [v, v]), cstate.attrs[k] || a.default))).join('');
  const states = (m.states || []).length ? field('state (forced)', select('id="cstate"', [['', 'none'], ...m.states.map((x) => [x, x])], cstate.state)) : '';
  const surface = isSingle(component) ? field('surface', select('data-csurface="1"', [['normal', 'normal'], ['inverse', 'inverse']], cstate.surface)) : '';
  const vars = Object.entries(m.variables || {}).map(([k, type]) => field(k, varControl(k, type, cstate.vars[k] || '', 'data-cvar'))).join('');
  p.innerHTML = `<h2>Variables and Properties</h2>${about}
    ${examples || attrs || states || surface ? `<div class="section">Properties</div>${examples}${attrs}${states}${surface}` : ''}
    ${vars ? `<div class="section">Variables</div>${vars}<p class="mute">Previewed here only. Edit Component changes the defaults.</p>` : ''}
    <div class="spacer"></div>
    <button class="link" id="creset">Reset preview</button>
    <button class="btn dark wide" id="edit-comp">Edit Component</button>`;
}

// Inline variables on the canvas = this component's saved defaults, with any preview overrides on top.
function syncVars() {
  const api = component && screen.contentWindow && screen.contentWindow.tdsComponent; if (!api) return;
  api.clearVars();
  for (const [k, v] of Object.entries({ ...(component.meta.defaults || {}), ...cstate.vars })) if (v) api.setVar(k, v);
}

function editDefault(k, v) {
  const m = component.meta; m.defaults = m.defaults || {};
  if (v) m.defaults[k] = v; else delete m.defaults[k];
  if (!Object.keys(m.defaults).length) delete m.defaults;
  delete cstate.vars[k]; dirtyComps.add(component.path);
  syncVars(); setStatus('Unsaved changes');
}

$('#panel').addEventListener('input', (e) => {
  const el = e.target, api = component && screen.contentWindow.tdsComponent; if (!api) return;
  if (el.dataset.cdef) editDefault(el.dataset.cdef, el.value);
  else if ('cexample' in el.dataset) { cstate.example = +el.value; api.setExample(cstate.example); }
  else if ('csurface' in el.dataset) { cstate.surface = el.value; api.setSurface(el.value); }
  else if (el.dataset.cattr) { api.setAttr(el.dataset.cattr, el.value); cstate.attrs[el.dataset.cattr] = el.value; }
  else if (el.id === 'cstate') { api.setState(el.value); cstate.state = el.value; }
  else if (el.dataset.cvar) {
    const v = el.value;
    if (v) cstate.vars[el.dataset.cvar] = v; else delete cstate.vars[el.dataset.cvar];
    syncVars();
  }
});
$('#panel').addEventListener('click', (e) => {
  if (!component) return;
  if (e.target.id === 'edit-comp') { editing = true; renderComponentPanel(); updateSavebar(); }
  else if (e.target.id === 'edit-back') { editing = false; renderComponentPanel(); updateSavebar(); }
  else if (e.target.id === 'creset') {
    const api = screen.contentWindow.tdsComponent; if (api) api.reset();
    cstate = freshPreview(); syncVars(); renderComponentPanel();
  }
});
window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data && e.data.type === 'tds-ready' && component) { syncVars(); renderComponentPanel(); }
});

/* ---------- canvas ---------- */
const DEVICES = [
  { name: 'iPhone 17', w: 390, h: 874, phone: true },
  { name: 'iPhone 17 Pro Max', w: 440, h: 956, phone: true },
  { name: 'iPhone SE', w: 375, h: 667, phone: true },
  { name: 'Pixel 9', w: 412, h: 915, phone: true },
  { name: 'iPad mini', w: 744, h: 1133, phone: true },
  { name: 'Desktop', w: 1280, h: 800, phone: false },
];
let dims = { w: DEVICES[0].w, h: DEVICES[0].h }, phoneFrame = true;
const screen = $('#screen');

// The content decides the view: components open on the canvas; tokens, assets and everything else are tables.
function renderView() {
  const canvas = !!component;
  $('#sheet').hidden = canvas; $('#stage').hidden = !canvas; $('#toolbar').hidden = !canvas;
  $('#add').hidden = !kind; $('#sheethead').hidden = !kind;
  if (canvas) fit();
}

// The canvas is full-screen. While the interface is showing, keep the frame clear of the panels.
const UI_AREA = { l: 208, r: 288, t: 40, b: 0 };   // nav, properties panel, top bar
function fit() {
  const on = $('#app').dataset.ui !== 'off', a = on ? UI_AREA : { l: 0, r: 0, t: 0, b: 0 };
  const bez = phoneFrame ? 10 : 0, W = dims.w + 2 * bez, H = dims.h + 2 * bez, pad = 24;
  const aw = innerWidth - a.l - a.r, ah = innerHeight - a.t - a.b;
  const s = Math.max(0.1, Math.min(1, (aw - 2 * pad) / W, (ah - 2 * pad) / H));
  const w = W * s, h = H * s;
  $('#wrap').style.cssText = `width:${w}px;height:${h}px;left:${a.l + (aw - w) / 2}px;top:${a.t + (ah - h) / 2}px`;
  const f = $('#frame');
  f.className = phoneFrame ? 'phone' : 'plain';
  f.style.cssText = `width:${W}px;height:${H}px;transform:scale(${s})`;
  screen.style.cssText = `width:${dims.w}px;height:${dims.h}px`;
  $('#dw').value = dims.w; $('#dh').value = dims.h;
}
new ResizeObserver(() => { if (component) fit(); }).observe($('#stage'));

$('#device').innerHTML = DEVICES.map((d, i) => `<option value="${i}">${d.name} ▾</option>`).join('');
$('#device').addEventListener('change', (e) => {
  const d = DEVICES[+e.target.value]; dims = { w: d.w, h: d.h }; phoneFrame = d.phone; fit();
});
for (const id of ['dw', 'dh']) $('#' + id).addEventListener('change', (e) => {
  const v = Math.max(200, Math.min(3000, parseInt(e.target.value, 10) || 0)) ; if (!v) return fit();
  dims[id === 'dw' ? 'w' : 'h'] = v; fit();
});

function applyModes() {
  const root = screen.contentDocument && screen.contentDocument.documentElement; if (!root) return;
  root.setAttribute('data-fidelity', fidelity);
}
function syncToggles() {
  $('#t-wire').checked = fidelity === 'wireframe';
}
$('#t-wire').addEventListener('change', (e) => { fidelity = e.target.checked ? 'wireframe' : 'styled'; applyModes(); });

screen.addEventListener('load', () => { applyModes(); applyLive(); });
syncToggles();

/* ---------- ⌘\ hides the interface ---------- */
function setUi(on) {
  $('#app').dataset.ui = on ? 'on' : 'off'; localStorage.tdsUi = on ? 'on' : 'off';
  if (!on) { const h = $('#hint'); h.classList.add('show'); clearTimeout(h.t); h.t = setTimeout(() => h.classList.remove('show'), 1800); }
  else $('#hint').classList.remove('show');
  if (component) fit();
}
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.code === 'Backslash') { e.preventDefault(); setUi($('#app').dataset.ui === 'off'); }
});
window.addEventListener('resize', () => { if (component) fit(); });
setUi(localStorage.tdsUi !== 'off');

(async () => {
  schema = await fetch('../tools/token-schema.json').then((r) => r.json());
  mode = (await fetch('../api/tokens', { method: 'HEAD' }).catch(() => ({ ok: false }))).ok ? 'local' : 'github';
  updateSavebar(); await Promise.all([loadTokens(), loadComponents(), loadLibraries()]); renderAll(); setCanvasSrc();
})();
