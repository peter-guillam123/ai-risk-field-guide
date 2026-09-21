// Fetches every source URL (4 at a time) and reports the HTTP status.
// 401/403/429 usually mean "blocks robots", not "broken". Run: node tools/check_links.js
global.window = global;
require('../js/data.js');
const src = Object.entries(global.GUIDE.sources);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
async function check([id, s]) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(s.u, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
    return [id, r.status, s.v, s.u];
  } catch (e) { return [id, 'ERR ' + (e.name || ''), s.v, s.u]; } finally { clearTimeout(t); }
}
(async () => {
  const out = []; let i = 0;
  await Promise.all([0, 1, 2, 3].map(async () => { while (i < src.length) { const n = i++; out[n] = await check(src[n]); } }));
  const bad = out.filter(r => r[1] !== 200);
  console.log('ok:', out.length - bad.length, 'of', out.length);
  bad.sort((a, b) => String(a[1]).localeCompare(String(b[1]))).forEach(r => console.log(r[1], '|', r[2], '|', r[0], '|', r[3]));
})();
