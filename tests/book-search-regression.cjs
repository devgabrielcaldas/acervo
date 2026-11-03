const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.join(__dirname, '../supabase/functions/catalog');
const transpile = name => ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{
  fileName:name,reportDiagnostics:true, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
});
function load(name, context, imports={}) {
  const out=transpile(name);
  assert.equal(out.diagnostics?.filter(x=>x.category===1).length??0,0);
  const module={exports:{}};
  vm.runInNewContext(out.outputText,{...context,module,exports:module.exports,require:id=>{
    if(!(id in imports))throw Error('Unknown import '+id);
    return imports[id];
  }},{filename:name});
  return module.exports;
}
const globals={URL,URLSearchParams,Request,Response,Headers,AbortSignal,Uint8Array,Date,Set,Promise,JSON,String,Array,Number,RegExp,Object,TextEncoder,TextDecoder,console};
const utils=load('catalog-utils.ts',globals);
const tests={};
function setup(fetchMock){
  let handle;
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'publishable-key',TMDB_READ_ACCESS_TOKEN:'tmdb-test-key'};
  const Deno={env:{get:k=>env[k]},serve:fn=>{handle=fn;}};
  const calls=[];
  load('index.ts',{...globals,Deno,fetch:async(input,opts)=>{
    const url=new URL(String(input));calls.push(url);
    if(url.pathname==='/auth/v1/user')return Response.json({id:'test-user'});
    return fetchMock(url,opts);
  }},{'./catalog-utils.ts':utils});
  const query=async(kind,q)=>{
    const resp=await handle(new Request('https://example.supabase.co/functions/v1/catalog',{
      method:'POST',headers:{origin:'https://livrosfilmesgabriel.netlify.app',authorization:'Bearer foo.bar.baz'},
      body:JSON.stringify({action:'search',kind,query:q})
    }));
    return {status:resp.status,body:await resp.json(),calls};
  };
  return query;
}
const bookItem=(name,lang='pt')=>({items:[{id:'B00TEST',volumeInfo:{title:name,language:lang,authors:['Autor'],publishedDate:'2024-01-01'}}]});
const olItem=(name)=>({docs:[{key:'/works/OL9999W',title:name,author_name:['Autor'],language:['por'],cover_i:1001,first_publish_year:2022}]});

test('Google Books: texto livre, sem country=BR ou operadores quebrados; preserva acentos',async()=>{
  const request=setup(async url=>{
    if(url.hostname==='www.googleapis.com')return Response.json(bookItem('A Última Casa da Rua Needless'));
    if(url.hostname==='openlibrary.org')return Response.json({docs:[]});
    throw new Error('Unexpected '+url);
  });
  const res=await request('book','A última casa da rua needless');
  assert.equal(res.status,200);
  assert.equal(res.body.results[0].title,'A Última Casa da Rua Needless');
  const google=res.calls.find(url=>url.hostname==='www.googleapis.com');
  assert.equal(google.searchParams.get('q'),'A última casa da rua needless');
  assert.equal(google.searchParams.get('country'),null);
  assert.doesNotMatch(google.search,/intitle|isbn%3A/i);
});

test('se Google Books responder 503, retorna resultados da Open Library sem falhar',async()=>{
  const request=setup(async url=>{
    if(url.hostname==='www.googleapis.com')return Response.json({error:'backend failed'},{status:503});
    if(url.hostname==='openlibrary.org'&&url.pathname==='/search.json')return Response.json(olItem('Nós Já Moramos Aqui'));
    if(url.hostname==='openlibrary.org'&&url.pathname.endsWith('/editions.json'))return Response.json({entries:[]});
    throw Error('Unexpected '+url);
  });
  const res=await request('book','Nós já moramos aqui');
  assert.equal(res.status,200);
  assert.equal(res.body.results[0].title,'Nós Já Moramos Aqui');
  assert(res.body.warnings.some(w=>w.includes('Google Books')));
});

test('ISBN 10 usa busca ISBN na Open Library e texto livre no Google',async()=>{
  const request=setup(async url=>{
    if(url.hostname==='www.googleapis.com')return Response.json({items:[]});
    if(url.hostname==='openlibrary.org'&&url.pathname==='/search.json')return Response.json(olItem('A Última Casa da Rua Needless'));
    return Response.json({entries:[]});
  });
  const res=await request('book','6556220469');
  assert.equal(res.status,200);
  assert(res.body.results.length>0);
  const google=res.calls.find(x=>x.hostname==='www.googleapis.com');
  const open=res.calls.find(x=>x.hostname==='openlibrary.org');
  assert.equal(google.searchParams.get('q'),'6556220469');
  assert.equal(open.searchParams.get('q'),'isbn:6556220469');
});

test('se fontes principais retornarem vazio, tenta busca ampla e preferência pt',async()=>{
  const request=setup(async url=>{
    if(url.hostname==='www.googleapis.com')return Response.json({items:url.searchParams.get('langRestrict')==='pt'?bookItem('A Paciente Silenciosa').items:[]});
    if(url.hostname==='openlibrary.org'&&url.pathname==='/search.json')return Response.json({docs:[]});
    return Response.json({entries:[]});
  });
  const res=await request('book','A Paciente Silenciosa');
  assert.equal(res.status,200);
  assert.equal(res.body.results[0].title,'A Paciente Silenciosa');
  assert(res.calls.some(x=>x.hostname==='www.googleapis.com'&&x.searchParams.get('langRestrict')==='pt'));
  assert(res.calls.some(x=>x.hostname==='openlibrary.org'&&x.searchParams.has('q')));
});

test('quando ambos os catálogos falham retorna erro claro e não afeta TMDB',async()=>{
  const request=setup(async url=>{
    if(url.hostname==='api.themoviedb.org')return Response.json({results:[{id:111,title:'Filme de teste',poster_path:'/poster.jpg'}]});
    return Response.json({error:'unavailable'},{status:503});
  });
  const books=await request('book','Livro indisponível');
  assert.equal(books.status,502);
  assert.match(books.body.error,/dois catálogos/);
  const film=await request('movie','Filme de teste');
  assert.equal(film.status,200);
  assert.equal(film.body.results[0].title,'Filme de teste');
});

test('Google Books: URL builder usa apenas parâmetros oficiais',()=>{
  const x=utils.bookSearchPlan('  Jantar  Secreto  ');
  assert.equal(x.google.searchParams.get('q'),'Jantar Secreto');
  assert.equal(x.google.searchParams.get('country'),null);
  assert.equal(x.googlePt.searchParams.get('langRestrict'),'pt');
  assert.equal(x.open.searchParams.get('title'),'Jantar Secreto');
});


test('ISBN com índice vazio consulta diretamente a edição via /isbn/*.json',async()=>{
  const request=setup(async url=>{
    if(url.hostname==='www.googleapis.com')return Response.json({items:[]});
    if(url.hostname==='openlibrary.org'&&url.pathname==='/search.json')return Response.json({docs:[]});
    if(url.hostname==='openlibrary.org'&&url.pathname==='/isbn/6556220469.json')return Response.json({
      title:'A Última Casa da Rua Needless',publish_date:'2022',number_of_pages:320,
      languages:[{key:'/languages/por'}],works:[{key:'/works/OL12345W'}],covers:[12345]
    });
    throw Error('Unexpected '+url);
  });
  const res=await request('book','6556220469');
  assert.equal(res.status,200);
  assert.equal(res.body.results[0].title,'A Última Casa da Rua Needless');
  assert.equal(res.body.results[0].language,'pt');
  assert(res.calls.some(x=>x.pathname==='/isbn/6556220469.json'));
});
