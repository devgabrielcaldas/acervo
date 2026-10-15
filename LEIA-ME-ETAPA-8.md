# ACERVO — Etapa 8 · Revisão final e publicação na Netlify

Atualização incremental: **não apague pastas, banco, imagens, node_modules nem dados do navegador**.

## 1. Arquivos entregues

- `src/components/layout/AppLayout.tsx` — substitui o layout anterior; menu mobile com foco por teclado, Escape, retorno de foco e título das páginas.
- `src/components/common/AppErrorBoundary.tsx` — novo; tela de recuperação quando ocorrer falha inesperada de renderização (não modifica dados).
- `src/main.tsx` — substitui o anterior; integra tratamento de erro e estilos de refinamento.
- `src/styles/refinements.css` — novo; detalhes de foco, toque, tamanhos de tela, contraste e responsividade.
- `netlify.toml` — novo; build e pasta publicada.
- `public/_redirects` — novo; rotas React Router funcionam após atualizar ou abrir URL diretamente.
- `scripts/validate-deploy.mjs` — novo; verifica a estrutura do build.

**Nenhum arquivo em `src/services` ou `src/types` foi alterado.** IndexedDB `acervo-local` continua na versão 1.

## 2. Instalar no Linux Mint

Baixe `acervo-etapa8-arquivos.zip` e mova-o para `~/Documentos/acervo` pelo gerenciador de arquivos.

No terminal do VS Code, dentro do projeto:

```bash
pwd
ls -lb acervo-etapa8-arquivos.zip
unzip -o ./acervo-etapa8-arquivos.zip
npm run lint
npm run build
node scripts/validate-deploy.mjs
npm run dev
```

Caso o ZIP ainda esteja na pasta Downloads, **não** execute `unzip` apontando para a pasta do projeto. Mova o arquivo primeiro ou informe seu caminho real. Se `ls` não mostrar o ZIP, não avance.

## 3. Checagens antes da publicação

1. Confira as rotas `/`, `/colecao`, `/desejos`, `/historico`, `/favoritos`, `/metas`, `/configuracoes`, `/novo`.
2. Desktop 1440px: menu lateral fixo, **sem X** ou botão hamburger.
3. Tablet 768px e celular 390px/320px: sidebar fecha normalmente, Esc fecha e o foco volta ao botão; barra inferior visível.
4. Use Tab/Shift+Tab: foco visível; atalho "Pular para o conteúdo" aparece ao receber foco.
5. Confira tema claro e escuro, inclusive após atualizar a página.
6. Cadastre e edite um **registro de teste** e verifique sua capa; remova-o depois.
7. Verifique Histórico e Metas com datas já cadastradas; não devem surgir números inventados.
8. Exporte **agora** seu backup JSON em Configurações e guarde-o em um local seguro.
9. Execute `npm run lint`, `npm run build` e `node scripts/validate-deploy.mjs`; interrompa se ocorrer erro.

**Não teste a restauração sobrescrevendo sua coleção de uso diário.** Para isso, use um perfil separado do navegador.

## 4. Publicar na Netlify — método simples (upload manual)

1. Com o build concluído, acesse https://app.netlify.com/drop e entre em sua conta, se necessário.
2. Arraste somente a pasta **`dist/`** produzida pelo `npm run build` para publicação como site estático (não arraste `src`, `node_modules` ou o ZIP de atualização).
3. Aguarde a Netlify criar um endereço `*.netlify.app` e abra-o.
4. Teste `/colecao`, `/historico` e `/configuracoes` diretamente e atualize com F5; a regra `public/_redirects` é copiada para `dist/_redirects` pelo Vite.
5. Se atualizar o código, execute novamente `npm run build`, valide e envie a nova `dist/` para o **mesmo site**, não crie um site novo a cada atualização.

## 5. Publicar via GitHub (recomendado para atualizações frequentes)

Seu projeto pode ter um repositório privado no GitHub. No projeto, caso ainda não use Git:

```bash
git init
git add .
git commit -m "feat: preparar Acervo para publicação na Netlify"
```

Crie um repositório vazio no GitHub (não precisa torná-lo público). Depois siga as instruções de remote do GitHub para associar o repositório e enviar o commit. Na Netlify, escolha adicionar projeto importando um repositório GitHub e selecione o repositório do Acervo. O arquivo `netlify.toml` define:

- comando de build: `npm run build`
- pasta publicada: `dist`

Não faça commit de `node_modules/`, `dist/`, dados pessoais, JSON exportados ou arquivos `.env` com segredos. O `.gitignore` do Vite costuma cobrir `node_modules` e `dist`, mas confira com `git status` antes do commit.

## 6. O ponto mais importante: dados locais e endereço do site

O Acervo salva seus registros **no IndexedDB do navegador, associado à origem (protocolo + domínio + porta)**, e não na Netlify ou nos arquivos de build.

- Uma atualização do código no **mesmo domínio** e no **mesmo navegador/perfil** preserva os dados locais, desde que não sejam apagados pelo navegador.
- `http://localhost:5173` e `https://seu-site.netlify.app` têm origens diferentes. A coleção que você cadastrou em `localhost` **não aparece automaticamente** na Netlify.
- Para levar seus dados: **exporte um backup JSON no localhost** → abra o site publicado → acesse Configurações → **importe o JSON** → confira os títulos, capas e metas.
- Em outro celular/PC/navegador/perfil, será necessário importar outro backup manualmente.
- Uma eventual troca de domínio Netlify também muda a origem e exige importação no novo endereço.
- A hospedagem pública não significa que outros visitantes tenham acesso a seus dados locais. Cada navegador usa seu próprio armazenamento, sem sincronização.

**Recomendação:** faça backup novamente após mudanças importantes. Não deixe sua única cópia apenas no IndexedDB.

## 7. Limitação dos testes desta entrega

Os arquivos TypeScript/TSX e CSS foram analisados estaticamente. Como o ambiente de preparação não conseguiu baixar dependências npm, não foi possível executar os comandos oficiais de lint, compilação Vite e testes interativos reais aqui. O checklist no seu Linux Mint é obrigatório antes de publicar.

Referências oficiais:
- https://docs.netlify.com/build/configure-builds/javascript-spas/
- https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/
- https://app.netlify.com/drop
