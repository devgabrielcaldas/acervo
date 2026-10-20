import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Film, LibraryBig, Plus, Search, SlidersHorizontal, Tv, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { MediaCard } from '../components/media/MediaCard';
import { listMedia, updateMedia } from '../services/mediaRepository';
import type { MediaCategory, MediaRecord, MediaStatus } from '../types/media';
import { statusLabels } from '../utils/mediaLabels';

type KindFilter = MediaCategory | 'all';
type StatusFilter = MediaStatus | 'all';
type SortMode = 'recent' | 'title' | 'completed' | 'rating';

const tabs = [
  { key: 'all', label: 'Todos', icon: LibraryBig },
  { key: 'book', label: 'Livros', icon: BookOpen },
  { key: 'movie', label: 'Filmes', icon: Film },
  { key: 'series', label: 'Séries', icon: Tv },
] as const;

const authorCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

function formatCount(n: number) { return `${n} ${n === 1 ? 'título' : 'títulos'}`; }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível acessar seus registros.'; }

export function CollectionPage() {
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [author, setAuthor] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [busyId, setBusyId] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const results = await listMedia();
      setItems(results);
      setError('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void listMedia()
      .then((records) => {
        if (active) {
          setItems(records);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Extrai apenas autores de livros desta conta, remove repetições e ordena A–Z.
  const authors = useMemo(() => {
    const names = items.flatMap((item) =>
      item.kind === 'book' && item.author?.trim()
        ? [item.author.trim().replace(/\s+/g, ' ')]
        : [],
    ).sort(authorCollator.compare);

    return names.filter((name, index) =>
      index === 0 || authorCollator.compare(name, names[index - 1]) !== 0,
    );
  }, [items]);

  // Se um autor deixar de existir na coleção, evita um filtro sem opção no select.
  const selectedAuthor = authors.some((name) => authorCollator.compare(name, author) === 0)
    ? author
    : 'all';

  const visible = useMemo(() => {
    const query = search.toLocaleLowerCase('pt-BR').trim();
    const result = items.filter((item) =>
      (kind === 'all' || item.kind === kind) &&
      (status === 'all' || item.status === status) &&
      (selectedAuthor === 'all' || (item.kind === 'book' &&
        authorCollator.compare(item.author?.trim().replace(/\s+/g, ' ') ?? '', selectedAuthor) === 0)) &&
      (!query || [item.title, item.kind === 'book' ? item.author : item.kind === 'movie' ? item.director : '', ...item.genres]
        .join(' ').toLocaleLowerCase('pt-BR').includes(query)),
    );
    return result.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || b.updatedAt.localeCompare(a.updatedAt);
      if (sort === 'completed') return (b.completedOn ?? '').localeCompare(a.completedOn ?? '') || b.updatedAt.localeCompare(a.updatedAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [items, kind, status, selectedAuthor, search, sort]);

  const toggleFavorite = async (item: MediaRecord) => {
    setBusyId(item.id);
    try {
      await updateMedia(item.id, { ...item, favorite: !item.favorite });
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(undefined);
    }
  };

  const clearFilters = () => { setKind('all'); setStatus('all'); setAuthor('all'); setSearch(''); setSort('recent'); };
  const hasFilters = kind !== 'all' || status !== 'all' || selectedAuthor !== 'all' || search.length > 0 || sort !== 'recent';

  return (
    <div className="collection-page page-enter">
      <div className="page-heading collection-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> SEU UNIVERSO DE HISTÓRIAS</span>
          <h1>Minha coleção<span className="heading-period">.</span></h1>
          <p>Um lugar para tudo o que você leu, assistiu ou ainda deseja conhecer.</p>
        </div>
        <Link className="btn btn--primary" to="/novo"><Plus size={17} /> Novo título</Link>
      </div>

      <div className="collection-toolbar">
        <div className="collection-tabs" role="group" aria-label="Filtrar por categoria">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className={`collection-tab ${kind === key ? 'collection-tab--active' : ''}`}
              aria-pressed={kind === key} onClick={() => {
                setKind(key);
                if (key === 'movie' || key === 'series') setAuthor('all');
              }}>
              <Icon size={17} /><span>{label}</span>
              <small>{key === 'all' ? items.length : items.filter((item) => item.kind === key).length}</small>
            </button>
          ))}
        </div>
        <div className="collection-filters">
          <label className="collection-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar por título, autor, diretor ou gênero</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na coleção..." />
          </label>
          {(kind === 'all' || kind === 'book') && authors.length > 0 && (
            <label className="collection-select collection-select--author">
              <UserRound size={16} aria-hidden="true" />
              <span className="sr-only">Filtrar livros por autor</span>
              <select value={selectedAuthor} onChange={(event) => setAuthor(event.target.value)}>
                <option value="all">Todos os autores</option>
                {authors.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          )}
          <label className="collection-select">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span className="sr-only">Filtrar por status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">Todos os status</option>
              {(Object.keys(statusLabels) as MediaStatus[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </select>
          </label>
          <label className="collection-select">
            <span className="sr-only">Ordenação</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="recent">Mais recentes</option>
              <option value="title">Título A–Z</option>
              <option value="completed">Data de conclusão</option>
              <option value="rating">Maiores notas</option>
            </select>
          </label>
        </div>
      </div>

      <div className="collection-results">
        <span className="section-kicker">{loading ? 'CARREGANDO...' : formatCount(visible.length).toLocaleUpperCase('pt-BR')}</span>
        {hasFilters && <button className="collection-clear" type="button" onClick={clearFilters}>Limpar filtros <ArrowRight size={14} /></button>}
      </div>

      {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
      {loading ? (
        <div className="collection-empty" role="status">Carregando sua coleção...</div>
      ) : visible.length ? (
        <div className="media-grid">
          {visible.map((item) => <MediaCard key={item.id} item={item} busy={busyId === item.id} onFavorite={(selected) => void toggleFavorite(selected)} />)}
        </div>
      ) : (
        <div className="collection-empty">
          <div className="collection-empty__icon"><LibraryBig size={31} strokeWidth={1.5} /></div>
          <h2>{items.length ? 'Nenhum título encontrado' : 'Sua coleção começa com uma história'}</h2>
          <p>{items.length ? 'Tente mudar os filtros ou a busca para encontrar outros registros.' : 'Cadastre um livro, filme ou série. Suas capas, notas e datas ficarão aqui, organizadas do seu jeito.'}</p>
          {items.length ? <button className="btn btn--outline" onClick={clearFilters} type="button">Limpar filtros</button>
            : <Link className="btn btn--primary" to="/novo"><Plus size={17} /> Adicionar primeiro título</Link>}
        </div>
      )}
    </div>
  );
}
