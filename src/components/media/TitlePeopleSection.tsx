import { useEffect, useState } from 'react';
import { BookOpen, ImageOff, Pencil, Plus, RefreshCw, Save, Trash2, Users, X } from 'lucide-react';
import type { BookCharacter, MediaRecord } from '../../types/media';
import { updateMedia } from '../../services/mediaRepository';
import { loadTitleCast } from '../../services/titlePeopleCatalog';
import type { CastPerson, TitleCast } from '../../services/titlePeopleCatalog';
import { cleanBookCharacters, safeTmdbProfileUrl } from '../../utils/titlePeople';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function Portrait({ person }: { person: CastPerson }) {
  const [broken, setBroken] = useState(false);
  const photo = safeTmdbProfileUrl(person.profilePath);
  return <div className="acervo-people__portrait">
    {photo && !broken ? <img src={photo} alt={`Foto de ${person.name}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      : <ImageOff size={23} strokeWidth={1.4} aria-hidden="true" />}
  </div>;
}

function BookPeople({ item, onSaved }: { item: Extract<MediaRecord, { kind: 'book' }>; onSaved: (item: MediaRecord) => void }) {
  const [draft, setDraft] = useState<BookCharacter[]>(item.characters ?? []);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(item.characters ?? []); setEditing(false); setError(''); }, [item.id, item.characters]);
  const characters = item.characters ?? [];

  function start() { setDraft(characters.map(row => ({ ...row }))); setEditing(true); setError(''); }
  function cancel() { setDraft(characters.map(row => ({ ...row }))); setEditing(false); setError(''); }
  async function save() {
    if (saving) return;
    setSaving(true); setError('');
    try {
      const cleaned = cleanBookCharacters(draft) ?? [];
      const updated = await updateMedia(item.id, { ...item, characters: cleaned });
      onSaved(updated);
      setDraft(cleaned);
      setEditing(false);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(false); }
  }
  return <section className="media-form-panel acervo-title-people" aria-labelledby="acervo-title-people-heading">
    <div className="acervo-people__heading">
      <div><span className="section-kicker">PERSONAGENS DA HISTÓRIA</span><h2 id="acervo-title-people-heading">Quem faz parte desta história</h2>
        <p>Registre quem é quem, com suas próprias palavras e sem spoilers, se preferir.</p></div>
      {!editing && <button className="btn btn--outline acervo-people__edit" type="button" onClick={start}><Pencil size={15}/>{characters.length ? 'Editar personagens' : 'Adicionar personagens'}</button>}
    </div>
    {error && <p role="alert" className="media-alert media-alert--error">{error}</p>}
    {editing ? <div className="acervo-people__editor">
      {draft.map((row, index) => <div className="acervo-people__edit-row" key={index}>
        <label className="media-field"><span>Nome do personagem {index + 1}</span>
          <input maxLength={100} value={row.name} placeholder="Ex.: Dante" onChange={e => setDraft(values => values.map((value, i) => i === index ? { ...value, name: e.target.value } : value))}/></label>
        <label className="media-field"><span>Quem é?</span>
          <textarea rows={2} maxLength={400} value={row.description} placeholder="Uma breve descrição, escrita por você" onChange={e => setDraft(values => values.map((value, i) => i === index ? { ...value, description: e.target.value } : value))}/></label>
        <button type="button" className="acervo-people__remove" aria-label={`Remover personagem ${index + 1}`} onClick={() => setDraft(values => values.filter((_, i) => i !== index))}><Trash2 size={15}/> Remover</button>
      </div>)}
      <div className="acervo-people__editor-actions">
        <button type="button" className="btn btn--outline" disabled={saving || draft.length >= 30} onClick={() => setDraft(values => [...values, { name: '', description: '' }])}><Plus size={16}/> Adicionar</button>
        <button type="button" className="btn btn--outline" disabled={saving} onClick={cancel}><X size={16}/> Cancelar</button>
        <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void save()}><Save size={16}/>{saving ? 'Salvando...' : 'Salvar personagens'}</button>
      </div>
      <p className="acervo-people__help">Até 30 personagens por livro. As anotações ficam salvas na sua própria conta e entram no backup existente.</p>
    </div> : characters.length ? <div className="acervo-people__book-grid">{characters.map((character, index) =>
      <article className="acervo-people__book-person" key={`${character.name}-${index}`}><div className="acervo-people__symbol"><BookOpen size={18} aria-hidden="true" /></div>
        <div><h3>{character.name}</h3><p>{character.description}</p></div></article>)}</div>
      : <p className="acervo-people__empty">Nenhum personagem cadastrado ainda. Você pode adicionar os principais personagens quando quiser.</p>}
  </section>;
}

function MoviePeople({ item }: { item: Extract<MediaRecord, { kind: 'movie' | 'series' }> }) {
  const [result, setResult] = useState<TitleCast>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const id = item.kind === 'series' ? item.tmdbId : item.tmdbId;
  const season = item.kind === 'series' ? item.seasonNumber : undefined;
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setResult(undefined); setShowAll(false);
    void loadTitleCast(item).then(data => { if (active) setResult(data); })
      .catch(reason => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // A busca deve refazer quando muda a obra, temporada ou quando a pessoa tenta novamente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.kind, item.title, item.releaseYear, id, season, retry]);
  const people = result?.cast ?? [];
  return <section className="media-form-panel acervo-title-people" aria-labelledby="acervo-title-people-heading">
    <div className="acervo-people__heading"><div><span className="section-kicker">ELENCO DA OBRA</span><h2 id="acervo-title-people-heading">Elenco e personagens</h2>
      <p>{item.kind === 'series' && item.seasonNumber ? `Elenco da temporada ${item.seasonNumber}, quando disponível no catálogo.` : 'Atrizes, atores e seus personagens.'}</p></div>
      {error && <button className="btn btn--outline acervo-people__edit" type="button" onClick={() => setRetry(n => n + 1)}><RefreshCw size={15}/> Tentar novamente</button>}
    </div>
    {loading ? <div role="status" className="acervo-people__loading">Consultando elenco...</div>
      : error ? <p role="alert" className="acervo-people__empty">{error}</p>
        : result?.unmatched ? <p className="acervo-people__empty">Não encontramos uma correspondência segura no TMDB para esta obra. Confira o título e o ano de lançamento no cadastro.</p>
          : people.length ? <>
            {result?.matchedBy === 'title' && <p className="acervo-people__match">Elenco identificado automaticamente como “{result.matchedTitle}”. Confira se corresponde à sua edição.</p>}
            <div className="acervo-people__cast-grid">{(showAll ? people : people.slice(0, 12)).map(person =>
              <article className="acervo-people__cast-member" key={`${person.id}-${person.character}`}>
                <Portrait person={person} /><div><h3>{person.name}</h3><p>{person.character}</p></div></article>)}</div>
            {people.length > 12 && <button type="button" className="btn btn--outline acervo-people__more" onClick={() => setShowAll(v => !v)}>{showAll ? 'Mostrar menos' : `Ver elenco completo (${people.length})`}</button>}
          </> : <p className="acervo-people__empty">O catálogo ainda não disponibiliza o elenco desta obra.</p>}
    <div className="acervo-people__credits"><Users size={14} aria-hidden="true" /><span>Dados e fotos de <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>. Este produto utiliza a API TMDB, mas não é endossado ou certificado pelo TMDB.</span></div>
  </section>;
}

export function TitlePeopleSection({ item, onSaved }: { item: MediaRecord; onSaved: (item: MediaRecord) => void }) {
  return item.kind === 'book' ? <BookPeople item={item} onSaved={onSaved} /> : <MoviePeople item={item}/>;
}
