import { requireSupabase } from '../lib/supabase';
import { sanitizeSmartFilters } from '../utils/smartCollection';
import type { SmartFilters, SavedSmartView } from '../utils/smartCollection';

async function userId(): Promise<string> {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error || !data.user) throw new Error('Faça login para acessar seus filtros salvos.');
  return data.user.id;
}

export async function listSavedViews(): Promise<SavedSmartView[]> {
  const uid = await userId();
  const { data, error } = await requireSupabase().from('acervo_saved_views')
    .select('id,name,config').eq('user_id', uid).order('created_at', { ascending: true });
  if (error) throw new Error(`Não foi possível carregar filtros salvos: ${error.message}`);
  return (data ?? []).map(row => ({ id: row.id as string, name: row.name as string, filters: sanitizeSmartFilters(row.config) }));
}

export async function createSavedView(name: string, filters: SmartFilters): Promise<void> {
  const uid = await userId();
  const title = name.trim().replace(/\s+/g, ' ');
  if (!title || title.length > 50) throw new Error('Dê um nome de até 50 caracteres para o filtro.');
  const { error } = await requireSupabase().from('acervo_saved_views')
    .insert({ user_id: uid, name: title, config: sanitizeSmartFilters(filters) });
  if (error) throw new Error(error.code === '23505' ? 'Você já possui um filtro com esse nome.' : `Não foi possível salvar: ${error.message}`);
}

export async function removeSavedView(id: string): Promise<void> {
  const uid = await userId();
  const { error } = await requireSupabase().from('acervo_saved_views').delete().eq('id', id).eq('user_id', uid);
  if (error) throw new Error(`Não foi possível excluir o filtro: ${error.message}`);
}
