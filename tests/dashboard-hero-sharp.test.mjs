import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const css = readFileSync(join(process.cwd(), 'src/styles/dashboard-hero.css'), 'utf8');
const dashboard = readFileSync(join(process.cwd(), 'src/pages/DashboardPage.tsx'), 'utf8');
const marker = 'ACERVO_HERO_DIAGONAL_NITIDO_2026';
const block = css.slice(css.indexOf(`/* ${marker}`));

test('O estilo diagonal existe somente uma vez e substitui o bloco antigo', () => {
  assert.equal(css.split(marker).length - 1, 1);
  assert.ok(!css.includes('ACERVO_HERO_NITIDEZ_2026'));
});

test('Preserva a altura mínima compacta do destaque', () => {
  assert.match(css, /hero\.hero--compact\s*\{[^}]*min-height:\s*226px/s);
});

test('Três capas reais seguem o mesmo componente e Supabase de antes', () => {
  assert.match(dashboard, /heroHighlights\.map/);
  assert.match(dashboard, /<MediaCover/);
  assert.match(dashboard, /mediaId=\{item\.id\}/);
  assert.match(dashboard, /coverId=\{item\.coverId\}/);
});

test('Capa esquerda inclinada -7 graus, central reta, direita +7', () => {
  assert.match(block, /hero-live__tile:first-child\s*\{[^}]*rotate\(-7deg\)/s);
  assert.match(block, /hero-live__tile:nth-child\(2\)\s*\{[^}]*rotate\(0deg\)/s);
  assert.match(block, /hero-live__tile:last-child\s*\{[^}]*rotate\(7deg\)/s);
});

test('Imagem não recebe suavização de filtro nem transformação adicional', () => {
  assert.match(block, /hero-live__tile \.hero-live__cover img\s*\{[^}]*image-rendering:\s*auto/s);
  assert.match(block, /hero-live__tile \.hero-live__cover img\s*\{[^}]*filter:\s*none/s);
  assert.match(block, /hero-live__tile \.hero-live__cover img\s*\{[^}]*transform:\s*none/s);
});

test('Breakpoints preservam layout em telas estreitas', () => {
  for (const width of [1380, 1100, 700, 520, 340]) {
    assert.ok(block.includes(`max-width: ${width}px`), `Falta breakpoint ${width}px`);
  }
});

test('Não introduz modificação de Supabase ou capa no armazenamento', () => {
  assert.ok(!block.includes('supabase'));
  assert.ok(!block.includes('background-image: url('));
});
