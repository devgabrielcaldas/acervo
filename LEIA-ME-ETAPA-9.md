# Acervo — Etapa 9: autenticação e Supabase

Este ZIP contém os arquivos **NOVOS/MODIFICADOS**. Faça backup JSON dos dados antigos **ANTES** de instalá-lo no seu projeto (abra a versão atual em localhost, Configurações > Exportar).

## Instalação (Linux Mint)

1. Dentro de ~/Documentos/acervo, coloque este ZIP e execute `unzip -o acervo-etapa9-supabase.zip`.
2. Execute `npm install @supabase/supabase-js`.
3. Crie um projeto Supabase no painel, na região mais próxima. Não habilite registros públicos.
4. Em SQL Editor > New query, execute **inteiro** `supabase/01-estrutura.sql`.
5. Em Authentication > Users, crie seu usuário manualmente, informe seu e-mail e uma senha NOVA e FORTE. Marque o e-mail como confirmado, se o painel oferecer essa opção.
6. Em Authentication > Providers > Email, **desative novas inscrições (Allow new users to sign up)**. Deixe e-mail/senha habilitado.
7. Copie `.env.example` para `.env.local` com `cp .env.example .env.local`, substitua Project URL e Publishable Key pelos valores do painel (Connect / Project Settings > API Keys). Nunca use a secret key ou service_role.
8. Execute `npm run lint`, `npm run build`, `npm run dev`. Abra o localhost e teste o login. Se houver erro, não faça deploy antes de corrigir.
9. Em Configurações > Importar backup, selecione o JSON exportado no passo inicial; confira contagem e capas; confirme RESTAURAR. Recarregue e confira os registros e metas.
10. No painel da Netlify > Project configuration > Environment variables, crie VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY com os mesmos valores e ative-as para builds de produção. Trigger deploy / Clear cache and deploy site, se necessário.
11. Faça `git add .`, `git status`, `git commit -m 'feat: autenticacao e sincronizacao Supabase'` e `git push` para atualizar a Netlify. `.env.local` não deve aparecer no `git status`.
12. Teste login, inclusão de livro, capa, avaliação, metas, backup, logout e login num navegador ou celular diferente.

## Observações e segurança

- O e-mail e a senha não foram inseridos no código. O login só funciona após criar o usuário no Supabase.
- Não reutilize a senha que foi mencionada no chat. Use uma senha nova e única, armazenada em um gerenciador de senhas.
- O banco usa RLS por `auth.uid()`; o bucket `acervo-covers` é **privado**. O repositório GitHub pode continuar público.
- Importe o backup JSON da etapa 7 para migrar dados anteriores. A instalação desta etapa **não apaga** o IndexedDB, mas não lê automaticamente seus registros antigos.
- Ao restaurar, **substitui a coleção remota**, não mescla. Faça um backup anterior da nuvem antes de restaurar novamente. As tabelas são atualizadas em transação SQL; arquivos antigos do Storage podem permanecer como órfãos, sem exposição pública.
- Se a Netlify abrir a tela de login com mensagem "Supabase ainda não configurado", confira as variáveis do deploy e redeploy.
- Supabase free tier tem limites, cotas e possível pausa por inatividade. Verifique disponibilidade e faça backup periódico.
