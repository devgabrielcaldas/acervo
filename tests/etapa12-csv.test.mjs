import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaToCsv, goalsToCsv } from '../src/services/portableCsv.ts';

const common = {
  id: '123', title: 'Um "livro"; especial', kind: 'book', status: 'completed',
  genres: ['Suspense', 'Mistério'], favorite: true, rating: 4.5,
  createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-21T10:00:00Z',
};

test('CSV usa UTF-8 BOM, separador pt-BR, cabeçalho e CRLF', () => {
  const csv = mediaToCsv([]);
  assert.ok(csv.startsWith('\uFEFF"ID";"Tipo";"Título"'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.split('\r\n').length, 2);
});
test('exporta título, aspas, gêneros e personagens sem perder campos', () => {
  const csv = mediaToCsv([{ ...common, characters: [{ name: 'Ana', description: 'Ela diz "oi"' }] }]);
  assert.ok(csv.includes('"Um ""livro""; especial"'));
  assert.ok(csv.includes('"Suspense | Mistério"'));
  assert.ok(csv.includes('"Ana: Ela diz ""oi"""'));
  assert.ok(csv.includes('"4.5"'));
});
test('neutraliza fórmulas e tabs antes de gerar CSV', () => {
  const csv = mediaToCsv([{ ...common, title: '=HYPERLINK("https://example.com")', notes: '\t+SUM(1,2)' }]);
  assert.ok(csv.includes('"\'=HYPERLINK('));
  assert.ok(csv.includes('"\'\t+SUM(1,2)"'));
});
test('exporta filme e série sem misturar os campos', () => {
  const film = { ...common, kind: 'movie', director: 'Diretor', durationMinutes: 120, tmdbId: 33 };
  const series = { ...common, id: '456', kind: 'series', seriesTitle: 'Minha série', seasonNumber: 2, currentEpisode: 6, tmdbId: 45 };
  const csv = mediaToCsv([film, series]);
  assert.equal(csv.split('\r\n').length, 4);
  assert.ok(csv.includes('"Diretor"'));
  assert.ok(csv.includes('"Minha série"'));
});
test('metas exportam cabeçalhos e anos com dados', () => {
  const csv = goalsToCsv([{ year: 2026, books: 24, movies: 48, series: 12, updatedAt: '2026-11-25T00:00:00Z' }]);
  assert.ok(csv.includes('"Meta de livros"'));
  assert.ok(csv.includes('"2026";"24";"48";"12"'));
});
