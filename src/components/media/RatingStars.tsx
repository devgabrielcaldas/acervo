import { Star, StarHalf } from 'lucide-react';

export function RatingStars({ rating, showValue = true }: { rating?: number; showValue?: boolean }) {
  if (rating === undefined) return <span className="rating-empty">Sem avaliação</span>;
  return (
    <span className="rating-stars" aria-label={`Avaliação: ${rating.toLocaleString('pt-BR')} de 5 estrelas`}>
      <span className="rating-stars__icons" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const rest = rating - index;
          return rest >= 1 ? <Star key={index} size={15} fill="currentColor" />
            : rest >= 0.5 ? <StarHalf key={index} size={15} fill="currentColor" />
              : <Star key={index} size={15} />;
        })}
      </span>
      {showValue && <strong>{rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>}
    </span>
  );
}
