// Checks that every [[citation]] and data-src on the page resolves to a source,
// and lists sources that nothing cites. Run: node tools/check_refs.js
const fs = require('fs');
global.window = global; // the data files attach to window.GUIDE, as in the browser
require('../js/data.js');
require('../js/content.js');
const G = global.GUIDE;
const used = new Set();
const walk = n => {
  if (typeof n === 'string') for (const m of n.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) used.add(m[1]);
  else if (n && typeof n === 'object') Object.entries(n).forEach(([k, v]) => { if (k !== 'sources') walk(v); });
};
walk(G);
const html = fs.readFileSync('index.html', 'utf8') + JSON.stringify(G.prose);
for (const m of html.matchAll(/data-src=\\?"([a-z0-9-]+)\\?"/g)) used.add(m[1]);
const missing = [...used].filter(id => !G.sources[id]);
const unused = Object.keys(G.sources).filter(id => !used.has(id));
console.log('cited:', used.size, '| defined:', Object.keys(G.sources).length);
console.log('MISSING:', missing.length ? missing.join(', ') : 'none');
console.log('unused:', unused.length ? unused.join(', ') : 'none');
const dash = (fs.readFileSync('index.html','utf8') + fs.readFileSync('js/data.js','utf8') + fs.readFileSync('js/content.js','utf8')).match(/—/g);
console.log('em dashes:', dash ? dash.length : 0);
process.exit(missing.length ? 1 : 0);
