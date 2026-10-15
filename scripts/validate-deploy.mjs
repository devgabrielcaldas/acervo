/** Teste simples da estrutura de publicação. Não acessa IndexedDB nem modifica dados. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const failures = [];
const mustExist = ['index.html', '_redirects', 'assets'];

for (const item of mustExist) {
  if (!existsSync(join(dist, item))) failures.push(`Não encontrado em dist/: ${item}`);
}
if (existsSync(join(dist, 'index.html'))) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  if (!/<html[^>]+lang="pt-BR"/i.test(html)) failures.push('index.html sem lang="pt-BR".');
  if (!/\/assets\/[^"']+\.js/.test(html)) failures.push('Não foi encontrado o JS compilado no HTML.');
}
if (existsSync(join(dist, '_redirects'))) {
  const redirects = readFileSync(join(dist, '_redirects'), 'utf8').trim();
  if (!/^\/\*\s+\/index\.html\s+200\s*$/m.test(redirects)) {
    failures.push('O arquivo _redirects não contém a regra SPA esperada.');
  }
}
if (existsSync(join(dist, 'assets')) && statSync(join(dist, 'assets')).isDirectory()) {
  if (!readdirSync(join(dist, 'assets')).some((file) => file.endsWith('.js'))) {
    failures.push('Nenhum arquivo JavaScript encontrado em dist/assets.');
  }
}
if (failures.length) {
  console.error('Falha na validação da publicação:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Acervo: pasta dist validada. Arquivos e rota SPA prontos para publicação.');
}
