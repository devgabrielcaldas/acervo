import {googleBooksResults,mergeGoogleAndOpenLibrary,openLibraryResults,portugueseWorkEdition,tmdbDetail,tmdbResults,validateCoverUrl} from './catalog-utils.ts';
import type {CatalogResult,MediaKind} from './catalog-utils.ts';

const DEFAULT_ORIGINS=['http://localhost:5173','http://127.0.0.1:5173','https://livrosfilmesgabriel.netlify.app'];
const ORIGINS=new Set([...DEFAULT_ORIGINS,...(Deno.env.get('ACERVO_ALLOWED_ORIGINS')??'').split(',').map(s=>s.trim()).filter(Boolean)]);
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')??'';
const SUPABASE_API_KEY=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??'';
const TMDB_TOKEN=Deno.env.get('TMDB_READ_ACCESS_TOKEN')??'';
const VERSION='catalog-v1';

function cors(origin:string|null): HeadersInit {
  return {'Access-Control-Allow-Origin':origin&&ORIGINS.has(origin)?origin:'null',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
}
function json(body:unknown,status:number,origin:string|null):Response {
  return new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
async function getJson(url:URL,headers?:HeadersInit):Promise<unknown> {
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(9500),redirect:'error'});
  if (!response.ok) throw new Error(`O catálogo respondeu ${response.status}.`);
  const len=Number(response.headers.get('content-length')??0);
  if (len>2_000_000) throw new Error('Resposta do catálogo acima do limite.');
  const body=await response.text();
  if(body.length>2_000_000) throw new Error('Resposta do catálogo acima do limite.');
  return JSON.parse(body) as unknown;
}
function tmdb(path:string):URL {const url=new URL(`https://api.themoviedb.org/3/${path}`);url.searchParams.set('language','pt-BR');return url;}
function tmdbHeaders():HeadersInit {if(!TMDB_TOKEN) throw new Error('Configure TMDB_READ_ACCESS_TOKEN no Supabase para buscar filmes e séries.');return {'Authorization':`Bearer ${TMDB_TOKEN}`,'Accept':'application/json'};}
async function search(kind:MediaKind,query:string):Promise<{results:CatalogResult[];warnings:string[]}> {
  if(kind!=='book') {
    const url=tmdb(`search/${kind==='movie'?'movie':'tv'}`);
    url.searchParams.set('query',query);url.searchParams.set('include_adult','false');if(kind==='movie')url.searchParams.set('region','BR');
    const data=await getJson(url,tmdbHeaders());return {results:tmdbResults(data,kind),warnings:[]};
  }
  const books=new URL('https://www.googleapis.com/books/v1/volumes');
  books.searchParams.set('q',`intitle:"${query}"`);
  books.searchParams.set('langRestrict','pt');
  books.searchParams.set('country','BR');
  books.searchParams.set('maxResults','15');
  books.searchParams.set('printType','books');
  const fields='key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,editions,editions.key,editions.title,editions.language,editions.cover_i,editions.publish_date,editions.number_of_pages,editions.isbn_13';
  const open=new URL('https://openlibrary.org/search.json');
  open.searchParams.set('title',query);
  open.searchParams.set('lang','pt');
  open.searchParams.set('limit','6');
  open.searchParams.set('fields',fields);
  // O parâmetro lang=pt sozinho NÃO exclui edições estrangeiras. O filtro
  // language:por recupera trabalhos que também possuem edições em português.
  const openPt=new URL('https://openlibrary.org/search.json');
  openPt.searchParams.set('q',`title:"${query.replace(/"/g,'')}" language:por`);
  openPt.searchParams.set('lang','pt');
  openPt.searchParams.set('limit','6');
  openPt.searchParams.set('fields',fields);
  const headers={'User-Agent':'AcervoCatalog/1.1 (personal reading collection)'};
  const [a,b,c]=await Promise.allSettled([getJson(books),getJson(open,headers),getJson(openPt,headers)]);
  const warnings:string[]=[];
  if(a.status==='rejected')warnings.push('Google Books indisponível.');
  if(b.status==='rejected'&&c.status==='rejected')warnings.push('Open Library indisponível.');
  if(a.status==='rejected'&&b.status==='rejected'&&c.status==='rejected')throw new Error('Não foi possível consultar os catálogos de livros agora. Tente novamente mais tarde.');
  const google=a.status==='fulfilled'?googleBooksResults(a.value):[];
  const olpt=c.status==='fulfilled'?openLibraryResults(c.value):[];
  const ol=b.status==='fulfilled'?openLibraryResults(b.value):[];
  // Se a busca foi pelo título original, localizar o título da edição portuguesa
  // no conjunto de edições da obra, em vez de inventar uma tradução.
  const unresolved=[...olpt,...ol].filter(x=>x.language!=='pt').slice(0,2);
  if (!google.some(x=>x.language==='pt') && ![...olpt,...ol].some(x=>x.language==='pt') && unresolved.length) {
    const resolved=await Promise.allSettled(unresolved.map(async item=>{
      const u=new URL(`https://openlibrary.org/works/${item.id}/editions.json`);
      u.searchParams.set('limit','100');
      return portugueseWorkEdition(await getJson(u,headers),item);
    }));
    for(const value of resolved)if(value.status==='fulfilled'&&value.value)olpt.unshift(value.value);
  }
  const results=mergeGoogleAndOpenLibrary(google,[...olpt,...ol]);
  if (results.length && !results.some(x=>x.language==='pt')) {
    warnings.push('Não foi encontrada uma edição em português para essa pesquisa. Confira o título antes de selecionar ou cadastre manualmente.');
  }
  return {results,warnings};
}
async function details(kind:MediaKind,selected:CatalogResult):Promise<CatalogResult> {
  if(kind==='book') return selected;
  if(selected.source!=='tmdb'||!/^\d{1,12}$/.test(selected.id))throw new Error('Resultado inválido.');
  const url=tmdb(`${kind==='movie'?'movie':'tv'}/${selected.id}`);
  if(kind==='movie')url.searchParams.set('append_to_response','credits');
  const data=await getJson(url,tmdbHeaders());
  return {...selected,...tmdbDetail(data,kind)};
}
async function imageDownload(input:unknown,origin:string|null):Promise<Response> {
  let url=validateCoverUrl(input);
  if(!url) return json({error:'Endereço da capa não permitido.'},400,origin);
  let result:Response|undefined;
  for(let redirect=0;redirect<3;redirect++) {
    result=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'AcervoCatalog/1.0'}});
    if(result.status>=300&&result.status<400) {
      const next=result.headers.get('location');
      if(!next) return json({error:'Redirecionamento sem destino.'},502,origin);
      url=validateCoverUrl(new URL(next,url).toString());
      if(!url) return json({error:'Redirecionamento bloqueado.'},400,origin);
      continue;
    }
    break;
  }
  if(!result||!result.ok)return json({error:'Capa indisponível no catálogo.'},502,origin);
  const type=(result.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Formato de imagem não suportado.'},422,origin);
  const reader=result.body?.getReader();
  if(!reader)return json({error:'Imagem sem conteúdo.'},502,origin);
  const buffers:Uint8Array[]=[];let total=0;
  while(true) {
    const {value,done}=await reader.read();if(done)break;
    total+=value.length;if(total>6*1024*1024){await reader.cancel();return json({error:'Imagem maior que 6 MB.'},413,origin);}
    buffers.push(value);
  }
  if(total===0)return json({error:'Imagem vazia.'},422,origin);
  const output=new Uint8Array(total);let offset=0;for(const chunk of buffers){output.set(chunk,offset);offset+=chunk.length;}
  return new Response(output,{status:200,headers:{...cors(origin),'Content-Type':type,'Cache-Control':'private, max-age=300'}});
}

Deno.serve(async(request:Request)=>{
  const origin=request.headers.get('origin');
  if(origin&&!ORIGINS.has(origin))return json({error:'Origem não permitida.'},403,origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='POST')return json({error:'Método inválido.'},405,origin);
  const authorization=request.headers.get('authorization')??'';
  if(!/^Bearer [\w.-]+$/.test(authorization))return json({error:'Entre no Acervo para pesquisar.'},401,origin);
  if(!SUPABASE_URL||!SUPABASE_API_KEY)return json({error:'Autenticação da função não configurada.'},500,origin);
  try {
    // Validação independente da plataforma: com verify_jwt=false, todo pedido é validado pelo Auth.
    const session=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:SUPABASE_API_KEY},signal:AbortSignal.timeout(6000)});
    if(!session.ok)return json({error:'Sessão inválida. Entre novamente no Acervo.'},401,origin);
    const body=await request.text();
    if(body.length>5000)return json({error:'Pesquisa muito longa.'},413,origin);
    let parsed:Record<string,unknown>;
    try{parsed=JSON.parse(body) as Record<string,unknown>;}catch{return json({error:'JSON inválido.'},400,origin);}
    const action=parsed.action;
    if(action==='image')return await imageDownload(parsed.url,origin);
    const kind=parsed.kind;
    if(kind!=='book'&&kind!=='movie'&&kind!=='series')return json({error:'Categoria inválida.'},400,origin);
    if(action==='search'){
      const query=typeof parsed.query==='string'?parsed.query.trim():'';
      if(query.length<3||query.length>100)return json({error:'Digite entre 3 e 100 caracteres.'},400,origin);
      const results=await search(kind,query);
      return json({...results,version:VERSION},200,origin);
    }
    if(action==='details'){
      const selected=parsed.selected;
      if(!selected||typeof selected!=='object'||Array.isArray(selected))return json({error:'Resultado inválido.'},400,origin);
      const s=selected as CatalogResult;
      if(s.kind!==kind||typeof s.id!=='string'||typeof s.title!=='string'||s.title.length>250||
        !['tmdb','google-books','open-library'].includes(s.source)||!Array.isArray(s.genres))return json({error:'Resultado inválido.'},400,origin);
      if(kind==='book'&&!(s.source==='google-books'&&/^[\w-]{1,80}$/.test(s.id)||s.source==='open-library'&&/^OL\d+W$/.test(s.id)))return json({error:'Identificador inválido.'},400,origin);
      return json({item:await details(kind,s)},200,origin);
    }
    return json({error:'Ação inválida.'},400,origin);
  } catch(error) {
    return json({error:error instanceof Error?error.message:'Falha ao consultar os catálogos.'},502,origin);
  }
});
