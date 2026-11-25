const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'src/pages/CollectionPage.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles/smart-collection.css'), 'utf8');

test('a coleção inicia com os filtros mobile recolhidos', () => {
  assert.match(page, /const \[mobileFiltersOpen, setMobileFiltersOpen\] = useState\(false\)/);
  assert.match(page, /acervo-mobile-advanced--open/);
});
test('há botão acessível para abrir e fechar filtros', () => {
  assert.match(page, /className="acervo-mobile-filter-toggle"/);
  assert.match(page, /aria-expanded=\{mobileFiltersOpen\}/);
  assert.match(page, /aria-controls="acervo-advanced-selects acervo-advanced-filters"/);
  assert.match(page, /setMobileFiltersOpen\(open => !open\)/);
});
test('busca principal e categoria permanecem disponíveis quando recolhido', () => {
  assert.match(page, /className="collection-search"/);
  assert.match(page, /className="collection-tabs"/);
  assert.match(styles, /\.collection-page \.collection-filters > \.collection-search/);
});
test('somente no mobile escondemos controles avançados', () => {
  assert.match(styles, /\.acervo-mobile-advanced \{ display: contents; \}/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.acervo-mobile-advanced \{ display: none; \}/);
  assert.match(styles, /\.acervo-mobile-advanced--open \{ display: block; \}/);
});
test('filtros de status, autor, ano e ordenação continuam existentes', () => {
  assert.ok(page.includes('selectedAuthor'));
  assert.match(page, /(?:changeStatus|setStatus)\(/);
  assert.match(page, /(?:changeCompletionYear|setCompletionYear)\(/);
  assert.match(page, /setSort\(/);
  assert.match(styles, /acervo-mobile-filters-open \.collection-filters > \.collection-select/);
});
test('filtros salvos e agrupamento de temporadas continuam disponíveis', () => {
  assert.match(page, /acervo-saved-views/);
  assert.match(page, /groupMediaSeasons\(visible\)/);
  assert.match(page, /setGroupSeasons\(e\.target\.checked\)/);
});
test('ao aplicar favorito, foco retorna ao botão de filtros', () => {
  assert.match(page, /setMobileFiltersOpen\(false\)/);
  assert.match(page, /mobileFilterButtonRef\.current\?\.focus\(\)/);
});
test('Cards e Lista ficam acessíveis sem abrir filtros', () => {
  assert.match(page, /className="acervo-mobile-view-switch"/);
  assert.match(page, /aria-label="Exibir em cards"/);
  assert.match(page, /aria-label="Exibir em lista"/);
});
test('desktop conserva exibição anterior', () => {
  assert.match(styles, /\.acervo-mobile-filter-toggle, \.acervo-mobile-view-switch \{ display: none; \}/);
  assert.match(page, /className="acervo-smart-switch"/);
});
test('não existem alterações nos serviços, registros ou schema de dados', () => {
  assert.doesNotMatch(page, /localStorage\.clear\(|deleteMedia\(|cloudDeleteMedia\(/);
  assert.match(page, /listMedia\(/);
});
