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
let collapsed = {};   // panel sections the user folded
let components = [], component = null, editing = false, cstate = freshPreview();
let kind = 'primitive', navKey = 'tokens/primitives', selected = null, saveTimer;

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

/* ---------- nav: tokens, styles, atoms, molecules, organisms, patterns ---------- */
const LEVELS = ['tokens', 'styles', 'atoms', 'molecules', 'organisms', 'patterns'];
const TOKEN_LEAVES = [['primitives', 'primitive'], ['roles', 'role'], ['padding', 'padding'], ['spacing', 'spacing'], ['radius', 'radius'], ['font family', 'font-family'], ['weight', 'font-weight'], ['size', 'font-size'], ['line height', 'line-height'], ['letter spacing', 'letter-spacing'], ['duration', 'duration'], ['easing', 'easing']];
const camel = (str) => str.replace(/-(\w)/g, (m, c) => c.toUpperCase());
const levelLeaves = (level) => {
  if (level === 'tokens') return TOKEN_LEAVES.map(([label, k]) => ({ label, kind: k }));
  if (level === 'styles') return [{ label: 'color', kind: 'gradient' }, { label: 'type' }, { label: 'elevation' }, { label: 'motion' }];
  return components.filter((c) => c.tier === level).map((c) => ({ label: camel(c.path.split('/')[1]), component: c.path }));
};
let openLevel = 'tokens';   // one level open at a time

function renderNav() {
  $('#nav').innerHTML = `<h1>tds</h1><ul>${LEVELS.map((lv) => {
    const open = openLevel === lv;
    const leaves = open ? `<ul>${levelLeaves(lv).map((n) => {
      const key = `${lv}/${n.label}`;
      const cls = `row leaf${key === navKey ? ' active' : ''}${n.kind || n.component ? '' : ' ph'}`;
      return `<li><button class="${cls}" data-nav="${key}" data-kind="${n.kind || ''}" data-component="${n.component || ''}">/${n.label}</button></li>`;
    }).join('') || '<li class="none">nothing yet</li>'}</ul>` : '';
    return `<li><button class="row level${open ? ' open' : ''}" data-level="${lv}">${lv}</button>${leaves}</li>`;
  }).join('')}</ul>`;
}

$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.level) { openLevel = openLevel === b.dataset.level ? null : b.dataset.level; renderNav(); return; }
  if (b.dataset.nav) {
    navKey = b.dataset.nav; kind = b.dataset.kind || null; selected = null;
    component = components.find((c) => c.path === b.dataset.component) || null;
    library = null; asset = null;
    cstate = freshPreview(); editing = false;
    setCanvasSrc();
  }
  renderAll();
});

/* ---------- table ---------- */
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

function renderAll() { renderNav(); renderTable(); renderPanel(); renderView(); $('#add').disabled = !kind; updateSavebar(); }

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
  if (type === 'color' || type === 'fill') return `<optgroup label="Roles">${opts(of('role'))}</optgroup><optgroup label="Primitives">${opts(of('primitive'))}</optgroup>${type === 'fill' ? `<optgroup label="Gradients">${opts(of('gradient'))}</optgroup>` : ''}`;
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

const svg = (d, w = 14) => `<svg viewBox="0 0 16 16" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const CHEV_UP = svg('<path d="m4 10 4-4 4 4"/>'), CHEV_DOWN = svg('<path d="m4 6 4 4 4-4"/>');
const encPath = (rel) => rel.split('/').map(encodeURIComponent).join('/');
const photoUrl = (rel) => `../tds/assets/${encPath(rel)}`;
const glyphUrl = (file) => `../tds/atoms/icon/${encPath(file)}`;
const iconMask = (file) => `<i class="mask" style="-webkit-mask-image:url('${glyphUrl(file)}');mask-image:url('${glyphUrl(file)}')"></i>`;

// ---- layout of the panel: collapsible sections, label-left / control-right rows, dashed "add" placeholders
const sec = (id, title, body) => `<section class="cp-sec${collapsed[id] ? '' : ' open'}"><button class="cp-sec-head" data-csec="${id}"><span>${esc(title)}</span>${CHEV_UP}</button><div class="cp-sec-body" ${collapsed[id] ? 'hidden' : ''}>${body}</div></section>`;
const prow = (label, control) => `<div class="prow"><span class="plabel">${esc(label)}</span><div class="pctl">${control}</div></div>`;
const panelHead = (m, extra = '') => `<div class="cp-top"><h2 class="cp-title">${esc(m.name)}</h2><label class="switch"><span>Charcoal</span><input type="checkbox" id="t-wire" role="switch" ${fidelity === 'wireframe' ? 'checked' : ''}><i></i></label></div>${extra}
  <div class="field"><label>Description</label><textarea class="cp-desc-edit" rows="3" data-cdesc>${esc(m.description || '')}</textarea></div>`;

// ---- controls
const steps = (opts, value, attrs) => `<div class="steps" ${attrs}>${opts.map((o) => { const on = String(o.value) === String(value); return `<button class="step${on ? ' sel' : ''}" type="button" data-step="${esc(o.value)}" title="${esc(o.title || o.label)}">${on ? esc(o.label) : '<i></i>'}</button>`; }).join('')}</div>`;
function dd(attrs, options, value, kind) {
  const cur = options.find((o) => String(o.value) === String(value)) || options[0] || { label: '' };
  const thumb = (o) => (kind === 'person' ? `<img class="dd-thumb" src="${photoUrl(o.photo)}" alt="">` : kind === 'icon' ? iconMask(o.file) : '');
  return `<div class="dd" ${attrs}><button class="dd-btn" type="button" data-dd>${thumb(cur)}<span>${esc(cur.label)}</span>${CHEV_DOWN}</button>
    <div class="dd-menu" hidden>${options.map((o) => `<button class="dd-opt${String(o.value) === String(value) ? ' sel' : ''}" type="button" data-dd-opt="${esc(o.value)}">${thumb(o)}<span>${esc(o.label)}</span></button>`).join('')}</div></div>`;
}
// The icon beside a text field connects it to a prompt. A prompt fills a group of fields together; it's set on the organism
// in the design system, and an environment (production / dev / sandbox) can override it.
const AI_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8 19.4 7v10L12 21.2 4.6 17V7z"/><path d="M12 8.2l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z"/><path d="M1.5 12h3"/></svg>`;
function aiMenu(prompt, model) {
  const envs = esc(model.environments.join(' · '));
  if (!prompt) return `<div class="aimenu" hidden><p class="ai-title">No prompt connected</p><p class="ai-note">A prompt attaches to the organism in the design system, or per environment (${envs}).</p></div>`;
  return `<div class="aimenu" hidden><p class="ai-title">${esc(prompt.label)}</p><p class="ai-note">Fills together: ${prompt.outputs.map(esc).join(' + ')}</p>
    <p class="ai-instr">${esc(prompt.instruction)}</p><p class="ai-note">Inputs: ${prompt.inputs.map(esc).join(', ')}<br>Set at: ${esc(prompt.level)} · overrides: none yet (${envs})</p></div>`;
}
const textControl = (attrs, value, model, long, prompt) => `<div class="inwrap">${long ? `<textarea rows="2" ${attrs}>${esc(value)}</textarea>` : `<input ${attrs} value="${esc(value)}">`}<button class="aibtn${prompt ? ' on' : ''}" type="button" data-ai title="${prompt ? 'Connected to a prompt' : 'Connect a prompt'}">${AI_ICON}</button>${aiMenu(prompt, model)}</div>`;

// Everyday panel: content only. Structure (icons, sizes, adding things) is for edit mode.
function itemHtml(it, model) {
  if (it.type === 'text') return field(it.label, textControl(`data-cm-item="${it.id}"`, it.value, model, it.value.length > 40, it.prompt));
  return it.controls.map((c) => field(it.controls.length > 1 ? c.label : it.label, textControl(`data-cm-item="${it.id}" data-cm-prop="${c.key}"`, c.value, model, false, it.prompt))).join('');
}
const slotsHtml = (model) => model.slots.map((sl) => sec('slot-' + sl.id, sl.label, sl.items.map((it) => itemHtml(it, model)).join(''))).join('');
const personaRows = (model) => model.personas.map((pe) => prow(pe.label, dd(`data-cpersona="${pe.role}"`, pe.options, pe.value, 'person'))).join('');

// ---- token-bound properties (background, corner radius, padding)
const propCur = (m, v, dflt) => cstate.vars[v] ?? (m.defaults || {})[v] ?? dflt;
const propVars = (pr) => pr.vars || [pr.var];
function propsBody(m, viewOnly = false) {
  return (m.properties || []).filter((pr) => !(viewOnly && pr.edit)).map((pr) => {
    if (pr.type === 'gradients') {
      const cur = propCur(m, propVars(pr)[0], pr.default);
      return prow(pr.label, `<div class="chips">${tokens.filter((t) => t.kind === 'gradient').map((t) => `<button class="chip-bg${`var(--${t.name})` === cur ? ' sel' : ''}" type="button" data-cprop="${pr.id}" data-cvalue="var(--${t.name})" title="${esc(t.name)}" style="background:${gradientCss(t)}"></button>`).join('')}</div>`);
    }
    const toks = tokens.filter((t) => t.kind === pr.scale), vars = propVars(pr);
    const cur = vars.map((v) => propCur(m, v, vars.length === 1 ? pr.default : undefined));
    const sel = toks.findIndex((t) => cur.every((c) => c === `var(--${t.name})`));
    return prow(pr.label, `<div class="steps">${toks.map((t, i) => `<button class="step${i === sel ? ' sel' : ''}" type="button" data-cprop="${pr.id}" data-cvalue="var(--${t.name})" title="${esc(t.name)} · ${t.px}px">${i === sel ? esc(t.name.split('-').pop().toUpperCase()) : '<i></i>'}</button>`).join('')}</div>`);
  }).join('');
}

const stateThumbs = (model) => `<div class="thumbs three">${model.states.map((st) => `<button class="thumb-tile${st.id === model.state ? ' sel' : ''}" data-cvariant="${st.id}" title="${esc(st.name)}"><span class="thumb-frame"><iframe tabindex="-1" loading="lazy" title="${esc(st.name)}" src="${thumbSrc({ state: st.id })}"></iframe></span><span class="thumb-label">${esc(st.name)}</span></button>`).join('')}</div>`;
const surfaceField = () => field('surface', select('data-csurface="1"', [['normal', 'normal'], ['inverse', 'inverse']], cstate.surface));

function renderComponentPanel() {
  const m = component.meta, p = $('#panel-body');
  const api = screen.contentWindow && screen.contentWindow.tdsComponent;
  const about = `<p class="mute">${esc(m.name)} · ${esc(m.tier)}${(m.uses || []).length ? ' · uses ' + m.uses.join(', ') : ''}</p>`;
  if (editing) {
    const vars = Object.entries(m.variables || {}).map(([k, type]) => field(k, varControl(k, type, (m.defaults || {})[k] || '', 'data-cdef'))).join('');
    p.innerHTML = `<div class="between"><h2>Editing ${esc(m.name)}</h2><button class="link" id="edit-back">← Back</button></div>${about}
      <div class="section">Defaults</div>${vars}
      <p class="mute">What you set here becomes this component's default. It's saved in its meta.json and in tds/defaults.css.</p>`;
    return;
  }
  const footer = `<div class="spacer"></div><button class="link" id="creset">Reset preview</button><button class="btn dark wide" id="edit-comp">Edit Component</button>`;
  if (m.items) {   // a composed organism: provider, state, background, then its slots' content
    const model = api && api.getModel();
    p.innerHTML = panelHead(m, model ? `<div id="cp-persona">${personaRows(model)}</div>` : '') + (model
      ? sec('state', 'State', stateThumbs(model)) + sec('props', 'Properties', propsBody(m, true)) + `<div id="cp-slots">${slotsHtml(model)}</div>` + (m.surface ? sec('options', 'Options', surfaceField()) : '')
      : '') + footer;
  } else {            // an atom or molecule: variants, properties, content, options
    const vs = variantThumbs(m);
    const thumbs = vs.items.length > 1 ? sec('variants', 'Variants', `<div class="thumbs">${vs.items.map((it, i) => `
      <button class="thumb-tile${i === vs.selected ? ' sel' : ''}" data-cthumb="${i}" title="${esc(it.label)}">
        <span class="thumb-frame"><iframe tabindex="-1" loading="lazy" title="${esc(it.label)}" src="${thumbSrc(it.param)}"></iframe></span>
        <span class="thumb-label">${esc(it.label)}</span></button>`).join('')}</div>`) : '';
    const props = (m.properties || []).length ? sec('props', 'Properties', propsBody(m)) : '';
    const content = api && api.getContent().length ? sec('content', 'Content', api.getContent().map((c) => field(c.label, c.value.length > 44
      ? `<textarea rows="3" data-ccontent="${c.i}">${esc(c.value)}</textarea>` : `<input data-ccontent="${c.i}" value="${esc(c.value)}">`)).join('')) : '';
    const attrs = Object.entries(m.attributes || {}).filter(([k]) => k !== vs.attr && !(m.properties && k === 'data-fill'))
      .map(([k, a]) => field(k, select(`data-cattr="${esc(k)}"`, a.values.map((v) => [v, v]), cstate.attrs[k] || a.default))).join('');
    const states = (m.states || []).length ? field('state (forced)', select('id="cstate"', [['', 'none'], ...m.states.map((x) => [x, x])], cstate.state)) : '';
    const options = attrs || states ? sec('options', 'Options', attrs + states) : '';
    p.innerHTML = panelHead(m) + thumbs + props + content + options + footer;
  }
  scaleThumbs();
}

// "Main variants" = the values of the main attribute (the first enum without a condition).
function variantThumbs(m) {
  const hit = Object.entries(m.attributes || {}).find(([k, a]) => a.type === 'enum' && !a.when && !(m.properties && k === 'data-fill'));
  if (!hit) return { attr: null, selected: 0, items: [] };
  const [k, a] = hit;
  return { attr: k, selected: Math.max(0, a.values.indexOf(cstate.attrs[k] || a.default)), items: a.values.map((v) => ({ label: v, param: { set: { [k]: v } }, apply: (api) => { cstate.attrs[k] = v; api.setAttr(k, v); } })) };
}
const thumbSrc = (param) => `../preview/component.html?c=${component.path}&thumb=${encodeURIComponent(JSON.stringify(param))}${window.__V ? `&v=${window.__V}` : ''}`;
// Each thumbnail is a real 390px-wide page, scaled down to fit its tile.
function scaleThumbs() {
  requestAnimationFrame(() => document.querySelectorAll('.thumb-frame').forEach((f) => {
    f.firstElementChild.style.transform = `scale(${f.clientWidth / 390})`;
    f.firstElementChild.addEventListener('load', applyModes);
  }));
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

const setItem = (api, item, prop, value) => api.setItem(item, prop ? { props: { [prop]: value } } : { value });
const refreshSlots = (api) => { const model = api.getModel(), box = $('#cp-slots'); if (box) box.innerHTML = slotsHtml(model); };
const closeMenus = (except) => document.querySelectorAll('.dd-menu, .aimenu').forEach((mn) => { if (mn !== except) mn.hidden = true; });
document.addEventListener('click', (e) => { if (!e.target.closest('.dd, .inwrap')) closeMenus(); });

$('#panel').addEventListener('input', (e) => {
  const el = e.target;
  if ('cdesc' in el.dataset) { if (component) component.meta.description = el.value; return; }   // not saved yet
  const api = component && screen.contentWindow.tdsComponent; if (!api) return;
  if (el.dataset.cmItem !== undefined && el.matches('input, textarea, select')) setItem(api, el.dataset.cmItem, el.dataset.cmProp, el.value);
  else if (el.dataset.cdef) editDefault(el.dataset.cdef, el.value);
  else if ('ccontent' in el.dataset) api.setContent(+el.dataset.ccontent, el.value);
  else if ('csurface' in el.dataset) { cstate.surface = el.value; api.setSurface(el.value); }
  else if (el.dataset.cattr) { api.setAttr(el.dataset.cattr, el.value); cstate.attrs[el.dataset.cattr] = el.value; }
  else if (el.id === 'cstate') { api.setState(el.value); cstate.state = el.value; }
  else if (el.dataset.cvar) {
    const v = el.value;
    if (v) cstate.vars[el.dataset.cvar] = v; else delete cstate.vars[el.dataset.cvar];
    syncVars();
  }
});
$('#panel').addEventListener('change', (e) => {
  if (e.target.id !== 't-wire') return;
  fidelity = e.target.checked ? 'wireframe' : 'styled'; applyModes();   // "Charcoal"
});
$('#panel').addEventListener('click', (e) => {
  if (!component) return;
  const t = e.target, api = screen.contentWindow.tdsComponent;
  const head = t.closest('[data-csec]');
  if (head) {   // fold / unfold a section in place
    const section = head.parentElement, open = section.classList.toggle('open');
    section.querySelector('.cp-sec-body').hidden = !open; collapsed[head.dataset.csec] = !open; return;
  }
  const ddBtn = t.closest('[data-dd]'), opt = t.closest('[data-dd-opt]'), ai = t.closest('[data-ai]');
  if (ddBtn) { const mn = ddBtn.nextElementSibling; closeMenus(mn); mn.hidden = !mn.hidden; return; }
  if (opt && api) {
    const root = opt.closest('.dd');
    if (root.dataset.cpersona) { api.setPersona(root.dataset.cpersona, opt.dataset.ddOpt); $('#cp-persona').innerHTML = personaRows(api.getModel()); return; }
    setItem(api, root.dataset.cmItem, root.dataset.cmProp, opt.dataset.ddOpt); refreshSlots(api); return;
  }
  if (ai) { const mn = ai.nextElementSibling; closeMenus(mn); mn.hidden = !mn.hidden; return; }
  const lay = t.closest('[data-cvariant]'), stp = t.closest('[data-step]'), prop = t.closest('[data-cprop]'), thumb = t.closest('[data-cthumb]');
  if (lay && api) {
    api.setVariant(lay.dataset.cvariant);
    document.querySelectorAll('[data-cvariant]').forEach((b) => b.classList.toggle('sel', b === lay));
    refreshSlots(api); return;
  }
  if (prop) {   // gradient chips and scale steps set token-bound variables
    const pr = component.meta.properties.find((x) => x.id === prop.dataset.cprop), vars = propVars(pr);
    for (const v of vars) {
      const base = (component.meta.defaults || {})[v] ?? (vars.length === 1 ? pr.default : undefined);
      if (prop.dataset.cvalue === base) delete cstate.vars[v]; else cstate.vars[v] = prop.dataset.cvalue;
    }
    syncVars(); document.querySelectorAll('.cp-sec-body').forEach((bd) => { if (bd.querySelector('[data-cprop]')) bd.innerHTML = propsBody(component.meta, !!component.meta.items); }); return;
  }
  if (stp && stp.closest('[data-cm-item]') && api) { const root = stp.closest('[data-cm-item]'); setItem(api, root.dataset.cmItem, root.dataset.cmProp, stp.dataset.step); refreshSlots(api); return; }
  if (thumb && api) { variantThumbs(component.meta).items[+thumb.dataset.cthumb].apply(api); syncVars(); renderComponentPanel(); return; }
  if (t.id === 'edit-comp') { editing = true; renderComponentPanel(); updateSavebar(); }
  else if (t.id === 'edit-back') { editing = false; renderComponentPanel(); updateSavebar(); }
  else if (t.id === 'creset') {
    if (api) api.reset();
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
  const W = dims.w, H = dims.h, pad = 24;
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
  const docs = [screen, ...document.querySelectorAll('.thumb-frame iframe')].map((f) => f.contentDocument).filter(Boolean);   // the canvas and the panel thumbnails
  for (const d of docs) d.documentElement.setAttribute('data-fidelity', fidelity);
}

screen.addEventListener('load', () => { applyModes(); applyLive(); });

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
