import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, BookOpen, Check, Film, ImagePlus, Save, Trash2, Tv } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { MediaCover } from '../components/media/MediaCover';
import { RatingStars } from '../components/media/RatingStars';
import { CatalogSearch } from '../components/media/CatalogSearch';
import { downloadCatalogCover, loadCatalogSeason } from '../services/catalogClient';
import type { CatalogItem } from '../services/catalogClient';
import { addMedia, getMedia, updateMedia } from '../services/mediaRepository';
import { removeCover, saveCover } from '../services/coverRepository';
import type { BookFormat, DateOnly, MediaCategory, MediaInput, MediaRecord, MediaStatus, WishPriority } from '../types/media';
import { formatPlaybackTime, parsePlaybackTime, seasonDisplayTitle } from '../utils/progress';

interface FormValues {
  kind: MediaCategory;
  title: string;
  status: MediaStatus;
  author: string;
  director: string;
  genres: string;
  releaseYear: string;
  startedOn: string;
  completedOn: string;
  rating: string;
  favorite: boolean;
  notes: string;
  priority: '' | WishPriority;
  totalPages: string;
  currentPage: string;
  ebookPercent: string;
  pausedAt: string;
  seriesTitle: string;
  seasonNumber: string;
  tmdbId: string;
  format: '' | BookFormat;
  durationMinutes: string;
  currentSeason: string;
  currentEpisode: string;
  totalSeasons: string;
  totalEpisodes: string;
}

const initialValues: FormValues = {
  kind: 'book', title: '', status: 'wishlist', author: '', director: '', genres: '',
  releaseYear: '', startedOn: '', completedOn: '', rating: '', favorite: false,
  notes: '', priority: '', totalPages: '', currentPage: '', ebookPercent: '', pausedAt: '',
  seriesTitle: '', seasonNumber: '', tmdbId: '', format: '',
  durationMinutes: '', currentSeason: '', currentEpisode: '', totalSeasons: '', totalEpisodes: '',
};

function valuesFromRecord(record: MediaRecord): FormValues {
  const fields: FormValues = {
    ...initialValues, kind: record.kind, title: record.title, status: record.status,
    genres: record.genres.join(', '), releaseYear: String(record.releaseYear ?? ''),
    startedOn: record.startedOn ?? '', completedOn: record.completedOn ?? '',
    rating: String(record.rating ?? ''), favorite: record.favorite, notes: record.notes ?? '',
    priority: record.priority ?? '',
  };
  if (record.kind === 'book') return {
    ...fields, author: record.author ?? '', totalPages: String(record.totalPages ?? ''),
    currentPage: String(record.currentPage ?? ''), ebookPercent: String(record.ebookPercent ?? ''), format: record.format ?? '',
  };
  if (record.kind === 'movie') return { ...fields, director: record.director ?? '', durationMinutes: String(record.durationMinutes ?? ''),
    pausedAt: formatPlaybackTime(record.pausedAtSeconds) };
  return {
    ...fields, currentSeason: String(record.currentSeason ?? ''), currentEpisode: String(record.currentEpisode ?? ''),
    totalSeasons: String(record.totalSeasons ?? ''), totalEpisodes: String(record.totalEpisodes ?? ''),
    seriesTitle: record.seriesTitle ?? '', seasonNumber: String(record.seasonNumber ?? ''),
    tmdbId: String(record.tmdbId ?? ''), pausedAt: formatPlaybackTime(record.pausedAtSeconds),
  };
}

function optionalNumber(value: string) { return value.trim() === '' ? undefined : Number(value); }
function optionalDate(value: string) { return value ? value as DateOnly : undefined; }
function createInput(values: FormValues): MediaInput {
  const common = {
    title: values.title, status: values.status,
    genres: values.genres.split(',').map((value) => value.trim()).filter(Boolean),
    releaseYear: optionalNumber(values.releaseYear), startedOn: optionalDate(values.startedOn),
    completedOn: values.status === 'completed' ? optionalDate(values.completedOn) : undefined,
    rating: optionalNumber(values.rating), favorite: values.favorite,
    notes: values.notes, priority: values.status === 'wishlist' ? values.priority || undefined : undefined,
  };
  if (values.kind === 'book') return {
    ...common, kind: 'book', author: values.author, totalPages: optionalNumber(values.totalPages),
    currentPage: optionalNumber(values.currentPage), ebookPercent: optionalNumber(values.ebookPercent), format: values.format || undefined,
  };
  if (values.kind === 'movie') return {
    ...common, kind: 'movie', director: values.director, durationMinutes: optionalNumber(values.durationMinutes),
    pausedAtSeconds: values.status === 'in_progress' || values.status === 'paused' ? parsePlaybackTime(values.pausedAt) : undefined,
  };
  return {
    ...common, kind: 'series', currentSeason: optionalNumber(values.currentSeason),
    currentEpisode: optionalNumber(values.currentEpisode), totalSeasons: optionalNumber(values.totalSeasons),
    totalEpisodes: optionalNumber(values.totalEpisodes),
    seriesTitle: values.seriesTitle || undefined, seasonNumber: optionalNumber(values.seasonNumber),
    tmdbId: optionalNumber(values.tmdbId), pausedAtSeconds: values.status === 'in_progress' || values.status === 'paused' ? parsePlaybackTime(values.pausedAt) : undefined,
  };
}

function getError(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível salvar o registro.'; }

export function MediaFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [record, setRecord] = useState<MediaRecord>();
  const [createdId, setCreatedId] = useState<string>();
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [coverSelection, setCoverSelection] = useState<{ file: File; url: string } | null>(null);
  const file = coverSelection?.file;
  const previewUrl = coverSelection?.url;
  const [removeExistingCover, setRemoveExistingCover] = useState(false);
  const [catalogActive, setCatalogActive] = useState(false);
  const [catalogHint, setCatalogHint] = useState('');
  const [catalogCoverUrl, setCatalogCoverUrl] = useState<string>();
  const [catalogCoverFallbackUrl, setCatalogCoverFallbackUrl] = useState<string>();
  const [fetchingCover, setFetchingCover] = useState(false);
  const [coverSource, setCoverSource] = useState<'catalog' | 'manual' | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<NonNullable<CatalogItem['seasons']>>([]);
  const [seasonBusy, setSeasonBusy] = useState(false);
  const seasonRequest = useRef(0);
  const coverRequest = useRef(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void getMedia(id).then((item) => {
      if (!active) return;
      if (!item) setError('Registro não encontrado. Volte à coleção e escolha outro título.');
      else { setRecord(item); setValues(valuesFromRecord(item)); }
    }).catch((err: unknown) => { if (active) setError(getError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    return () => { if (coverSelection) URL.revokeObjectURL(coverSelection.url); };
  }, [coverSelection]);

  function change<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  const changeStatus = (value: MediaStatus) => setValues((current) => ({
    ...current, status: value, completedOn: value === 'completed' ? current.completedOn : '',
  }));

  function chooseCover(next: File | undefined, source: 'catalog' | 'manual' = 'manual') {
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError('A capa deve estar em JPG, PNG ou WebP.'); return;
    }
    if (next.size > 12 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 12 MB.'); return;
    }
    if (source === 'manual') { coverRequest.current++; setFetchingCover(false); }
    setCoverSelection({ file: next, url: URL.createObjectURL(next) });
    setCoverSource(source);
    setCatalogCoverUrl(undefined);
    setCatalogCoverFallbackUrl(undefined);
    setRemoveExistingCover(false);
    setError('');
  }

  async function acceptCatalogCover(url: string, confirmReplace = false, fallbackUrl?: string) {
    if (confirmReplace && (coverSource === 'manual' || (record?.coverId && !removeExistingCover)) &&
        !window.confirm('Substituir a capa atual pela imagem do catálogo?')) return;
    const request = ++coverRequest.current;
    setFetchingCover(true);
    try {
      const selected = await downloadCatalogCover(url, fallbackUrl);
      if (request !== coverRequest.current) return;
      chooseCover(selected, 'catalog');
      setCatalogHint('Capa do catálogo pronta. Você ainda pode escolher outra imagem.');
    } catch (reason) {
      if (request === coverRequest.current) setCatalogHint(`Não foi possível baixar a capa automática: ${getError(reason)}. Você pode escolher uma capa manualmente.`);
    } finally {
      if (request === coverRequest.current) setFetchingCover(false);
    }
  }

  async function acceptCatalogItem(item: CatalogItem) {
    coverRequest.current++;
    setValues(current => ({
      ...current,
      title: item.title,
      releaseYear: item.year ? String(item.year) : current.releaseYear,
      genres: item.genres.length ? item.genres.join(', ') : current.genres,
      author: current.kind === 'book' && item.creator ? item.creator : current.author,
      director: current.kind === 'movie' && item.creator ? item.creator : current.director,
      totalPages: current.kind === 'book' && item.pages ? String(item.pages) : current.totalPages,
      durationMinutes: current.kind === 'movie' && item.durationMinutes ? String(item.durationMinutes) : current.durationMinutes,
      totalSeasons: current.kind === 'series' && item.totalSeasons ? String(item.totalSeasons) : current.totalSeasons,
      totalEpisodes: current.kind === 'series' && item.totalEpisodes ? String(item.totalEpisodes) : current.totalEpisodes,
      seriesTitle: current.kind === 'series' ? item.title : current.seriesTitle,
      tmdbId: current.kind === 'series' && item.source === 'tmdb' ? item.id : current.tmdbId,
      seasonNumber: current.kind === 'series' ? '' : current.seasonNumber,
      currentEpisode: current.kind === 'series' ? '' : current.currentEpisode,
    }));
    seasonRequest.current++;
    setAvailableSeasons(item.kind === 'series' ? item.seasons ?? [] : []);
    setCatalogActive(false);
    if (coverSource === 'catalog') { setCoverSelection(null); setCoverSource(null); }
    setCatalogCoverUrl(item.coverUrl);
    setCatalogCoverFallbackUrl(item.coverFallbackUrl);
    setCatalogHint(`Informações preenchidas a partir de ${item.source === 'tmdb' ? 'TMDB' : item.source === 'google-books' ? 'Google Books' : 'Open Library'}. Confira os dados antes de salvar.`);
    if (item.coverUrl && item.kind !== 'series' && (!file || coverSource === 'catalog') && !(record?.coverId && !removeExistingCover)) {
      await acceptCatalogCover(item.coverUrl, false, item.coverFallbackUrl);
    }
  }


  /** Temporada vira um registro independente, com episódios e capa específicos. */
  async function selectSeason(numberText: string) {
    const token = ++seasonRequest.current;
    const number = optionalNumber(numberText);
    const base = values.seriesTitle || values.title.replace(/\s*[—-]\s*Temp\.\s*\d+$/i,'');
    const summary = availableSeasons.find((season) => season.number === number);
    coverRequest.current++;
    setValues((current) => ({ ...current, seriesTitle: base, seasonNumber: numberText,
      title: number ? seasonDisplayTitle(base, number) : base,
      totalEpisodes: summary?.episodeCount ? String(summary.episodeCount) : current.totalEpisodes,
      releaseYear: summary?.year ? String(summary.year) : current.releaseYear,
      currentEpisode: '', pausedAt: '' }));
    if (!number || !values.tmdbId) return;
    setSeasonBusy(true);
    try {
      const detail = await loadCatalogSeason(Number(values.tmdbId),number);
      if (token !== seasonRequest.current) return;
      setValues((current) => current.seasonNumber !== numberText ? current : ({...current,
        totalEpisodes: detail.episodeCount ? String(detail.episodeCount) : current.totalEpisodes,
        releaseYear: detail.year ? String(detail.year) : current.releaseYear }));
      const seasonCover = detail.coverUrl ?? summary?.coverUrl;
      setCatalogCoverUrl(seasonCover ?? catalogCoverUrl);
      if (seasonCover && coverSource !== 'manual' && !(record?.coverId && !removeExistingCover)) {
        await acceptCatalogCover(seasonCover);
      }
    } catch (reason) {
      if (token === seasonRequest.current) setCatalogHint(`Temporada selecionada. Detalhes não disponíveis: ${getError(reason)}. Você pode informar os episódios manualmente.`);
      if (summary?.coverUrl && coverSource !== 'manual' && !(record?.coverId && !removeExistingCover)) await acceptCatalogCover(summary.coverUrl);
    } finally { if (token === seasonRequest.current) setSeasonBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing && !record) return;
    setSaving(true);
    setError('');
    let savedId: string | undefined;
    try {
      const input = createInput(values);
      const key = id ?? createdId;
      const result = key ? await updateMedia(key, input) : await addMedia(input);
      savedId = result.id;
      setCreatedId(result.id);
      if (file) await saveCover(result.id, file);
      else if (removeExistingCover) await removeCover(result.id);
      navigate(`/colecao/${result.id}`, { replace: true, state: { saved: true } });
    } catch (err) {
      setError(savedId ? `As informações foram salvas, mas houve um problema com a capa: ${getError(err)}. Você pode tentar salvar novamente sem duplicar o registro.` : getError(err));
    } finally {
      setSaving(false);
    }
  }

  const options = [
    { kind: 'book', label: 'Livro', Icon: BookOpen },
    { kind: 'movie', label: 'Filme', Icon: Film },
    { kind: 'series', label: 'Série', Icon: Tv },
  ] as const;

  if (loading) return <div className="media-loading page-enter" role="status">Carregando dados do título...</div>;
  if (editing && !record) return <div className="page-enter"><p className="media-alert media-alert--error" role="alert">{error || 'Registro não encontrado.'}</p><Link className="btn btn--outline" to="/colecao"><ArrowLeft size={16} /> Voltar à coleção</Link></div>;

  return (
    <div className="media-form-page page-enter">
      <Link className="media-back" to={record ? `/colecao/${record.id}` : '/colecao'}><ArrowLeft size={17} /> Voltar</Link>
      <div className="page-heading collection-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> SUA PRÓXIMA HISTÓRIA</span>
          <h1>{editing ? 'Editar título' : 'Adicionar ao Acervo'}<span className="heading-period">.</span></h1>
          <p>Preencha só o que quiser. Título, categoria e status são suficientes para começar.</p>
        </div>
      </div>

      <form className="media-form-layout" onSubmit={(event) => void submit(event)}>
        <div className="media-form-main">
          <section className="media-form-panel">
            <div className="media-form-section-title"><span>01</span><div><h2>O que vamos guardar?</h2><p>Escolha o tipo e as informações principais.</p></div></div>
            <div className="media-kind-options" role="group" aria-label="Categoria do registro">
              {options.map(({ kind, label, Icon }) => (
                <button key={kind} type="button" disabled={editing} onClick={() => { seasonRequest.current++; setAvailableSeasons([]); setCoverSource(null); change('kind', kind); setCatalogActive(false); setCatalogCoverUrl(undefined); setCatalogCoverFallbackUrl(undefined); setCatalogHint(''); }}
                  className={`media-kind ${values.kind === kind ? 'media-kind--active' : ''}`} aria-pressed={values.kind === kind}>
                  <Icon size={20} /> {label}
                </button>
              ))}
            </div>
            {editing && <p className="media-help">A categoria não pode ser alterada após criar um registro.</p>}
            <div className="media-fields-grid">
              <label className="media-field media-field--wide"><span>Título <b>*</b></span>
                <input autoFocus required maxLength={200} value={values.title} placeholder="Ex.: O Massacre da Família Hope"
                  onChange={(event) => { change('title', event.target.value); setCatalogActive(true); setCatalogCoverUrl(undefined); setCatalogCoverFallbackUrl(undefined); setCatalogHint(''); }} /></label>
              {catalogActive && values.title.trim().length >= 3 && (
                <div className="media-field media-field--wide">
                  <CatalogSearch key={`${values.kind}:${values.title}`} kind={values.kind} query={values.title} enabled={catalogActive} onSelect={acceptCatalogItem} />
                </div>
              )}
              <label className="media-field"><span>Status <b>*</b></span>
                <select value={values.status} onChange={(event) => changeStatus(event.target.value as MediaStatus)}>
                  <option value="wishlist">{values.kind === 'book' ? 'Quero ler' : 'Quero assistir'}</option>
                  <option value="in_progress">{values.kind === 'book' ? 'Lendo' : 'Assistindo'}</option>
                  <option value="completed">Concluído</option>
                  <option value="paused">Pausado</option>
                  <option value="abandoned">Abandonado</option>
                </select></label>
              {values.kind === 'book' && (
                <label className="media-field"><span>Autor</span>
                  <input value={values.author} placeholder="Nome do autor" onChange={(event) => change('author', event.target.value)} /></label>
              )}
              {values.kind === 'movie' && (
                <label className="media-field"><span>Diretor</span>
                  <input value={values.director} placeholder="Nome do diretor" onChange={(event) => change('director', event.target.value)} /></label>
              )}
              <label className="media-field"><span>Ano de lançamento</span>
                <input type="number" min="1" max="9999" step="1" value={values.releaseYear} placeholder="Ex.: 2026"
                  onChange={(event) => change('releaseYear', event.target.value)} /></label>
              <label className="media-field media-field--wide"><span>Gêneros</span>
                <input value={values.genres} placeholder="Suspense, mistério, drama" onChange={(event) => change('genres', event.target.value)} />
                <small>Separe os gêneros por vírgula.</small></label>
              {values.status === 'wishlist' && (
                <label className="media-field"><span>Prioridade</span>
                  <select value={values.priority} onChange={(event) => change('priority', event.target.value as FormValues['priority'])}>
                    <option value="">Sem prioridade</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>
                  </select></label>
              )}
            </div>
          </section>

          <section className="media-form-panel">
            <div className="media-form-section-title"><span>02</span><div><h2>Seu progresso</h2><p>Datas reais, acompanhamento e avaliação pessoal.</p></div></div>
            <div className="media-fields-grid">
              <label className="media-field"><span>Data de início</span>
                <input type="date" value={values.startedOn} onChange={(event) => change('startedOn', event.target.value)} /></label>
              {values.status === 'completed' && <label className="media-field"><span>Data de conclusão (opcional)</span>
                <input type="date" value={values.completedOn} min={values.startedOn || undefined}
                  onChange={(event) => change('completedOn', event.target.value)} />
                <small>Se não souber o dia exato, deixe em branco. O histórico e as metas só considerarão títulos com uma data real.</small></label>}
              <label className="media-field"><span>Sua nota</span>
                <select value={values.rating} onChange={(event) => change('rating', event.target.value)}>
                  <option value="">Sem avaliação</option>
                  {Array.from({ length: 11 }, (_, idx) => (idx / 2).toString()).map((value) =>
                    <option key={value} value={value}>{Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} / 5</option>)}
                </select>
                <span className="media-form-rating"><RatingStars rating={values.rating === '' ? undefined : Number(values.rating)} /></span>
              </label>
              <label className="media-toggle"><input type="checkbox" checked={values.favorite} onChange={(event) => change('favorite', event.target.checked)} />
                <span>Adicionar aos favoritos</span></label>
            </div>
          </section>

          <section className="media-form-panel">
            <div className="media-form-section-title"><span>03</span><div><h2>Detalhes {values.kind === 'book' ? 'da leitura' : values.kind === 'movie' ? 'do filme' : 'da série'}</h2><p>Opcionais — complete quando quiser.</p></div></div>
            <div className="media-fields-grid">
              {values.kind === 'series' && <>
                <label className="media-field media-field--wide"><span>Nome da série (sem temporada)</span>
                  <input value={values.seriesTitle} placeholder="Ex.: Lost" onChange={(e) => setValues(current=>({...current,seriesTitle:e.target.value, title:current.seasonNumber ? seasonDisplayTitle(e.target.value,Number(current.seasonNumber)) : e.target.value}))} />
                  <small>Ao escolher a temporada, o título fica como “Lost — Temp. 1”. Cada temporada é um registro separado para suas metas.</small>
                </label>
                <label className="media-field"><span>Temporada do registro</span>
                  {availableSeasons.length > 0 ? (
                    <select value={values.seasonNumber} required={!editing} disabled={seasonBusy || editing} onChange={(e) => void selectSeason(e.target.value)}>
                      <option value="">Selecionar temporada</option>
                      {availableSeasons.map(s => <option key={s.number} value={s.number}>{`Temporada ${s.number}${s.episodeCount ? ` · ${s.episodeCount} episódios` : ''}`}</option>)}
                    </select>
                  ) : (
                    <input type="number" min="1" step="1" required={!editing} disabled={editing} value={values.seasonNumber} placeholder="Ex.: 1"
                      onChange={(e) => void selectSeason(e.target.value)} />
                  )}
                  <small>{editing ? 'Para registrar outra temporada, crie um novo título.' : seasonBusy ? 'Carregando temporada no TMDB...' : 'Quando a TMDB disponibilizar, usamos a capa específica da temporada.'}</small>
                </label>
              </>}
              {values.kind === 'book' && <>
                <label className="media-field"><span>Formato</span><select value={values.format} onChange={(event) => change('format', event.target.value as FormValues['format'])}>
                  <option value="">Não informado</option><option value="physical">Físico</option><option value="ebook">E-book</option><option value="audiobook">Audiobook</option>
                </select></label>
                <label className="media-field"><span>Total de páginas</span><input type="number" min="1" step="1" value={values.totalPages} onChange={(event) => change('totalPages', event.target.value)} /></label>
                {values.format === 'ebook' ? (
                  <label className="media-field"><span>Progresso no e-book (%)</span>
                    <input type="number" min="0" max="100" step="1" value={values.ebookPercent} placeholder="Ex.: 35" onChange={(e) => change('ebookPercent', e.target.value)} />
                    <small>Percentual indicado pelo leitor digital, mesmo sem número de página.</small>
                  </label>
                ) : (
                  <label className="media-field"><span>Página atual</span><input type="number" min="0" step="1" value={values.currentPage} onChange={(event) => change('currentPage', event.target.value)} /></label>
                )}
              </>}
              {values.kind === 'movie' && <label className="media-field"><span>Duração (minutos)</span>
                <input type="number" min="1" step="1" value={values.durationMinutes} onChange={(event) => change('durationMinutes', event.target.value)} /></label>}
              {values.kind === 'series' && <>
                <label className="media-field"><span>Episódios concluídos nesta temporada</span>
                  <input type="number" min="0" step="1" value={values.currentEpisode} placeholder="Ex.: 3" onChange={(e) => change('currentEpisode', e.target.value)} /></label>
                <label className="media-field"><span>Total de episódios da temporada</span>
                  <input type="number" min="1" step="1" value={values.totalEpisodes} placeholder="Ex.: 10" onChange={(e) => change('totalEpisodes', e.target.value)} /></label>
              </>}
              {(values.kind === 'movie' || values.kind === 'series') && (values.status === 'in_progress' || values.status === 'paused') &&
                <label className="media-field"><span>{values.kind === 'movie' ? 'Parei no filme em' : 'Parei no episódio em'} (HH:MM:SS)</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]{1,2}:[0-9]{2}:[0-9]{2}" placeholder="00:48:40" value={values.pausedAt}
                    onChange={(e) => change('pausedAt', e.target.value)} />
                  <small>É a posição da reprodução, não a duração total. Ex.: 00:48:40.</small>
                </label>}
              <label className="media-field media-field--wide"><span>Minha opinião / anotações</span>
                <textarea rows={5} value={values.notes} placeholder="O que essa história te fez sentir?" onChange={(event) => change('notes', event.target.value)} /></label>
            </div>
          </section>
        </div>

        <aside className="media-form-aside">
          <section className="media-form-panel media-cover-panel">
            <div className="media-form-section-title"><span>04</span><div><h2>Capa personalizada</h2><p>A imagem que você escolher.</p></div></div>
            <MediaCover kind={values.kind} title={values.title} mediaId={removeExistingCover ? undefined : record?.id}
              coverId={removeExistingCover ? undefined : record?.coverId} src={previewUrl} className="media-cover--editor" />
            <label className="btn btn--outline media-upload-label"><ImagePlus size={17} /> {file || record?.coverId ? 'Trocar capa' : 'Escolher imagem'}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
                chooseCover(event.target.files?.[0]); event.target.value = '';
              }} /></label>
            {(file || (record?.coverId && !removeExistingCover)) && <button type="button" className="media-remove-cover" onClick={() => { setCoverSelection(null); setRemoveExistingCover(true); }}>
              <Trash2 size={15} /> Remover capa
            </button>}
            {catalogHint && <p className="catalog-cover-notice" role="status">{catalogHint}</p>}
            {catalogCoverUrl && <button type="button" className="btn btn--outline catalog-use-cover" disabled={fetchingCover} onClick={() => void acceptCatalogCover(catalogCoverUrl, true, catalogCoverFallbackUrl)}>{fetchingCover ? 'Baixando capa...' : 'Usar capa do catálogo'}</button>}
            <p className="media-help">JPG, PNG ou WebP · até 12 MB. A capa será otimizada e salva na nuvem.</p>
          </section>
          <div className="media-save-panel">
            {error && <div className="media-alert media-alert--error" role="alert">{error}</div>}
            <button className="btn btn--primary media-save-button" type="submit" disabled={saving || fetchingCover}>
              {saving ? 'Salvando...' : fetchingCover ? 'Preparando capa...' : <><Save size={17} /> {editing ? 'Salvar alterações' : 'Adicionar à coleção'}</>}
            </button>
            <p><Check size={15} /> Você poderá editar tudo depois, sem criar cópias.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
