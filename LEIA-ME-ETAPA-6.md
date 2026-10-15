# Acervo — Etapa 6: Metas e estatísticas

Esta atualização é **incremental**: foi feita para ser instalada sobre o Acervo já atualizado até a **Etapa 5**.

## Instalação (Linux Mint)

1. Salve `acervo-etapa6-arquivos.zip` na **raiz do projeto** (a pasta que contém `package.json`).
2. Execute no terminal, dentro dessa pasta:

```bash
unzip -o acervo-etapa6-arquivos.zip
npm run lint
npm run build
npm run dev
```

Se houver erro no lint ou no build, envie a mensagem completa antes de avançar.

**Nenhuma dependência nova** foi acrescentada. O arquivo ZIP substitui `src/App.tsx`, `src/main.tsx` e `src/pages/DashboardPage.tsx`, e adiciona `src/pages/GoalsPage.tsx`, `src/utils/statistics.ts` e `src/styles/statistics.css`.

## O que testar

1. Abra **Metas e estatísticas** no menu lateral.
2. Selecione 2026, preencha uma meta de **2 livros** e salve.
3. Confirme o progresso a partir dos livros realmente concluídos em 2026. Se forem 3, a tela deve mostrar **150%**, com a barra visual limitada à largura disponível.
4. Altere para 2027, salve metas diferentes e volte para 2026. As metas de cada ano devem continuar independentes.
5. Confirme se o gráfico mensal considera as datas **de conclusão** dos títulos, e não o ano de lançamento, a data de início ou a data de cadastro.
6. Experimente notas de 4,5 e 5 estrelas em títulos concluídos. Elas devem aparecer nas categorias corretas da distribuição.
7. Compare 2026 com 2027. As diferenças devem aparecer corretamente, inclusive com sinais positivos ou negativos.
8. Volte à **Visão geral**, selecione 2026 e confira a seção **Metas de 2026**.
9. Confira a responsividade no navegador, especialmente a 390 px e 768 px.

## Regras e limitações

- Os cálculos consideram apenas registros com `status === 'completed'` e `completedOn` no ano selecionado.
- Filmes ou livros no estado “Quero assistir/Quero ler”, pausados ou abandonados não contam como concluídos.
- Uma meta de **0**, ou um campo vazio, indica **sem meta**, não um objetivo já cumprido.
- Se a meta for ultrapassada, o percentual é exibido integralmente (por exemplo: 150%).
- O percentual agregado considera apenas categorias com uma meta maior que zero.
- A média e a distribuição de estrelas consideram apenas títulos concluídos que tenham nota atribuída; **nota zero informada** é uma avaliação válida.
- O gráfico não usa bibliotecas externas de visualização.
- Metas são gravadas na tabela `goals` do IndexedDB já existente, **sem alterar a versão do banco e sem migrar ou apagar os registros anteriores**.
- Continuamos **sem sincronização automática** entre navegadores e dispositivos. Exportação/importação de backup está prevista para a Etapa 7.

## Validação feita na preparação deste pacote

- Checagem de sintaxe dos arquivos novos e modificados via TypeScript.
- Checagem estática de tipos dos componentes novos e da nova lógica usando declarações locais de teste.
- Compilação TypeScript da lógica pura `statistics.ts` em modo estrito.
- Testes automatizados das contagens por mês/ano, distribuição de notas (inclusive zero), progressão acima de 100% e anos futuros.
- Validação de sintaxe CSS via PostCSS.

Não foi possível executar `npm run lint` / `npm run build` com as dependências oficiais aqui, pois este ambiente não conseguiu acessar o registro npm. **Esses dois comandos devem ser executados no seu projeto local.**
