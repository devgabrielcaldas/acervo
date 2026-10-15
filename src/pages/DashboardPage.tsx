import { useEffect, useState } from 'react';
import { listMedia } from '../services/mediaRepository';
import { listAnnualGoals } from '../services/goalsRepository';
import { calculateYearStatistics, categories, formatPercent, getAvailableYears, goalProgress } from '../utils/statistics';
import type { AnnualGoal, MediaCategory, MediaRecord } from '../types/media';
import { describeCategoryStatus } from '../utils/mediaLabels';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  Clapperboard,
  Film,
  LibraryBig,
  Play,
  Sparkles,
  Target,
  Tv,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

type SummaryCard = {
  label: string;
  detail: string;
  icon: LucideIcon;
  kind: MediaCategory;
};

const summaryCards: SummaryCard[] = [
  { label: 'Livros concluídos', detail: 'Suas leituras do ano', icon: BookOpen, kind: 'book' },
  { label: 'Filmes assistidos', detail: 'Seu cinema particular', icon: Film, kind: 'movie' },
  { label: 'Séries concluídas', detail: 'Histórias em episódios', icon: Tv, kind: 'series' },
];

const currentYear = new Date().getFullYear();

export function DashboardPage() {
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [goals, setGoals] = useState<AnnualGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([listMedia(), listAnnualGoals()]).then(([records, savedGoals]) => { if (active) { setItems(records); setGoals(savedGoals); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar suas estatísticas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const years = getAvailableYears(items, goals, year);
  const statistics = calculateYearStatistics(items, year);
  const selectedGoal = goals.find((goal) => goal.year === year);
  const ongoing = items.filter((item) => item.status === 'in_progress').slice(0, 3);
  const wishlist = items.filter((item) => item.status === 'wishlist').slice(0, 3);

  return (
    <div className="dashboard page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> BEM-VINDO AO SEU ACERVO</span>
          <h1>O seu espaço para boas histórias.</h1>
          <p>Organize o que já viveu e descubra o que vem a seguir.</p>
        </div>
        <label className="year-pill" aria-label="Ano do resumo">
          <span className="year-pill__dot" aria-hidden="true" />
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__content">
          <span className="hero__eyebrow"><Sparkles size={15} /> SUA BIBLIOTECA DE EXPERIÊNCIAS</span>
          <h2 id="hero-title">Colecione momentos, <em>não apenas títulos.</em></h2>
          <p>Livros que marcaram, filmes inesquecíveis e séries que fizeram companhia. Tudo em um único lugar, do seu jeito.</p>
          <div className="hero__actions">
            <Link className="btn btn--primary" to="/colecao">
              Explorar coleção <ArrowRight size={17} />
            </Link>
            <Link className="btn btn--text" to="/desejos">
              Minha lista de desejos <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          <div className="hero__halo" />
          <div className="art-cover art-cover--back"><Clapperboard size={32} strokeWidth={1.2} /></div>
          <div className="art-cover art-cover--middle"><Film size={35} strokeWidth={1.2} /></div>
          <div className="art-cover art-cover--front"><BookOpen size={43} strokeWidth={1.15} /><span>ACERVO</span></div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <span className="section-kicker">UM OLHAR SOBRE {year}</span>
          <h2>Sua jornada em números</h2>
        </div>
        <Link className="text-link" to="/metas">Ver metas <ArrowRight size={16} /></Link>
      </div>

      {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
      <section className="stats-grid" aria-label="Resumo anual">
        {summaryCards.map(({ label, detail, icon: Icon, kind }) => {
          const count = kind === 'book' ? statistics.counts.books : kind === 'movie' ? statistics.counts.movies : statistics.counts.series;
          return <article className="stat-card" key={label}>
            <div className="stat-card__top">
              <span className="stat-card__icon"><Icon size={21} strokeWidth={1.65} /></span>
              <span className="stat-card__state"><span /> {loading ? 'CARREGANDO' : count === 0 ? 'SEM REGISTROS' : 'REGISTROS REAIS'}</span>
            </div>
            <p className="stat-card__value" aria-label={`${label}: ${count}`}>{loading || error ? '—' : count}</p>
            <h3>{label}</h3>
            <p className="stat-card__detail">{detail}</p>
          </article>;
        })}
      </section>

      <section className="acervo-dashboard-goals" aria-label={`Progresso das metas de ${year}`}>
        <div className="acervo-dashboard-goals__heading">
          <div><span className="section-kicker">SEUS OBJETIVOS</span><h2>Metas de {year}</h2></div>
          <Link to="/metas" className="text-link">{selectedGoal ? 'Editar metas' : 'Definir metas'} <ArrowRight size={16} /></Link>
        </div>
        {!loading && !error && categories.some(({ field }) => (selectedGoal?.[field] ?? 0) > 0) ? (
          <div className="acervo-dashboard-goals__grid">
            {categories.map(({ field, label }) => {
              const target = selectedGoal?.[field] ?? 0;
              const count = statistics.counts[field];
              const progress = goalProgress(count, target);
              return <div className="acervo-dashboard-goals__item" key={field}>
                <div><span>{label}</span><strong>{target ? `${count} / ${target}` : 'Sem meta'}</strong></div>
                <div className="acervo-progress" role="progressbar" aria-label={`Meta de ${label} em ${year}`}
                  aria-valuemin={0} aria-valuemax={target || Math.max(1, count)} aria-valuenow={target ? Math.min(count, target) : count}>
                  <span style={{ width: `${progress === null ? 0 : Math.min(progress, 100)}%` }} />
                </div>
                <small>{progress === null ? 'Não definida' : formatPercent(progress)}</small>
              </div>;
            })}
          </div>
        ) : (
          <p className="acervo-dashboard-goals__empty">{loading ? 'Carregando metas…' : error ? 'As metas não puderam ser carregadas.' : 'Você ainda não definiu metas para este ano. Defina objetivos personalizados quando quiser.'}</p>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="panel" aria-labelledby="recent-heading">
          <div className="panel__header">
            <div>
              <span className="section-kicker">SUA ROTINA</span>
              <h2 id="recent-heading">Em andamento</h2>
            </div>
            <span className="panel__badge"><Play size={12} fill="currentColor" /> CONTINUAR</span>
          </div>
          {ongoing.length ? <div className="dashboard-mini-list">
            {ongoing.map((item) => <Link key={item.id} to={`/colecao/${item.id}`}>
              <span className="dashboard-mini-list__icon"><LibraryBig size={17} /></span>
              <span><strong>{item.title}</strong><small>{describeCategoryStatus(item.kind, item.status)}</small></span><ArrowRight size={16} />
            </Link>)}
          </div> : <div className="empty-state">
            <span className="empty-state__icon"><LibraryBig size={28} strokeWidth={1.4} /></span>
            <h3>Suas histórias aparecerão aqui</h3>
            <p>Cadastre um título com o status “Lendo” ou “Assistindo” para acompanhá-lo.</p>
          </div>}
        </section>

        <section className="panel" aria-labelledby="wishlist-heading">
          <div className="panel__header">
            <div>
              <span className="section-kicker">PRÓXIMAS DESCOBERTAS</span>
              <h2 id="wishlist-heading">Na sua lista</h2>
            </div>
            <Link className="icon-link" to="/desejos" aria-label="Abrir lista de desejos"><ArrowRight size={19} /></Link>
          </div>
          {wishlist.length ? <div className="dashboard-mini-list">
            {wishlist.map((item) => <Link key={item.id} to={`/colecao/${item.id}`}>
              <span className="dashboard-mini-list__icon"><Bookmark size={17} /></span>
              <span><strong>{item.title}</strong><small>{describeCategoryStatus(item.kind, item.status)}</small></span><ArrowRight size={16} />
            </Link>)}
          </div> : <div className="empty-state">
            <span className="empty-state__icon"><Bookmark size={28} strokeWidth={1.4} /></span>
            <h3>Um mundo de possibilidades</h3>
            <p>Os títulos com status “Quero ler” ou “Quero assistir” aparecerão aqui.</p>
          </div>}
        </section>
      </div>

      <div className="closing-note">
        <div className="closing-note__symbol"><Target size={21} strokeWidth={1.5} /></div>
        <p><strong>Seu ritmo, suas metas.</strong> O importante não é consumir mais, mas aproveitar melhor cada história.</p>
        <span className="closing-note__check"><Check size={15} /> SEM PRESSA</span>
      </div>
    </div>
  );
}
