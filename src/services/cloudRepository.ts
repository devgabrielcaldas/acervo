import { authenticatedUserId, requireSupabase } from '../lib/supabase';
import type { AnnualGoal, CoverRecord, MediaRecord, StorageSummary } from '../types/media';

const BUCKET = 'acervo-covers';
function errorFrom(message: string, error: { message: string } | null) {
  if (error) throw new Error(`${message}: ${error.message}`);
}
function objectPath(uid: string, mediaId: string, token = 'current') {
  return `${uid}/${mediaId}-${token}.webp`;
}

type MediaRow = { id: string; data: MediaRecord };
type GoalRow = { year: number; data: AnnualGoal };
type CoverRow = { id: string; media_id: string; path: string; mime_type: string; width: number; height: number; saved_at: string };

async function paged<T>(table: 'acervo_media'|'acervo_goals'|'acervo_covers', cols: string): Promise<T[]> {
  const client = requireSupabase();
  const output: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client.from(table).select(cols).order(table === 'acervo_goals' ? 'year' : 'id', { ascending: true }).range(from, from + 499);
    errorFrom(`Não foi possível consultar ${table}`, error);
    const items = (data ?? []) as T[];
    output.push(...items);
    if (items.length < 500) return output;
    from += 500;
    if (output.length > 10000) throw new Error('Limite de registros excedido.');
  }
}

export async function cloudListMedia(): Promise<MediaRecord[]> {
  return (await paged<MediaRow>('acervo_media', 'id,data')).map((item) => item.data)
    .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function cloudGetMedia(id: string): Promise<MediaRecord | undefined> {
  const { data, error } = await requireSupabase().from('acervo_media').select('data').eq('id', id).maybeSingle();
  errorFrom('Erro ao carregar título', error);
  return (data?.data as MediaRecord | undefined);
}
export async function cloudSaveMedia(record: MediaRecord): Promise<MediaRecord> {
  const uid = await authenticatedUserId();
  const { error } = await requireSupabase().from('acervo_media').upsert({ id: record.id, user_id: uid, data: record }, {onConflict:'id'});
  errorFrom('Erro ao salvar título', error);
  return record;
}
export async function cloudDeleteMedia(id: string): Promise<void> {
  const { data: cover, error: coverErr } = await requireSupabase().from('acervo_covers').select('path').eq('media_id', id).maybeSingle();
  errorFrom('Erro ao localizar capa', coverErr);
  const { error } = await requireSupabase().from('acervo_media').delete().eq('id', id);
  errorFrom('Erro ao excluir título', error);
  if (cover?.path) {
    // Se a limpeza do arquivo falhar, o registro já estará excluído; a capa ficará órfã sem acesso público.
    await requireSupabase().storage.from(BUCKET).remove([cover.path]).catch(() => undefined);
  }
}
export async function cloudListGoals(): Promise<AnnualGoal[]> {
  return (await paged<GoalRow>('acervo_goals', 'year,data')).map((row) => row.data).sort((a,b) => b.year-a.year);
}
export async function cloudSaveGoal(goal: AnnualGoal): Promise<AnnualGoal> {
  const uid = await authenticatedUserId();
  const { error } = await requireSupabase().from('acervo_goals').upsert({ user_id: uid, year: goal.year, data: goal }, {onConflict:'user_id,year'});
  errorFrom('Erro ao salvar meta', error);
  return goal;
}
export async function cloudGetGoal(year: number): Promise<AnnualGoal | undefined> {
  const { data, error } = await requireSupabase().from('acervo_goals').select('data').eq('year', year).maybeSingle();
  errorFrom('Erro ao carregar meta', error);
  return data?.data as AnnualGoal | undefined;
}

export async function cloudCoverRows(): Promise<CoverRow[]> {
  return paged<CoverRow>('acervo_covers','id,media_id,path,mime_type,width,height,saved_at');
}
export async function cloudGetCover(mediaId: string): Promise<Blob | undefined> {
  const { data, error } = await requireSupabase().from('acervo_covers').select('path').eq('media_id',mediaId).maybeSingle();
  errorFrom('Erro ao procurar capa', error);
  if (!data?.path) return undefined;
  const result = await requireSupabase().storage.from(BUCKET).download(data.path);
  errorFrom('Erro ao carregar capa',result.error);
  return result.data ?? undefined;
}
export async function cloudSaveCover(mediaId: string, prepared: Pick<CoverRecord,'image'|'mimeType'|'width'|'height'>): Promise<CoverRecord> {
  const uid = await authenticatedUserId();
  const record = await cloudGetMedia(mediaId);
  if (!record) throw new Error('Cadastre o item antes da capa.');
  const previous = (await cloudCoverRows()).find((cover) => cover.media_id === mediaId);
  const cover: CoverRecord = { id: crypto.randomUUID(),mediaId,savedAt:new Date().toISOString(),...prepared };
  const path = objectPath(uid,mediaId,cover.id);
  const uploaded = await requireSupabase().storage.from(BUCKET).upload(path,prepared.image,{contentType:prepared.mimeType,upsert:false});
  errorFrom('Erro ao enviar capa',uploaded.error);
  try {
    const {error} = await requireSupabase().from('acervo_covers').upsert({
      id: cover.id,media_id:mediaId,user_id:uid,path,mime_type:cover.mimeType,width:cover.width,height:cover.height,saved_at:cover.savedAt,
    },{onConflict:'user_id,media_id'});
    errorFrom('Erro ao vincular capa',error);
    try {
      await cloudSaveMedia({ ...record,coverId:cover.id,updatedAt:new Date().toISOString() });
    } catch (writeError) {
      // Restaura os metadados anteriores se falhar a atualização do título.
      if (previous) {
        await requireSupabase().from('acervo_covers').upsert({
          id: previous.id, media_id: previous.media_id, user_id: uid, path: previous.path,
          mime_type: previous.mime_type, width: previous.width, height: previous.height, saved_at: previous.saved_at,
        }, { onConflict: 'user_id,media_id' });
      } else {
        await requireSupabase().from('acervo_covers').delete().eq('media_id',mediaId);
      }
      throw writeError;
    }
    if(previous?.path) await requireSupabase().storage.from(BUCKET).remove([previous.path]);
    return cover;
  } catch(err) {
    await requireSupabase().storage.from(BUCKET).remove([path]);
    throw err;
  }
}
export async function cloudRemoveCover(mediaId: string): Promise<void> {
  const record=await cloudGetMedia(mediaId);
  const {data,error}=await requireSupabase().from('acervo_covers').select('path').eq('media_id',mediaId).maybeSingle();
  errorFrom('Erro ao carregar capa',error);
  if(record) {
    const updated={...record};delete updated.coverId;
    await cloudSaveMedia({...updated,updatedAt:new Date().toISOString()});
  }
  const deleted=await requireSupabase().from('acervo_covers').delete().eq('media_id',mediaId);
  errorFrom('Erro ao remover capa',deleted.error);
  if(data?.path) await requireSupabase().storage.from(BUCKET).remove([data.path]);
}
export async function cloudSnapshot():Promise<{media:MediaRecord[];goals:AnnualGoal[];covers:CoverRecord[]}> {
  const [media,goals,metadata]=await Promise.all([cloudListMedia(),cloudListGoals(),cloudCoverRows()]);
  const covers:CoverRecord[]=[];
  for(const item of metadata) {
    const {data,error}=await requireSupabase().storage.from(BUCKET).download(item.path);
    errorFrom('Erro ao exportar capa',error);
    if(!data) throw new Error('Arquivo de capa não encontrado.');
    covers.push({id:item.id,mediaId:item.media_id,image:data,mimeType:item.mime_type,width:item.width,height:item.height,savedAt:item.saved_at});
  }
  return {media,goals,covers};
}
export async function cloudSummary():Promise<StorageSummary> {
  const [media,goals,covers]=await Promise.all([cloudListMedia(),cloudListGoals(),cloudCoverRows()]);
  return {books:media.filter(x=>x.kind==='book').length,movies:media.filter(x=>x.kind==='movie').length,series:media.filter(x=>x.kind==='series').length,covers:covers.length,goals:goals.length};
}

/** Upload de capas antes do commit SQL. O SQL altera todas as tabelas numa única transação. */
export async function cloudRestoreSnapshot(records:MediaRecord[],covers:CoverRecord[],goals:AnnualGoal[]):Promise<void> {
  const client=requireSupabase();
  const uid=await authenticatedUserId();
  const batch=crypto.randomUUID();
  const staged:string[]=[];
  const meta=[];
  try {
    for (const cover of covers) {
      const path=`${uid}/imports/${batch}/${cover.mediaId}.webp`;
      const {error}=await client.storage.from(BUCKET).upload(path,cover.image,{contentType:cover.mimeType,upsert:false});
      errorFrom('Erro ao enviar capa da importação',error);
      staged.push(path);
      meta.push({id:cover.id,media_id:cover.mediaId,path,mime_type:cover.mimeType,width:cover.width,height:cover.height,saved_at:cover.savedAt});
    }
    const {error}=await client.rpc('acervo_restore_snapshot',{p_media:records,p_goals:goals,p_covers:meta});
    errorFrom('Erro ao restaurar registros',error);
    // Objetos antigos podem permanecer no Storage, mas o banco restaurado é consistente.
  } catch(err) {
    if(staged.length) await client.storage.from(BUCKET).remove(staged);
    throw err;
  }
}
