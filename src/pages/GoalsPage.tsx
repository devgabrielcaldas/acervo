import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarRange, CheckCircle2,
  ChevronLeft, ChevronRight, CircleHelp, Edit3, Goal, Star, Target, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router';
import { listMedia } from '../services/mediaRepository';
import { listAnnualGoals, saveAnnualGoal } from '../services/goalsRepository';
import type { AnnualGoal, MediaRecord } from '../types/media';
import {
  calculateYearStatistics, categories, formatDecimal, formatPercent,
  getAvailableYears, goalProgress, monthNames,
} from '../utils/statistics';
import type { CategoryField, YearStatistics } from '../utils/statistics';

const START_YEAR = new Date().getFullYear();

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível acessar seus dados locais.';
}

function GoalEditor({ year, goal, onSaved }: {
  year: number;
  goal?: AnnualGoal;
  onSaved: (saved: AnnualGoal) => void;
}) {
  const [values, setValues] = useState<Record<CategoryField, string>>({
    books: String(goal?.books ?? ''),
    movies: String(goal?.movies ?? ''),
    series: String(goal?.series ?? ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = { books: Number(values.books || 0), movies: Number(values.movies || 0), series: Number(values.series || 0) };
    if (Object.values(parsed).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      setError('Use apenas números inteiros maiores ou iguais a zero.');
      setMessage('');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveAnnualGoal({ year, ...parsed });
      onSaved(saved);
      setMessage(`Metas de ${year} salvas com sucesso.`);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="acervo-goal-editor" onSubmit={(event: FormEvent<HTMLFormElement>) => { void handleSubmit(event); }}>
      <div className="acervo-goal-editor__intro">
        <div><span className="section-kicker">SEUS OBJETIVOS</span><h2>Defina suas metas para {year}</h2></div>
        <span className="acervo-goal-chip"><Edit3 size={14} /> Personalizável</span>
      </div>
      <div className="acervo-goal-editor__inputs">
        {categories.map((category) => (
          <label key={category.field} className="media-field acervo-goal-editor__input">
            <span>{category.label} no ano</span>
            <input type="number" min="0" max="100000" step="1" inputMode="numeric" value={values[category.field]}
              onChange={(event) => { setValues((previous) => ({ ...previous, [category.field]: event.target.value })); setMessage(''); }}
              placeholder="Sem meta" />
          </label>
        ))}
      </div>
      <div className="acervo-goal-editor__footer">
        <p>Deixe vazio ou use zero para não definir uma meta naquela categoria. Você pode alterá-la a qualquer momento.</p>
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar metas'} <ArrowRight size={16} /></button>
      </div>
      {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
      {message && <p className="acervo-success" role="status"><CheckCircle2 size={16} /> {message}</p>}
    </form>
  );
}

function GoalCard({ label, count, target, year }: { label: string; count: number; target: number; year: number }) {
  const progress = goalProgress(count, target);
  const exceeded = progress !== null && progress > 100;
  return (
    <article className="acervo-goal-card">
      <div className="acervo-goal-card__header"><span>{label}</span><Target size={17} aria-hidden="true" /></div>
      <div className="acervo-goal-card__numbers"><strong>{count}</strong><span>{target > 0 ? `/ ${target}` : 'sem meta'}</span></div>
      <div className="acervo-progress" role="progressbar" aria-label={`${label} concluídos em ${year}`} aria-valuemin={0}
        aria-valuemax={target > 0 ? target : Math.max(1, count)} aria-valuenow={target > 0 ? Math.min(count, target) : count}>
        <span style={{ width: `${progress === null ? 0 : Math.min(progress, 100)}%` }} />
      </div>
      <div className="acervo-goal-card__foot">
        <span>{progress === null ? 'Nenhuma meta definida' : exceeded ? 'Meta superada' : progress === 100 ? 'Meta alcançada' : `Faltam ${target - count}`}</span>
        <strong>{progress === null ? '—' : formatPercent(progress)}</strong>
      </div>
    </article>
  );
}

function MonthlyChart({ statistics }: { statistics: YearStatistics }) {
  const max = Math.max(1, ...statistics.months.flatMap((month) => categories.map(({ field }) => month[field])));
  return (
    <section className="acervo-stat-panel acervo-stat-panel--wide" aria-labelledby="acervo-month-chart-title">
      <div className="acervo-stat-panel__heading"><div><span className="section-kicker">EVOLUÇÃO MENSAL</span><h2 id="acervo-month-chart-title">Concluídos mês a mês</h2></div><CalendarRange size={21} aria-hidden="true" /></div>
      <div className="acervo-stat-legend" aria-label="Legenda do gráfico">
        {categories.map(({ label, field }) => <span key={field}><i className={`acervo-dot acervo-dot--${field}`} /> {label}</span>)}
      </div>
      {statistics.total === 0 ? (
        <div className="acervo-chart-empty"><CalendarRange size={28} aria-hidden="true" /><strong>Ainda sem conclusões em {statistics.year}</strong><p>Os gráficos serão preenchidos quando você concluir títulos com data neste ano.</p></div>
      ) : (
        <div className="acervo-month-chart">
          {statistics.months.map((month) => {
            const previousTotal = statistics.months[month.month - 2]?.total;
            const difference = previousTotal === undefined ? null : month.total - previousTotal;
            return <div className="acervo-month-chart__row" key={month.month}>
              <span className="acervo-month-chart__name">{monthNames[month.month - 1].slice(0, 3)}</span>
              <div className="acervo-month-chart__bars" role="img" aria-label={`${monthNames[month.month - 1]}: ${month.books} livros, ${month.movies} filmes, ${month.series} séries`}>
                {categories.map(({ field }) => (
                  <span key={field} className={`acervo-month-chart__bar acervo-month-chart__bar--${field}`}>
                    <i style={{ width: `${(month[field] / max) * 100}%` }} />
                  </span>
                ))}
              </div>
              <span className="acervo-month-chart__total">{month.total || '—'}</span>
              <span className={`acervo-month-chart__delta ${difference !== null && difference > 0 ? 'acervo-month-chart__delta--positive' : difference !== null && difference < 0 ? 'acervo-month-chart__delta--negative' : ''}`}
                aria-label={difference === null ? 'Sem mês anterior' : `Variação de ${difference} títulos em relação ao mês anterior`}>
                {difference === null ? '—' : difference > 0 ? `+${difference}` : difference}
              </span>
            </div>;
          })}
        </div>
      )}
      <p className="acervo-stat-note">As barras mostram cada categoria. As duas colunas à direita exibem o total do mês e a diferença em relação ao mês anterior. Datas de cadastro e lançamento não entram no cálculo.</p>
    </section>
  );
}

function RatingsChart({ statistics }: { statistics: YearStatistics }) {
  const max = Math.max(1, ...statistics.ratings.map(({ count }) => count));
  return (
    <section className="acervo-stat-panel" aria-labelledby="acervo-rating-chart-title">
      <div className="acervo-stat-panel__heading"><div><span className="section-kicker">SUAS AVALIAÇÕES</span><h2 id="acervo-rating-chart-title">Distribuição de notas</h2></div><Star size={21} aria-hidden="true" /></div>
      <p className="acervo-metric"><strong>{statistics.averageRating === null ? '—' : formatDecimal(statistics.averageRating)}</strong><span>média de estrelas · {statistics.ratedCount} avaliados</span></p>
      {statistics.ratedCount === 0 ? (
        <div className="acervo-chart-empty"><Star size={27} aria-hidden="true" /><strong>Nenhuma nota neste ano</strong><p>Avalie um título concluído para ver a distribuição.</p></div>
      ) : (
        <div className="acervo-ratings-chart">
          {statistics.ratings.map(({ rating, count }) => (
            <div className="acervo-ratings-chart__row" key={rating}>
              <span>{formatDecimal(rating)}</span>
              <div role="img" aria-label={`Nota ${formatDecimal(rating)}: ${count} títulos`} className="acervo-ratings-chart__track">
                <i style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Difference({ current, previous }: { current: number; previous: number }) {
  const difference = current - previous;
  return <span className={`acervo-difference ${difference < 0 ? 'acervo-difference--negative' : difference > 0 ? 'acervo-difference--positive' : ''}`}>
    {difference > 0 ? <ArrowUpRight size={15} /> : difference < 0 ? <ArrowDownRight size={15} /> : null}
    {difference > 0 ? '+' : ''}{difference}
  </span>;
}

function Comparison({ current, compare }: { current: YearStatistics; compare: YearStatistics }) {
  return (
    <section className="acervo-stat-panel acervo-stat-panel--comparison" aria-labelledby="acervo-comparison-title">
      <div className="acervo-stat-panel__heading"><div><span className="section-kicker">ANO A ANO</span><h2 id="acervo-comparison-title">Comparação entre anos</h2></div><TrendingUp size={21} aria-hidden="true" /></div>
      <div className="acervo-comparison-scroll"><table className="acervo-comparison-table">
        <thead><tr><th scope="col">Categoria</th><th scope="col">{compare.year}</th><th scope="col">{current.year}</th><th scope="col">Diferença</th></tr></thead>
        <tbody>
          {categories.map(({ field, label }) => <tr key={field}><th scope="row">{label}</th><td>{compare.counts[field]}</td><td>{current.counts[field]}</td><td><Difference current={current.counts[field]} previous={compare.counts[field]} /></td></tr>)}
          <tr className="acervo-comparison-table__total"><th scope="row">Total</th><td>{compare.total}</td><td>{current.total}</td><td><Difference current={current.total} previous={compare.total} /></td></tr>
        </tbody>
      </table></div>
      <p className="acervo-stat-note">A diferença é a quantidade concluída em {current.year} menos a quantidade concluída em {compare.year}. Anos sem registros aparecem com zero.</p>
    </section>
  );
}

function compareYearOptions(allYears: number[], selectedYear: number): number[] {
  return [...new Set([...allYears, selectedYear - 1])].filter((value) => value > 0 && value !== selectedYear).sort((a, b) => b - a);
}

export function GoalsPage() {
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [goals, setGoals] = useState<AnnualGoal[]>([]);
  const [selectedYear, setSelectedYear] = useState(START_YEAR);
  const [comparisonYear, setComparisonYear] = useState(START_YEAR - 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([listMedia(), listAnnualGoals()]).then(([records, savedGoals]) => {
      if (!active) return;
      setItems(records);
      setGoals(savedGoals);
    }).catch((reason: unknown) => { if (active) setError(friendlyError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const availableYears = useMemo(() => getAvailableYears(items, goals, selectedYear), [items, goals, selectedYear]);
  const comparableYears = useMemo(() => compareYearOptions(availableYears, selectedYear), [availableYears, selectedYear]);
  const otherYear = comparableYears.includes(comparisonYear) ? comparisonYear : (comparableYears[0] ?? selectedYear - 1);
  const statistics = useMemo(() => calculateYearStatistics(items, selectedYear), [items, selectedYear]);
  const previousStatistics = useMemo(() => calculateYearStatistics(items, otherYear), [items, otherYear]);
  const goal = goals.find((item) => item.year === selectedYear);
  const targetTotal = goal ? categories.reduce((sum, entry) => sum + goal[entry.field], 0) : 0;
  const trackedCount = categories.reduce((sum, entry) =>
    sum + ((goal?.[entry.field] ?? 0) > 0 ? statistics.counts[entry.field] : 0), 0);
  const totalProgress = targetTotal > 0 ? goalProgress(trackedCount, targetTotal) : null;

  function handleYear(value: number) {
    if (Number.isSafeInteger(value) && value >= 1 && value <= 9999) setSelectedYear(value);
  }

  function handleSaved(saved: AnnualGoal) {
    setGoals((previous) => [...previous.filter((item) => item.year !== saved.year), saved]);
  }

  return (
    <div className="page-enter acervo-goals-page">
      <header className="page-heading collection-heading">
        <div><span className="eyebrow"><span className="eyebrow__line" /> ACOMPANHE SUA EVOLUÇÃO</span>
          <h1>Metas e estatísticas<span className="heading-period">.</span></h1>
          <p>Uma visão real do que você leu e assistiu, no seu ritmo e ao longo dos anos.</p></div>
        <div className="acervo-goal-years" aria-label="Selecionar ano de acompanhamento">
          <button type="button" onClick={() => handleYear(selectedYear - 1)} disabled={selectedYear <= 1} aria-label="Ano anterior"><ChevronLeft size={19} /></button>
          <label><span className="sr-only">Ano</span><input type="number" min="1" max="9999" step="1" value={selectedYear}
            onChange={(event) => handleYear(Number(event.target.value))} /></label>
          <button type="button" onClick={() => handleYear(selectedYear + 1)} disabled={selectedYear >= 9999} aria-label="Próximo ano"><ChevronRight size={19} /></button>
        </div>
      </header>

      {loading ? <div className="collection-empty" role="status">Carregando metas e estatísticas…</div>
        : error ? <div className="collection-empty" role="alert"><CircleHelp size={27} /><h2>Não foi possível carregar</h2><p>{error}</p></div>
          : <>
            <div className="acervo-goals-overview">
              <div><span className="section-kicker">UM OLHAR SOBRE {selectedYear}</span><h2>Seu ano em perspectiva</h2>
                <p>Somente títulos com status concluído e data de conclusão em {selectedYear} entram nas estatísticas.</p></div>
              <div className="acervo-goals-overview__metric"><strong>{statistics.total}</strong><span>títulos concluídos</span></div>
              <div className="acervo-goals-overview__metric"><strong>{totalProgress === null ? '—' : formatPercent(totalProgress)}</strong><span>da soma das metas*</span></div>
            </div>

            <section aria-label={`Progresso das metas de ${selectedYear}`} className="acervo-goal-cards">
              {categories.map(({ label, field }) => <GoalCard key={field} label={label} year={selectedYear} count={statistics.counts[field]} target={goal?.[field] ?? 0} />)}
            </section>
            <p className="acervo-stat-note acervo-goals-disclaimer">*O percentual total só é exibido quando há alguma meta definida. Para esse percentual, categorias sem meta não entram nesse cálculo.</p>

            <GoalEditor key={selectedYear} year={selectedYear} goal={goal} onSaved={handleSaved} />

            <div className="acervo-goals-charts">
              <MonthlyChart statistics={statistics} />
              <RatingsChart statistics={statistics} />
            </div>
            <div className="acervo-goals-comparison-heading">
              <div><span className="section-kicker">OLHE PARA TRÁS</span><h2>Como seu ritmo mudou?</h2></div>
              <label className="media-field"><span>Comparar com</span><select value={otherYear} onChange={(event) => setComparisonYear(Number(event.target.value))}>
                {comparableYears.map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
            </div>
            <Comparison current={statistics} compare={previousStatistics} />
            <p className="acervo-goals-footnote"><Goal size={17} /> Metas registradas por ano permanecem disponíveis quando você alterna os anos. Nenhum dado é enviado a servidores. <Link to="/historico">Consultar histórico <ArrowRight size={14} /></Link></p>
          </>}
    </div>
  );
}
