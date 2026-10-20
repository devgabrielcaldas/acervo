/** Testes locais sem credenciais: simula respostas HTTP reais da função catalog. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const path = require('node:path');
const file = path.resolve(__dirname, '../src/services/catalogClient.ts');
// import.meta é nativo do Vite; nos testes CommonJS é somente um substituto do ambiente.
const source = fs.readFileSync(file,'utf8').replaceAll('import.meta.env','globalThis.__env');
const transpiled = ts.transpileModule(source, {fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal(transpiled.diagnostics?.length,0,'Sintaxe TypeScript válida');

const state = {token:'session.jwt',requestLog:[], responses:[]};
const fakeSupabase={
  auth:{getSession:async()=>({data:{session:state.token?{access_token:state.token}:null},error:null})},
  functions:{invoke:async(_,{body})=>({data:body.action==='search'?{results:[]}:{item:body.selected},error:null})},
};
const sandboxModule = { exports: {} };
const context = {
  module:sandboxModule,exports:sandboxModule.exports,require:specifier=>{
    assert.equal(specifier,'../lib/supabase');return {requireSupabase:()=>fakeSupabase};
  },
  __env:{VITE_SUPABASE_URL:'https://projeto-exemplo.supabase.co/',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'},
  Blob,File,Response,Headers,AbortSignal,Uint8Array,String,Array,Set,Error,JSON,console,
  fetch:async(url,opts)=>{
    state.requestLog.push({url,opts});
    if (!state.responses.length) throw new Error('Resposta simulada não configurada');
    const next=state.responses.shift();
    return typeof next==='function'?next(url,opts):next;
  },
};
vm.runInNewContext(transpiled.outputText,context,{filename:'catalogClient.js'});
const api=context.module.exports;
const JPEG = new Uint8Array(1100);JPEG.set([255,216,255,224]);
const PNG = new Uint8Array(950);PNG.set([137,80,78,71,13,10,26,10]);
const WEBP = new Uint8Array(1200);WEBP.set(Buffer.from('RIFF'),0);WEBP.set(Buffer.from('WEBP'),8);
const make=(bytes,mime)=>new Response(bytes,{status:200,headers:{'content-type':mime}});
let count=0;
async function test(name,fn){state.responses=[];state.requestLog=[];state.token='session.jwt';await fn();++count;console.log(`✓ ${name}`);}

(async()=>{
  await test('JPG devolvido como image/jpeg torna-se File JPEG válido',async()=>{
    state.responses.push(make(JPEG,'image/jpeg'));
    const file=await api.downloadCatalogCover('https://books.google.com/books/content?id=xyz');
    assert.equal(file.type,'image/jpeg');assert.equal(file.size,JPEG.length);assert.equal(file.name,'capa-catalogo.jpg');
    assert.equal(state.requestLog[0].url,'https://projeto-exemplo.supabase.co/functions/v1/catalog');
    assert.equal(state.requestLog[0].opts.headers.Authorization,'Bearer session.jwt');
    assert.equal(state.requestLog[0].opts.headers.apikey,'sb_publishable_example');
    assert.equal(JSON.parse(state.requestLog[0].opts.body).action,'image');
  });
  await test('PNG com Content-Type + charset é processado sem converter para texto',async()=>{
    state.responses.push(make(PNG,'image/png; charset=binary'));
    const file=await api.downloadCatalogCover('https://covers.openlibrary.org/b/id/7-L.png');
    assert.equal(file.type,'image/png');assert.equal(file.name,'capa-catalogo.png');
  });
  await test('WebP do catálogo é aceito',async()=>{
    state.responses.push(make(WEBP,'image/webp'));
    const file=await api.downloadCatalogCover('https://image.tmdb.org/t/p/w500/abc.webp');
    assert.equal(file.type,'image/webp');
  });
  await test('Erro na primeira capa usa segunda imagem por ISBN',async()=>{
    state.responses.push(Response.json({error:'Imagem não encontrada na primeira fonte'},{status:502}), make(JPEG,'image/jpeg'));
    const file=await api.downloadCatalogCover('https://books.google.com/books/content?id=1','https://covers.openlibrary.org/b/isbn/9780000000001-L.jpg?default=false');
    assert.equal(file.size,JPEG.length);assert.equal(state.requestLog.length,2);
    assert.match(state.requestLog[1].opts.body,/9780000000001/);
  });
  await test('Resposta HTML disfarçada de imagem é rejeitada',async()=>{
    state.responses.push(make(new Uint8Array(800),'image/jpeg'));
    await assert.rejects(api.downloadCatalogCover('https://books.google.com/books/content?id=1'),/não é uma imagem válida/);
  });
  await test('Formato MIME incorreto não é aceito',async()=>{
    state.responses.push(new Response('<html>Ops</html>',{status:200,headers:{'content-type':'text/html'}}));
    await assert.rejects(api.downloadCatalogCover('https://books.google.com/books/content?id=1'),/não é uma imagem JPG, PNG ou WebP/);
  });
  await test('Imagem pequena retorna erro e permite capa manual',async()=>{
    state.responses.push(make(new Uint8Array([255,216,255]),'image/jpeg'));
    await assert.rejects(api.downloadCatalogCover('https://books.google.com/books/content?id=1'),/incompleta/);
  });
  await test('Imagem > 6MB é bloqueada sem leitura desnecessária',async()=>{
    state.responses.push(new Response(new Uint8Array([255,216,255]),{status:200,headers:{'content-type':'image/jpeg','content-length':String(7*1024*1024)}}));
    await assert.rejects(api.downloadCatalogCover('https://books.google.com/books/content?id=1'),/excede o limite/);
  });
  await test('Mesma URL repetida não dispara duas buscas',async()=>{
    state.responses.push(Response.json({error:'Capa indisponível'},{status:502}));
    await assert.rejects(api.downloadCatalogCover('https://covers.openlibrary.org/b/id/1-L.jpg','https://covers.openlibrary.org/b/id/1-L.jpg'),/Capa indisponível/);
    assert.equal(state.requestLog.length,1);
  });
  await test('Sem token a função não é chamada',async()=>{
    state.token='';await assert.rejects(api.downloadCatalogCover('https://books.google.com/books/content?id=1'),/sessão expirou/);
    assert.equal(state.requestLog.length,0);
  });
  await test('Falha de rede na primeira capa não impede a alternativa',async()=>{
    state.responses.push(()=>{throw new TypeError('Failed to fetch')},make(PNG,'image/png'));
    assert.equal((await api.downloadCatalogCover('https://books.google.com/books/content?id=1','https://covers.openlibrary.org/b/id/8-L.jpg')).type,'image/png');
  });
  await test('Busca e detalhes continuam usando cliente Supabase',async()=>{
    const found=await api.searchCatalog('book','Jantar Secreto'); assert.equal(found.results.length,0);
    const result=await api.loadCatalogDetails({source:'google-books',id:'abc',kind:'book',title:'Jantar Secreto',genres:[]});
    assert.equal(result.title,'Jantar Secreto');
  });
  console.log(`\n${count} testes concluídos sem falhas.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
