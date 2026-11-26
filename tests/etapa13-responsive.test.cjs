const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/refinements.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/styles/layout.css'), 'utf8');

test('CSS de refinamento continua importado na aplicação', () => {
  assert.match(main, /import ['"]\.\/styles\/refinements\.css['"]/);
});
test('bloco de atualização presente uma única vez', () => {
  assert.equal(css.split('/* ACERVO ETAPA 13 —').length - 1, 1);
});
test('mobile utiliza altura dinâmica e rolagem independente na busca', () => {
  assert.match(css, /\.acervo-global-search-overlay\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.acervo-global-search__results\s*\{[^}]*overflow-y:\s*auto;/s);
});
test('ajustes preservam espaços seguros do iPhone', () => {
  assert.match(css, /\.main-content\s*\{\s*padding-bottom:\s*calc\(110px \+ env\(safe-area-inset-bottom\)\)/);
});
test('redução de movimento desabilita efeitos não essenciais', () => {
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.page-enter, \.acervo-people__portrait-loading/);
});
test('barra inferior existente continua funcional', () => {
  assert.match(layout, /\.bottom-nav\s*\{\s*position:\s*fixed/);
});
test('estilos não escondem imagens de elenco ou alteram posicionamento', () => {
  assert.doesNotMatch(css.slice(css.lastIndexOf('/* ACERVO ETAPA 13')), /\.acervo-people__portrait img\s*\{\s*(?:display|position|object-fit)/);
});
