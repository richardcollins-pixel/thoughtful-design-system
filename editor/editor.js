import { buildCss } from '../tools/build-tokens.js';
import * as gh from './github.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

let tokens = [], schema = { fontFamilies: [], fontWeights: [] };
let view = localStorage.tdsView || 'table', fidelity = 'styled', theme = 'light';
let kind = 'primitive', navKey = 'tokens/color/primitives', selected = null, saveTimer;
const expanded = new Set(['tokens', 'tokens/color', 'tokens/layout', 'tokens/type', 'tokens/motion']);

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
    [{ key: 'hex', label: 'Hex', type: 'hex' }],
    [['Value', (t) => `<span class="chip">${sw(t.hex)}${esc(t.hex)}</span>`]],
    (t) => sw(t.hex, 100, true)),
  role: {
    path: ['tokens', 'color', 'roles'], noun: 'role',
    make: () => ({ group: 'background', values: { light: { ref: 'gray-900', opacity: 100 }, dark: { ref: 'white', opacity: 100 } } }),
    fields: [
      { key: 'group', label: 'Group', type: 'text', list: true }, NAME,
      { section: 'Light' }, { key: 'values.light', label: 'Color + opacity', type: 'refop' },
      { section: 'Dark' }, { key: 'values.dark', label: 'Color + opacity', type: 'refop' },
    ],
    cols: [['Light', (t) => refChip(t.values.light)], ['Dark', (t) => refChip(t.values.dark)]],
    preview: (t) => `<div class="pair" style="grid-template-columns:1fr 1fr">${sw(primHex(t.values.light.ref), t.values.light.opacity, true)}${sw(primHex(t.values.dark.ref), t.values.dark.opacity, true)}</div>`,
  },
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
  { label: 'tokens', children: [
    { label: 'color', children: [{ label: 'primitives', kind: 'primitive' }, { label: 'roles', kind: 'role' }] },
    { label: 'layout', children: [{ label: 'padding', kind: 'padding' }, { label: 'spacing', kind: 'spacing' }, { label: 'radius', kind: 'radius' }] },
    { label: 'type', children: [{ label: 'font family', kind: 'font-family' }, { label: 'weight', kind: 'font-weight' }, { label: 'size', kind: 'font-size' }, { label: 'line height', kind: 'line-height' }, { label: 'letter spacing', kind: 'letter-spacing' }] },
    { label: 'motion', children: [{ label: 'duration', kind: 'duration' }, { label: 'easing', kind: 'easing' }] },
  ] },
  { label: 'styles', children: [{ label: 'color' }, { label: 'type' }, { label: 'elevation' }, { label: 'motion' }] },
  { label: 'layout utilities' },
  { label: 'components', children: [{ label: 'parts' }, { label: 'blocks' }, { label: 'sections' }] },
  { label: 'templates' },
  { label: 'screens' },
];

function renderNav() {
  const walk = (items, prefix) => `<ul>${items.map((n) => {
    const key = prefix ? `${prefix}/${n.label}` : n.label;
    if (n.children) {
      const open = expanded.has(key);
      return `<li><button class="row${n.kind ? '' : ' ph'}" data-toggle="${key}"><span class="caret">${open ? '▼' : '▶'}</span>${n.label}</button>${open ? walk(n.children, key) : ''}</li>`;
    }
    const cls = `row${key === navKey ? ' active' : ''}${n.kind ? '' : ' ph'}`;
    return `<li><button class="${cls}" data-nav="${key}" data-kind="${n.kind || ''}">${n.label}</button></li>`;
  }).join('')}</ul>`;
  $('#nav').innerHTML = `<h1>tds</h1>${walk(NAV, '')}`;
}

$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.toggle) { expanded.has(b.dataset.toggle) ? expanded.delete(b.dataset.toggle) : expanded.add(b.dataset.toggle); }
  if (b.dataset.nav) { navKey = b.dataset.nav; kind = b.dataset.kind || null; selected = null; }
  renderAll();
});

/* ---------- table ---------- */
function renderCrumbs() {
  const parts = navKey.split('/');
  $('#crumbs').innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${p}</b>` : p)).join(' / ');
}

function renderTable() {
  const body = $('#body');
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
    case 'bezier': return wrap(`<div class="bez">${v.map((n, i) => `<input type="number" step="0.05" data-key="bezier.${i}" value="${n}">`).join('')}</div>`);
  }
}

function renderPanel() {
  const p = $('#panel');
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
  if (el.type === 'number') { v = parseFloat(v); if (Number.isNaN(v)) return; }
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
  if (selected.kind === 'primitive') tokens.forEach((t) => { if (t.kind === 'role') for (const m of ['light', 'dark']) if (t.values[m].ref === selected.name) t.values[m].ref = v; });
  selected.name = v; renderTable(); scheduleSave();
});

$('#panel').addEventListener('click', (e) => {
  if (e.target.id !== 'del' || !selected) return;
  if (selected.kind === 'primitive') {
    const users = tokens.filter((t) => t.kind === 'role' && ['light', 'dark'].some((m) => t.values[m].ref === selected.name));
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
let mode = 'local', dirty = false;   // local: python server autosaves. github: explicit commit.

function setStatus(msg, err) { const s = $('#status'); s.textContent = msg; s.className = 'status' + (err ? ' err' : ''); }
const files = () => ({ [TOKENS_JSON]: JSON.stringify({ tokens }, null, 2) + '\n', [TOKENS_CSS]: buildCss(tokens, schema) });

// Push the current (possibly unsaved) tokens into the canvas as a layer-scoped stylesheet.
function applyLive() {
  const doc = screen.contentDocument; if (!doc || !doc.head || !tokens.length) return;
  let st = doc.getElementById('live-tokens');
  if (!st) { st = doc.createElement('style'); st.id = 'live-tokens'; doc.head.appendChild(st); }
  st.textContent = `@layer tokens {\n${buildCss(tokens, schema)}\n}`;
}

function scheduleSave() {
  applyLive();
  if (mode === 'github') { dirty = true; setStatus('Unsaved changes'); renderMode(); return; }
  setStatus('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveLocal, 300);
}
async function saveLocal() {
  try {
    const f = files();
    const r = await fetch('../api/tokens', { method: 'PUT', body: JSON.stringify({ tokens, css: f[TOKENS_CSS] }) });
    const j = await r.json();
    setStatus(r.ok ? 'Saved' : j.error, !r.ok);
  } catch { setStatus('Save failed — is the server running?', true); }
}

function renderMode() {
  const gm = mode === 'github', cfg = gh.getCfg();
  $('#signin').hidden = !gm; $('#commit').hidden = !gm;
  $('#signin').textContent = cfg.token ? 'GitHub ✓' : 'Sign in';
  $('#commit').disabled = !dirty;
}
$('#signin').addEventListener('click', () => {
  const c = gh.getCfg(); $('#g-token').value = c.token; $('#g-repo').value = c.repo; $('#g-branch').value = c.branch; $('#dlg').showModal();
});
$('#dlg').addEventListener('close', async () => {
  if ($('#dlg').returnValue !== 'ok') return;
  gh.setCfg({ token: $('#g-token').value.trim(), repo: $('#g-repo').value.trim(), branch: $('#g-branch').value.trim() || 'main' });
  renderMode();
  if (!dirty) await loadTokens();   // pick up the latest from the repo
});
$('#commit').addEventListener('click', async () => {
  if (!gh.getCfg().token) return $('#signin').click();
  setStatus('Committing…'); $('#commit').disabled = true;
  try {
    await gh.commit(files(), 'Update design tokens via editor');
    dirty = false; setStatus(`Committed to ${gh.getCfg().branch} — the site updates in about a minute`);
  } catch (e) { setStatus(e.message, true); }
  renderMode();
});
window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

async function loadTokens() {
  try {
    if (mode === 'github' && gh.getCfg().token) tokens = (await gh.load(TOKENS_JSON)).tokens;
    else tokens = (await fetch(mode === 'local' ? '../api/tokens' : '../' + TOKENS_JSON, { cache: 'no-store' }).then((r) => r.json())).tokens;
    selected = null; renderAll(); applyLive();
    if (mode === 'github' && !gh.getCfg().token) setStatus('Read-only — sign in to commit changes');
  } catch (e) { setStatus(e.message, true); }
}

function renderAll() { renderNav(); renderCrumbs(); renderTable(); renderPanel(); renderView(); $('#add').disabled = !kind; }

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

function renderView() {
  const canvas = view === 'canvas';
  $('#body').hidden = canvas; $('#stage').hidden = !canvas; $('#toolbar').hidden = !canvas;
  $('#add').hidden = canvas;
  document.querySelectorAll('#viewseg button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  if (canvas) fit();
}
$('#viewseg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  view = localStorage.tdsView = b.dataset.view; renderView();
});

function fit() {
  const st = $('#stage'), bez = phoneFrame ? 10 : 0;
  const W = dims.w + 2 * bez, H = dims.h + 2 * bez;
  const s = Math.min(1, (st.clientWidth - 48) / W, (st.clientHeight - 32) / H);
  $('#wrap').style.cssText = `width:${W * s}px;height:${H * s}px`;
  const f = $('#frame');
  f.className = phoneFrame ? 'phone' : 'plain';
  f.style.cssText = `width:${W}px;height:${H}px;transform:scale(${s})`;
  screen.style.cssText = `width:${dims.w}px;height:${dims.h}px`;
  $('#dw').value = dims.w; $('#dh').value = dims.h;
}
new ResizeObserver(() => { if (view === 'canvas') fit(); }).observe($('#stage'));

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
  root.setAttribute('data-fidelity', fidelity); root.setAttribute('data-theme', theme);
}
function syncToggles() {
  $('#t-wire').classList.toggle('on', fidelity === 'wireframe'); $('#t-dark').classList.toggle('on', theme === 'dark');
}
$('#t-wire').addEventListener('click', () => { fidelity = fidelity === 'wireframe' ? 'styled' : 'wireframe'; applyModes(); syncToggles(); });
$('#t-dark').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyModes(); syncToggles(); });

screen.addEventListener('load', () => { applyModes(); applyLive(); });
syncToggles();

(async () => {
  schema = await fetch('../tools/token-schema.json').then((r) => r.json());
  mode = (await fetch('../api/tokens', { method: 'HEAD' }).catch(() => ({ ok: false }))).ok ? 'local' : 'github';
  renderMode(); await loadTokens();
})();
