import type { AnnualGoal, MediaCategory, MediaRecord } from '../types/media';

export const categories = [
  { kind: 'book', field: 'books', label: 'Livros', completedLabel: 'Livros concluídos' },
  { kind: 'movie', field: 'movies', label: 'Filmes', completedLabel: 'Filmes assistidos' },
  { kind: 'series', field: 'series', label: 'Séries', completedLabel: 'Séries concluídas' },
] as const satisfies ReadonlyArray<{
  kind: MediaCategory;
  field: 'books' | 'movies' | 'series';
  label: string;
  completedLabel: string;
}>;

export type CategoryField = (typeof categories)[number]['field'];
export type Counts = Record<CategoryField, number>;
export type MonthlyCounts = Counts & { month: number; total: number };
export type RatingBar = { rating: number; count: number };
export type YearStatistics = {
  year: number;
  counts: Counts;
  total: number;
  months: MonthlyCounts[];
  averageRating: number | null;
  ratedCount: number;
  ratings: RatingBar[];
};

export const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

function emptyCounts(): Counts {
  return { books: 0, movies: 0, series: 0 };
}

/** Usa exclusivamente a data real de conclusão, sem conversão de fuso. */
export function calculateYearStatistics(items: readonly MediaRecord[], year: number): YearStatistics {
  const counts = emptyCounts();
  const months = monthNames.map((_, index): MonthlyCounts => ({
    ...emptyCounts(), month: index + 1, total: 0,
  }));
  const ratings = Array.from({ length: 11 }, (_, index): RatingBar => ({ rating: index / 2, count: 0 }));
  let ratingSum = 0;
  let ratedCount = 0;
  let total = 0;

  for (const item of items) {
    if (item.status !== 'completed' || !item.completedOn || !item.completedOn.startsWith(`${year}-`)) continue;
    const monthIndex = Number(item.completedOn.slice(5, 7)) - 1;
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) continue;

    const category = categories.find((entry) => entry.kind === item.kind);
    if (!category) continue;
    counts[category.field] += 1;
    months[monthIndex][category.field] += 1;
    months[monthIndex].total += 1;
    total += 1;

    if (item.rating !== undefined && Number.isInteger(item.rating * 2) && item.rating >= 0 && item.rating <= 5) {
      ratedCount += 1;
      ratingSum += item.rating;
      ratings[item.rating * 2].count += 1;
    }
  }

  return {
    year, counts, total, months,
    averageRating: ratedCount ? ratingSum / ratedCount : null,
    ratedCount, ratings,
  };
}

export function getAvailableYears(items: readonly MediaRecord[], goals: readonly AnnualGoal[], selectedYear: number): number[] {
  const current = new Date().getFullYear();
  const years = new Set([current - 1, current, current + 1, selectedYear]);
  for (const item of items) {
    if (item.status === 'completed' && item.completedOn) {
      const year = Number(item.completedOn.slice(0, 4));
      if (Number.isSafeInteger(year) && year > 0) years.add(year);
    }
  }
  for (const goal of goals) years.add(goal.year);
  return [...years].filter((year) => Number.isSafeInteger(year) && year > 0).sort((a, b) => b - a);
}

export function goalProgress(count: number, target: number): number | null {
  return target > 0 ? (count / target) * 100 : null;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
