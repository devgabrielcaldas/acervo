import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { latestCompletedMedia } from '../src/utils/latestCompletedMedia.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const create = (id, kind, completedOn, updatedAt = '2026-01-05T12:00:00.000Z', status = 'completed') => ({
  id, kind, completedOn, updatedAt, createdAt: updatedAt, status, title: id,
});

test('Seleciona o livro mais recentemente concluído pela data real', () => {
  const list = [create('antigo', 'book', '2026-01-01'), create('novo', 'book', '2026-06-25')];
  assert.equal(latestCompletedMedia(list, 'book')?.id, 'novo');
});
test('Atualizar uma nota não altera qual foi o último concluído', () => {
  const list = [create('antigo', 'book', '2025-05-20', '2026-12-31T12:00:00Z'), create('recente', 'book', '2026-05-20', '2026-05-20T12:00:00Z')];
  assert.equal(latestCompletedMedia(list, 'book')?.id, 'recente');
});
test('Distingue filme de livro e série', () => {
  const list = [create('livro', 'book', '2026-01-30'), create('filme', 'movie', '2026-02-01'), create('serie', 'series', '2026-03-01')];
  assert.equal(latestCompletedMedia(list, 'book')?.id, 'livro');
  assert.equal(latestCompletedMedia(list, 'movie')?.id, 'filme');
  assert.equal(latestCompletedMedia(list, 'series')?.id, 'serie');
});
test('Ignora os que ainda estão lendo/assistindo e desejos', () => {
  const list = [create('lendo', 'book', '2026-10-20', '2026-10-20', 'in_progress'), create('quero', 'book', '2026-10-25', '2026-10-25', 'wishlist'), create('completo', 'book', '2026-01-01')];
  assert.equal(latestCompletedMedia(list, 'book')?.id, 'completo');
});
test('Se não houver data de conclusão, usa atualização do registro como último recurso', () => {
  const list = [create('anterior', 'movie', undefined, '2026-01-01T00:00:00Z'), create('atual', 'movie', undefined, '2026-11-01T00:00:00Z')];
  assert.equal(latestCompletedMedia(list, 'movie')?.id, 'atual');
});
test('Registros com data real têm prioridade sobre os sem data', () => {
  const list = [create('sem-data', 'series', undefined, '2026-12-01T00:00:00Z'), create('datado', 'series', '2025-04-04')];
  assert.equal(latestCompletedMedia(list, 'series')?.id, 'datado');
});
test('Sem concluídos retorna undefined', () => {
  assert.equal(latestCompletedMedia([create('não', 'book', undefined, '', 'wishlist')], 'book'), undefined);
  assert.equal(latestCompletedMedia([], 'series'), undefined);
});
test('Não altera a ordem da coleção', () => {
  const arr = [create('b', 'book', '2025-01-01'), create('a', 'book', '2026-01-01')];
  latestCompletedMedia(arr, 'book');
  assert.deepEqual(arr.map(x => x.id), ['b', 'a']);
});
test('A implementação usa o componente MediaCover existente e liga as capas às mídias', () => {
  const source = readFileSync(resolve(root, 'src/pages/DashboardPage.tsx'), 'utf8');
  assert.match(source, /mediaId=\{item\.id\}/);
  assert.match(source, /coverId=\{item\.coverId\}/);
  assert.match(source, /latestCompletedMedia\(items, 'book'\)/);
  assert.match(source, /latestCompletedMedia\(items, 'movie'\)/);
  assert.match(source, /latestCompletedMedia\(items, 'series'\)/);
});
test('CSS do destaque define altura menor que 322px e mantém mobile responsivo', () => {
  const css = readFileSync(resolve(root, 'src/styles/dashboard-hero.css'), 'utf8');
  assert.match(css, /hero\.hero--compact\s*\{[^}]*min-height:\s*226px/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /object-fit:\s*cover/);
});
