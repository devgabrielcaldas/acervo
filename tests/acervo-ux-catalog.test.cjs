'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const utilPath = path.join(root, 'supabase/functions/catalog/catalog-utils.ts');
const edgePath = path.join(root, 'supabase/functions/catalog/index.ts');

function loadEdge(fakeFetch) {
  const utils = { exports: {} };
  const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  }).outputText;
  vm.runInNewContext(compile(utilPath), { module: utils, exports: utils.exports, URL, console, Date, Intl, Set });
  let handler;
  const edge = { exports: {} };
  vm.runInNewContext(compile(edgePath), {
    module: edge, exports: edge.exports,
    require: name => {
      if (name === './catalog-utils.ts') return utils.exports;
      throw Error(`Importação inesperada: ${name}`);
    },
    Deno: { env: { get: key => ({
      SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'public_fake_key',
      GOOGLE_BOOKS_API_KEY: 'fake_books_key', TMDB_READ_ACCESS_TOKEN: 'fake_tmdb_token',
    })[key] }, serve: cb => { handler = cb; } },
    fetch: fakeFetch, URL, Response, Request, AbortSignal, Headers, console, Date, Intl, Set,
  });
  return handler;
}

const jsonResponse = body => new Response(JSON.stringify(body), { status: 200, headers: {'Content-Type':'application/json'} });
const entry = (title, author) => ({ id: title === 'Olhos Vazios' ? 'exact' : `other-${title.length}`, volumeInfo: {
  title, authors:[author],language:'pt',publishedDate:'2024-01-01',publisher:'Faro Editorial',
  imageLinks:{thumbnail:'https://books.google.com/books/content?id=sample'},
} });
const request = (kind,query) => new Request('https://example.test/functions/v1/catalog', {
 method:'POST',headers:{origin:'https://livrosfilmesgabriel.netlify.app', authorization:'Bearer example-token', 'content-type':'application/json'},
 body:JSON.stringify({action:'search',kind,query}),
});

test('busca complementar por título encontra Olhos Vazios quando busca ampla só traz livros irrelevantes', async()=>{
  const urls=[];
  const fetchFake=async input=>{
    const u=new URL(String(input));urls.push(u.toString());
    if(u.pathname==='/auth/v1/user')return jsonResponse({id:'user1'});
    if(u.hostname==='www.googleapis.com'){
      assert.equal(u.searchParams.get('key'),'fake_books_key');
      return jsonResponse({items:u.searchParams.get('q')?.startsWith('intitle:') ? [entry('Olhos Vazios','Charlie Donlea')] : [entry('O comitê da morte','Noel'),entry('Seu par de olhos vazios','Outro')]});
    }
    if(u.hostname==='openlibrary.org')return jsonResponse({docs:[]});
    throw Error('URL externa não esperada: '+u);
  };
  const handler=loadEdge(fetchFake);
  const response=await handler(request('book','Olhos Vazios'));
  assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.results[0].title,'Olhos Vazios');
  assert.equal(body.results[0].creator,'Charlie Donlea');
  assert.ok(urls.some(u=>u.includes('intitle%3A')));
});

test('livros exatos na busca original não exigem uma chamada extra ao Google', async()=>{
  let requests=0;
  const handler=loadEdge(async input=>{
    const url=new URL(String(input));
    if(url.pathname==='/auth/v1/user')return jsonResponse({id:'user1'});
    if(url.hostname==='www.googleapis.com'){requests++;return jsonResponse({items:[entry('Jantar Secreto','Raphael Montes')]});}
    if(url.hostname==='openlibrary.org')return jsonResponse({docs:[]});
    throw Error('URL: '+url);
  });
  const response=await handler(request('book','Jantar Secreto'));
  assert.equal(response.status,200);assert.equal(requests,1);
});

test('filmes continuam consultando TMDB sem tocar no Google Books', async()=>{
  const called=[];
  const handler=loadEdge(async input=>{
    const url=new URL(String(input));called.push(url.hostname);
    if(url.pathname==='/auth/v1/user')return jsonResponse({id:'user1'});
    if(url.hostname==='api.themoviedb.org')return jsonResponse({results:[]});
    throw Error('Outra API foi acessada: '+url);
  });
  const response=await handler(request('movie','Clube da Luta'));
  assert.equal(response.status,200);
  assert.deepEqual(called,['supabase.test','api.themoviedb.org']);
});
