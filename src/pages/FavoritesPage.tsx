import { useMemo, useState } from 'react';
import { ArrowRight, Heart, Plus, Search } from 'lucide-react';
import { Link } from 'react-router';
import { CategoryTabs } from '../components/media/CategoryTabs';
import type { CategoryFilter } from '../components/media/CategoryTabs';
import { MediaCard } from '../components/media/MediaCard';
import { useMediaLibrary } from '../hooks/useMediaLibrary';

type FavoriteSort = 'recent' | 'title' | 'rating';

export function FavoritesPage() {
  const { items, loading, error, busyId, toggleFavorite } = useMediaLibrary();
  const [kind, setKind] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<FavoriteSort>('recent');
  const favorites = useMemo(() => items.filter((item) => item.favorite), [items]);
  const visible = useMemo(() => {
    const query = search.toLocaleLowerCase('pt-BR').trim();
    return favorites.filter((item) => (kind === 'all' || kind === item.kind) &&
      (!query || item.title.toLocaleLowerCase('pt-BR').includes(query)))
      .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'pt-BR') :
        sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title, 'pt-BR') :
          b.updatedAt.localeCompare(a.updatedAt));
  }, [favorites, kind, search, sort]);
  const hasFilters = kind !== 'all' || search !== '' || sort !== 'recent';
  const clear = () => { setKind('all'); setSearch(''); setSort('recent'); };

  return (
    <div className="page-enter acervo-lists-page">
      <header className="page-heading collection-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> SUAS ESCOLHAS ESPECIAIS</span>
          <h1>Favoritos<span className="heading-period">.</span></h1>
          <p>As histórias que ganharam um lugar especial, independente do status.</p>
        </div>
        <Link className="btn btn--primary" to="/colecao"><Heart size={17} /> Explorar coleção</Link>
      </header>
      <div className="acervo-list-summary acervo-list-summary--hearts">
        <span className="acervo-list-summary__icon"><Heart size={21} /></span>
        <div><strong>{loading ? '—' : favorites.length}</strong><span>{favorites.length === 1 ? 'história favorita' : 'histórias favoritas'}</span></div>
        <span className="acervo-list-summary__aside">Uma seleção só sua</span>
      </div>
      <div className="collection-toolbar acervo-list-filters">
        <CategoryTabs items={favorites} selected={kind} onChange={setKind} />
        <div className="collection-filters">
          <label className="collection-search"><Search size={18} /><span className="sr-only">Pesquisar favoritos</span>
            <input type="search" placeholder="Encontrar um favorito..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="collection-select"><span className="sr-only">Ordenação dos favoritos</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as FavoriteSort)}>
              <option value="recent">Atualizados recentemente</option>
              <option value="title">Título A–Z</option>
              <option value="rating">Maiores notas</option>
            </select>
          </label>
        </div>
      </div>
      <div className="collection-results">
        <span className="section-kicker">{loading ? 'CARREGANDO...' : `${visible.length} ${visible.length === 1 ? 'FAVORITO' : 'FAVORITOS'}`}</span>
        {hasFilters && <button className="collection-clear" type="button" onClick={clear}>Limpar filtros <ArrowRight size={14} /></button>}
      </div>
      {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
      {loading ? <div className="collection-empty" role="status">Carregando seus favoritos...</div> : visible.length ? (
        <div className="media-grid">{visible.map((item) =>
          <MediaCard key={item.id} item={item} busy={busyId === item.id} onFavorite={(record) => { void toggleFavorite(record); }} />)}
        </div>
      ) : (
        <div className="collection-empty">
          <div className="collection-empty__icon"><Heart size={30} /></div>
          <h2>{favorites.length ? 'Nenhum favorito encontrado' : 'Suas histórias inesquecíveis'}</h2>
          <p>{favorites.length ? 'Experimente outro filtro ou outra busca.' : 'Use o coração em qualquer livro, filme ou série para colocá-lo aqui. Seus títulos não serão duplicados.'}</p>
          {favorites.length ? <button type="button" className="btn btn--outline" onClick={clear}>Limpar filtros</button>
            : <Link to="/colecao" className="btn btn--primary"><Plus size={16} /> Explorar coleção</Link>}
        </div>
      )}
    </div>
  );
}
