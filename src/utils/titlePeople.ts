import type { BookCharacter } from '../types/media';

/** Texto redigido pelo usuário, salvo dentro do JSON do próprio livro. */
export function cleanBookCharacters(input: BookCharacter[] | undefined): BookCharacter[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > 30) {
    throw new Error('Você pode cadastrar até 30 personagens por livro.');
  }
  const seen = new Set<string>();
  const output: BookCharacter[] = [];
  for (const character of input) {
    if (!character || typeof character.name !== 'string' || typeof character.description !== 'string') {
      throw new Error('Informe um nome e uma descrição válidos para cada personagem.');
    }
    const name = character.name.trim().replace(/\s+/g, ' ');
    const description = character.description.trim();
    if (!name || !description) throw new Error('Preencha o nome e a descrição de todos os personagens.');
    if (name.length > 100) throw new Error('O nome do personagem deve ter até 100 caracteres.');
    if (description.length > 400) throw new Error('A descrição deve ter até 400 caracteres.');
    const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    if (seen.has(key)) throw new Error(`O personagem “${name}” está repetido.`);
    seen.add(key);
    output.push({ name, description });
  }
  return output;
}

/** Nunca aceita URLs arbitrárias no src de um ator. */
export function safeTmdbProfileUrl(profilePath: unknown): string | undefined {
  if (typeof profilePath !== 'string' || !/^\/[A-Za-z0-9_-]{3,90}\.(?:jpg|jpeg|png|webp)$/i.test(profilePath)) return undefined;
  return `https://image.tmdb.org/t/p/w185${profilePath}`;
}
