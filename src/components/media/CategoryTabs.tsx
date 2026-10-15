import { BookOpen, Film, LibraryBig, Tv } from 'lucide-react';
import type { MediaCategory, MediaRecord } from '../../types/media';

export type CategoryFilter = MediaCategory | 'all';

const categories = [
  { key: 'all', label: 'Todos', icon: LibraryBig },
  { key: 'book', label: 'Livros', icon: BookOpen },
  { key: 'movie', label: 'Filmes', icon: Film },
  { key: 'series', label: 'Séries', icon: Tv },
] as const;

export function CategoryTabs({ selected, onChange, items }: {
  selected: CategoryFilter;
  onChange: (kind: CategoryFilter) => void;
  items: MediaRecord[];
}) {
  return (
    <div className="collection-tabs" role="group" aria-label="Filtrar por categoria">
      {categories.map(({ key, label, icon: Icon }) => (
        <button type="button" key={key}
          className={`collection-tab ${selected === key ? 'collection-tab--active' : ''}`}
          aria-pressed={selected === key} onClick={() => onChange(key)}>
          <Icon size={17} aria-hidden="true" /><span>{label}</span>
          <small>{key === 'all' ? items.length : items.filter((item) => item.kind === key).length}</small>
        </button>
      ))}
    </div>
  );
}
