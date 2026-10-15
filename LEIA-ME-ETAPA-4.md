# ACERVO — ETAPA 4

## O que contém

**Novos arquivos (9)**

- `src/components/media/MediaCard.tsx`
- `src/components/media/MediaCover.tsx`
- `src/components/media/RatingStars.tsx`
- `src/hooks/useCoverUrl.ts`
- `src/pages/CollectionPage.tsx`
- `src/pages/MediaDetailPage.tsx`
- `src/pages/MediaFormPage.tsx`
- `src/styles/media.css`
- `src/utils/mediaLabels.ts`

**Arquivos completos que serão substituídos (4)**

- `src/App.tsx`
- `src/main.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/pages/DashboardPage.tsx`

Os outros arquivos da etapa 3 (banco e repositórios) não são alterados.

## Instalação

1. Faça cópia da pasta do projeto se tiver alterações pessoais não mencionadas.
2. Copie `acervo-etapa4-arquivos.zip` para a **raiz do projeto** (onde está `package.json`).
3. Execute:

```bash
unzip -o acervo-etapa4-arquivos.zip
npm install
npm run lint
npm run build
npm run dev
```

O `npm install` deve apenas garantir que as dependências da etapa 1 estão disponíveis; não foram adicionadas dependências nesta etapa.

Abra o endereço local mostrado pelo Vite, normalmente `http://localhost:5173`.

## Roteiro de teste

1. **Coleção**: navegue pelo menu para `Minha coleção`. Deve haver filtros de categoria, status, pesquisa e ordenação.
2. **Cadastro**: clique em `Novo título`. Cadastre um livro apenas com título, categoria e status `Quero ler`. Abra o card.
3. **Persistência**: recarregue a página e confirme que o item e a capa continuam visíveis.
4. **Edição**: abra detalhes, clique `Editar registro`, altere para `Concluído` e informe a data real de conclusão. A data é obrigatória nesse status.
5. **Avaliação**: registre uma nota de 4,5, marque favorito e escolha uma capa JPG, PNG ou WebP (máximo 12 MB).
6. **Filtros**: use categoria `Livros`, status `Concluído` e procure o título. Confira ordenação por nota e data.
7. **Dashboard**: volte à Visão geral; selecione o ano da conclusão e confirme que o total real de livros foi atualizado.
8. **Outros tipos**: cadastre um filme com duração e uma série com temporada/episódio.
9. **Capa**: abra o editor, substitua e depois remova a capa para testar as duas operações.
10. **Exclusão**: em detalhes, clique `Excluir` e confirme. O item e a capa desaparecem, sem afetar os demais.
11. **Contagens**: em Configurações, confira a contagem de registros e capas.
12. **Responsividade**: abra o modo dispositivo móvel do DevTools para verificar grid de duas colunas, formulários e navegação.

## Observações

- O **IndexedDB** da etapa 3 não é recriado nem alterado. Os seus dados anteriores são preservados se a origem/URL do navegador continuar sendo a mesma e o navegador não limpar o armazenamento.
- O botão de **adicionar título no cabeçalho** (ícone `+`) está disponível em todas as páginas.
- Um registro sempre terá o mesmo ID ao trocar de status. Favoritos e lista de desejos são propriedades do mesmo item.
- A data de conclusão nunca é inferida da data atual. Não definimos automaticamente uma data ao marcar `Concluído`.
- A página exclusiva de lista de desejos, histórico e favoritos e os gráficos de metas ainda são **fases futuras**. Seus dados necessários já podem ser salvos nesta etapa.
- **Ainda não há exportação de backups**. Por enquanto, evite limpar dados do site/navegador e não dependa deste armazenamento como única cópia insubstituível. Exportar e importar será implementado em uma etapa futura.
- Nenhuma API externa, backend, autenticação ou nova dependência é exigida nesta etapa.
- Os arquivos TypeScript/TSX passaram por uma verificação sintática estática. O ambiente de criação não consegue instalar pacotes npm da internet; portanto, o lint e build definitivos devem ser confirmados localmente.

## Próxima etapa

Lista de desejos dedicada, histórico com filtros combináveis de dia/mês/ano e favoritos usando os registros reais.
