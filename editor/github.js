// Saves tokens to the GitHub repo as one commit (Git Data API). Token lives only in this browser.
const KEY = 'tdsGithub';
const guess = () => {
  const m = location.hostname.match(/^(.+)\.github\.io$/), repo = location.pathname.split('/')[1];
  return { repo: m && repo ? `${m[1]}/${repo}` : 'richardcollins-pixel/thoughtful-design-system', branch: 'main', token: '' };
};
export const getCfg = () => ({ ...guess(), ...JSON.parse(localStorage[KEY] || '{}') });
export const setCfg = (c) => { localStorage[KEY] = JSON.stringify(c); };

async function api(path, { method = 'GET', body, raw } = {}) {
  const { token } = getCfg();
  const r = await fetch('https://api.github.com' + path, {
    method, body: body && JSON.stringify(body), cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.json().catch(() => ({}))).message || r.statusText}`);
  return raw ? r.text() : r.json();
}

export async function load(path) {
  const { repo, branch } = getCfg();
  return JSON.parse(await api(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, { raw: true }));
}

/** files: { path: textContent }. Returns the new commit sha. */
export async function commit(files, message) {
  const { repo, branch } = getCfg(), base = `/repos/${repo}/git`;
  const head = (await api(`${base}/ref/heads/${encodeURIComponent(branch)}`)).object.sha;
  const baseTree = (await api(`${base}/commits/${head}`)).tree.sha;
  const tree = [];
  for (const [path, content] of Object.entries(files)) {
    const blob = await api(`${base}/blobs`, { method: 'POST', body: { content, encoding: 'utf-8' } });
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const t = await api(`${base}/trees`, { method: 'POST', body: { base_tree: baseTree, tree } });
  const c = await api(`${base}/commits`, { method: 'POST', body: { message, tree: t.sha, parents: [head] } });
  await api(`${base}/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: { sha: c.sha } });
  return c.sha;
}
