import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompletionYear, listCompletionYears } from '../src/utils/completionYears.ts';

test('reconhece ano pela data real de conclusão', () => {
  assert.equal(getCompletionYear({ status: 'completed', completedOn: '2025-12-31' }), '2025');
  assert.equal(getCompletionYear({ status: 'completed', completedOn: '2027-01-01' }), '2027');
});

test('ignora livros concluídos sem data, mesmo que importados via SQL', () => {
  assert.equal(getCompletionYear({ status: 'completed' }), null);
});

test('ignora ano de conclusão para livros não concluídos', () => {
  assert.equal(getCompletionYear({ status: 'wishlist', completedOn: '2026-01-15' }), null);
  assert.equal(getCompletionYear({ status: 'in_progress', completedOn: '2026-01-15' }), null);
});

test('ignora datas incompletas e datas inválidas', () => {
  assert.equal(getCompletionYear({ status: 'completed', completedOn: '2026' }), null);
  assert.equal(getCompletionYear({ status: 'completed', completedOn: '2026-02-30' }), null);
  assert.equal(getCompletionYear({ status: 'completed', completedOn: '2025-13-05' }), null);
});

test('extrai anos únicos em ordem decrescente', () => {
  const records = [
    { status: 'completed', completedOn: '2026-01-03' },
    { status: 'completed', completedOn: '2025-12-31' },
    { status: 'completed', completedOn: '2027-02-02' },
    { status: 'completed', completedOn: '2026-05-20' },
    { status: 'wishlist' },
    { status: 'completed' },
  ];
  assert.deepEqual(listCompletionYears(records), ['2027','2026','2025']);
});

test('suporta banco vazio, múltiplas contas isoladas pelo repositório e títulos de todas as categorias', () => {
  assert.deepEqual(listCompletionYears([]), []);
  assert.deepEqual(listCompletionYears([
    { status: 'completed', completedOn: '2026-03-05' },
    { status: 'completed', completedOn: '2024-02-29' },
  ]), ['2026', '2024']);
});
