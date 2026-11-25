import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
function loadTs(rel, dependencies = {}) {
  const src = fs.readFileSync(path.join(cwd, rel), 'utf8');
  const result = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  const errors = result.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error) ?? [];
  assert.equal(errors.length, 0, `${rel}: ${errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText, '\n')).join('\n')}`);
  const m = { exports: {} };
  const requireMock = (name) => name in dependencies ? dependencies[name] : (() => { throw new Error('Dependência inesperada: '+name); })();
  new Function('require', 'module', 'exports', result.outputText)(requireMock, m, m.exports);
  return m.exports;
}
const search = loadTs('src/utils/searchMedia.ts');
const smart = loadTs('src/utils/smartCollection.ts', { './searchMedia': search });
const item = (overrides={})=>({id:'001',kind:'book',title:'A Mágica Mortal',status:'completed',genres:[],favorite:false,createdAt:'2026-01-01',updatedAt:'2026-01-03',...overrides});
const input = (overrides={})=>({kind:'book',status:'wishlist',title:'A Magica Mortal',...overrides});

const cases = [
 ['normaliza acentos e sinais gráficos',()=>assert.equal(smart.identityText('  A MÁGICA—MORTAL!  '),'a magica mortal')],
 ['avisa duplicidade de livro sem acento',()=>assert.equal(smart.findPossibleDuplicates(input({author:'Raphael Montes'}),[item({author:'Raphael Montes'})]).length,1)],
 ['não confunde mesmo título de autores diferentes',()=>assert.equal(smart.findPossibleDuplicates(input({author:'Autora B'}),[item({author:'Raphael Montes'})]).length,0)],
 ['sem autor, identifica potencial duplicação',()=>assert.equal(smart.findPossibleDuplicates(input(),[item({author:'Raphael Montes'})]).length,1)],
 ['não alerta ao editar o próprio registro',()=>assert.equal(smart.findPossibleDuplicates(input(),[item()], '001').length,0)],
 ['não mistura livro e filme',()=>assert.equal(smart.findPossibleDuplicates(input(),[item({kind:'movie'})]).length,0)],
 ['mesmo filme no mesmo ano alerta',()=>assert.equal(smart.findPossibleDuplicates({kind:'movie',title:'De Volta para o Futuro',status:'wishlist',releaseYear:1985,director:'Robert Zemeckis'},[item({kind:'movie',title:'De volta para o futuro',releaseYear:1985,director:'Robert Zemeckis'})]).length,1)],
 ['remake com ano diferente não alerta',()=>assert.equal(smart.findPossibleDuplicates({kind:'movie',title:'It',status:'wishlist',releaseYear:2017},[item({kind:'movie',title:'IT',releaseYear:1990})]).length,0)],
 ['filmes de mesmo nome e diretores diferentes não alertam',()=>assert.equal(smart.findPossibleDuplicates({kind:'movie',title:'O Estranho',status:'wishlist',director:'Ana'},[item({kind:'movie',title:'O Estranho',director:'Carlos'})]).length,0)],
 ['temporada 1 igual alerta',()=>assert.equal(smart.findPossibleDuplicates({kind:'series',status:'wishlist',title:'Lost — Temp. 1',seriesTitle:'Lost',seasonNumber:1},[item({kind:'series',title:'Lost - Temporada 1',seriesTitle:'Lost',seasonNumber:1})]).length,1)],
 ['temporada 2 distinta não alerta',()=>assert.equal(smart.findPossibleDuplicates({kind:'series',status:'wishlist',title:'Lost — Temp. 2',seriesTitle:'Lost',seasonNumber:2},[item({kind:'series',title:'Lost — Temp. 1',seriesTitle:'Lost',seasonNumber:1})]).length,0)],
 ['temporada antiga sem campos estruturados é reconhecida',()=>assert.equal(smart.findPossibleDuplicates({kind:'series',status:'wishlist',title:'Lost — Temp. 1',seriesTitle:'Lost',seasonNumber:1},[item({kind:'series',title:'Lost - Temporada 1'})]).length,1)],
 ['limita as sugestões a cinco',()=>assert.equal(smart.findPossibleDuplicates(input(),Array.from({length:15},(_,i)=>item({id:String(i)}))).length,5)],
 ['agrupa três temporadas sem unir registros',()=>{const books=[item({id:'b'})],s=[1,3,2].map(n=>item({id:'s'+n,kind:'series',title:`Lost — Temp. ${n}`,seriesTitle:'Lost',seasonNumber:n}));const g=smart.groupMediaSeasons([...books,...s]);assert.equal(g.groups.length,1);assert.deepEqual(g.groups[0].items.map(x=>x.id),['s1','s2','s3']);assert.equal(g.singles.length,1)}],
 ['temporada isolada permanece avulsa',()=>assert.equal(smart.groupMediaSeasons([item({kind:'series',title:'Lost — Temp. 1',seasonNumber:1})]).groups.length,0)],
 ['títulos diferentes não são agrupados',()=>{const a=[item({id:'a',kind:'series',title:'Lost — Temp. 1'}),item({id:'b',kind:'series',title:'Dark — Temp. 2'})];assert.equal(smart.groupMediaSeasons(a).singles.length,2)}],
 ['não duplica ou modifica objetos de origem',()=>{const a=[item({id:'1',kind:'series',title:'Lost — Temp. 2'}),item({id:'2',kind:'series',title:'Lost — Temp. 1'})];const original=a.map(x=>x.title);const r=smart.groupMediaSeasons(a);assert.deepEqual(a.map(x=>x.title),original);assert.equal(r.groups[0].items.length,2)}],
 ['normaliza filtros inválidos antes de salvar',()=>{const x=smart.sanitizeSmartFilters({kind:'admin',status:'deleted',sort:'random',minRating:'99',search:'a'.repeat(1000)});assert.equal(x.kind,'all');assert.equal(x.status,'all');assert.equal(x.sort,'recent');assert.equal(x.minRating,'all');assert.equal(x.search.length,200)}],
 ['aceita ano de conclusão válido',()=>assert.equal(smart.sanitizeSmartFilters({completionYear:'2026'}).completionYear,'2026')],
 ['rejeita ano não numérico',()=>assert.equal(smart.sanitizeSmartFilters({completionYear:'202X'}).completionYear,'all')],
 ['lida com configuração nula',()=>assert.deepEqual(smart.sanitizeSmartFilters(null),smart.EMPTY_SMART_FILTERS)],
 ['mantém nota e busca em filtros',()=>{const x=smart.sanitizeSmartFilters({minRating:'4.5',search:'Alá',kind:'book'});assert.equal(x.minRating,'4.5');assert.equal(x.search,'Alá')}],
 ['não confunde palavras da busca sem acentos',()=>assert.equal(search.matchesMediaSearch(item({author:'Raphael Montes'}),'montes magica'),true)],
 ['não retorna falso positivo em busca global',()=>assert.equal(search.matchesMediaSearch(item(),'carro azul'),false)],
];
for (const [name,run] of cases) test(name,run);
