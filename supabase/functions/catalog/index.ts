import {bookSearchPlan,googleBooksResults,mergeGoogleAndOpenLibrary,openLibraryResults,openLibraryIsbnEdition,portugueseWorkEdition,rankBookResults,tmdbDetail,tmdbResults,tmdbSeasonDetails,validateCoverUrl} from './catalog-utils.ts';
import type {CatalogResult,MediaKind} from './catalog-utils.ts';

const DEFAULT_ORIGINS=['http://localhost:5173','http://127.0.0.1:5173','https://livrosfilmesgabriel.netlify.app'];
const ORIGINS=new Set([...DEFAULT_ORIGINS,...(Deno.env.get('ACERVO_ALLOWED_ORIGINS')??'').split(',').map(s=>s.trim()).filter(Boolean)]);
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')??'';
const SUPABASE_API_KEY=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??'';
const GOOGLE_BOOKS_API_KEY =
  Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? '';
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

if (
  url.hostname === 'www.googleapis.com' &&
  url.pathname === '/books/v1/volumes' &&
  GOOGLE_BOOKS_API_KEY
) {
  url.searchParams.set('key', GOOGLE_BOOKS_API_KEY);
}

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
  const plan = bookSearchPlan(query);
  const headers = {'User-Agent': 'AcervoCatalog/1.2 (personal reading collection)'};
  // Duas chamadas principais: evita sobrecarregar provedores a cada busca.
  const [googleMain, openMain] = await Promise.allSettled([
    getJson(plan.google), getJson(plan.open, headers),
  ]);
  const warnings: string[] = [];
  let google = googleMain.status === 'fulfilled' ? googleBooksResults(googleMain.value) : [];
  let library = openMain.status === 'fulfilled' ? openLibraryResults(openMain.value) : [];
  let googleFailed = googleMain.status === 'rejected';
  let openFailed = openMain.status === 'rejected';

  // Se não há edição em português ou a busca é vazia, ampliar sem inventar títulos.
  // Nunca repetir a chamada que já falhou por limite de serviço.
  const needMore = ![...google,...library].some(item => item.language === 'pt') ||
    (google.length === 0 && library.length === 0);
  if (needMore) {
    const tasks: Promise<unknown>[] = [];
    const tags: ('google'|'open')[] = [];
    if (!googleFailed) { tasks.push(getJson(plan.googlePt)); tags.push('google'); }
    // Não repetir consultas idênticas (p. ex. certos ISBNs).
    if (!openFailed && plan.open.toString() !== plan.openBroad.toString()) {
      tasks.push(getJson(plan.openBroad, headers)); tags.push('open');
    }
    const extra = await Promise.allSettled(tasks);
    extra.forEach((result, index) => {
      if (result.status !== 'fulfilled') return;
      if (tags[index] === 'google') google = [...google,...googleBooksResults(result.value)];
      else library = [...library,...openLibraryResults(result.value)];
    });
  }

  if (googleMain.status === 'rejected') {
    console.warn('Busca de livros: Google Books falhou:', googleMain.reason instanceof Error ? googleMain.reason.message : 'erro desconhecido');
    warnings.push('Google Books temporariamente indisponível.');
  }
  if (openMain.status === 'rejected') {
    console.warn('Busca de livros: Open Library falhou:', openMain.reason instanceof Error ? openMain.reason.message : 'erro desconhecido');
    warnings.push('Open Library temporariamente indisponível.');
  }
  if (googleFailed && openFailed) {
    throw new Error('Os dois catálogos de livros não responderam. Tente novamente mais tarde.');
  }

  // Open Library pode ter apenas o título original; procurar a edição portuguesa.
  const toResolve = library.filter(item => item.language !== 'pt').slice(0, 2);
  if (![...google,...library].some(item => item.language === 'pt') && toResolve.length) {
    const editions = await Promise.allSettled(toResolve.map(async item => {
      const url = new URL(`https://openlibrary.org/works/${item.id}/editions.json`);
      url.searchParams.set('limit', '100');
      return portugueseWorkEdition(await getJson(url, headers), item);
    }));
    editions.forEach(result => {
      if (result.status === 'fulfilled' && result.value) library.unshift(result.value);
    });
  }
  let results = rankBookResults(mergeGoogleAndOpenLibrary(google, library), query);
  // Caso o ISBN não tenha sido encontrado na busca indexada, consultar a edição
  // diretamente na Open Library. Um 404 não invalida as outras fontes.
  if (!results.length && plan.isbn && !openFailed) {
    try {
      const direct = new URL(`https://openlibrary.org/isbn/${plan.isbn}.json`);
      const edition = openLibraryIsbnEdition(await getJson(direct, headers), plan.isbn);
      if (edition) results = [edition];
    } catch { /* Edição não catalogada ou provedor temporariamente indisponível. */ }
  }
  if (results.length && !results.some(item => item.language === 'pt')) {
    warnings.push('Não encontramos uma edição em português confirmada. Confira a edição antes de usar os dados.');
  }
  return {results, warnings};
}
async function details(kind:MediaKind,selected:CatalogResult):Promise<CatalogResult> {
  if(kind==='book') return selected;
  if(selected.source!=='tmdb'||!/^\d{1,12}$/.test(selected.id))throw new Error('Resultado inválido.');
  const url=tmdb(`${kind==='movie'?'movie':'tv'}/${selected.id}`);
  if(kind==='movie')url.searchParams.set('append_to_response','credits');
  const data=await getJson(url,tmdbHeaders());
  return {...selected,...tmdbDetail(data,kind)};
}
async function seasonDetails(tmdbId:number,seasonNumber:number) {
  if (!Number.isSafeInteger(tmdbId) || tmdbId < 1 || !Number.isSafeInteger(seasonNumber) || seasonNumber < 1 || seasonNumber > 100) throw new Error('Série ou temporada inválida.');
  const data=await getJson(tmdb(`tv/${tmdbId}/season/${seasonNumber}`),tmdbHeaders());
  return tmdbSeasonDetails(data,seasonNumber);
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
    if(action==='season') {
      if (kind!=='series') return json({error:'Temporada disponível apenas para séries.'},400,origin);
      const tmdbId=parsed.tmdbId,seasonNumber=parsed.seasonNumber;
      if (!Number.isSafeInteger(tmdbId) || (tmdbId as number)<1 || !Number.isSafeInteger(seasonNumber) || (seasonNumber as number)<1 || (seasonNumber as number)>100) return json({error:'ID ou temporada inválida.'},400,origin);
      return json({season:await seasonDetails(tmdbId as number,seasonNumber as number)},200,origin);
    }
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
