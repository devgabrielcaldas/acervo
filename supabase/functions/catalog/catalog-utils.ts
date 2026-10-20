/** Normalização dos catálogos — prioriza edições efetivamente publicadas em português. */
export type MediaKind = 'book' | 'movie' | 'series';
export type CatalogSource = 'google-books' | 'open-library' | 'tmdb';
export interface CatalogResult {
  source: CatalogSource;
  id: string;
  kind: MediaKind;
  title: string;
  creator?: string;
  year?: number;
  genres: string[];
  pages?: number;
  durationMinutes?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  coverUrl?: string;
  /** Alternativa segura para a capa da mesma edição/ISBN, se existir. */
  coverFallbackUrl?: string;
  edition?: string;
  /** Idioma da edição escolhida, não do título original da obra. */
  language?: string;
}

function text(value: unknown): string { return typeof value === 'string' ? value.trim().slice(0, 250) : ''; }
function names(value: unknown, limit = 3): string[] { return Array.isArray(value) ? value.map(text).filter(Boolean).slice(0, limit) : []; }
function integer(value: unknown): number | undefined { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined; }
function year(value: unknown): number | undefined {
  const match = typeof value === 'string' ? /(?:^|\D)((?:1[6-9]|20|21)\d{2})(?:\D|$)/.exec(value) : null;
  const parsed = match ? Number(match[1]) : undefined;
  return parsed && parsed <= new Date().getFullYear() + 5 ? parsed : undefined;
}
function secureImage(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  try {
    const url = new URL(input.replace(/^http:\/\//, 'https://'));
    if (url.protocol !== 'https:' || !['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org', 'image.tmdb.org'].includes(url.hostname) || url.port || url.username || url.password) return undefined;
    return url.toString();
  } catch { return undefined; }
}
export function validateCoverUrl(input: unknown): URL | null {
  const value = secureImage(input);
  if (!value) return null;
  const url = new URL(value);
  if (url.hostname === 'image.tmdb.org' && !/^\/t\/p\/(w\d+|original)\/[\w.\-/]+$/.test(url.pathname)) return null;
  if (url.hostname === 'covers.openlibrary.org' && !/^\/b\/(id|isbn|olid)\/[\w-]+(?:-[SML])?\.(jpg|png)$/.test(url.pathname)) return null;
  if (url.hostname === 'books.google.com' && url.pathname !== '/books/content') return null;
  return url;
}
function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}
/** Nunca preencher o campo Gêneros com personagens, objetos ou assuntos específicos. */
export function portugueseGenres(values: unknown): string[] {
  const incoming = names(values, 14);
  const rules: {pattern: RegExp; value: string}[] = [
    {pattern:/psychological (thriller|suspense)|suspense psicol[oó]gico/,value:'Suspense psicológico'},
    {pattern:/thriller|suspense|tension/,value:'Suspense'},
    {pattern:/detective|mystery|mist[eé]rio|policial/,value:'Mistério'},
    {pattern:/fantasy|fantasia|magic|witchcraft|wizard|feiti[çc]|magia/,value:'Fantasia'},
    {pattern:/horror|terror|supernatural|sobrenatural/,value:'Terror'},
    {pattern:/science fiction|sci.fi|fic[çc][ãa]o cient[ií]fica/,value:'Ficção científica'},
    {pattern:/romance|love stor|amor/,value:'Romance'},
    {pattern:/young adult|juvenile|children|infantojuvenil|juvenil/,value:'Infantojuvenil'},
    {pattern:/biograph|biografia/,value:'Biografia'},
    {pattern:/historical|hist[oó]ric/,value:'Ficção histórica'},
    {pattern:/crime|criminal/,value:'Policial'},
    {pattern:/adventure|aventura/,value:'Aventura'},
    {pattern:/drama/,value:'Drama'},
    {pattern:/fiction|fic[çc][ãa]o/,value:'Ficção'},
    {pattern:/non.fiction|n[ãa]o fic[çc][ãa]o/,value:'Não ficção'},
  ];
  const result: string[] = [];
  for (const raw of incoming) {
    const term = normalized(raw);
    for (const {pattern,value} of rules) {
      if (pattern.test(term) && !result.includes(value)) result.push(value);
    }
    if (result.length >= 4) break;
  }
  // Termos desconhecidos não são gêneros confiáveis. Deixar vazio é melhor que
  // cadastrar 'the Elder Wand', 'dementors' ou nomes de personagens.
  return result.slice(0, 4);
}
function lang(value: unknown): string | undefined {
  const raw = text(value).toLowerCase();
  return raw === 'por' || raw === 'pt' || raw === 'pt-br' ? 'pt' : raw || undefined;
}
export function googleBooksResults(data: unknown): CatalogResult[] {
  const items = (data as {items?: unknown[]})?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap(raw => {
    const entry = raw as {id?: unknown; volumeInfo?: Record<string,unknown>};
    const info = entry?.volumeInfo ?? {};
    const title = text(info.title), id = text(entry?.id);
    if (!title || !id || !/^[\w-]{1,80}$/.test(id)) return [];
    const language = lang(info.language);
    const links = (info.imageLinks ?? {}) as Record<string,unknown>;
    const googleCover = secureImage(links.extraLarge ?? links.large ?? links.medium ?? links.small ?? links.thumbnail ?? links.smallThumbnail);
    const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers as Record<string, unknown>[] : [];
    const isbn = identifiers.map(entry => text(entry.identifier).replace(/[-\s]/g, '')).find(value => /^\d{13}$/.test(value)) ??
      identifiers.map(entry => text(entry.identifier).replace(/[-\s]/g, '')).find(value => /^\d{9}[0-9X]$/.test(value));
    const isbnCover = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : undefined;
    const coverUrl = googleCover ?? isbnCover;
    const coverFallbackUrl = googleCover ? isbnCover : undefined;
    return [{ source:'google-books' as const, id, kind:'book' as const, title,
      creator:names(info.authors,5).join(', ') || undefined,year:year(info.publishedDate),
      pages:integer(info.pageCount),genres:portugueseGenres(info.categories),coverUrl,coverFallbackUrl,language,
      edition:[text(info.publisher),text(info.publishedDate),language==='pt'?'Edição em português':language?'Edição estrangeira · confira idioma':'Idioma não informado'].filter(Boolean).join(' · ') }];
  });
}
function editionsOf(doc: Record<string,unknown>): Record<string,unknown>[] {
  const data=(doc.editions ?? {}) as {docs?:unknown[]};
  return Array.isArray(data.docs) ? data.docs.filter((x):x is Record<string,unknown>=>typeof x==='object'&&x!==null) : [];
}
function editionLanguage(value: unknown): string | undefined {
  if (typeof value === 'string') return lang(value);
  if (Array.isArray(value)) {
    for (const x of value) {
      if (typeof x === 'object' && x !== null && 'key' in x && typeof x.key === 'string') {
        const language=lang(x.key.split('/').pop());
        if(language==='pt')return 'pt';
      }
      const language=lang(x);
      if(language==='pt')return 'pt';
    }
  }
  return undefined;
}
function editionCover(entry: Record<string,unknown>): string | undefined {
  const covers=Array.isArray(entry.covers)?entry.covers:[];
  const c=integer(covers[0]) ?? integer(entry.cover_i);
  if (c) return `https://covers.openlibrary.org/b/id/${c}-L.jpg?default=false`;
  const isbns=Array.isArray(entry.isbn_13)?entry.isbn_13: Array.isArray(entry.isbn_10)?entry.isbn_10:[];
  const isbn=isbns.find(x=>typeof x==='string'&&/^\d{10}(\d{3})?$/.test(x));
  if(typeof isbn==='string')return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  return undefined;
}
export function openLibraryResults(data: unknown): CatalogResult[] {
  const docs = (data as {docs?:unknown[]})?.docs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap(raw => {
    const doc=raw as Record<string,unknown>;
    const id=text(doc.key).split('/').pop()??'';
    if (!/^OL\d+W$/.test(id) || !text(doc.title)) return [];
    const editions=editionsOf(doc);
    const ptEdition=editions.find(e=>editionLanguage(e.language)==='pt');
    const candidate=ptEdition??editions[0];
    const editionTitle=text(candidate?.title);
    const portuguese=Boolean(ptEdition) || (!editions.length && text(doc.language)==='por');
    const coverUrl=editionCover(candidate??{}) ?? editionCover(doc);
    const alt=editionCover(doc);
    const coverFallbackUrl=coverUrl!==alt?alt:undefined;
    const publishYear=integer(doc.first_publish_year);
    return [{source:'open-library' as const,id,kind:'book' as const,
      title:editionTitle || text(doc.title),creator:names(doc.author_name,5).join(', ')||undefined,
      year:year(candidate?.publish_date)??(publishYear&&publishYear>=1450&&publishYear<=new Date().getFullYear()+5?publishYear:undefined),
      pages:integer(candidate?.number_of_pages)??integer(doc.number_of_pages_median),
      genres:portugueseGenres(doc.subject),coverUrl,coverFallbackUrl,language:portuguese?'pt':editionLanguage(candidate?.language),
      edition:portuguese?'Edição em português · confira publicação brasileira':'Ano original/edição não confirmada · verifique idioma'}];
  });
}
/** Converte uma edição de /works/{id}/editions.json em resultado com título traduzido, se houver. */
export function portugueseWorkEdition(data: unknown, work: CatalogResult): CatalogResult | undefined {
  if(work.source!=='open-library'||!/^OL\d+W$/.test(work.id))return undefined;
  const entries=(data as {entries?:unknown[]})?.entries;
  if(!Array.isArray(entries))return undefined;
  const pt=entries.filter((x):x is Record<string,unknown> => typeof x==='object'&&x!==null&&editionLanguage((x as Record<string,unknown>).languages)==='pt');
  if(!pt.length)return undefined;
  // Uma capa da própria edição em português é preferível à capa da obra original.
  pt.sort((a,b)=>Number(Boolean(editionCover(b)))-Number(Boolean(editionCover(a))));
  const edition=pt[0];
  const title=text(edition.title);
  if(!title)return undefined;
  return {...work,title,language:'pt',year:year(edition.publish_date)??work.year,
    pages:integer(edition.number_of_pages)??work.pages,
    coverUrl:editionCover(edition)??work.coverUrl,
    coverFallbackUrl:editionCover(edition)&&work.coverUrl!==editionCover(edition)?work.coverUrl:work.coverFallbackUrl,
    edition:'Edição em português · confira publicação brasileira'};
}
export function tmdbResults(data: unknown, kind:'movie'|'series'): CatalogResult[] {
  const items=(data as {results?:unknown[]})?.results;
  if(!Array.isArray(items))return [];
  return items.flatMap(raw=>{
    const info=raw as Record<string,unknown>;
    const id=integer(info.id),title=text(info.title??info.name);
    if(!id||!title)return [];
    const poster=text(info.poster_path);
    return [{source:'tmdb' as const,id:String(id),kind,title,genres:[],year:year(info.release_date??info.first_air_date),
      coverUrl:/^\/[\w-]+\.(jpg|png|webp)$/.test(poster)?`https://image.tmdb.org/t/p/w500${poster}`:undefined,
      edition:kind==='movie'?'Filme · TMDB':'Série · TMDB'}];
  });
}
export function tmdbDetail(data: unknown, kind:'movie'|'series'): Partial<CatalogResult> {
  const info=(data??{}) as Record<string,unknown>;
  const genres=Array.isArray(info.genres)?info.genres.map((x:unknown)=>text((x as Record<string,unknown>)?.name)).filter(Boolean).slice(0,5):[];
  const credits=(info.credits??{}) as {crew?:unknown[]};
  const director=Array.isArray(credits.crew)?credits.crew.find(x=>(x as {job?:string})?.job==='Director') as {name?:string}|undefined:undefined;
  const poster=text(info.poster_path);
  return {genres,creator:kind==='movie'?text(director?.name)||undefined:undefined,
    durationMinutes:kind==='movie'?integer(info.runtime):undefined,
    totalSeasons:kind==='series'?integer(info.number_of_seasons):undefined,
    totalEpisodes:kind==='series'?integer(info.number_of_episodes):undefined,
    year:year(info.release_date??info.first_air_date),
    coverUrl:/^\/[\w-]+\.(jpg|png|webp)$/.test(poster)?`https://image.tmdb.org/t/p/w500${poster}`:undefined};
}
export function mergeGoogleAndOpenLibrary(google: CatalogResult[], open: CatalogResult[]): CatalogResult[] {
  const result:CatalogResult[]=[];
  const seen=new Set<string>();
  const source=[...google,...open];
  // Dê destaque às edições portuguesas, sem esconder completamente a edição original.
  source.sort((a,b)=>Number(b.language==='pt')-Number(a.language==='pt') ||
    Number(Boolean(b.coverUrl))-Number(Boolean(a.coverUrl)) || (a.source==='google-books'?-1:1));
  for(const item of source){
    const key=item.source==='google-books'?`google:${item.id}`:`open-library:${item.id}`;
    if (seen.has(key) || (item.source==='open-library' && google.some(g=>normalized(g.title)===normalized(item.title) && normalized(g.creator??'')===normalized(item.creator??'') && (g.language==='pt'||item.language!=='pt')))) continue;
    seen.add(key);result.push(item);
    if(result.length>=15)break;
  }
  return result;
}
