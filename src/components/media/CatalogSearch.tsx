import { useEffect, useRef, useState } from 'react';
import { BookMarked, CheckCircle2, Film, LoaderCircle, Search, Tv } from 'lucide-react';
import type { CatalogItem, CatalogKind } from '../../services/catalogClient';
import { loadCatalogDetails, searchCatalog } from '../../services/catalogClient';

interface CatalogSearchProps {
  kind: CatalogKind;
  query: string;
  enabled: boolean;
  onSelect: (item: CatalogItem) => Promise<void>;
}
const icons = {book:BookMarked,movie:Film,series:Tv};
const providers = {'google-books':'Google Books','open-library':'Open Library','tmdb':'TMDB'};

export function CatalogSearch({kind,query,enabled,onSelect}:CatalogSearchProps) {
  const [results,setResults]=useState<CatalogItem[]>([]);
  const [warnings,setWarnings]=useState<string[]>([]);
  const [resolvedQuery,setResolvedQuery]=useState('');
  const [loading,setLoading]=useState(false);
  const [selectedId,setSelectedId]=useState<string>();
  const [error,setError]=useState('');
  const requestId=useRef(0);
  const trimmed=query.trim();

  useEffect(()=>{
    const request=++requestId.current;
    if(!enabled||trimmed.length<3){return;}
    const timer=window.setTimeout(()=>{
      void searchCatalog(kind,trimmed).then(({results,warnings})=>{
        if(request!==requestId.current)return;
        setResults(results);setWarnings(warnings??[]);setResolvedQuery(`${kind}:${trimmed}`);setError('');
      }).catch((reason:unknown)=>{
        if(request!==requestId.current)return;
        setResults([]);setResolvedQuery(`${kind}:${trimmed}`);setError(reason instanceof Error?reason.message:'Falha ao pesquisar.');
      }).finally(()=>{if(request===requestId.current)setLoading(false);});
    },450);
    return()=>{window.clearTimeout(timer);requestId.current++;};
  },[kind,trimmed,enabled]);

  // Consultas em andamento têm indicador somente depois do debounce para evitar piscar.
  useEffect(()=>{
    if(!enabled||trimmed.length<3)return;
    const timer=window.setTimeout(()=>setLoading(true),400);
    return()=>window.clearTimeout(timer);
  },[kind,trimmed,enabled]);

  if(!enabled||trimmed.length<3)return null;
  const current=resolvedQuery===`${kind}:${trimmed}`;
  const displayResults=current?results:[];
  const Icon=icons[kind];
  async function select(item:CatalogItem){
    if (kind==='book' && item.language && item.language!=='pt') {
      const accept=window.confirm('Esta edição não está identificada como brasileira/portuguesa. Deseja mesmo usar os dados em outro idioma?');
      if (!accept) return;
    }
    setSelectedId(`${item.source}:${item.id}`);setError('');
    try{await onSelect(await loadCatalogDetails(item));}
    catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível selecionar o título.');}
    finally{setSelectedId(undefined);}
  }
  return (
    <div className="catalog-search" aria-label="Resultados do catálogo">
      <div className="catalog-search__heading"><Search size={15} aria-hidden="true"/><strong>Busca inteligente</strong><span>{kind==='book'?'Edições em português primeiro · escolha a edição correta':'Escolha a obra ou continue manualmente'}</span></div>
      {loading && <p className="catalog-search__message" role="status"><LoaderCircle className="catalog-spinner" size={15}/> Procurando títulos...</p>}
      {!loading && current && displayResults.length===0 && !error && <p className="catalog-search__message">Nenhum resultado encontrado. Você pode continuar o cadastro normalmente.</p>}
      {error && <p className="catalog-search__message catalog-search__message--error" role="alert">{error} Você também pode preencher manualmente.</p>}
      {!loading && current && displayResults.length>0 && <div className="catalog-search__results">
        {displayResults.slice(0,8).map(item=>{
          const key=`${item.source}:${item.id}`;
          return <button type="button" className="catalog-search__result" key={key} disabled={Boolean(selectedId)} onClick={()=>void select(item)}>
            <span className="catalog-search__poster">{item.coverUrl?<img alt="" src={item.coverUrl} loading="lazy" referrerPolicy="no-referrer"/>:<Icon size={23} aria-hidden="true"/>}</span>
            <span className="catalog-search__description"><strong>{item.title}</strong><small>{[item.creator,item.year,item.edition].filter(Boolean).join(' · ')||'Dados do catálogo'}</small><em>{providers[item.source]}{kind==='book' ? item.language==='pt' ? ' · Edição em português' : ' · Idioma não confirmado' : ''}</em></span>
            {selectedId===key?<LoaderCircle className="catalog-spinner" size={17}/>:<CheckCircle2 size={17} aria-hidden="true"/>}
          </button>;
        })}
      </div>}
      {current && warnings.length>0 && <p className="catalog-search__note">{warnings.join(' ')} Alguns resultados podem não aparecer.</p>}
      <p className="catalog-search__note">Priorize a edição brasileira. O ano de publicação e a capa podem variar entre edições; confira antes de salvar.</p>
      {kind!=='book'&&<p className="catalog-search__credit"><img className="catalog-search__tmdb-logo" src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" alt="TMDB" loading="lazy"/> Créditos: informações fornecidas pela <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>}
    </div>
  );
}
