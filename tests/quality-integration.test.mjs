import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = (name) => read(`src/pages/${name}.tsx`);

test('busca compartilhada em coleção, desejos, histórico e favoritos', () => {
  for (const name of ['CollectionPage','WishlistPage','HistoryPage','FavoritesPage']) {
    const source = page(name);
    assert.match(source,/matchesMediaSearch\(item, search\)/);
    assert.doesNotMatch(source,/const query = search\.toLocaleLowerCase/);
  }
});
test('componentes de carregamento implementados em quatro listas', () => {
  for(const name of ['CollectionPage','WishlistPage','HistoryPage','FavoritesPage','InProgressPage'])
    assert.match(page(name), /<MediaGridSkeleton count=/);
});
test('recarregar com erro sem falsear coleção vazia', () => {
  for(const name of ['CollectionPage','WishlistPage','HistoryPage','FavoritesPage','InProgressPage'])
    assert.match(page(name), /<RetryNotice message=/);
  assert.match(read('src/hooks/useMediaLibrary.ts'), /throw reason;/);
});
test('dashboard trata falhas independentes e usa o modal já existente', () => {
  const source=page('DashboardPage');
  assert.match(source,/Promise\.allSettled/);
  assert.match(source,/mediaError/);
  assert.match(source,/goalsError/);
  assert.match(source,/dashboard-mini-list__quick/);
  assert.match(source,/<QuickProgressDialog/);
});
test('cache não é persistido e é limpo no logout', () => {
  const cache=read('src/utils/coverBlobCache.ts');
  assert.match(cache,/MAX_BYTES/);
  assert.match(cache,/pending\.set/);
  assert.doesNotMatch(cache,/(?:window\.|globalThis\.|global\.)?(?:localStorage|indexedDB)\.(?:getItem|setItem|open)\s*\(/);
  const auth=read('src/contexts/AuthContext.tsx');
  assert.match(auth,/clearCoverBlobCache/);
  assert.match(read('src/hooks/useCoverUrl.ts'),/getCachedCoverBlob/);
});
test('sem scripts SQL, tabelas ou mudanças nos provedores', () => {
  const source=page('DashboardPage');
  assert.match(source,/updateMedia\(editingProgress\.id/);
  assert.match(read('src/pages/StoragePage.tsx'),/desta conta pelos dados do arquivo/);
});
