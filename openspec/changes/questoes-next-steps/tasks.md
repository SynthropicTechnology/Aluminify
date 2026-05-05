## 1. Dashboard: integrar banco de questões no desempenho por matéria

- [ ] 1.1 Criar helper `getRespostasBancoComDetalhes()` em `dashboard-analytics.service.ts` que retorna respostas agrupadas por `questao_id` com dados de `banco_questoes` (disciplina_id, frente_id, modulo_id), reutilizando dedup de `getListasComAtividadeIds()`
- [ ] 1.2 Atualizar `getSubjectPerformance()` para somar acertos/totais do banco de questões por frente (com fallback modulo→frente)
- [ ] 1.3 Atualizar `getPerformanceFiltered()` para incluir dados do banco de questões respeitando o `groupBy` (curso/disciplina/frente/modulo)
- [ ] 1.4 Atualizar `getStrategicDomainFiltered()` para incluir dados do banco de questões no `questionsAggByModulo`
- [ ] 1.5 Escrever testes unitários em `tests/questoes/dashboard-integration.test.ts` cobrindo dedup e agregação por frente/módulo

## 2. Relatório do professor

- [ ] 2.1 Criar método `getRelatorioListas()` em `lista.service.ts` que retorna métricas agregadas: desempenho por lista, por disciplina, ranking de alunos, questões mais erradas
- [ ] 2.2 Criar API route `GET /api/listas/relatorio/route.ts` com auth middleware (professor/admin only), parâmetros opcionais `listaId` e `empresaId`
- [ ] 2.3 Criar page server component em `app/[tenant]/(modules)/biblioteca/listas/(gestao)/relatorio/page.tsx` com guard de role
- [ ] 2.4 Criar componente client `relatorio-listas-client.tsx` com: cards de resumo, tabela de desempenho por lista, barras de progresso por disciplina, ranking de alunos (filtrável por lista), top 10 questões mais erradas
- [ ] 2.5 Adicionar link para o relatório na página de gestão de listas (`listas-admin-client.tsx`)
- [ ] 2.6 Escrever testes para o service method `getRelatorioListas()`

## 3. Paginação na API de listas

- [ ] 3.1 Criar método `listPaginated()` em `lista.repository.ts` com suporte a cursor (`created_at|id`) e limit (padrão 20, max 50)
- [ ] 3.2 Criar método `listAvailablePaginated()` em `lista.service.ts` que filtra listas com questões e retorna `{ data, nextCursor }`
- [ ] 3.3 Atualizar `GET /api/listas/route.ts` para aceitar parâmetros `cursor` e `limit` quando `available=true`
- [ ] 3.4 Atualizar `ct-questoes-client.tsx`: trocar fetch único por carregamento incremental com estado de `nextCursor` e botão "Carregar mais"
- [ ] 3.5 Garantir que filtros e ordenação operam sobre o array acumulado de listas

## 4. Ordenação client-side

- [ ] 4.1 Adicionar estado `ordenacao` em `ct-questoes-client.tsx` com opções: `data` (padrão), `disciplina`, `progresso`
- [ ] 4.2 Adicionar Select de ordenação na barra de filtros
- [ ] 4.3 Atualizar memo `listasFiltradas` para aplicar `.sort()` pelo critério selecionado após filtragem

## 5. Filtro por tags no picker de questões

- [ ] 5.1 Atualizar `GET /api/questoes/filtros/route.ts` para retornar array de tags únicas além de instituições e anos
- [ ] 5.2 Adicionar combobox multi-select de tags em `adicionar-questoes-client.tsx` usando `cmdk` + popover
- [ ] 5.3 Passar tags selecionadas como parâmetro `tags` (comma-separated) na query de questões
- [ ] 5.4 Exibir tags selecionadas como badges removíveis abaixo do combobox

## 6. Verificação final

- [ ] 6.1 `npx tsc --noEmit` sem erros
- [ ] 6.2 `npm run lint` sem erros novos
- [ ] 6.3 `npm run build` sucesso
- [ ] 6.4 `npx jest tests/questoes/ --no-coverage` testes passam
- [ ] 6.5 Teste manual no browser: dashboard com dados do banco, relatório do professor, paginação, ordenação, filtro de tags
