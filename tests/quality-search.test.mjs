import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, matchesMediaSearch } from '../src/utils/searchMedia.ts';

const book = { kind: 'book', title: 'A Mágica Mortal', author: 'Raphael Montes', genres: ['Suspense Juvenil'] };
const movie = { kind: 'movie', title: 'De Volta para o Futuro', director: 'Robert Zemeckis', genres: ['Ficção Científica'] };
const series = { kind: 'series', title: 'O Corpo — Temp. 1', seriesTitle: 'O Corpo', genres: ['Drama'] };

test('remove acentos e normaliza maiúsculas', () => assert.equal(normalizeSearch('  MÁGICA  Mortal  '), 'magica mortal'));
test('não altera a informação original', () => { matchesMediaSearch(book, 'magica'); assert.equal(book.title, 'A Mágica Mortal'); });
test('busca livro sem acentos', () => assert.equal(matchesMediaSearch(book, 'magica mortal'), true));
test('busca palavras fora de ordem em título e autor', () => assert.equal(matchesMediaSearch(book, 'montes magica'), true));
test('busca por gênero com acentos e sem acentos', () => assert.equal(matchesMediaSearch(movie, 'ficcao cientifica'), true));
test('busca pelo diretor', () => assert.equal(matchesMediaSearch(movie, 'zemeckis'), true));
test('busca pelo nome base da série', () => assert.equal(matchesMediaSearch(series, 'corpo'), true));
test('consulta vazia não filtra', () => assert.equal(matchesMediaSearch(book, '   '), true));
test('não retorna falsos positivos', () => assert.equal(matchesMediaSearch(book, 'harry potter'), false));
test('todos os termos precisam corresponder', () => assert.equal(matchesMediaSearch(book, 'magica zemeckis'), false));
