const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.resolve(__dirname, '../src/styles/title-people.css'), 'utf8');
const mobile = css.slice(css.lastIndexOf('@media (max-width: 590px)'));
const portrait = mobile.match(/\.acervo-people__portrait\s*\{([^}]*)\}/)?.[1] ?? '';
const image = mobile.match(/\.acervo-people__portrait img\s*\{([^}]*)\}/)?.[1] ?? '';
const base = css.slice(0,css.indexOf('@media (max-width: 590px)'));

test('media query do elenco continua limitada a celulares', () => {
  assert.match(css, /@media \(max-width: 590px\)/);
});
test('o card de elenco ainda usa duas colunas no celular', () => {
  assert.match(mobile, /\.acervo-people__cast-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('o retrato do celular ocupa toda a largura do card', () => {
  assert.match(portrait, /width:100%/);
});
test('o retrato tem proporção vertical 2:3', () => {
  assert.match(portrait, /aspect-ratio:2\/3/);
});
test('o flex basis horizontal não achata o retrato', () => {
  assert.match(portrait, /flex:0 0 auto/);
  assert.doesNotMatch(portrait, /flex:0 0 62px/);
});
test('a limitação de altura anterior foi removida', () => {
  assert.match(portrait, /max-height:none/);
});
test('imagem é contida sem cortar o rosto', () => {
  assert.match(image, /object-fit:contain/);
  assert.match(image, /object-position:center top/);
});
test('desktop mantém sua configuração horizontal original', () => {
  assert.match(base, /\.acervo-people__portrait\s*\{[^}]*width:62px; height:84px; flex:0 0 62px/);
  assert.match(base, /\.acervo-people__portrait img\s*\{[^}]*object-fit:cover/);
});
