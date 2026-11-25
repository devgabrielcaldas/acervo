/**
 * Máscara de posição de reprodução — não é uma hora do relógio.
 * O usuário digita até seis números, sem precisar inserir ':' no teclado do celular.
 * Não converte HH:MM para HH:MM:SS enquanto o campo está em edição.
 */
export function playbackDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

/** Formata progressivamente: 0 → 01 → 01:1 → 01:17 → 01:17:4 → 01:17:40. */
export function maskPlaybackTime(value: string): string {
  const digits = playbackDigits(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
}

/** Se foram digitadas só horas e minutos (0117), assume zero segundos no blur. */
export function finishPlaybackTime(value: string): string {
  const digits = playbackDigits(value);
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}:00`;
  return maskPlaybackTime(value);
}

/** Mantém o cursor na posição lógica mesmo quando a máscara insere os dois-pontos. */
export function playbackCaretForDigits(maskedValue: string, count: number): number {
  if (count <= 0) return 0;
  let found = 0;
  for (let i = 0; i < maskedValue.length; i++) {
    if (/\d/.test(maskedValue[i])) {
      found++;
      if (found === count) return i + 1;
    }
  }
  return maskedValue.length;
}

/** Remoção nas bordas de ':' — evita Backspace aparentemente travado. */
export function deletePlaybackDigit(value: string, digitIndex: number): string {
  const digits = playbackDigits(value);
  if (digitIndex < 0 || digitIndex >= digits.length) return maskPlaybackTime(value);
  return maskPlaybackTime(digits.slice(0, digitIndex) + digits.slice(digitIndex + 1));
}
