import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaybackTime } from '../src/utils/progress.ts';
import {
  playbackDigits, maskPlaybackTime, finishPlaybackTime,
  playbackCaretForDigits, deletePlaybackDigit,
} from '../src/utils/playbackTimeMask.ts';

test('teclado numérico insere os separadores progressivamente', () => {
  assert.deepEqual(['0','01','011','0117','01174','011740'].map(maskPlaybackTime),
    ['0','01','01:1','01:17','01:17:4','01:17:40']);
});
test('valor 004840 representa 00:48:40', () => {
  assert.equal(maskPlaybackTime('004840'), '00:48:40');
});
test('aceita colagem com pontuação e completa HH:MM', () => {
  assert.equal(maskPlaybackTime('01:17:40'), '01:17:40');
  assert.equal(finishPlaybackTime('0117'), '01:17:00');
  assert.equal(finishPlaybackTime('01:17'), '01:17:00');
});
test('entrada vazia permanece vazia (remover pausa)', () => {
  assert.equal(maskPlaybackTime(''), '');
  assert.equal(finishPlaybackTime(''), '');
});
test('remove letras e ignora excesso de números', () => {
  assert.equal(maskPlaybackTime('a01b17x40 99'), '01:17:40');
  assert.equal(playbackDigits('01:17:40'), '011740');
});
test('o cursor acompanha os dígitos mesmo com os dois-pontos', () => {
  assert.equal(playbackCaretForDigits('01:17:40', 0), 0);
  assert.equal(playbackCaretForDigits('01:17:40', 2), 2);
  assert.equal(playbackCaretForDigits('01:17:40', 3), 4);
  assert.equal(playbackCaretForDigits('01:17:40', 6), 8);
});
test('backspace junto do separador apaga um dígito em vez de ficar travado', () => {
  assert.equal(deletePlaybackDigit('01:17:40', 1), '01:74:0');
  assert.equal(deletePlaybackDigit('00:48:40', -1), '00:48:40');
});
test('HH:MM:SS continua incompleto quando o usuário digitou só 5 algarismos', () => {
  assert.equal(finishPlaybackTime('01174'), '01:17:4');
});

test('salva HH:MM:SS com a mesma conversão para segundos já usada pelo Acervo', () => {
  assert.equal(parsePlaybackTime(maskPlaybackTime('011740')), 4660);
  assert.equal(parsePlaybackTime(finishPlaybackTime('0117')), 4620);
});
test('validação existente continua rejeitando minutos ou segundos >= 60', () => {
  assert.throws(() => parsePlaybackTime(maskPlaybackTime('019940')), /minutos e segundos/);
  assert.throws(() => parsePlaybackTime(maskPlaybackTime('011799')), /minutos e segundos/);
});
