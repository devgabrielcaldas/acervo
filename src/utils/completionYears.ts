/** Ano de conclusão para filtros da coleção. Não usa ano de lançamento ou cadastro. */
export type CompletionDatedRecord = { status: string; completedOn?: string };

export function getCompletionYear(record: CompletionDatedRecord): string | null {
  if (record.status !== 'completed' || !record.completedOn) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(record.completedOn);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return match[1];
}

/** Anos existentes, sem duplicatas, do mais recente para o mais antigo. */
export function listCompletionYears(records: readonly CompletionDatedRecord[]): string[] {
  return [...new Set(records.map(getCompletionYear).filter((year): year is string => year !== null))]
    .sort((a, b) => Number(b) - Number(a));
}
