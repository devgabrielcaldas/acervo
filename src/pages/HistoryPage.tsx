import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CalendarRange, History, Search, SlidersHorizontal } from 'lucide-react';
import { CategoryTabs } from '../components/media/CategoryTabs';
import type { CategoryFilter } from '../components/media/CategoryTabs';
import { MediaCard } from '../components/media/MediaCard';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import type { MediaRecord } from '../types/media';
import { formatDate } from '../utils/mediaLabels';

type HistorySort = 'newest' | 'oldest' | 'title' | 'rating';
type RatingFilter = 'all' | 'unrated' | `${number}`;
type DisplayMode = 'grid' | 'month';
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const yearOf = (date: string) => date.slice(0, 4);
const monthOf = (date: string) => date.slice(5, 7);

export function HistoryPage() {
  const { items, loading, error, busyId, toggleFavorite } = useMediaLibrary();
  const [kind, setKind] = useState<CategoryFilter>('all');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [day, setDay] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rating, setRating] = useState<RatingFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<HistorySort>('newest');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');

  // Datas de conclusão, não de lançamento nem de cadastro. O histórico é de itens concluídos.
  const completed = useMemo(() => items.filter((item): item is MediaRecord & { completedOn: NonNullable<MediaRecord['completedOn']> } =>
    item.status === 'completed' && Boolean(item.completedOn)), [items]);
  const years = useMemo(() => Array.from(new Set(completed.map((item) => yearOf(item.completedOn))))
    .sort((a, b) => b.localeCompare(a)), [completed]);

  const visible = useMemo(() => {
    const query = search.toLocaleLowerCase('pt-BR').trim();
    return completed.filter((item) => {
      const date = item.completedOn;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (year !== 'all' && yearOf(date) !== year) return false;
      if (month !== 'all' && monthOf(date) !== month) return false;
      if (day && date !== day) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (favoritesOnly && !item.favorite) return false;
      if (rating === 'unrated' && item.rating !== undefined) return false;
      if (rating !== 'all' && rating !== 'unrated' && (item.rating === undefined || item.rating !== Number(rating))) return false;
      if (query && ![item.title, item.kind === 'book' ? item.author : item.kind === 'movie' ? item.director : '', ...item.genres]
        .join(' ').toLocaleLowerCase('pt-BR').includes(query)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || b.completedOn.localeCompare(a.completedOn);
      return sort === 'oldest' ? a.completedOn.localeCompare(b.completedOn) : b.completedOn.localeCompare(a.completedOn);
    });
  }, [completed, kind, year, month, day, from, to, favoritesOnly, rating, search, sort]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof visible>();
    // Preserva a ordenação dos títulos; só ordena os cabeçalhos dos meses.
    for (const item of visible) {
      const groupKey = item.completedOn.slice(0, 7);
      const group = groups.get(groupKey) ?? [];
      group.push(item);
      groups.set(groupKey, group);
    }
    return [...groups.entries()].sort((a, b) => sort === 'oldest' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]));
  }, [visible, sort]);

  const clearFilters = () => {
    setKind('all'); setYear('all'); setMonth('all'); setDay(''); setFrom(''); setTo('');
    setRating('all'); setFavoritesOnly(false); setSearch(''); setSort('newest');
  };
  const hasFilters = kind !== 'all' || year !== 'all' || month !== 'all' || day !== '' || from !== '' || to !== '' ||
    rating !== 'all' || favoritesOnly || search !== '' || sort !== 'newest';

  const cards = (records: typeof visible) => (
    <div className="media-grid acervo-history-grid">
      {records.map((item) => (
        <div className="acervo-history-item" key={item.id}>
          <MediaCard item={item} busy={busyId === item.id} onFavorite={(record) => { void toggleFavorite(record); }} />
          <div className="acervo-history-date"><CalendarDays size={14} /> {formatDate(item.completedOn)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-enter acervo-lists-page">
      <header className="page-heading collection-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> MEMÓRIAS QUE FICAM</span>
          <h1>Histórico<span className="heading-period">.</span></h1>
          <p>Revisite tudo o que você concluiu, no dia e no ano em que aconteceu.</p>
        </div>
        <div className="acervo-history-total"><History size={19} /><strong>{completed.length}</strong><span>concluídos no total</span></div>
      </header>

      <div className="acervo-history-filter-panel">
        <CategoryTabs items={completed} selected={kind} onChange={setKind} />
        <div className="acervo-history-controls">
          <label className="collection-search acervo-history-search"><Search size={17} aria-hidden="true" />
            <span className="sr-only">Pesquisar no histórico</span>
            <input value={search} type="search" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, autor ou gênero..." />
          </label>
          <label className="media-field"><span>Ano de conclusão</span>
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">Todos os anos</option>
              {years.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label className="media-field"><span>Mês de conclusão</span>
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="all">Todos os meses</option>
              {months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}
            </select>
          </label>
          <label className="media-field"><span>Dia específico</span>
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
          <label className="media-field"><span>Período: de</span>
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="media-field"><span>Até</span>
            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="media-field"><span>Avaliação</span>
            <select value={rating} onChange={(event) => setRating(event.target.value as RatingFilter)}>
              <option value="all">Todas as notas</option>
              {Array.from({ length: 11 }, (_, index) => (10 - index) / 2).map((score) => (
                <option key={score} value={String(score)}>{String(score).replace('.', ',')} {score === 1 ? 'estrela' : 'estrelas'}</option>
              ))}
              <option value="unrated">Sem avaliação</option>
            </select>
          </label>
          <label className="media-field"><span>Ordenação</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as HistorySort)}>
              <option value="newest">Mais recentes primeiro</option>
              <option value="oldest">Mais antigos primeiro</option>
              <option value="title">Título A–Z</option>
              <option value="rating">Maiores notas</option>
            </select>
          </label>
        </div>
        <div className="acervo-history-filter-footer">
          <label className="acervo-check"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /> Somente favoritos</label>
          {hasFilters && <button type="button" className="collection-clear" onClick={clearFilters}>Limpar todos os filtros <ArrowRight size={14} /></button>}
        </div>
      </div>

      <div className="acervo-history-results-header">
        <div><span className="section-kicker">{loading ? 'CARREGANDO...' : `${visible.length} ${visible.length === 1 ? 'REGISTRO ENCONTRADO' : 'REGISTROS ENCONTRADOS'}`}</span>
          <p>Datas de conclusão dos seus registros, não das publicações.</p></div>
        <div className="acervo-view-toggle" role="group" aria-label="Exibição dos registros">
          <button className={displayMode === 'grid' ? 'is-active' : ''} aria-pressed={displayMode === 'grid'} type="button" onClick={() => setDisplayMode('grid')}><SlidersHorizontal size={14} /> Grade</button>
          <button className={displayMode === 'month' ? 'is-active' : ''} aria-pressed={displayMode === 'month'} type="button" onClick={() => setDisplayMode('month')}><CalendarRange size={14} /> Por mês</button>
        </div>
      </div>
      {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
      {loading ? <div className="collection-empty" role="status">Carregando seu histórico...</div> : visible.length ? (
        displayMode === 'month' ? (
          <div className="acervo-history-groups">
            {grouped.map(([key, group]) => {
              const monthIndex = Number(key.slice(5, 7)) - 1;
              return <section key={key} className="acervo-history-group">
                <div className="acervo-history-group__heading"><h2>{months[monthIndex]} de {key.slice(0, 4)}</h2><span>{group.length} {group.length === 1 ? 'título' : 'títulos'}</span></div>
                {cards(group)}
              </section>;
            })}
          </div>
        ) : cards(visible)
      ) : (
        <div className="collection-empty">
          <div className="collection-empty__icon"><History size={30} /></div>
          <h2>{completed.length ? 'Nenhum registro nesse período' : 'O histórico começa com uma conclusão'}</h2>
          <p>{completed.length ? 'Experimente mudar as datas, a nota ou os outros filtros.' : 'Marque algum livro, filme ou série como concluído e informe a data real para começar sua linha do tempo.'}</p>
          {completed.length > 0 && <button type="button" className="btn btn--outline" onClick={clearFilters}>Limpar filtros</button>}
        </div>
      )}
    </div>
  );
}
