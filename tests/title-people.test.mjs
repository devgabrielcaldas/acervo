import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cleanBookCharacters, safeTmdbProfileUrl } from '../src/utils/titlePeople.ts';
import { normalizeTmdbCast, pickTmdbMatch, fetchTmdbCast } from '../supabase/functions/catalog/cast-utils.ts';

test('personagens: salva nomes e descrições aparados', () => {
  assert.deepEqual(cleanBookCharacters([{ name: ' Dante  ', description: '  Um dos protagonistas. ' }]), [{ name:'Dante', description:'Um dos protagonistas.' }]);
});
test('personagens: mantém ausência de campo para backups antigos', () => assert.equal(cleanBookCharacters(undefined), undefined));
test('personagens: lista vazia é válida', () => assert.deepEqual(cleanBookCharacters([]), []));
test('personagens: exige descrição e nome', () => assert.throws(() => cleanBookCharacters([{ name:'Dante', description:' ' }] )));
test('personagens: impede nomes duplicados com e sem acento', () => assert.throws(() => cleanBookCharacters([{ name:'Cora', description:'A' }, { name:'CóRa', description:'B' }])));
test('personagens: limita quantidade a 30', () => assert.throws(() => cleanBookCharacters(Array.from({length:31},(_,i)=>({name:`P${i}`,description:'ok'})))));
test('personagens: limita descrição a 400 caracteres', () => assert.throws(() => cleanBookCharacters([{name:'A',description:'x'.repeat(401)}])));
test('personagens: limita nome a 100 caracteres', () => assert.throws(() => cleanBookCharacters([{name:'x'.repeat(101),description:'ok'}])));
test('fotos TMDB: aceita apenas caminho de imagem', () => {
  assert.equal(safeTmdbProfileUrl('/abcDE123.jpg'),'https://image.tmdb.org/t/p/w185/abcDE123.jpg');
  assert.equal(safeTmdbProfileUrl('https://malicioso.example/foto.jpg'),undefined);
  assert.equal(safeTmdbProfileUrl('//evil.jpg'),undefined);
  assert.equal(safeTmdbProfileUrl('/abcDE123.svg'),undefined);
});
test('elenco: normaliza ator/atriz, personagem e foto', () => {
  assert.deepEqual(normalizeTmdbCast({cast:[{id:5,name:'Ana',character:'Joana',profile_path:'/abc123.jpg'}]}),
    [{id:5,name:'Ana',character:'Joana',profilePath:'/abc123.jpg'}]);
});
test('elenco: usa roles de créditos agregados de séries', () => {
  assert.equal(normalizeTmdbCast({cast:[{id:5,name:'Ana',roles:[{character:'Joana'}]}]})[0].character,'Joana');
});
test('elenco: omite dados incompletos e duplicatas', () => {
  assert.equal(normalizeTmdbCast({cast:[{id:5,name:'',character:'A'},{id:1,name:'L',character:'X'},{id:1,name:'L',character:'X'}]}).length,1);
});
test('elenco: limita resposta a 25 pessoas', () => {
  const members = Array.from({length:40},(_,id)=>({id:id+1,name:`Ator ${id}`,character:`Personagem ${id}`}));
  assert.equal(normalizeTmdbCast({cast:members}).length,25);
});
test('elenco: remove foto inválida', () => {
  assert.equal(normalizeTmdbCast({cast:[{id:1,name:'Ana',character:'Joana',profile_path:'https://evil.test/foto.jpg'}]})[0].profilePath,undefined);
});
test('busca antiga: identifica filme com título em português e ano', () => {
  const r = {results:[{id:1,title:'De Volta para o Futuro',release_date:'1985-07-03'}]};
  assert.deepEqual(pickTmdbMatch(r,'movie','de volta para o futuro',1985),{id:1,title:'De Volta para o Futuro'});
});
test('busca antiga: não associa homônimo do ano errado', () => {
  assert.equal(pickTmdbMatch({results:[{id:4,title:'A Intrusa',release_date:'2017-01-01'}]},'movie','A Intrusa',2026),undefined);
});
test('busca antiga: não seleciona homônimo ambíguo sem ano', () => {
  assert.equal(pickTmdbMatch({results:[{id:1,title:'A Intrusa'},{id:2,title:'A Intrusa'}]},'movie','A Intrusa'),undefined);
});
test('busca antiga: título da série sem sufixo Temp. 1', () => {
  assert.deepEqual(pickTmdbMatch({results:[{id:42,name:'Lost'}]},'series','Lost — Temp. 1'),{id:42,title:'Lost'});
});
const member = {cast:[{id:11,name:'Ator teste',character:'Protagonista',profile_path:'/actor99.jpg'}]};
test('Edge: com ID salvo consulta elenco do filme diretamente', async () => {
  const urls=[];
  const result=await fetchTmdbCast({kind:'movie',title:'Teste',tmdbId:11},async url=>{urls.push(url.pathname);return member;},{});
  assert.deepEqual(urls,['/3/movie/11/credits']);
  assert.equal(result.cast[0].character,'Protagonista');
  assert.equal(result.matchedBy,'id');
});
test('Edge: por título busca filme e em seguida créditos', async () => {
  const urls=[];
  const data=await fetchTmdbCast({kind:'movie',title:'Filme Exemplo',releaseYear:2024},async url=>{
    urls.push(url.pathname);
    return url.pathname.includes('/search/')?{results:[{id:77,title:'Filme Exemplo',release_date:'2024-10-01'}]}:member;
  },{});
  assert.deepEqual(urls,['/3/search/movie','/3/movie/77/credits']);
  assert.equal(data.matchedBy,'title');
});
test('Edge: retorno seguro quando não há correspondência', async () => {
  const result=await fetchTmdbCast({kind:'movie',title:'Falso',releaseYear:2000},async()=>({results:[]}),{});
  assert.deepEqual(result,{cast:[],unmatched:true});
});
test('Edge: série usa créditos da temporada selecionada', async () => {
  const urls=[];
  const result=await fetchTmdbCast({kind:'series',title:'Lost',tmdbId:12,seasonNumber:1},async url=>{urls.push(url.pathname);return member;},{});
  assert.deepEqual(urls,['/3/tv/12/season/1/credits']);
  assert.equal(result.cast.length,1);
});
test('Edge: série usa elenco agregado se créditos da temporada estiverem vazios', async () => {
  const urls=[];
  const result=await fetchTmdbCast({kind:'series',title:'Lost',tmdbId:12,seasonNumber:2},async url=>{urls.push(url.pathname);return urls.length===1?{cast:[]}:member;},{});
  assert.deepEqual(urls,['/3/tv/12/season/2/credits','/3/tv/12/aggregate_credits']);
  assert.equal(result.cast.length,1);
});
test('Edge: série usa elenco agregado se endpoint de temporada falhar', async () => {
  const urls=[];
  const result=await fetchTmdbCast({kind:'series',title:'Lost',tmdbId:12,seasonNumber:2},async url=>{urls.push(url.pathname);if(url.pathname.includes('/season/'))throw new Error('404');return member;},{});
  assert.equal(result.cast.length,1);
});
test('integração: existem componente, estilos, cliente, validação e Edge Function', () => {
  const fs = readFileSync;
  assert.match(fs(new URL('../src/components/media/TitlePeopleSection.tsx',import.meta.url),'utf8'),/onSaved\(updated\)/);
  assert.match(fs(new URL('../src/services/titlePeopleCatalog.ts',import.meta.url),'utf8'),/functions\.invoke\('catalog'/);
  assert.match(fs(new URL('../src/styles/title-people.css',import.meta.url),'utf8'),/acervo-people__cast-grid/);
});
