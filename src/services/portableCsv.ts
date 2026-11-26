import type { AnnualGoal, MediaRecord } from '../types/media';

/** CSV legível em planilhas. Não substitui o backup JSON usado na restauração. */
const DELIMITER = ';';

function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value);
  // Excel/LibreOffice interpretam estas entradas como fórmulas, mesmo se forem citadas.
  // Prefixo de apóstrofo impede execução e preserva a informação textual.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRows(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(DELIMITER)).join('\r\n') + '\r\n';
}

const mediaColumns = [
  'ID', 'Tipo', 'Título', 'Status', 'Ano', 'Gêneros', 'Favorito', 'Nota',
  'Início', 'Conclusão', 'Autor', 'Formato', 'Páginas', 'Página atual',
  'Progresso ebook (%)', 'Diretor', 'Duração (min)', 'Tempo pausado (s)',
  'Série', 'Temporada', 'Temporada atual', 'Episódios concluídos',
  'Total de temporadas', 'Total de episódios', 'TMDB ID', 'Prioridade',
  'Observações', 'Personagens', 'Criado em', 'Atualizado em',
];

/** Todos os itens, inclusive séries por temporada, com ordem estável. */
export function mediaToCsv(records: readonly MediaRecord[]): string {
  const rows: unknown[][] = [mediaColumns];
  for (const item of records) {
    rows.push([
      item.id, item.kind, item.title, item.status, item.releaseYear,
      item.genres.join(' | '), item.favorite ? 'Sim' : 'Não', item.rating,
      item.startedOn, item.completedOn,
      item.kind === 'book' ? item.author : undefined,
      item.kind === 'book' ? item.format : undefined,
      item.kind === 'book' ? item.totalPages : undefined,
      item.kind === 'book' ? item.currentPage : undefined,
      item.kind === 'book' ? item.ebookPercent : undefined,
      item.kind === 'movie' ? item.director : undefined,
      item.kind === 'movie' ? item.durationMinutes : undefined,
      item.kind !== 'book' ? item.pausedAtSeconds : undefined,
      item.kind === 'series' ? item.seriesTitle : undefined,
      item.kind === 'series' ? item.seasonNumber : undefined,
      item.kind === 'series' ? item.currentSeason : undefined,
      item.kind === 'series' ? item.currentEpisode : undefined,
      item.kind === 'series' ? item.totalSeasons : undefined,
      item.kind === 'series' ? item.totalEpisodes : undefined,
      item.kind !== 'book' ? item.tmdbId : undefined,
      item.priority, item.notes,
      item.kind === 'book' ? (item.characters ?? []).map(person => `${person.name}: ${person.description}`).join(' | ') : undefined,
      item.createdAt, item.updatedAt,
    ]);
  }
  return csvRows(rows);
}

export function goalsToCsv(goals: readonly AnnualGoal[]): string {
  return csvRows([
    ['Ano', 'Meta de livros', 'Meta de filmes', 'Meta de séries', 'Atualizada em'],
    ...goals.map(goal => [goal.year, goal.books, goal.movies, goal.series, goal.updatedAt]),
  ]);
}
