## MODIFIED Requirements

### Requirement: Dominio estrategico separado por modalidade
O sistema SHALL retornar, no payload do dashboard do aluno, metricas de **Dominio Estrategico** separadas por modalidade:

- **Flashcards (memoria)**: derivado de `progresso_flashcards.ultimo_feedback`
- **Questoes (aplicacao)**: derivado de `progresso_atividades.questoes_acertos/questoes_totais` **combinado com** `respostas_aluno` (banco de questões), com dedup por `listas_exercicios.atividade_id`

As metricas SHALL ser expostas para os eixos:
- **Modulos de Base** (`modulos.importancia = 'Base'`)
- **Alta Recorrencia** (`modulos.importancia = 'Alta'`)

#### Scenario: Aluno com dados legado e banco de questões
- **WHEN** o aluno possui registros em `progresso_atividades` e em `respostas_aluno` para módulos do eixo
- **THEN** o `questionsScore` SHALL combinar ambas as fontes, excluindo respostas de listas onde `listas_exercicios.atividade_id IS NOT NULL`

#### Scenario: Aluno apenas com dados do banco de questões
- **WHEN** o aluno possui registros apenas em `respostas_aluno` (nenhum em `progresso_atividades`)
- **THEN** o `questionsScore` SHALL ser calculado exclusivamente a partir de `respostas_aluno`

#### Scenario: Dedup — lista vinculada ao legado
- **WHEN** uma lista possui `atividade_id` não-null
- **THEN** as respostas dessa lista em `respostas_aluno` SHALL ser excluídas do cálculo para evitar contagem dupla

## ADDED Requirements

### Requirement: Desempenho por matéria inclui banco de questões
O sistema SHALL incluir dados de `respostas_aluno` no cálculo de `getSubjectPerformance()` e `getPerformanceFiltered()`, combinando com os dados de `progresso_atividades`.

Para cada resposta do banco:
- O sistema SHALL usar `banco_questoes.frente_id` quando disponível
- O sistema SHALL fazer fallback para `banco_questoes.modulo_id → modulos.frente_id` quando `frente_id` é null
- Para questões apenas com `disciplina_id`, o sistema SHALL distribuir como "Sem frente identificada"

#### Scenario: Questão com frente direta
- **WHEN** uma questão em `banco_questoes` possui `frente_id` preenchido
- **THEN** os acertos/totais dessa questão SHALL ser agregados na frente correspondente no `performanceMap`

#### Scenario: Questão sem frente mas com módulo
- **WHEN** uma questão possui `modulo_id` mas não `frente_id`
- **THEN** o sistema SHALL resolver a frente via `modulos.frente_id` e agregar nela

#### Scenario: PerformanceFiltered agrupado por módulo
- **WHEN** o usuário seleciona groupBy "modulo" no card de desempenho
- **THEN** os dados de `respostas_aluno` SHALL ser agrupados por `banco_questoes.modulo_id` e somados ao resultado
