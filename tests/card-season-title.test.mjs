import test from 'node:test';
import assert from 'node:assert/strict';
import { getSeriesCardTitle } from '../src/utils/cardSeasonTitle.ts';

const series = (title, more = {}) => ({
  kind: 'series', title, ...more,
});

test('separa temporada 1 sem deixar o 1 sozinho', () => {
  assert.deepEqual(getSeriesCardTitle(series('Ninguém Quer — Temp. 1')), {
    name: 'Ninguém Quer', season: 1,
  });
});
test('usa o titulo correto para A Garota do Remo', () => {
  assert.deepEqual(getSeriesCardTitle(series('A Garota do Remo — Temp. 1')), {
    name: 'A Garota do Remo', season: 1,
  });
});
test('aceita diferentes travessoes e Temporada por extenso', () => {
  assert.deepEqual(getSeriesCardTitle(series('True Detective - Temporada 2')), {
    name: 'True Detective', season: 2,
  });
  assert.deepEqual(getSeriesCardTitle(series('Lost – Temp. 3')), {
    name: 'Lost', season: 3,
  });
});
test('prioriza titulo salvo com temporada para dados antigos', () => {
  assert.deepEqual(getSeriesCardTitle(series('Lost — Temp. 4')), {
    name: 'Lost', season: 4,
  });
});
test('usa seriesTitle e seasonNumber para dados estruturados', () => {
  assert.deepEqual(getSeriesCardTitle(series('Lost', { seriesTitle: 'Lost', seasonNumber: 5 })), {
    name: 'Lost', season: 5,
  });
});
test('nao cria temporada em serie antiga sem numero', () => {
  assert.equal(getSeriesCardTitle(series('Dark')), null);
});
test('nao altera livro ou filme que tenham Temp. no titulo', () => {
  assert.equal(getSeriesCardTitle({ kind: 'book', title: 'Temp. 1' }), null);
  assert.equal(getSeriesCardTitle({ kind: 'movie', title: 'Lost — Temp. 1' }), null);
});
test('ignora temporada zero e evita corromper dados', () => {
  assert.equal(getSeriesCardTitle(series('Lost — Temp. 0')), null);
  const item = series('Lost — Temp. 1');
  getSeriesCardTitle(item);
  assert.equal(item.title, 'Lost — Temp. 1');
});
