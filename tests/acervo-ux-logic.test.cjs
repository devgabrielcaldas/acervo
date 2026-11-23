'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cached = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (cached.has(file)) return cached.get(file).exports;
  const module = {exports:{}};
  cached.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText;
  const localRequire = name => name.startsWith('.')
    ? loadTs(path.resolve(path.dirname(file),name.endsWith('.ts')?name:name+'.ts'))
    : require(name);
  const run = new Function('require','module','exports',code);
  run(localRequire,module,module.exports);
  return module.exports;
}
const {startDraft,startPatch}=loadTs(path.join(root,'src/utils/startMedia.ts'));
const {completeDraft,completePatch}=loadTs(path.join(root,'src/utils/completeMedia.ts'));
const {rankBookResults,bookTitleMatches,bookSearchPlan}=loadTs(path.join(root,'supabase/functions/catalog/catalog-utils.ts'));
const base={id:'1',createdAt:'2026-01-01T12:00:00Z',updatedAt:'2026-10-01T00:00:00Z',coverId:'c1',title:'Exemplo',genres:[],favorite:true,notes:'Comentário preservado',status:'wishlist'};
const book={...base,kind:'book',format:'ebook',ebookPercent:25,totalPages:300,rating:4};
const movie={...base,kind:'movie',durationMinutes:139,pausedAtSeconds:900};
const series={...base,kind:'series',seasonNumber:1,totalEpisodes:10,currentEpisode:3};

test('iniciar e-book de 0%, usando 60% sem sobrescrever outros campos',()=>{
 const d=startDraft(book);assert.equal(d.percent,'25');d.percent='60';const patch=startPatch(book,d);
 assert.equal(patch.status,'in_progress');assert.equal(patch.ebookPercent,60);
 assert.equal({...book,...patch}.coverId,'c1');assert.equal({...book,...patch}.rating,4);
});
test('iniciar livro físico na página 120/300',()=>{
 const d=startDraft({...book,format:'physical',currentPage:undefined});d.currentPage='120';
 assert.equal(startPatch({...book,format:'physical'},d).currentPage,120);
});
test('iniciar série em zero episódios',()=>{
 const d=startDraft({...series,currentEpisode:undefined});assert.equal(d.watchedEpisodes,'0');
 assert.equal(startPatch(series,d).currentEpisode,0);
});
test('iniciar série já no terceiro episódio concluído',()=>{
 const d=startDraft(series);d.watchedEpisodes='3';assert.equal(startPatch(series,d).currentEpisode,3);
});
test('iniciar filme e registrar 00:48:40',()=>{
 const d=startDraft(movie);d.pausedAt='00:48:40';assert.equal(startPatch(movie,d).pausedAtSeconds,2920);
});
test('recusar progresso maior que 100% e página maior que o total',()=>{
 let d=startDraft(book);d.percent='101';assert.throws(()=>startPatch(book,d));
 const physical={...book,format:'physical'};d=startDraft(physical);d.currentPage='301';assert.throws(()=>startPatch(physical,d));
});
test('recusar iniciar registro fora da wishlist',()=>{
 assert.throws(()=>startPatch({...book,status:'completed'},startDraft(book)));
});
test('não inventar data de início',()=>{
 assert.equal(startPatch(book,startDraft(book)).startedOn,undefined);
});
test('rejeitar data de início impossível',()=>{
 const d=startDraft(book);d.startedOn='2026-02-30';assert.throws(()=>startPatch(book,d));
});
test('concluir e-book: nota meia estrela, 100% e metadata intacta',()=>{
 const d=completeDraft(book);d.completedOn='2026-06-08';d.rating='4.5';d.notes='Excelente';
 const p=completePatch(book,d);assert.equal(p.status,'completed');assert.equal(p.rating,4.5);assert.equal(p.ebookPercent,100);
 assert.equal({...book,...p}.coverId,'c1');assert.equal({...book,...p}.genres.length,0);
});
test('concluir físico usando o total de páginas',()=>{
 const d=completeDraft({...book,format:'physical'});d.completedOn='2026-06-08';
 assert.equal(completePatch({...book,format:'physical'},d).currentPage,300);
});
test('concluir filme limpa pausa e não exige nota',()=>{
 const d=completeDraft(movie);d.completedOn='2026-06-08';
 assert.equal(completePatch(movie,d).rating,undefined);assert.equal(completePatch(movie,d).pausedAtSeconds,undefined);
});
test('concluir temporada registra todos os episódios e remove pausa',()=>{
 const d=completeDraft(series);d.completedOn='2026-06-08';d.rating='5';
 const p=completePatch(series,d);assert.equal(p.currentEpisode,10);assert.equal(p.pausedAtSeconds,undefined);
});
test('rejeitar datas falsas ou posteriores ao início',()=>{
 const d=completeDraft(book);d.completedOn='2026-02-30';assert.throws(()=>completePatch(book,d));
 const d2=completeDraft({...book,startedOn:'2026-06-10'});d2.completedOn='2026-06-08';assert.throws(()=>completePatch({...book,startedOn:'2026-06-10'},d2));
});
test('rejeitar notas fora da escala e passos',()=>{
 const d=completeDraft(book);d.completedOn='2026-06-08';d.rating='4.3';assert.throws(()=>completePatch(book,d));
});
test('priorizar Olhos Vazios exato sobre resultados português irrelevantes',()=>{
 const results=rankBookResults([
  {title:'SEU PAR de Olhos Vazios',language:'pt'},
  {title:'O comitê da morte',language:'pt'},
  {title:'Olhos Vazios',language:'pt',creator:'Charlie Donlea',coverUrl:'https://x'},
  {title:'Olhos Vazio',language:'en'}
 ],'Olhos Vazios');
 assert.equal(results[0].title,'Olhos Vazios');
 assert.equal(bookTitleMatches('SEU PAR de Olhos Vazios','Olhos Vazios'),false);
 assert.equal(bookTitleMatches('Olhos Vazios - edição especial','Olhos Vazios'),true);
});
test('criar fallback por título com operador oficial intitle',()=>{
 const p=bookSearchPlan('Olhos Vazios');
 assert.equal(p.googleTitle.searchParams.get('q'),'intitle:"Olhos Vazios"');
 assert.equal(p.google.searchParams.get('maxResults'),'30');
});
test('não inventar ISBN para texto e mantém pesquisa por ISBN',()=>{
 const p=bookSearchPlan('9786556220468');assert.equal(p.isbn,'9786556220468');
});
