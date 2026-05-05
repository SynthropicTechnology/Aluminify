## Context

O sistema de questões está funcional: banco, importação, listas, resolver, resultados e filtros do aluno. O dashboard do aluno já integra parcialmente o banco de questões:

- `getQuestionsAnswered()` e `getAccuracy()` já chamam `getRespostasBancoQuestoes()` com dedup por `atividade_id` — **essa parte já está feita**.
- `getQuestionBankMetrics()` e `QuestionBankSection` já existem com dados por disciplina, evolução temporal e tópicos errados.
- **Falta**: integrar `respostas_aluno` em `getSubjectPerformance()`, `getPerformanceFiltered()` e `getStrategicDomainFiltered()`.

Não existe nenhuma página de relatório do professor para questões. A API de listas não tem paginação. O picker de questões já suporta `tags` na API mas o client não expõe esse filtro.

## Goals / Non-Goals

**Goals:**

- Integrar dados do banco de questões nos cards de desempenho por matéria e domínio estratégico do dashboard
- Criar relatório do professor com visão agregada de desempenho dos alunos
- Adicionar paginação cursor-based na API de listas para o aluno
- Permitir ordenação client-side das listas (data, disciplina, progresso)
- Expor filtro de tags no picker de questões (client-side, API já suporta)

**Non-Goals:**

- Refatorar o dashboard inteiro ou mudar a arquitetura de cache
- Criar sistema de relatórios exportáveis (PDF/Excel) — pode vir depois
- Real-time updates no dashboard (WebSocket)
- Alterar o esquema de banco — todas as tabelas necessárias já existem

## Decisions

### 1. Dashboard: integrar respostas no desempenho por matéria

**Decisão**: Reutilizar o helper `getRespostasBancoQuestoes()` existente, estendendo-o para retornar dados agrupados por `questao_id` (hoje retorna apenas totais). Nos métodos de performance, fazer JOIN in-memory com `banco_questoes` para obter `disciplina_id`, `frente_id`, `modulo_id`.

**Alternativa descartada**: Query SQL com JOINs via Supabase — o client JS não suporta JOINs complexos facilmente, e o padrão atual já é fetch + agregação in-memory.

**Caminho de dados**:
```
respostas_aluno.questao_id → banco_questoes { disciplina_id, frente_id, modulo_id }
```
- `getSubjectPerformance()`: agregar acertos/totais por frente_id
- `getPerformanceFiltered()`: agregar por groupBy (curso/disciplina/frente/modulo)
- `getStrategicDomainFiltered()`: agregar por modulo_id no `questionsAggByModulo`

### 2. Relatório do professor: nova página e API

**Decisão**: Criar como módulo separado sob `app/[tenant]/(modules)/biblioteca/listas/(gestao)/relatorio/`. API em `app/api/listas/relatorio/route.ts`. Service method no `lista.service.ts` existente.

**Dados expostos**:
- Desempenho por lista: total de alunos, % aproveitamento médio, tempo médio
- Desempenho por disciplina: agregado de todas as listas
- Ranking de alunos: top acertos/erros por lista
- Questões mais erradas: top 10 questões com menor % acerto

**Alternativa descartada**: Colocar no dashboard do professor — o dashboard é genérico, o relatório é específico do módulo de questões.

### 3. Paginação: cursor-based na API de listas

**Decisão**: Cursor-based pagination usando `created_at|id` (mesmo padrão da API de questões). Limite padrão de 20, máximo 50. O client carrega mais com botão "Carregar mais".

**Alternativa descartada**: Offset-based — inconsistente com o padrão já usado na API de questões e menos eficiente para datasets crescentes.

**Impacto no repositório**: `lista.repository.ts` precisa de novo método `listPaginated()` que aceita cursor e limit. O `list()` atual continua existindo para uso admin.

### 4. Ordenação: client-side

**Decisão**: Ordenação no client via `.sort()` no array de listas carregadas, sem envolver a API. Opções: data (padrão), disciplina, progresso (%).

**Justificativa**: Com paginação de 20 itens por página, ordenar no client é trivial e evita complexidade na API. Se o dataset crescer muito, pode migrar para server-side depois.

### 5. Filtro de tags no picker: multi-select client

**Decisão**: Adicionar combobox multi-select de tags no picker. Tags únicas são derivadas das questões já carregadas + endpoint `GET /api/questoes/filtros` (que já retorna instituições e anos — estender para incluir tags). O parâmetro `tags` já é suportado na API de questões.

## Risks / Trade-offs

- **[Performance do dashboard]** → Queries adicionais em `respostas_aluno` + `banco_questoes` para cada load do dashboard. Mitigação: todas as queries rodam em `Promise.all` junto com as existentes, e o cache de sessão (30min TTL) já cobre.
- **[Dedup incorreto]** → Se `listas_exercicios.atividade_id` não estiver preenchido corretamente, dados podem ser contados duas vezes. Mitigação: o helper `getListasComAtividadeIds()` já isola a lógica; testes validam cenários com e sem atividade_id.
- **[Paginação + filtros]** → Filtros client-side (disciplina, frente, módulo, tipo, status) operam sobre os dados já carregados. Com paginação, filtrar pode resultar em poucos itens visíveis. Mitigação: manter um limite generoso (20 por página) e carregar mais automaticamente se filtros resultam em 0 itens.
- **[Tags no picker]** → Com muitas tags únicas, o combobox pode ficar longo. Mitigação: usar combobox com busca (tipo `cmdk`), limitar exibição a tags com >1 questão.
