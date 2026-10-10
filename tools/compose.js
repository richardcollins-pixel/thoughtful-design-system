// Composition: an organism is a layout + items, and items fill the layout's slots. This module turns that
// description into HTML (for the canvas) and into a model (for the editor's panel), so the two never disagree.
//
//   organism meta:  layouts[] { id, name, template with {{item:id}} placeholders, slots[{label, items[]}], overrides? }
//                   items{}   { id: { type:'text'|'component', ... } }      properties[]  (token-bound controls)
//   atom/molecule meta: props{} (editable props) + template (HTML with {{prop}} placeholders)
//   state:          { layout, items: { id: { value?, props? } } }           ctx: { components, people, glyphs, data }

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// Fill {{key}} placeholders in an HTML template. Values are escaped; unknown keys are left as written.
export const fill = (tpl, vars) => tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : m));

// Plain text that may contain {{variables}} (resolved from the sample data). Everything is escaped.
export function text(str, data) {
  return String(str).split(/(\{\{\s*[\w.-]+\s*\}\})/).map((part) => {
    const m = /^\{\{\s*([\w.-]+)\s*\}\}$/.exec(part);
    return esc(m && m[1] in data ? data[m[1]] : part);
  }).join('');
}

const layoutOf = (meta, state) => meta.layouts.find((l) => l.id === state.layout) || meta.layouts[0];

// An item as the current layout sees it: the base item, then the layout's overrides, then the user's edits.
export function effectiveItem(meta, state, id) {
  const base = meta.items[id], layout = layoutOf(meta, state);
  const over = (layout.overrides || {})[id] || {}, edit = (state.items || {})[id] || {};
  return { id, ...base, ...over, ...edit, props: { ...(base.props || {}), ...(over.props || {}), ...(edit.props || {}) } };
}

// Flatten a component's props into placeholder values, resolving people and filling variables in text.
function propVars(compMeta, props, ctx) {
  const vars = {};
  for (const [key, def] of Object.entries(compMeta.props || {})) {
    const v = props[key] ?? def.default;
    if (def.type === 'person') {
      const p = ctx.people.find((x) => x.id === v) || ctx.people[0] || { name: '', photo: '' };
      vars[`${key}.name`] = p.name; vars[`${key}.photo`] = p.photo; vars[key] = p.name;
    } else if (def.type === 'text') vars[key] = String(v).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => (k in ctx.data ? ctx.data[k] : m));
    else vars[key] = v;
  }
  return vars;
}

function renderItem(meta, state, id, ctx) {
  const it = effectiveItem(meta, state, id);
  if (it.type === 'text') return `<${it.tag || 'p'}${it.class ? ` class="${it.class}"` : ''}>${text(it.value, ctx.data)}</${it.tag || 'p'}>`;
  const comp = ctx.components[it.component];
  if (!comp) return `<!-- unknown component ${esc(it.component)} -->`;
  return comp.template ? fill(comp.template, propVars(comp, it.props, ctx)) : comp.markup;
}

export function renderOrganism(meta, state, ctx) {
  const layout = layoutOf(meta, state);
  return layout.template.replace(/\{\{item:([\w-]+)\}\}/g, (m, id) => (meta.items[id] ? renderItem(meta, state, id, ctx) : ''));
}

// What the panel needs: layouts, the current layout's slots with each item's controls, and the available variables.
export function getModel(meta, state, ctx) {
  const layout = layoutOf(meta, state);
  const controlFor = (comp, key, props) => {
    const def = comp.props[key], value = props[key] ?? def.default;
    const c = { key, label: def.label || key, type: def.type, value, ui: def.ui, vars: !!def.vars };
    if (def.type === 'enum') c.values = def.values;
    if (def.type === 'person') c.options = ctx.people.map((x) => ({ value: x.id, label: x.name, photo: x.photo }));
    if (def.type === 'icon') c.options = ctx.glyphs;
    return c;
  };
  return {
    layouts: meta.layouts.map((l) => ({ id: l.id, name: l.name })),
    layout: layout.id,
    variables: Object.entries(ctx.data).map(([name, value]) => ({ name, value })),
    slots: layout.slots.map((slot) => ({
      label: slot.label,
      items: slot.items.map((id) => {
        const it = effectiveItem(meta, state, id);
        if (it.type === 'text') return { id, type: 'text', label: it.label || id, value: it.value };
        const comp = ctx.components[it.component];
        return { id, type: 'component', label: it.label || comp.name, controls: (it.expose || []).filter((k) => comp.props && comp.props[k]).map((k) => controlFor(comp, k, it.props)) };
      }),
    })),
  };
}
