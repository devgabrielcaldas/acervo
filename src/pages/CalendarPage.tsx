import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, BookOpen, CalendarCheck2, CalendarDays, ChevronLeft,
  ChevronRight, Clapperboard, Flame, RefreshCw, Tv,
} from 'lucide-react';
import { listActivityEvents } from '../services/activityRepository';
import {
  activityEventsFor, brasiliaDate, daysInMonth, describeActivity, exportActivitiesJson,
  formatDuration, formatMonthTitle, leadingDays, summarizeActivities,
} from '../utils/activityMetrics';
import type { ActivityEvent, ActivityFilter, ActivityKind } from '../utils/activityMetrics';
import '../styles/calendar14.css';

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const filters: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'Todas' }, { id: 'book', label: 'Leituras' },
  { id: 'movie', label: 'Filmes' }, { id: 'series', label: 'Séries' },
];
const kinds: Record<ActivityKind, { label: string; icon: typeof BookOpen }> = {
  book: { label: 'Livro', icon: BookOpen },
  movie: { label: 'Filme', icon: Clapperboard },
  series: { label: 'Série', icon: Tv },
};
const isoDay = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

function fileDownload(events: readonly ActivityEvent[]) {
  const blob = new Blob([exportActivitiesJson(events)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `acervo-atividades-${brasiliaDate()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function CalendarPage() {
  const today = brasiliaDate();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setEvents(await listActivityEvents()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o calendário.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => activityEventsFor(events, filter), [events, filter]);
  const metrics = useMemo(() => summarizeActivities(filtered, today), [filtered, today]);
  const byDay = useMemo(() => {
    const grouped = new Map<string, ActivityEvent[]>();
    for (const event of filtered) {
      const current = grouped.get(event.activity_day) ?? [];
      current.push(event);
      grouped.set(event.activity_day, current);
    }
    return grouped;
  }, [filtered]);
  const selectedEvents = byDay.get(selectedDay) ?? [];
  const dayCount = daysInMonth(year, month);
  const leading = leadingDays(year, month);
  const tail = (7 - (leading + dayCount) % 7) % 7;
  const calendarCells = Array.from({ length: leading + dayCount + tail }, (_, index) =>
    index >= leading && index < leading + dayCount ? index - leading + 1 : null);
  const activeInMonth = [...byDay.keys()].filter(date => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;

  function navigateMonth(offset: number) {
    const date = new Date(Date.UTC(year, month + offset, 1));
    const nextYear = date.getUTCFullYear();
    if (nextYear < 2000 || nextYear > 9999) return;
    const nextMonth = date.getUTCMonth();
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDay(isoDay(nextYear, nextMonth, 1));
  }

  return (
    <div className="page-enter acervo-calendar-page">
      <header className="page-heading acervo-calendar-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> SEU DIÁRIO AUTOMÁTICO</span>
          <h1>Calendário<span className="heading-period">.</span></h1>
          <p>Os pequenos avanços também fazem parte da história.</p>
        </div>
        <div className="acervo-calendar-heading__actions">
          <button type="button" className="btn btn--outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> Atualizar
          </button>
          <button type="button" className="btn btn--outline" onClick={() => fileDownload(events)} disabled={loading || events.length === 0}>
            <ArrowDownToLine size={16} aria-hidden="true" /> Exportar atividades
          </button>
        </div>
      </header>

      {error && <div className="acervo-calendar-error" role="alert">{error}</div>}
      <section aria-label="Indicadores de atividade" className="acervo-calendar-metrics">
        <div><span>Dias ativos</span><strong>{loading ? '—' : metrics.activeDays}</strong><small>desde a ativação</small></div>
        <div><span>Sequência atual</span><strong>{loading ? '—' : metrics.currentStreak}</strong><small>dias consecutivos</small></div>
        <div><span>Maior sequência</span><strong>{loading ? '—' : metrics.longestStreak}</strong><small>dias consecutivos</small></div>
        <div><span>Atualizações</span><strong>{loading ? '—' : metrics.sessions}</strong><small>eventos registrados</small></div>
      </section>
      <div className="acervo-calendar-quantities" aria-label="Totais por unidade">
        <span><BookOpen size={15} /> {metrics.pages} páginas</span>
        <span>{metrics.ebookPoints} pontos percentuais de e-book</span>
        <span><Tv size={15} /> {metrics.episodes} episódios</span>
        <span><Clapperboard size={15} /> {formatDuration(metrics.playbackSeconds)} de avanço de reprodução</span>
        <span><CalendarCheck2 size={15} /> {metrics.completions} conclusões</span>
      </div>

      <div className="acervo-calendar-layout">
        <section className="acervo-calendar-panel" aria-label="Calendário de atividades">
          <div className="acervo-calendar-toolbar">
            <div><span className="section-kicker">REGISTRO DIÁRIO</span><h2>{formatMonthTitle(year, month)}</h2></div>
            <div className="acervo-calendar-month-actions">
              <button type="button" aria-label="Mês anterior" onClick={() => navigateMonth(-1)}><ChevronLeft size={20} /></button>
              <button type="button" aria-label="Próximo mês" onClick={() => navigateMonth(1)}><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="acervo-calendar-filter" role="group" aria-label="Filtrar atividades">
            {filters.map(({ id, label }) => <button key={id} type="button" aria-pressed={filter === id}
              onClick={() => setFilter(id)} className={filter === id ? 'is-active' : ''}>{label}</button>)}
          </div>
          <div className="acervo-calendar-week" aria-hidden="true">{weekDays.map(day => <span key={day}>{day}</span>)}</div>
          <div className="acervo-calendar-grid">
            {calendarCells.map((day, index) => day === null ? <span className="acervo-calendar-placeholder" aria-hidden="true" key={`blank-${index}`} /> : (() => {
              const date = isoDay(year, month, day);
              const count = byDay.get(date)?.length ?? 0;
              return <button type="button" key={date} onClick={() => setSelectedDay(date)}
                className={`acervo-calendar-day${count ? ' has-activity' : ''}${selectedDay === date ? ' is-selected' : ''}${today === date ? ' is-today' : ''}`}
                aria-pressed={selectedDay === date}
                aria-label={`${day} de ${formatMonthTitle(year, month)}, ${count} ${count === 1 ? 'atividade' : 'atividades'}`}>
                <span>{day}</span>{count > 0 && <small>{count}</small>}
              </button>;
            })())}
          </div>
          <p className="acervo-calendar-context"><Flame size={15} /> {activeInMonth} dias com atividade neste mês · Horário de Brasília</p>
        </section>

        <section className="acervo-calendar-panel acervo-calendar-timeline" aria-label="Atividades do dia escolhido">
          <div className="acervo-calendar-timeline__heading">
            <div><span className="section-kicker">O QUE ACONTECEU</span><h2>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${selectedDay}T12:00:00Z`))}</h2></div>
            <span className="acervo-calendar-timeline__count">{selectedEvents.length} {selectedEvents.length === 1 ? 'atividade' : 'atividades'}</span>
          </div>
          {loading ? <p className="acervo-calendar-empty" role="status">Carregando suas atividades…</p>
            : error ? <p className="acervo-calendar-empty">Não foi possível carregar os registros.</p>
              : selectedEvents.length === 0 ? <div className="acervo-calendar-empty"><CalendarDays size={30} /><strong>Nenhuma atividade registrada</strong><p>Ao atualizar seu progresso, os avanços aparecerão automaticamente aqui.</p></div>
                : <ol className="acervo-calendar-entries">
                  {selectedEvents.map(event => {
                    const Icon = kinds[event.media_kind].icon;
                    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date(event.occurred_at));
                    return <li key={event.id}>
                      <span className="acervo-calendar-entry__icon"><Icon size={18} /></span>
                      <div className="acervo-calendar-entry__text">
                        <div><strong>{event.media_title}</strong><time dateTime={event.occurred_at}>{time}</time></div>
                        <small>{kinds[event.media_kind].label}{event.event_kind === 'completed' ? ' · Conclusão' : ' · Progresso'}</small>
                        <p>{describeActivity(event)}</p>
                      </div>
                    </li>;
                  })}
                </ol>}
        </section>
      </div>
      <p className="acervo-calendar-note">O calendário começa vazio e registra apenas mudanças de progresso ou conclusões feitas após a ativação no Supabase. Editar nome, nota, capa ou favoritos não cria atividade. O backup JSON tradicional não inclui este diário: use “Exportar atividades” para guardar uma cópia separada.</p>
    </div>
  );
}
