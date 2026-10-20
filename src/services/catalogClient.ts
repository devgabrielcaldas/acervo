import { requireSupabase } from '../lib/supabase';

export type CatalogKind = 'book' | 'movie' | 'series';
export type CatalogSource = 'google-books' | 'open-library' | 'tmdb';
export interface CatalogItem {
  source: CatalogSource;
  id: string;
  kind: CatalogKind;
  title: string;
  creator?: string;
  year?: number;
  genres: string[];
  pages?: number;
  durationMinutes?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  coverUrl?: string;
  coverFallbackUrl?: string;
  edition?: string;
  language?: string;
}
interface SearchResponse { results: CatalogItem[]; warnings?: string[] }

async function messageFromError(error: unknown, fallback: string): Promise<never> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as {context?:unknown}).context;
    if (context instanceof Response) {
      try {
        const data = await context.clone().json() as {error?:string};
        if (data?.error) throw new Error(data.error);
      } catch (reason) { if (reason instanceof Error && reason.message !== 'Unexpected end of JSON input' && !reason.message.includes('JSON')) throw reason; }
    }
  }
  throw new Error(error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback);
}

export async function searchCatalog(kind: CatalogKind, query: string): Promise<SearchResponse> {
  const { data, error } = await requireSupabase().functions.invoke('catalog', { body:{action:'search',kind,query} });
  if (error) return messageFromError(error, 'Não foi possível pesquisar o catálogo.');
  const result=data as SearchResponse;
  if(!Array.isArray(result?.results))throw new Error('O catálogo retornou dados inválidos.');
  return result;
}
export async function loadCatalogDetails(item: CatalogItem): Promise<CatalogItem> {
  const {data,error}=await requireSupabase().functions.invoke('catalog',{body:{action:'details',kind:item.kind,selected:item}});
  if(error)return messageFromError(error,'Não foi possível carregar os detalhes.');
  const loaded=(data as {item?:CatalogItem})?.item;
  if(!loaded||loaded.kind!==item.kind)throw new Error('A resposta do catálogo está incompleta.');
  return loaded;
}
/**
 * As Edge Functions devolvem a capa com Content-Type image/jpeg, image/png ou
 * image/webp. O supabase-js functions.invoke() interpreta essas respostas como
 * texto, não como Blob (só application/octet-stream recebe tratamento binário).
 * Para capas usamos fetch() autenticado na MESMA Edge Function, preservando
 * CORS, validação de sessão, lista segura de provedores e bloqueio de SSRF.
 */
const COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_COVER_BYTES = 6 * 1024 * 1024;

function validImageHeader(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes.length >= 8 && signature.every((byte, index) => bytes[index] === byte);
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

async function downloadImage(url: string, accessToken: string): Promise<File> {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!projectUrl || !publishableKey) {
    throw new Error('As variáveis públicas do Supabase não estão configuradas.');
  }

  // Não acessar URLs externas diretamente: toda imagem passa pela Edge Function.
  const response = await fetch(`${projectUrl}/functions/v1/catalog`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'image', url }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    let description = `O provedor não disponibilizou a capa (HTTP ${response.status}).`;
    try {
      const payload: unknown = await response.json();
      if (payload && typeof payload === 'object' && 'error' in payload &&
        typeof payload.error === 'string') description = payload.error;
    } catch { /* Alguns erros da rede não devolvem JSON. */ }
    throw new Error(description);
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!COVER_TYPES.has(mimeType)) {
    throw new Error('A fonte retornou conteúdo que não é uma imagem JPG, PNG ou WebP.');
  }
  const declaredSize = Number(response.headers.get('content-length'));
  if (declaredSize > MAX_COVER_BYTES) throw new Error('A capa excede o limite de 6 MB.');

  const blob = await response.blob();
  if (blob.size < 500 || blob.size > MAX_COVER_BYTES) {
    throw new Error('A capa retornou vazia, incompleta ou acima de 6 MB.');
  }
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (!validImageHeader(bytes, mimeType)) {
    throw new Error('O catálogo retornou um arquivo que não é uma imagem válida.');
  }
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `capa-catalogo.${extension}`, { type: mimeType });
}

/** Retenta a alternativa segura do catálogo sem alterar a capa já existente. */
export async function downloadCatalogCover(url: string, fallbackUrl?: string): Promise<File> {
  const candidates = [...new Set([url, fallbackUrl].filter((value): value is string => Boolean(value?.trim())))];
  if (!candidates.length) throw new Error('Esta edição não possui capa no catálogo.');

  const { data, error } = await requireSupabase().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Sua sessão expirou. Entre novamente no Acervo para baixar capas.');
  }

  let lastError = 'Não foi possível acessar a capa.';
  for (const candidate of candidates) {
    try {
      return await downloadImage(candidate, data.session.access_token);
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(`${lastError} Você pode selecionar outra edição ou enviar uma capa manualmente.`);
}
