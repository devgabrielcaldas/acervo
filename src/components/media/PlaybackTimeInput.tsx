import { useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import {
  deletePlaybackDigit, finishPlaybackTime, maskPlaybackTime,
  playbackCaretForDigits, playbackDigits,
} from '../../utils/playbackTimeMask';

interface PlaybackTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Campo HH:MM:SS com teclado numérico e separadores automáticos (iPhone/Android/desktop). */
export function PlaybackTimeInput({
  value, onChange, disabled = false, placeholder = '00:48:40',
}: PlaybackTimeInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const nextCaret = useRef<number | null>(null);

  // Atualiza o caret depois que o React refletir o novo valor controlado.
  useLayoutEffect(() => {
    const position = nextCaret.current;
    nextCaret.current = null;
    if (position === null || !input.current || document.activeElement !== input.current) return;
    input.current.setSelectionRange(position, position);
  }, [value]);

  function changeText(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.currentTarget.value;
    const caret = event.currentTarget.selectionStart ?? raw.length;
    const digitsToCaret = playbackDigits(raw.slice(0, caret)).length;
    const formatted = maskPlaybackTime(raw);
    nextCaret.current = playbackCaretForDigits(formatted, digitsToCaret);
    onChange(formatted);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const current = event.currentTarget;
    const start = current.selectionStart ?? 0;
    const end = current.selectionEnd ?? 0;
    if (start !== end) return; // Seleções de texto continuam com o comportamento nativo.
    const colon = event.key === 'Backspace' ? value[start - 1] : value[start];
    if (colon !== ':') return;
    event.preventDefault();
    const digitsBefore = playbackDigits(value.slice(0, start)).length;
    const index = event.key === 'Backspace' ? digitsBefore - 1 : digitsBefore;
    const formatted = deletePlaybackDigit(value, index);
    nextCaret.current = playbackCaretForDigits(formatted, Math.max(0, index));
    onChange(formatted);
  }

  function blur() {
    const complete = finishPlaybackTime(value);
    if (complete !== value) onChange(complete);
  }

  return (
    <input
      ref={input}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={8}
      pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
      placeholder={placeholder}
      title="Digite os números de horas, minutos e segundos. Ex.: 011740 vira 01:17:40."
      value={value}
      disabled={disabled}
      onChange={changeText}
      onKeyDown={keyDown}
      onBlur={blur}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    />
  );
}
