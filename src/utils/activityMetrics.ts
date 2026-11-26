/** Calendário da etapa 14: interpreta exclusivamente os eventos imutáveis do Supabase. */
export type ActivityKind = 'book' | 'movie' | 'series';
export type ActivityFilter = ActivityKind | 'all';
export type ActivityMetric = 'pages' | 'percent' | 'episodes' | 'seconds' | 'completion';

export interface ActivityEvent {
  id: string;
  media_id: string;
  media_title: string;
  media_kind: ActivityKind;
  event_kind: 'progress' | 'completed';
  metric: ActivityMetric;
  previous_value: number;
  current_value: number;
  delta_value: number;
  activity_day: string;  // Dia fixado pelo servidor no fuso America/Sao_Paulo.
  occurred_at: string;
}

export function brasiliaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatMonthTitle(year: number, month: number): string {
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[month]} de ${year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Segunda-feira = 0, domingo = 6. Evita depender do timezone do navegador. */
export function leadingDays(year: number, month: number): number {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

export function activityEventsFor(events: readonly ActivityEvent[], filter: ActivityFilter): ActivityEvent[] {
  return filter === 'all' ? [...events] : events.filter(event => event.media_kind === filter);
}

function utcDayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function summarizeActivities(events: readonly ActivityEvent[], today: string) {
  const unique = [...new Set(events.filter(e => e.activity_day <= today).map(e => e.activity_day))].sort().reverse();
  let longestStreak = 0;
  let rolling = 0;
  let lastDay: number | undefined;
  for (const day of [...unique].reverse()) {
    const serial = utcDayNumber(day);
    rolling = lastDay !== undefined && serial === lastDay + 1 ? rolling + 1 : 1;
    longestStreak = Math.max(longestStreak, rolling);
    lastDay = serial;
  }
  const currentDay = utcDayNumber(today);
  const mostRecent = unique[0] ? utcDayNumber(unique[0]) : undefined;
  let currentStreak = 0;
  if (mostRecent !== undefined && (mostRecent === currentDay || mostRecent === currentDay - 1)) {
    let expected = mostRecent;
    for (const day of unique) {
      if (utcDayNumber(day) !== expected) break;
      currentStreak++;
      expected--;
    }
  }
  return {
    activeDays: unique.length,
    sessions: events.length,
    currentStreak,
    longestStreak,
    pages: events.filter(e => e.metric === 'pages').reduce((n,e) => n+e.delta_value,0),
    ebookPoints: events.filter(e => e.metric === 'percent').reduce((n,e) => n+e.delta_value,0),
    episodes: events.filter(e => e.metric === 'episodes').reduce((n,e) => n+e.delta_value,0),
    playbackSeconds: events.filter(e => e.metric === 'seconds').reduce((n,e) => n+e.delta_value,0),
    completions: events.filter(e => e.event_kind === 'completed').length,
  };
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total/3600)).padStart(2,'0')}:${String(Math.floor(total%3600/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

export function describeActivity(event: ActivityEvent): string {
  const { metric, previous_value: before, current_value: after, delta_value: delta } = event;
  const detail = metric === 'pages' ? `Página ${before} → ${after} (+${delta} páginas)`
    : metric === 'percent' ? `Leitura ${before}% → ${after}% (+${delta} p.p.)`
    : metric === 'episodes' ? `Episódios ${before} → ${after} (+${delta})`
    : metric === 'seconds' ? `Posição ${formatDuration(before)} → ${formatDuration(after)} (+${formatDuration(delta)})`
    : 'Conclusão registrada';
  return event.event_kind === 'completed' && metric !== 'completion' ? `${detail} · Concluído` : detail;
}

/** Exportação separada: o backup tradicional do Acervo v1 NÃO inclui essas atividades. */
export function exportActivitiesJson(events: readonly ActivityEvent[]): string {
  return JSON.stringify({ format: 'acervo-activity', version: 1, timezone: 'America/Sao_Paulo',
    exportedAt: new Date().toISOString(), events }, null, 2);
}
