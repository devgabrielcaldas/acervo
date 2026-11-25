import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = p => fs.readFileSync(path.join(cwd,p),'utf8');

for (const file of [
  'src/pages/MediaFormPage.tsx','src/pages/CollectionPage.tsx','src/components/layout/AppLayout.tsx',
  'src/components/layout/GlobalSearchDialog.tsx','src/components/media/MediaListRow.tsx',
  'src/utils/smartCollection.ts','src/services/savedViewsRepository.ts'
]) {
  test(`TS/TSX sem erro de sintaxe: ${file}`,() => {
    const result=ts.transpileModule(read(file),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
    const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error) || [];
    assert.equal(errors.length,0,errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText,'\n')).join('\n'));
  });
}

test('busca global usa coleção autenticada e não faz pesquisa externa',()=>{
  const c=read('src/components/layout/GlobalSearchDialog.tsx');
  assert.match(c,/listMedia\(\)/);
  assert.match(c,/matchesMediaSearch/);
  assert.doesNotMatch(c,/TMDB|googleBooks|catalogSearch|https:\/\//i);
  assert.match(c,/aria-modal="true"/);
  assert.match(c,/event\.key === 'Escape'/);
});
test('atalho Ctrl/Cmd+K ligado ao modal e fechamento',()=>{
  const c=read('src/components/layout/AppLayout.tsx');
  assert.match(c,/event\.ctrlKey \|\| event\.metaKey/);
  assert.match(c,/<GlobalSearchDialog onClose=/);
});
test('aviso de duplicado não salva sem confirmação',()=>{
  const c=read('src/pages/MediaFormPage.tsx');
  assert.match(c,/!editing && potentialDuplicates\.length > 0 && !duplicatesChecked/);
  assert.match(c,/Cadastrar mesmo assim/);
  assert.match(c,/role="status"/);
});
test('filtros favoritos não salvam dados de contas diferentes',()=>{
  const c=read('src/services/savedViewsRepository.ts');
  assert.match(c,/auth\.getUser\(\)/);
  assert.match(c,/\.eq\('user_id', uid\)/);
  const sql=read('supabase/02-filtros-salvos.sql');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql,/revoke all on public\.acervo_saved_views from public, anon/);
  assert.doesNotMatch(sql,/drop table.*acervo_media|truncate|delete from public\.acervo_media/i);
});
test('visualização em lista reutiliza progresso, capas e favoritos',()=>{
  const c=read('src/components/media/MediaListRow.tsx');
  assert.match(c,/<MediaCover/);
  assert.match(c,/<MediaProgress/);
  assert.match(c,/<RatingStars/);
  assert.match(c,/onFavorite/);
  assert.match(c,/onStart/);
});
test('agrupamento não escreve no banco nem altera registros',()=>{
  const c=read('src/utils/smartCollection.ts');
  assert.match(c,/map\(g => \(\{ \.\.\.g, items: \[\.\.\.g\.items\]/);
  assert.doesNotMatch(c,/updateMedia|cloudSaveMedia|\.from\(/);
});
test('script SQL não está vinculado a create table auth.users',()=>{
  const c=read('supabase/02-filtros-salvos.sql');
  assert.doesNotMatch(c,/create\s+table\s+auth\.users/i);
  assert.match(c,/create table if not exists public\.acervo_saved_views/i);
});
test('CSS foi importado na entrada React',()=>{
  assert.match(read('src/main.tsx'),/smart-collection\.css/);
});
