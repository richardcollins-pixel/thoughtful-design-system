// Composition: an organism is a set of states, and each state is a template whose slots are filled by items.
// This module turns that description into HTML (for the canvas) and into a model (for the editor's panel), so the
// two never disagree.
//
//   organism meta:  states[]   { id, name, template with {{item:id}} placeholders, slots[{id,label,items[]}], overrides? }
//                   items{}    { id: { type:'text'|'component', ... } }     personas[]  roles it uses, e.g. ['provider']
//                   properties[] (token-bound controls)                      prompts[]   (see README)
//   atom/molecule meta: props{} (editable props) + template (HTML with {{prop}} placeholders)
//   state (what the panel is currently showing): { state, personas:{role:id}, items:{ id:{ value?, props? } } }
//   ctx: { components, personas:{role:[…]}, glyphs, data, environments }

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// Fill {{key}} placeholders in an HTML template. Values are escaped; unknown keys are left as written.
export const fill = (tpl, vars) => tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : m));

// Plain text that may contain {{variables}}. Everything is escaped.
export function text(str, data) {
  return String(str).split(/(\{\{\s*[\w.-]+\s*\}\})/).map((part) => {
    const m = /^\{\{\s*([\w.-]+)\s*\}\}$/.exec(part);
    return esc(m && m[1] in data ? data[m[1]] : part);
  }).join('');
}

const stateOf = (meta, st) => meta.states.find((s) => s.id === st.state) || meta.states[0];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The persona (e.g. the provider) currently chosen for a role; the first one until the user picks.
export function personaFor(st, ctx, role) {
  const list = ctx.personas[role] || [];
  return list.find((p) => p.id === (st.personas || {})[role]) || list[0] || null;
}

// Variables available to text: the sample data plus the chosen personas (provider-name, provider-specialty, …).
export function dataFor(meta, st, ctx) {
  const data = { ...ctx.data };
  for (const role of meta.personas || []) {
    const p = personaFor(st, ctx, role);
    if (p) { data[`${role}-name`] = p.name; data[`${role}-specialty`] = p.specialty || ''; }
  }
  return data;
}

// An item as the current state sees it: the base item, then the state's overrides, then the user's edits.
export function effectiveItem(meta, st, id) {
  const base = meta.items[id], state = stateOf(meta, st);
  const over = (state.overrides || {})[id] || {}, edit = (st.items || {})[id] || {};
  return { id, ...base, ...over, ...edit, props: { ...(base.props || {}), ...(over.props || {}), ...(edit.props || {}) } };
}

// Flatten a component's props into placeholder values; a prop can be bound to a persona role.
function propVars(compMeta, item, scope) {
  const vars = {};
  for (const [key, def] of Object.entries(compMeta.props || {})) {
    let v = item.props[key] ?? def.default;
    if (def.type === 'person') {
      const role = (item.bind || {})[key], list = scope.ctx.personas[role || 'provider'] || [];
      const p = (role && personaFor(scope.st, scope.ctx, role)) || list.find((x) => x.id === v) || list[0] || { name: '', photo: '' };
      vars[`${key}.name`] = p.name; vars[`${key}.photo`] = p.photo; vars[key] = p.name;
    } else if (def.type === 'text') vars[key] = String(v).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => (k in scope.data ? scope.data[k] : m));
    else vars[key] = v;
  }
  return vars;
}

function renderItem(scope, id) {
  const it = effectiveItem(scope.meta, scope.st, id);
  if (it.type === 'text') return `<${it.tag || 'p'}${it.class ? ` class="${it.class}"` : ''}>${text(it.value, scope.data)}</${it.tag || 'p'}>`;
  const comp = scope.ctx.components[it.component];
  if (!comp) return `<!-- unknown component ${esc(it.component)} -->`;
  return comp.template ? fill(comp.template, propVars(comp, it, scope)) : comp.markup;
}

export function renderOrganism(meta, st, ctx) {
  const scope = { meta, st, ctx, data: dataFor(meta, st, ctx) };
  return stateOf(meta, st).template.replace(/\{\{item:([\w-]+)\}\}/g, (m, id) => (meta.items[id] ? renderItem(scope, id) : ''));
}

// What the panel needs. By default only content (text) is exposed; { edit: true } also exposes structure (icons, sizes…).
export function getModel(meta, st, ctx, opts = {}) {
  const state = stateOf(meta, st), data = dataFor(meta, st, ctx);
  const labelOf = (id) => meta.items[id].label || id;
  const promptFor = (id) => {
    const p = (meta.prompts || []).find((x) => x.outputs.includes(id) && (!x.states || x.states.includes(state.id)));
    return p ? { id: p.id, label: p.label, instruction: p.instruction, inputs: p.inputs || [], outputs: p.outputs.map(labelOf), level: 'design system' } : null;
  };
  const controlFor = (comp, key, props) => {
    const def = comp.props[key], value = props[key] ?? def.default;
    const c = { key, label: def.label || key, type: def.type, value, ui: def.ui, content: def.type === 'text' };
    if (def.type === 'enum') c.values = def.values;
    if (def.type === 'person') c.options = (ctx.personas.provider || []).map((x) => ({ value: x.id, label: x.name, photo: x.photo }));
    if (def.type === 'icon') c.options = ctx.glyphs;
    return c;
  };
  return {
    states: meta.states.map((s) => ({ id: s.id, name: s.name })),
    state: state.id,
    personas: (meta.personas || []).map((role) => {
      const p = personaFor(st, ctx, role);
      return { role, label: cap(role), value: p ? p.id : '', options: (ctx.personas[role] || []).map((x) => ({ value: x.id, label: x.name, photo: x.photo })) };
    }),
    environments: (ctx.environments || {}).environments || [],
    variables: Object.entries(data).map(([name, value]) => ({ name, value })),
    slots: state.slots.map((slot) => ({
      id: slot.id, label: slot.label,
      items: slot.items.map((id) => {
        const it = effectiveItem(meta, st, id);
        if (it.type === 'text') return { id, type: 'text', label: it.label || id, value: it.value, prompt: promptFor(id) };
        const comp = ctx.components[it.component];
        let controls = (it.expose || []).filter((k) => comp.props && comp.props[k]).map((k) => controlFor(comp, k, it.props));
        if (!opts.edit) controls = controls.filter((c) => c.content);
        return { id, type: 'component', label: it.label || comp.name, controls, prompt: promptFor(id) };
      }).filter((it) => it.type === 'text' || it.controls.length),
    })).filter((slot) => slot.items.length),
  };
}
