import '../../styles/quality.css';

/** Carregamento não bloqueante, respeitando a preferência por movimento reduzido. */
export function MediaGridSkeleton({ count = 6 }: { count?: number }) {
  return <div className="media-grid acervo-skeleton-grid" role="status" aria-label="Carregando títulos" aria-busy="true">
    {Array.from({ length: count }, (_, index) => <div className="acervo-skeleton-card" key={index} aria-hidden="true">
      <div className="acervo-skeleton-cover" />
      <div className="acervo-skeleton-line acervo-skeleton-line--long" />
      <div className="acervo-skeleton-line acervo-skeleton-line--short" />
      <div className="acervo-skeleton-line acervo-skeleton-line--tiny" />
    </div>)}
    <span className="sr-only">Carregando sua coleção...</span>
  </div>;
}
