# ACERVO — ETAPA 7 — BACKUP E RESTAURAÇÃO

Este pacote é uma **atualização incremental da etapa 6**. Não cria outro projeto, não exige dependências e **não altera a versão nem a estrutura do IndexedDB existente** (`acervo-local`, versão 1).

## 1. Arquivos completos incluídos

| Caminho | Ação |
| --- | --- |
| `src/services/backupService.ts` | Criar — exportação, validação, decodificação e restauração atômica |
| `src/pages/StoragePage.tsx` | Substituir arquivo inteiro — configurações e interface de backup |
| `src/styles/backup.css` | Criar — estilos para backup no tema claro e escuro |
| `src/main.tsx` | Substituir arquivo inteiro — somente adiciona import do novo CSS |

**Não** substitua `database.ts`, `mediaRepository.ts`, `coverRepository.ts`, `goalsRepository.ts` nem apague o IndexedDB: esses arquivos e seus dados ficam intactos.

## 2. Instalar no Linux Mint

Copie o ZIP para a pasta `acervo`, ao lado do `package.json`. No terminal aberto nessa pasta:

```bash
unzip -o acervo-etapa7-arquivos.zip
npm run lint
npm run build
npm run dev
```

Caso algum comando reporte erro, interrompa os testes e envie a mensagem. Não execute comandos de limpeza de armazenamento.

## 3. Como exportar

Abra **Configurações → Backup completo → Exportar backup JSON**.

O navegador fará o download de `acervo-backup-AAAA-MM-DD-HH-mm.json`, com:

- Todos os registros de livros, filmes e séries (status, notas, favoritos, progresso, datas, observações, etc.);
- Capas em Base64 no mesmo JSON, usando os bytes do Blob salvo no IndexedDB;
- Metas anuais, inclusive dos anos anteriores;
- Preferência de tema claro/escuro.

O formato tem os campos `format: "acervo-backup"`, `version: 1`, `exportedAt` e `data` com `media`, `covers`, `goals` e `settings`. O arquivo guarda as **datas originais**; não muda uma data concluída de dia, mês ou ano.

**Importante:** o sistema prepara o download, mas você deve conferir se o arquivo apareceu na pasta Downloads. Guarde cópias em um local protegido fora do navegador.

## 4. Como importar

1. Faça primeiro um backup do estado atual, mesmo se for testar outro arquivo.
2. Em Configurações, clique em **Selecionar arquivo JSON**.
3. Aguarde a análise do arquivo. O Acervo valida identificação, versão, tipos de dados, IDs duplicados, datas, notas, integridade das imagens e referências entre registros e capas, **sem modificar o banco**.
4. Confira a prévia com a quantidade de títulos e metas que serão restaurados.
5. Para realmente substituir, digite `RESTAURAR` e clique em **Substituir dados e restaurar**.
6. Clique em **Recarregar Acervo** depois do sucesso.

### Regras de segurança

- A importação é uma **substituição completa**, não uma mesclagem. A coleção atual, as capas e as metas anuais serão trocadas pelos valores do arquivo.
- Nenhum dado existente é alterado durante a simples seleção/validação.
- A gravação é feita com **uma única transação `readwrite`** nas três tabelas IndexedDB. Se essa transação falhar (por exemplo, por falta de espaço), a substituição é abortada. Não recarregue nem feche o navegador enquanto estiver restaurando.
- A preferência de tema, guardada em `localStorage`, é aplicada após a conclusão da transação e depois de recarregar o Acervo. Ela não faz parte da transação IndexedDB.
- O backup versão 1 aceita apenas JPEG, PNG e WebP para capas. O limite por arquivo de backup é 150 MB; por capa, 12 MB.
- Backups de versões desconhecidas não são importados automaticamente. Uma futura alteração no formato precisará de migração explícita.

## 5. Checklist de testes recomendado

- [ ] `npm run lint` e `npm run build` concluíram sem erros;
- [ ] A página Configurações continua mostrando contagens reais do banco;
- [ ] O botão **Testar banco local** continua funcionando;
- [ ] Exportar JSON baixa um arquivo cujo tamanho é maior que zero;
- [ ] O arquivo tem campos `format`, `version`, `data.media`, `data.covers`, `data.goals`, `data.settings`;
- [ ] Selecionar esse arquivo exibe corretamente a prévia da coleção;
- [ ] Clicar em **Cancelar** não modifica nada;
- [ ] Selecionar um JSON que não é backup Acervo mostra erro e não altera dados;
- [ ] Na restauração de teste, usando de preferência um **perfil separado do navegador**, títulos, notas, capas e metas reaparecem;
- [ ] A aplicação mantém o tema e a responsividade após recarregar.

**Não teste substituição com um backup falso ou em branco na sua coleção principal.** Se quiser testar o ciclo completo sem riscos para o uso diário, abra o mesmo site em um perfil separado do navegador, com IndexedDB próprio, e importe a cópia ali.

## 6. Limitações e próximos passos

- O backup **não** é automático. Faça uma nova exportação regularmente.
- Não há sincronização automática entre celulares, notebooks e outros navegadores. Em um dispositivo novo, importe manualmente o JSON.
- Não existe servidor nesta versão. O JSON contém dados pessoais em texto e imagens; cuide dele como um arquivo privado.
- O próximo passo será revisar a responsividade, acessibilidade, fluxos e comportamento de produção, depois preparar o deploy na Netlify.

## 7. Validação efetuada nesta entrega

Os novos arquivos TypeScript/TSX passaram em checagem estática com declarações substitutas das dependências, e o CSS passou no parser PostCSS. Um teste automatizado com banco simulado cobriu exportação, importação, capas, metas, tema, integridade, arquivos inválidos e reversão em falha de gravação. **O lint/build real com as dependências do projeto não foi executado neste ambiente porque o npm registry não estava acessível**; rode os comandos no seu computador.
