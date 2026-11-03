import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPlaybackTime,parsePlaybackTime,mediaProgress,seasonDisplayTitle} from '../src/utils/progress.ts';
import {tmdbDetail,tmdbSeasonDetails,rankBookResults} from '../supabase/functions/catalog/catalog-utils.ts';

const base={id:'x',title:'teste',genres:[],status:'in_progress',favorite:false,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'};
test('livro físico: porcentagem deriva das páginas reais',()=>{
 assert.equal(mediaProgress({...base,kind:'book',format:'physical',totalPages:240,currentPage:60})?.percent,25);
});
test('ebook: porcentagem independe de páginas',()=>{
 assert.equal(mediaProgress({...base,kind:'book',format:'ebook',totalPages:240,currentPage:60,ebookPercent:38})?.percent,38);
});
test('série: 3 de 10 episódios é 30%',()=>{
 assert.equal(mediaProgress({...base,kind:'series',currentEpisode:3,totalEpisodes:10,seasonNumber:1})?.percent,30);
});
test('série: 0 de 10 episódios é 0%',()=>{
 assert.equal(mediaProgress({...base,kind:'series',currentEpisode:0,totalEpisodes:10})?.percent,0);
});
test('filme: tempo parcial / duração',()=>{
 assert.equal(mediaProgress({...base,kind:'movie',durationMinutes:120,pausedAtSeconds:3600})?.percent,50);
});
test('pausado mantém a barra',()=>{
 assert.equal(mediaProgress({...base,status:'paused',kind:'series',currentEpisode:2,totalEpisodes:8})?.percent,25);
});
test('concluído não exibe progresso, mesmo com valores anteriores',()=>{
 assert.equal(mediaProgress({...base,status:'completed',kind:'series',currentEpisode:8,totalEpisodes:8}),undefined);
});
test('sem denominador não inventa porcentagem',()=>{
 assert.equal(mediaProgress({...base,kind:'book',currentPage:45}),undefined);
});
test('posição HH:MM:SS',()=>{
 assert.equal(parsePlaybackTime('00:48:40'),2920);
 assert.equal(formatPlaybackTime(2920),'00:48:40');
 assert.equal(parsePlaybackTime(''),undefined);
 assert.throws(()=>parsePlaybackTime('00:60:01'));
 assert.throws(()=>parsePlaybackTime('23:12'));
});
test('título de temporada é determinístico',()=>{
 assert.equal(seasonDisplayTitle(' Lost ',1),'Lost — Temp. 1');
});
test('TMDB lista temporadas, ignora especiais e preserva capa específica',()=>{
 const info=tmdbDetail({number_of_seasons:3,seasons:[{season_number:0,name:'Especiais',episode_count:4},{season_number:2,name:'Temporada 2',episode_count:10,poster_path:'/abc.jpg'},{season_number:1,name:'Temporada 1',episode_count:12,poster_path:'/def.jpg'}]},'series');
 assert.deepEqual(info.seasons?.map(s=>s.number),[1,2]);
 assert.equal(info.seasons?.[0].episodeCount,12);
 assert.equal(info.seasons?.[1].coverUrl,'https://image.tmdb.org/t/p/w500/abc.jpg');
});
test('detalhe de temporada usa número de episódios e poster',()=>{
 const s=tmdbSeasonDetails({name:'Season 1',poster_path:'/s1.jpg',episodes:[{},{},{}]},1);
 assert.equal(s.number,1);assert.equal(s.episodeCount,3);assert.match(s.coverUrl,/s1.jpg/);
});
test('busca prioriza edição em português e não elimina a original',()=>{
 const mock={source:'google-books',kind:'book',id:'1',creator:'Alguém',genres:[]};
 const items=rankBookResults([
  {...mock,id:'en',title:'Some completely different book',language:'en'},
  {...mock,id:'pt',title:'Nós já moramos aqui',language:'pt'}], 'Nós já moramos aqui');
 assert.equal(items[0].id,'pt');assert.equal(items.length,2);
});

test('estatísticas contam apenas as temporadas realmente concluídas', async()=>{
 const {calculateYearStatistics}=await import('../src/utils/statistics.ts');
 const season1={...base, id:'s1',kind:'series',title:'Lost — Temp. 1',seasonNumber:1,status:'completed',completedOn:'2026-10-01'};
 const season2={...base, id:'s2',kind:'series',title:'Lost — Temp. 2',seasonNumber:2,status:'in_progress'};
 const season3={...base, id:'s3',kind:'series',title:'Lost — Temp. 3',seasonNumber:3,status:'completed',completedOn:'2027-01-09'};
 assert.equal(calculateYearStatistics([season1,season2,season3],2026).counts.series,1);
 assert.equal(calculateYearStatistics([season1,season2,season3],2027).counts.series,1);
});

test('edição em português fica à frente da original quando ambas existem',()=>{
 const mock={source:'google-books',kind:'book',id:'1',creator:'JK Rowling',genres:[]};
 const sorted=rankBookResults([
   {...mock,id:'en',title:'Harry Potter and the Deathly Hallows',language:'en'},
   {...mock,id:'pt',title:'Harry Potter e as Relíquias da Morte',language:'pt'}
 ],'Harry Potter and the Deathly Hallows');
 assert.equal(sorted[0].id,'pt');
});
