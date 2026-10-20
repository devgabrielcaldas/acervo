const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const dir=__dirname+'/../supabase/functions/catalog/';
const read=(p)=>ts.transpileModule(fs.readFileSync(dir+p,'utf8'),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={URL,URLSearchParams,Request,Response,Headers,AbortSignal,Uint8Array,Date,Set,Promise,JSON,String,Array,Number,RegExp,Object,console,TextEncoder,TextDecoder};
function load(src,req){const box={exports:{}};vm.runInNewContext(src,{...context,module:box,exports:box.exports,require:req,fetch:globalThis.fetch,Deno:globalThis.Deno});return box.exports;}
const helper=load(read('catalog-utils.ts'),()=>{});
let handle;
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-example',TMDB_READ_ACCESS_TOKEN:'test-token'};
globalThis.Deno={env:{get:k=>env[k]},serve:fn=>{handle=fn}};
const image=new Uint8Array([255,216,255,224,0,0]);
globalThis.fetch=async(url,opts)=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/user')return new Response(opts.headers.Authorization==='Bearer good.jwt'?'{}':'{}',{status:opts.headers.Authorization==='Bearer good.jwt'?200:401});
  if(u.hostname==='www.googleapis.com')return Response.json({items:[{id:'123',volumeInfo:{title:'A Paciente Silenciosa',authors:['Alex Michaelides'],publishedDate:'2021-01-02',pageCount:320,imageLinks:{thumbnail:'https://books.google.com/books/content?id=123'}}}]});
  if(u.hostname==='openlibrary.org')return Response.json({docs:[]});
  if(u.pathname.includes('/search/movie'))return Response.json({results:[{id:238,title:'O Poderoso Chefão',release_date:'1972-03-24',poster_path:'/poster.jpg'}]});
  if(u.pathname.includes('/movie/238'))return Response.json({genres:[{name:'Crime'}],runtime:175,credits:{crew:[{job:'Director',name:'Francis Ford Coppola'}]}});
  if(u.hostname==='image.tmdb.org')return new Response(image,{status:200,headers:{'content-type':'image/jpeg'}});
  throw Error('Mock nao reconhece '+url);
};
load(read('index.ts'),p=>{if(p==='./catalog-utils.ts')return helper;throw Error(p)});
const call=async(body, token='good.jwt',origin='https://livrosfilmesgabriel.netlify.app')=>{
 const response=await handle(new Request('https://test.supabase.co/functions/v1/catalog',{method:'POST',headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 const data=response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer();
 return {status:response.status,data};
};
(async()=>{
 let r=await call({action:'search',kind:'book',query:'A Paciente Silenciosa'});assert.equal(r.status,200);assert.equal(r.data.results[0].creator,'Alex Michaelides');console.log('✓ API livros/autenticação normalização');
 r=await call({action:'search',kind:'movie',query:'Poderoso Chefão'});assert.equal(r.status,200);assert.equal(r.data.results[0].title,'O Poderoso Chefão');console.log('✓ API filmes TMDB');
 r=await call({action:'details',kind:'movie',selected:r.data.results[0]});assert.equal(r.status,200);assert.equal(r.data.item.creator,'Francis Ford Coppola');console.log('✓ Detalhes diretor TMDB');
 r=await call({action:'image',url:'https://image.tmdb.org/t/p/w500/poster.jpg'});assert.equal(r.status,200);assert.equal(r.data.byteLength,image.length);console.log('✓ Proxy capa binário');
 r=await call({action:'image',url:'https://127.0.0.1/secret'});assert.equal(r.status,400);console.log('✓ Proxy bloqueia SSRF');
 r=await call({action:'search',kind:'book',query:'Teste'},'bad.jwt');assert.equal(r.status,401);console.log('✓ Recusa sessão inválida');
 r=await call({action:'search',kind:'book',query:'Teste'},'good.jwt','https://evil.example');assert.equal(r.status,403);console.log('✓ Recusa origem não autorizada');
 console.log('\n7 testes integrados OK');
})().catch(e=>{console.error(e);process.exitCode=1});
