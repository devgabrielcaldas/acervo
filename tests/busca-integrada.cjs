const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const root='supabase/functions/catalog/';
const transpile=f=>ts.transpileModule(fs.readFileSync(root+f,'utf8'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function use(code,context,req){const m={exports:{}};vm.runInNewContext(code,{...context,module:m,exports:m.exports,require:req});return m.exports;}
const sdk={URL,URLSearchParams,Request,Response,Headers,AbortSignal,Uint8Array,Date,Set,Promise,JSON,String,Array,Number,RegExp,Object,TextEncoder,TextDecoder,console};
const utils=use(transpile('catalog-utils.ts'),sdk,()=>{throw Error('not imported')});
const calls=[];let handle;
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'fake-public-key',TMDB_READ_ACCESS_TOKEN:'fake-token'};
const Deno={env:{get:k=>env[k]},serve:f=>{handle=f}};
const fetch=async(input,options)=>{
  const u=new URL(String(input));calls.push(u.pathname+u.search);
  if(u.pathname==='/auth/v1/user')return Response.json({id:'user-1'});
  if(u.hostname==='www.googleapis.com')return Response.json({items:[{id:'en-123',volumeInfo:{title:'Harry Potter and the Deathly Hallows',language:'en',authors:['J. K. Rowling'],categories:["children's books",'Fantasy fiction','the Elder Wand','dementors'],publishedDate:'2007-01-01',industryIdentifiers:[{type:'ISBN_13',identifier:'9780545010221'}],imageLinks:{thumbnail:'https://books.google.com/books/content?id=abc'}}}]});
  if(u.hostname==='openlibrary.org'&&u.pathname==='/search.json') {
    if((u.searchParams.get('q')??'').includes('language:por'))return Response.json({docs:[]});
    return Response.json({docs:[{key:'/works/OL82586W',title:'Harry Potter and the Deathly Hallows',author_name:['J. K. Rowling'],subject:['Magic','Fiction'],first_publish_year:2007}]});
  }
  if(u.hostname==='openlibrary.org'&&u.pathname==='/works/OL82586W/editions.json') return Response.json({entries:[
    {title:'Harry Potter and the Deathly Hallows',languages:[{key:'/languages/eng'}]},
    {title:'Harry Potter e as Relíquias da Morte',languages:[{key:'/languages/por'}],covers:[7777],publish_date:'2007',number_of_pages:592}
  ]});
  if(u.hostname==='api.themoviedb.org'&&u.pathname==='/3/search/movie')return Response.json({results:[{id:25,title:'O Poderoso Chefão',poster_path:'/poster.jpg'}]});
  if(u.hostname==='covers.openlibrary.org')return new Response(new Uint8Array(700).fill(13),{headers:{'content-type':'image/jpeg'}});
  throw Error('Mock unexpected fetch: '+u);
};
use(transpile('index.ts'),{...sdk,Deno,fetch},p=>{if(p==='./catalog-utils.ts')return utils;throw Error('unknown import '+p)});
async function call(body){const response=await handle(new Request('https://test.supabase.co/functions/v1/catalog',{method:'POST',headers:{origin:'https://livrosfilmesgabriel.netlify.app',authorization:'Bearer demo.jwt','content-type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()};}
(async()=>{
const {status,data}=await call({action:'search',kind:'book',query:'Harry Potter and the Deathly Hallows'});
assert.equal(status,200,JSON.stringify(data));
assert.equal(data.results[0].title,'Harry Potter e as Relíquias da Morte');
assert.equal(data.results[0].language,'pt');
assert.equal(data.results[0].year,2007);
assert.equal(data.results[0].pages,592);
assert.match(data.results[0].coverUrl,/7777-L/);
assert(!data.results[0].genres.some(g=>/wand|dementor|children/i.test(g)));
assert.equal(data.results[1].language,'en');
assert(data.results[1].coverFallbackUrl?.includes('covers.openlibrary.org/b/isbn/'));
assert(calls.some(path=>path.includes('editions.json')));
console.log('✓ Busca inglesa resolve edição em português, capa e número de páginas');
const tmdb=await call({action:'search',kind:'movie',query:'Poderoso Chefão'});
assert.equal(tmdb.status,200);assert.equal(tmdb.data.results[0].title,'O Poderoso Chefão');
console.log('✓ Filmes não foram afetados');
console.log('2 testes integrados aprovados');
})().catch(e=>{console.error(e);process.exitCode=1});
