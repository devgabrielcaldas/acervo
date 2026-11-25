import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../src/hooks/useCoverUrl.ts', import.meta.url), 'utf8');
const match = code.match(/^\s{2}return (image[^\n;]+);\s*$/m);
assert.ok(match, 'O hook useCoverUrl deve retornar uma URL a partir de image/key.');
// Executa somente a expressão de retorno (sem React, rede ou Supabase).
const getUrl = new Function('image','key',`return ${match[1]};`);

test('não quebra no cadastro de novo título (sem capa)', () => {
  assert.equal(getUrl(undefined, undefined), undefined);
});

test('não quebra enquanto a capa ainda está carregando', () => {
  assert.equal(getUrl(undefined, 'media:cover'), undefined);
});

test('capa de outro título nunca é exibida no novo título', () => {
  assert.equal(getUrl({ key:'anterior:capa', url:'blob:anterior' }, undefined), undefined);
  assert.equal(getUrl({ key:'anterior:capa', url:'blob:anterior' }, 'novo:capa'), undefined);
});

test('imagem válida é exibida no título correspondente', () => {
  assert.equal(getUrl({ key:'media:capa', url:'blob:atual' }, 'media:capa'), 'blob:atual');
});

test('hook mantém o download via cache e a limpeza de URLs temporárias', () => {
  assert.match(code, /getCachedCoverBlob\(mediaId, coverId\)/);
  assert.match(code, /URL\.revokeObjectURL\(objectUrl\)/);
});
