const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const calendar = read('src/pages/CalendarPage.tsx');
const styles = read('src/styles/calendar14-visual.css');

test('CalendarPage.tsx tem sintaxe TSX válida', () => {
  const diagnostics = ts.transpileModule(calendar, {fileName:'CalendarPage.tsx',reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext}}).diagnostics || [];
  assert.deepEqual(diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).map(d=>d.messageText), []);
});
test('página importa CSS adicional de escopo exclusivo',()=>{
  assert.match(calendar,/import '\.\.\/styles\/calendar14\.css';/);
  assert.match(calendar,/import '\.\.\/styles\/calendar14-visual\.css';/);
  assert.match(styles,/\.acervo-calendar-page/);
});
test('capas usam o mesmo MediaCover e o identificador salvo',()=>{
  assert.match(calendar,/import \{ MediaCover \} from '\.\.\/components\/media\/MediaCover';/);
  assert.match(calendar,/<MediaCover kind=\{event\.media_kind\} title=\{event\.media_title\}/);
  assert.match(calendar,/mediaId=\{event\.media_id\} coverId=\{coverIds\[event\.media_id\]\}/);
});
test('as capas existentes são lidas sem nova tabela SQL',()=>{
  assert.match(calendar,/cloudCoverRows\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(calendar,/setCoverIds\(Object\.fromEntries/);
  assert.match(read('src/services/cloudRepository.ts'),/export async function cloudCoverRows\(/);
});
test('evento continua disponível mesmo sem capa',()=>{
  const cover = read('src/components/media/MediaCover.tsx');
  assert.match(cover,/coverSrc \? \(/);
  assert.match(cover,/media-cover__fallback/);
  assert.match(styles,/\.acervo-calendar-entry__cover \.media-cover__fallback/);
});
test('dias mostram categorias distintas sem criar sessões extras',()=>{
  assert.match(calendar,/calendarKindOrder\.filter\(category => dayEvents\.some/);
  assert.match(calendar,/dayKinds\.map\(category => <i key=\{category\}/);
  assert.match(calendar,/const count = dayEvents\.length/);
});
test('o indicador do dia com uma série recebe cor própria',()=>{
  assert.match(calendar,/acervo-calendar-day--\$\{dayKinds\[0\]\}/);
  assert.match(styles,/\.acervo-calendar-day--series small\s*\{/);
  assert.match(styles,/background:var\(--acervo-cal-series\)/);
});
test('livros, filmes e séries têm cores distintas nos temas claro e escuro',()=>{
  for (const category of ['book','movie','series']) {
    assert.match(styles, new RegExp('acervo-cal-' + category));
    assert.match(styles, new RegExp('acervo-calendar-entry--' + category));
    assert.match(styles, new RegExp('acervo-calendar-kind-dot--' + category));
  }
  assert.match(styles,/:root\[data-theme='light'\]/);
});
test('o resumo de episódios usa a cor verde das séries',()=>{
  assert.match(calendar,/className="acervo-calendar-quantity--series"/);
  assert.match(calendar,/\{metrics\.episodes\} episódios/);
  assert.match(styles,/\.acervo-calendar-quantities \.acervo-calendar-quantity--series/);
});
test('duração agregada de reprodução não é erroneamente classificada como filme',()=>{
  assert.match(calendar,/acervo-calendar-quantity--playback/);
  assert.match(styles,/acervo-calendar-quantity--playback/);
  assert.doesNotMatch(calendar,/movieSeconds|seriesSeconds/);
});
test('CSS inclui cobertura mobile, nomes longos e sem movimento',()=>{
  assert.match(styles,/@media \(max-width:520px\)/);
  assert.match(styles,/\.acervo-calendar-entry__cover/);
  assert.match(styles,/min-width:0/);
  assert.match(styles,/prefers-reduced-motion/);
});
test('consulta e métrica originais permanecem funcionando sem gravação adicional',()=>{
  assert.match(calendar,/listActivityEvents\(\)/);
  assert.match(calendar,/summarizeActivities\(filtered, today\)/);
  assert.doesNotMatch(calendar,/insert\(|upsert\(|updateMedia\(/);
  assert.match(read('supabase/03-calendario-atividades.sql'),/acervo_activity_after_media_update/);
});
