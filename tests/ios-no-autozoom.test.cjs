const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stylesheet = readFileSync(path.join(root, 'src/styles/ios-no-autozoom.css'), 'utf8');
const main = readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

test('o CSS de protecao e carregado pela entrada React', () => {
  assert.match(main, /import\s+['"]\.\/styles\/ios-no-autozoom\.css['"]/);
});
test('a protecao contempla campos de texto, busca, select, textarea e conteudo editavel', () => {
  assert.match(stylesheet, /@media screen and \(max-width: 900px\)/);
  for (const type of ['checkbox', 'radio', 'range', 'hidden', 'file']) {
    assert.ok(stylesheet.includes(`:not([type='${type}'])`), `ignorar ${type}`);
  }
  assert.match(stylesheet, /\bselect,/);
  assert.match(stylesheet, /\btextarea,/);
  assert.match(stylesheet, /\[contenteditable='true'\]/);
  assert.match(stylesheet, /font-size:\s*17px\s*!important/);
});
test('viewport mantem escala inicial correta e zoom manual disponivel', () => {
  const viewport = html.match(/<meta\s+name=['"]viewport['"]\s+content=['"]([^'"]+)['"]/i);
  assert.ok(viewport, 'meta viewport ausente');
  assert.match(viewport[1], /width=device-width/);
  assert.match(viewport[1], /initial-scale=1(?:\.0)?/);
  assert.doesNotMatch(viewport[1], /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?(?:,|$)/);
});
