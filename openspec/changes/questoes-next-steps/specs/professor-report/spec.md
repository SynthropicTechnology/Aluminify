## ADDED Requirements

### Requirement: Página de relatório do professor
O sistema SHALL fornecer uma página de relatório acessível a professores e admins em `/[tenant]/biblioteca/listas/relatorio`, exibindo métricas agregadas de desempenho dos alunos nas listas de exercícios.

#### Scenario: Professor acessa relatório
- **WHEN** um professor ou admin navega para a página de relatório
- **THEN** o sistema SHALL exibir cards de resumo (total de listas, total de alunos participantes, aproveitamento médio, tempo médio por lista)

#### Scenario: Aluno tenta acessar
- **WHEN** um aluno tenta acessar `/[tenant]/biblioteca/listas/relatorio`
- **THEN** o sistema SHALL redirecionar para `/[tenant]/biblioteca`

### Requirement: Desempenho por lista
O sistema SHALL exibir uma tabela com todas as listas criadas, mostrando para cada uma:
- Título e tipo (exercício/simulado)
- Número de alunos que iniciaram e finalizaram
- Aproveitamento médio (% acerto)
- Tempo médio de resolução

#### Scenario: Lista sem nenhum aluno
- **WHEN** nenhum aluno respondeu uma lista
- **THEN** a linha SHALL exibir "0 alunos" e "—" para aproveitamento e tempo

#### Scenario: Lista com alunos parciais
- **WHEN** alguns alunos iniciaram mas não finalizaram
- **THEN** a coluna "Finalizaram" SHALL mostrar apenas os alunos com `finalizada = true`, e o aproveitamento SHALL ser calculado apenas sobre respostas existentes

### Requirement: Desempenho por disciplina
O sistema SHALL exibir uma seção com aproveitamento agregado por disciplina, derivado das respostas de todas as listas.

#### Scenario: Múltiplas disciplinas
- **WHEN** as listas cobrem questões de múltiplas disciplinas
- **THEN** o sistema SHALL exibir uma barra de progresso por disciplina com % de acerto e total de questões

### Requirement: Ranking de alunos
O sistema SHALL exibir um ranking dos alunos por desempenho, filtrável por lista específica ou geral.

#### Scenario: Ranking geral
- **WHEN** nenhuma lista específica é selecionada
- **THEN** o ranking SHALL agregar acertos/totais de todas as listas finalizadas por cada aluno, ordenado por % acerto decrescente

#### Scenario: Ranking por lista
- **WHEN** o professor seleciona uma lista específica
- **THEN** o ranking SHALL mostrar apenas dados daquela lista

### Requirement: Questões mais erradas
O sistema SHALL exibir as top 10 questões com menor percentual de acerto, mostrando:
- Código ou número da questão
- Disciplina
- % de acerto
- Total de respostas

#### Scenario: Questão com poucas respostas
- **WHEN** uma questão possui menos de 3 respostas
- **THEN** ela SHALL ser excluída do ranking de mais erradas (amostra insuficiente)

### Requirement: API de relatório do professor
O sistema SHALL expor endpoint `GET /api/listas/relatorio` autenticado, restrito a professores e admins, retornando todas as métricas do relatório.

Parâmetros opcionais:
- `listaId` — filtrar por lista específica
- `empresaId` — escopo do tenant

#### Scenario: Requisição sem autenticação
- **WHEN** a requisição não possui token válido
- **THEN** o endpoint SHALL retornar 401

#### Scenario: Requisição por aluno
- **WHEN** o token pertence a um aluno
- **THEN** o endpoint SHALL retornar 403
