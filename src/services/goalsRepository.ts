import { cloudSaveGoal,cloudGetGoal,cloudListGoals } from './cloudRepository';
import type { AnnualGoal } from '../types/media';

export type AnnualGoalInput = Pick<AnnualGoal, 'year' | 'books' | 'movies' | 'series'>;

/** Uma meta por ano. Valores zero significam que não há meta definida para a categoria. */
export async function saveAnnualGoal(input: AnnualGoalInput): Promise<AnnualGoal> {
  const values = [input.year, input.books, input.movies, input.series];
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0) || input.year < 1) {
    throw new Error('Informe um ano válido e metas inteiras não negativas.');
  }
  const goal: AnnualGoal = { ...input, updatedAt: new Date().toISOString() };
  return cloudSaveGoal(goal);
}

export async function getAnnualGoal(year: number): Promise<AnnualGoal | undefined> {
  return cloudGetGoal(year);
}

export async function listAnnualGoals(): Promise<AnnualGoal[]> {
  const goals = await cloudListGoals();
  return goals.sort((a, b) => b.year - a.year);
}
