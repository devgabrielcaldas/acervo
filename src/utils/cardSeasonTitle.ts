import type { MediaRecord } from '../types/media';

export interface SeriesCardTitle {
  name: string;
  season: number;
}

/**
 * Apenas apresenta temporadas em duas linhas nos cards.
 * Nao altera item.title nem os registros persistidos.
 */
export function getSeriesCardTitle(item: MediaRecord): SeriesCardTitle | null {
  if (item.kind !== 'series') return null;

  const storedTitle = item.title.trim();
  // Compativel com titulos antigos: "Lost — Temp. 1" / "Lost - Temporada 1".
  const suffix = /^(.*?)\s*[—–-]\s*Temp(?:orada)?\.?\s*(\d{1,3})\s*$/i.exec(storedTitle);
  if (suffix?.[1]?.trim()) {
    const season = Number(suffix[2]);
    if (season > 0) return { name: suffix[1].trim(), season };
  }

  // Para os registros novos que ja guardam os dados estruturados.
  const season = item.seasonNumber;
  const name = item.seriesTitle?.trim() || storedTitle;
  if (Number.isInteger(season) && season !== undefined && season > 0 && name) {
    return { name, season };
  }

  // Series antigas sem temporada definida continuam com o titulo original.
  return null;
}
