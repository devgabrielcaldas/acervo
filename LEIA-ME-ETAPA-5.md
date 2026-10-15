# ACERVO — ETAPA 5: Lista de desejos, Histórico e Favoritos

Esta atualização foi preparada **sobre os arquivos da etapa 4 com o pacote de correção já aplicado**. São 9 arquivos de código: apenas novos ou substituídos. Não modifique `package.json`, `src/services/database.ts` nem o IndexedDB.

## 1. Instalar no Linux Mint

**Abra um terminal na raiz do projeto `acervo`**, onde está o `package.json`, e coloque o ZIP nesta pasta. Se desejar salvar uma cópia das páginas e do layout antes de atualizar:

```bash
cp -a src "src-backup-antes-da-etapa5"
```

Extraia:

```bash
unzip -o acervo-etapa5-arquivos.zip
```

Arquivos novos:

- `src/hooks/useMediaLibrary.ts`
- `src/components/media/CategoryTabs.tsx`
- `src/components/media/CompleteMediaDialog.tsx`
- `src/pages/WishlistPage.tsx`
- `src/pages/HistoryPage.tsx`
- `src/pages/FavoritesPage.tsx`
- `src/styles/lists.css`

Arquivos substituídos:

- `src/App.tsx` (substitui os placeholders das três rotas por páginas reais)
- `src/main.tsx` (importa o novo CSS)

**Observação:** são 9 arquivos de código ao todo (7 novos + 2 alterados).

## 2. Validar

```bash
npm run lint
npm run build
npm run dev
```

Abra o endereço local exibido no terminal (geralmente `http://localhost:5173`).

## 3. Testar com registros reais (sem apagar seus dados)

1. Em **Minha coleção**, cadastre dois títulos com status **Quero ler/Quero assistir** e, se desejar, defina prioridades diferentes.
2. Vá a **Lista de desejos**: os dois devem aparecer. Experimente busca, categorias, prioridade e ordenação.
3. Clique **Começar** em um título. Ele sai da lista de desejos e passa a **Em andamento** na coleção, sem ser duplicado.
4. No outro, clique **Concluir**. Informe **a data real da conclusão** no modal. Ele sai de Desejos e aparece em **Histórico**.
5. No histórico, teste os filtros de **ano, mês, dia, intervalo de datas, nota, favoritos** e a visualização **Por mês**.
6. Marque o coração de um título. Ele deve aparecer na página **Favoritos**, mesmo que o status seja Quero ler, Em andamento ou Concluído.
7. Desmarque o coração em Favoritos. Ele some da página, mas continua em Minha coleção.
8. Cadastre mais um desejo e clique em **Retirar dos desejos sem excluir**. O status muda para **Pausado**, mas o registro e a capa permanecem na coleção.
9. Recarregue a página e confira os registros: o armazenamento continua sendo o IndexedDB da etapa 3.

## 4. Regras de funcionamento

- **Não há cópias de registros** para cada seção. Desejos = status `wishlist`; Histórico = status `completed` + `completedOn`; Favoritos = `favorite: true`.
- As datas são `AAAA-MM-DD` (calendário local, sem conversão de timezone). O filtro do histórico usa a data de **conclusão**, nunca o ano de lançamento.
- A nota permite comparação exata com incrementos de meia estrela, incluindo 0,0.
- Ao concluir diretamente nos Desejos, a data é **obrigatória e não é preenchida automaticamente**. Você pode inserir datas retroativas.
- **Começar** apenas altera o status; a data de início é opcional e pode ser adicionada em **Editar**.
- **Retirar dos desejos** muda o status para **Pausado**; não exclui nada, e você pode voltar ao status Quero ler/assistir pela edição.
- A aba **Metas e estatísticas** continua reservada à etapa 6.
- O backup JSON continua pendente; **não limpe os dados do navegador** e não mude a origem do site até implementar o backup.

## 5. Limitações da verificação executada

Os arquivos foram conferidos com o compilador TypeScript em uma checagem de tipos usando declarações substitutas para pacotes não instalados neste ambiente e com validação de imports e sintaxe. A verificação real com as tipagens oficiais de React, React Router, Lucide e idb, juntamente com o build Vite e o lint, precisa ser executada no seu projeto, por meio dos comandos acima. Não foi possível baixar dependências npm neste ambiente.

Se aparecer qualquer erro, envie a saída integral do terminal. Vamos corrigir antes da etapa 6.
