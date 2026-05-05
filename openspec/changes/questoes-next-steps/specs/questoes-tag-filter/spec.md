## ADDED Requirements

### Requirement: Filtro por tags no picker de questões
O picker de questões (`adicionar-questoes-client.tsx`) SHALL exibir um filtro multi-select de tags, permitindo ao professor filtrar questões que possuam todas as tags selecionadas.

#### Scenario: Nenhuma tag selecionada
- **WHEN** nenhuma tag está selecionada no filtro
- **THEN** o sistema SHALL exibir todas as questões (sem filtro de tags aplicado)

#### Scenario: Uma ou mais tags selecionadas
- **WHEN** o professor seleciona uma ou mais tags
- **THEN** o sistema SHALL passar as tags como parâmetro `tags` na API e exibir apenas questões que possuam todas as tags selecionadas

#### Scenario: Remover tag do filtro
- **WHEN** o professor remove uma tag da seleção
- **THEN** o sistema SHALL recarregar as questões com os filtros atualizados

### Requirement: Listagem de tags disponíveis
O endpoint `GET /api/questoes/filtros` SHALL retornar, além de instituições e anos, a lista de tags únicas existentes no banco de questões da empresa.

#### Scenario: Tags retornadas
- **WHEN** existem questões com tags no banco
- **THEN** o endpoint SHALL retornar um array `tags` com valores únicos, ordenados alfabeticamente

#### Scenario: Nenhuma tag
- **WHEN** nenhuma questão possui tags
- **THEN** o endpoint SHALL retornar `tags: []`

### Requirement: Combobox com busca para tags
O componente de filtro de tags SHALL usar um combobox com campo de busca (padrão `cmdk`), permitindo ao professor digitar para encontrar tags rapidamente.

#### Scenario: Busca dentro do combobox
- **WHEN** o professor digita texto no campo de busca do combobox
- **THEN** o sistema SHALL filtrar as opções de tags que contenham o texto digitado (case-insensitive)

#### Scenario: Seleção múltipla
- **WHEN** o professor seleciona múltiplas tags
- **THEN** as tags selecionadas SHALL ser exibidas como badges abaixo do combobox, cada uma com botão de remoção
