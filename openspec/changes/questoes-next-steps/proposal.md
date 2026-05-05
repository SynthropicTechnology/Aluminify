## Why

O sistema de questões (banco, listas, resolver, resultados) está funcional, mas os dados de `respostas_aluno` não alimentam o dashboard do aluno — questões feitas pelo banco não aparecem nos cards de métricas, desempenho por matéria nem domínio estratégico. Além disso, professores não têm visibilidade agregada do desempenho dos alunos nas listas. Com o crescimento do número de listas e questões, a listagem do aluno precisa de paginação, ordenação e filtro por tags no picker para escalar.

## What Changes

- **Integrar `respostas_aluno` no dashboard do aluno**: cards de "Questões respondidas" e "Aproveitamento" somam dados do banco de questões (com dedup para listas vinculadas ao sistema legado via `atividade_id`). Desempenho por matéria e domínio estratégico incluem dados do banco.
- **Nova seção de métricas detalhadas do banco de questões**: desempenho por disciplina, evolução temporal, tópicos mais errados — já existe `getQuestionBankMetrics()` e `QuestionBankSection`, mas precisam integrar dedup e dados do desempenho por matéria.
- **Relatório do professor**: nova página com visão agregada — desempenho por lista, por disciplina, ranking de alunos, questões mais erradas. API + componente novo.
- **Paginação na listagem do aluno**: `GET /api/listas?available=true` retorna tudo sem paginação. Adicionar cursor-based pagination.
- **Ordenação**: permitir ordenar listas por data, disciplina, progresso no client.
- **Filtro por tags no picker**: o picker de questões (`adicionar-questoes-client.tsx`) exibe tags mas não filtra por elas. Adicionar filtro multi-select de tags.

## Capabilities

### New Capabilities

- `professor-report`: Relatório agregado do professor — visão de desempenho dos alunos por lista, disciplina, ranking, questões mais erradas. Inclui API route, service e componente.
- `listas-pagination`: Paginação cursor-based na API de listas e no componente do aluno, com ordenação client-side por data/disciplina/progresso.
- `questoes-tag-filter`: Filtro por tags no picker de questões (adicionar-questoes), com multi-select e integração à query da API.

### Modified Capabilities

- `dashboard-analytics`: Integrar dados de `respostas_aluno` nos métodos `getQuestionsAnswered`, `getAccuracy`, `getSubjectPerformance`, `getPerformanceFiltered`, `getStrategicDomainFiltered` — com dedup por `listas_exercicios.atividade_id`. Enriquecer `getQuestionBankMetrics` com dados por disciplina e evolução temporal.

## Impact

- **Arquivos modificados**: `dashboard-analytics.service.ts` (~6 métodos), `student.ts` (tipos), API routes de dashboard, `ct-questoes-client.tsx`, `adicionar-questoes-client.tsx`, `app/api/listas/route.ts`, `lista.repository.ts`
- **Arquivos novos**: página e componentes do relatório do professor, API route do relatório, testes
- **Tabelas consultadas**: `respostas_aluno`, `banco_questoes`, `listas_exercicios`, `listas_exercicios_questoes`, `frentes`, `modulos`, `disciplinas`, `progresso_atividades`
- **Risco de dedup**: listas com `atividade_id` não-null já contam em `progresso_atividades` — filtrar para não contar duas vezes
- **Performance**: queries adicionais no dashboard — mitigar com paralelismo (`Promise.all`) e cache existente
