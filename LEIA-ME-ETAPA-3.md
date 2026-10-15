# Acervo — Etapa 3: Modelagem + IndexedDB

Este ZIP contém **arquivos completos** novos e atualizados para instalar sobre a etapa 2.
**Não apague suas outras pastas nem `node_modules`.**

## Como instalar (Linux Mint / bash)

1. Coloque `acervo-etapa3-arquivos.zip` na raiz da sua pasta `acervo`.
2. Abra o terminal nessa pasta e execute:

```bash
unzip -o acervo-etapa3-arquivos.zip
npm run lint
npm run build
npm run dev
```

3. No navegador, entre em `/configuracoes` e clique em **Testar banco local**.
4. Confira a mensagem de sucesso e a contagem real de livros, filmes, séries, capas e metas.
5. Verifique a interface no desktop (sem X nem botão de menu) e no celular (menu lateral com X).

## Arquivos criados

- `src/types/media.ts`: tipos para livros, filmes, séries, status, notas, datas, metas e capas.
- `src/services/database.ts`: abre o banco IndexedDB `acervo-local`, versão 1.
- `src/services/mediaRepository.ts`: `addMedia`, `getMedia`, `listMedia`, `updateMedia`, `deleteMedia`.
- `src/services/coverRepository.ts`: `saveCover`, `getCoverBlob`, `removeCover`; comprime capas e remove órfãs ao excluir.
- `src/services/goalsRepository.ts`: salva, consulta e lista metas anuais.
- `src/services/storageDiagnostics.ts`: resumo dos dados reais e teste automático temporário.
- `src/pages/StoragePage.tsx`: tela real de armazenamento em Configurações.
- `src/styles/storage.css`: estilo da tela de Configurações.

## Arquivos substituídos (sempre completos)

- `src/styles/layout.css`: corrige o X e o botão de menu em telas de desktop.
- `src/App.tsx`: conecta Configurações à nova página de armazenamento.
- `src/main.tsx`: importa os estilos da página de armazenamento.

## Regras de persistência e datas

- Não há servidor, login nem sincronização entre celulares/computadores.
- Todas as capas são guardadas como Blob em store separada, e não como base64 no localStorage.
- Cada obra possui um só registro; `status` e `favorite` são propriedades do registro.
- As datas pessoais (`startedOn`/`completedOn`) são strings `YYYY-MM-DD` sem fuso horário.
- Um item só pode ficar como `completed` se tiver `completedOn` informado manualmente.
- `createdAt` e `updatedAt` são timestamps técnicos e **nunca** substituem a data de conclusão.
- A nota aceita 0 a 5 em passos de 0,5; campo ausente = não avaliado.
- O teste temporário remove registro e capa ao final. Se a página travar durante a execução, confira a contagem.
- A etapa 4 terá formulários e cards. O armazenamento agora está pronto, mas ainda não há cadastro visual.

## Limites atuais

- Exportação/importação JSON, backup, interface completa das metas e filtros serão implementados depois.
- O tema da etapa 2 permanece salvo no `localStorage`; a migração dele para configurações exportáveis será feita com o recurso de backup.
- O navegador pode excluir dados locais se você limpar os dados do site. Não o considere backup permanente.
