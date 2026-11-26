import { authenticatedUserId, requireSupabase } from '../lib/supabase';
import type { ActivityEvent } from '../utils/activityMetrics';

/** Somente leitura. Eventos são gravados atomicamente pelo gatilho SQL. */
export async function listActivityEvents(): Promise<ActivityEvent[]> {
  const uid = await authenticatedUserId();
  const client = requireSupabase();
  const output: ActivityEvent[] = [];
  const batchSize = 500;
  for (let from = 0; from < 20_000; from += batchSize) {
    const { data, error } = await client.from('acervo_activity_events')
      .select('id,media_id,media_title,media_kind,event_kind,metric,previous_value,current_value,delta_value,activity_day,occurred_at')
      .eq('user_id', uid)
      .order('activity_day', { ascending: false })
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + batchSize - 1);
    if (error) throw new Error(`Não foi possível carregar o calendário: ${error.message}. Confirme se executou a migração SQL da Etapa 14.`);
    const rows = (data ?? []) as ActivityEvent[];
    output.push(...rows);
    if (rows.length < batchSize) return output;
  }
  throw new Error('O calendário ultrapassou 20.000 atividades. Exporte seus dados e solicite paginação ampliada antes de continuar.');
}
