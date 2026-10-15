import { getDatabase } from './database';
import type { AnnualGoal } from '../types/media';

export type AnnualGoalInput = Pick<AnnualGoal, 'year' | 'books' | 'movies' | 'series'>;

/** Uma meta por ano. Valores zero significam que não há meta definida para a categoria. */
export async function saveAnnualGoal(input: AnnualGoalInput): Promise<AnnualGoal> {
  const values = [input.year, input.books, input.movies, input.series];
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0) || input.year < 1) {
    throw new Error('Informe um ano válido e metas inteiras não negativas.');
  }
  const goal: AnnualGoal = { ...input, updatedAt: new Date().toISOString() };
  const db = await getDatabase();
  await db.put('goals', goal);
  return goal;
}

export async function getAnnualGoal(year: number): Promise<AnnualGoal | undefined> {
  const db = await getDatabase();
  return db.get('goals', year);
}

export async function listAnnualGoals(): Promise<AnnualGoal[]> {
  const db = await getDatabase();
  const goals = await db.getAll('goals');
  return goals.sort((a, b) => b.year - a.year);
}
