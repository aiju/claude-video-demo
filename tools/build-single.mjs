// Inline a video page and all of its local scripts/styles into ONE html file,
// e.g. for publishing as a claude.ai Artifact or emailing.
//   node tools/build-single.mjs videos/<name>/index.html [--out dist/<name>.html] [--artifact]
// --artifact drops the <!doctype>/<html>/<head>/<body> wrapper and the charset /
// viewport metas (the Artifact host adds its own).
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const src = argv.find((a) => !a.startsWith('--'));
if (!src) { console.error('usage: node tools/build-single.mjs videos/<name>/index.html [--out file] [--artifact]'); process.exit(2); }
const oi = argv.indexOf('--out');
const name = path.basename(path.dirname(path.resolve(src)));
const out = path.resolve(oi >= 0 ? argv[oi + 1] : `dist/${name}.html`);
const dir = path.dirname(path.resolve(src));
let html = fs.readFileSync(src, 'utf8');
let n = 0;
html = html.replace(/<script\s+src="(?!https?:|\/\/)([^"]+)"\s*><\/script>/g, (_, p) => {
  n++;
  return `<script>\n${fs.readFileSync(path.join(dir, p), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
html = html.replace(/<link\s+rel="stylesheet"\s+href="(?!https?:|\/\/)([^"]+)"\s*\/?>/g, (_, p) => { n++; return `<style>\n${fs.readFileSync(path.join(dir, p), 'utf8')}\n</style>`; });
html = html.replace(/<!--[\s\S]*?-->\s*/g, '');
if (argv.includes('--artifact')) {
  for (const re of [/<!doctype html>\s*/i, /<html[^>]*>\s*/i, /<\/html>\s*/i, /<head>\s*/i, /<\/head>\s*/i, /<body[^>]*>\s*/i, /<\/body>\s*/i, /<meta charset[^>]*>\s*/i, /<meta name="viewport"[^>]*>\s*/i]) html = html.replace(re, '');
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out}: ${n} files inlined, ${(html.length / 1024).toFixed(0)} KB`);
