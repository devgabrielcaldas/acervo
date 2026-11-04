const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function loadTS(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, { fileName: filename, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, mod);
  const nativeRequire = mod.require.bind(mod);
  mod.require = id => id === './progress' ? loadTS('src/utils/progress.ts') : nativeRequire(id);
  mod._compile(js, filename);
  return mod.exports;
}
const { quickProgressDraft, quickProgressPatch } = loadTS('src/utils/quickProgress.ts');
const { mediaProgress } = loadTS('src/utils/progress.ts');
const base = { id:'test', title:'Teste', status:'in_progress', genres:[], favorite:false, createdAt:'2026-11-01T00:00:00Z', updatedAt:'2026-11-01T00:00:00Z' };
const makeBook = more => ({ ...base, kind:'book', author:'Autor teste', format:'ebook', ebookPercent:60, ...more });
const makeSeries = more => ({ ...base, kind:'series', title:'Lost — Temp. 1', currentEpisode:2, totalEpisodes:10, ...more });
const makeMovie = more => ({ ...base, kind:'movie', title:'Clube da Luta', durationMinutes:139, pausedAtSeconds:1200, ...more });

function patchFor(item, edits={}) {
  return quickProgressPatch(item, { ...quickProgressDraft(item), ...edits });
}
test('e-book: altera 60% para 72%, sem modificar o original', () => {
  const item=makeBook();
  const patch=patchFor(item,{percent:'72'});
  assert.deepEqual(patch,{format:'ebook',ebookPercent:72});
  assert.equal(item.ebookPercent,60);
  assert.equal(mediaProgress({...item,...patch}).percent,72);
});
test('livro físico: página 145/350 calcula 41,4%', () => {
  const item=makeBook({format:'physical',totalPages:350,currentPage:100});
  const patch=patchFor(item,{currentPage:'145'});
  assert.deepEqual(patch,{format:'physical',currentPage:145,totalPages:350});
  assert.equal(mediaProgress({...item,...patch}).percent,41.4);
});
test('livro físico permite total ainda não conhecido', () => {
  assert.deepEqual(patchFor(makeBook({format:'physical', currentPage:10}),{currentPage:'12'}),{format:'physical',currentPage:12,totalPages:undefined});
});
test('audiolivro registra percentual e aparece no progresso', () => {
  const item=makeBook({format:'audiobook',ebookPercent:20});
  const patch=patchFor(item,{percent:'25'});
  assert.equal(mediaProgress({...item,...patch}).description,'Audiolivro · 25%');
});
test('e-book rejeita percentuais acima de 100 e negativos', () => {
  assert.throws(()=>patchFor(makeBook(),{percent:'101'}),/0 a 100/);
  assert.throws(()=>patchFor(makeBook(),{percent:'-1'}),/inteiro válido/);
});
test('livro físico rejeita páginas maiores que total', () => {
  assert.throws(()=>patchFor(makeBook({format:'physical',totalPages:200}),{currentPage:'201'}),/ultrapassar/);
});
test('filme: 00:48:40 é convertido para 2920 segundos', () => {
  const item=makeMovie();
  const patch=patchFor(item,{pausedAt:'00:48:40'});
  assert.deepEqual(patch,{pausedAtSeconds:2920,durationMinutes:139});
  assert.equal(mediaProgress({...item,...patch}).percent,35);
});
test('filme rejeita posição acima da duração', () => {
  assert.throws(()=>patchFor(makeMovie({durationMinutes:60}),{pausedAt:'01:05:00'}),/ultrapassar/);
});
test('filme rejeita minutos inválidos', () => {
  assert.throws(()=>patchFor(makeMovie(),{pausedAt:'00:72:00'}),/minutos e segundos/);
});
test('filme: campo vazio remove posição sem afetar status', () => {
  const item=makeMovie();
  const patch=patchFor(item,{pausedAt:''});
  assert.equal(patch.pausedAtSeconds,undefined);
  assert.equal({...item,...patch}.status,'in_progress');
});
test('série: 3 episódios concluídos de 10 = 30%', () => {
  const item=makeSeries();
  const patch=patchFor(item,{watchedEpisodes:'3'});
  assert.equal(mediaProgress({...item,...patch}).percent,30);
});
test('série: permite zero episódio concluído e pausa no primeiro', () => {
  const item=makeSeries({currentEpisode:undefined});
  const patch=patchFor(item,{watchedEpisodes:'0',pausedAt:'00:18:00'});
  assert.deepEqual(patch,{currentEpisode:0,totalEpisodes:10,pausedAtSeconds:1080});
  assert.equal(mediaProgress({...item,...patch}).percent,0);
});
test('série: rejeita contagem maior que total', () => {
  assert.throws(()=>patchFor(makeSeries(),{watchedEpisodes:'11'}),/superar/);
});
test('série: não aceita pausa após completar todos os episódios', () => {
  assert.throws(()=>patchFor(makeSeries(),{watchedEpisodes:'10',pausedAt:'00:10:00'}),/Todos os episódios/);
});
test('série: pausa pode ser limpa ao concluir o episódio', () => {
  assert.deepEqual(patchFor(makeSeries({pausedAtSeconds:600}),{watchedEpisodes:'10',pausedAt:''}),{currentEpisode:10,totalEpisodes:10,pausedAtSeconds:undefined});
});
test('atualização rápida não sobrescreve título, capa, nota, favoritos, datas, nem status', () => {
  const item=makeBook({coverId:'capa',rating:4.5,notes:'ótimo',favorite:true,startedOn:'2026-11-01'});
  const next={...item,...patchFor(item,{percent:'80'})};
  for (const field of ['title','coverId','rating','notes','favorite','startedOn','status','id','author']) {
    assert.equal(next[field],item[field],`Campo ${field} deve ser preservado`);
  }
});
test('os três tipos não apresentam valores inventados quando o progresso é desconhecido', () => {
  assert.equal(quickProgressDraft(makeMovie({durationMinutes:undefined,pausedAtSeconds:undefined})).pausedAt,'');
  assert.equal(quickProgressDraft(makeBook({format:'ebook',ebookPercent:undefined})).percent,'');
  assert.equal(quickProgressDraft(makeSeries({currentEpisode:undefined})).watchedEpisodes,'0');
});

test('marcar e-book como concluído dá 100%, registra data e nota, sem criar novo registro', () => {
  const item=makeBook({coverId:'capa',notes:'Comentário',favorite:true,startedOn:'2026-10-01'});
  const patch=patchFor(item,{finish:true,completedOn:'2026-10-20',rating:'4.5'});
  assert.deepEqual(patch,{format:'ebook',ebookPercent:100,status:'completed',completedOn:'2026-10-20',rating:4.5});
  const updated={...item,...patch};
  assert.equal(updated.coverId,'capa');assert.equal(updated.notes,'Comentário');assert.equal(updated.favorite,true);
  assert.equal(updated.status,'completed'); assert.equal(item.status,'in_progress');
});
test('concluir livro físico usa total de páginas quando conhecido, sem exigir página atual', () => {
  const item=makeBook({format:'physical',currentPage:42,totalPages:350});
  const patch=patchFor(item,{finish:true,currentPage:'',completedOn:'2026-10-20',rating:'5'});
  assert.equal(patch.currentPage,350); assert.equal(patch.totalPages,350);assert.equal(patch.status,'completed');
});
test('concluir livro sem paginação conhecida é possível e não inventa páginas', () => {
  const item=makeBook({format:'physical',currentPage:undefined,totalPages:undefined});
  const patch=patchFor(item,{finish:true,currentPage:'',totalPages:'',completedOn:'2026-10-20',rating:''});
  assert.equal(patch.currentPage,undefined);assert.equal(patch.totalPages,undefined);assert.equal(patch.rating,undefined);
});
test('concluir filme remove tempo de pausa e permite nota opcional', () => {
  const item=makeMovie({rating:3,coverId:'capa-filme',notes:'Preservar'});
  const patch=patchFor(item,{finish:true,completedOn:'2026-10-20',rating:'',pausedAt:'00:20:00'});
  assert.equal(patch.status,'completed'); assert.equal(patch.pausedAtSeconds,undefined);
  assert.equal(patch.rating,undefined);assert.equal({...item,...patch}.coverId,'capa-filme');assert.equal({...item,...patch}.notes,'Preservar');
});
test('conclusão exige dia real, sem data automaticamente preenchida',()=>{
  const item=makeMovie();
  assert.equal(quickProgressDraft(item).completedOn,'');
  assert.throws(()=>patchFor(item,{finish:true,completedOn:''}),/data real/);
  assert.throws(()=>patchFor(item,{finish:true,completedOn:'2026-02-30'}),/não existe/);
});
test('conclusão recusa data anterior à data de início e data futura',()=>{
  const item=makeBook({startedOn:'2026-10-10'});
  assert.throws(()=>patchFor(item,{finish:true,completedOn:'2026-10-09'}),/anteceder/);
  assert.throws(()=>patchFor(item,{finish:true,completedOn:'2099-01-01'}),/futura/);
});
test('conclusão aceita notas em meios pontos e rejeita valores inválidos',()=>{
  const item=makeBook();
  assert.equal(patchFor(item,{finish:true,completedOn:'2026-10-20',rating:'0'}).rating,0);
  assert.equal(patchFor(item,{finish:true,completedOn:'2026-10-20',rating:'3.5'}).rating,3.5);
  assert.throws(()=>patchFor(item,{finish:true,completedOn:'2026-10-20',rating:'4.2'}),/0 a 5/);
  assert.throws(()=>patchFor(item,{finish:true,completedOn:'2026-10-20',rating:'6'}),/0 a 5/);
});
test('séries seguem o fluxo antigo e não aceitam conclusão via modal rápido',()=>{
  const item=makeSeries();
  assert.equal(patchFor(item,{watchedEpisodes:'4'}).currentEpisode,4);
  assert.throws(()=>patchFor(item,{finish:true,completedOn:'2026-10-20'}),/temporadas/);
});
test('sem finalizar, atualização rápida nunca altera data, status, avaliação ou capa',()=>{
  const item=makeBook({rating:4.5,completedOn:'2026-10-10',coverId:'x',notes:'Importante'});
  const patch=patchFor(item,{percent:'70',finish:false});
  const merged={...item,...patch};
  for(const k of ['rating','completedOn','status','coverId','notes'])assert.equal(merged[k],item[k]);
});
