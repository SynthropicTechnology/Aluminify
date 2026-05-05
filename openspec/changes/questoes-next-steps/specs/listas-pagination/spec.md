## ADDED Requirements

### Requirement: Paginação cursor-based na API de listas
O endpoint `GET /api/listas?available=true` SHALL suportar paginação cursor-based com os parâmetros:
- `limit` — número máximo de itens (padrão 20, máximo 50)
- `cursor` — cursor opaco no formato `created_at|id`

A resposta SHALL incluir:
- `data` — array de `ListaResumo`
- `nextCursor` — cursor para a próxima página, ou `null` se não houver mais itens

#### Scenario: Primeira página sem cursor
- **WHEN** a requisição não inclui `cursor`
- **THEN** o sistema SHALL retornar os primeiros `limit` itens ordenados por `created_at DESC`

#### Scenario: Página seguinte com cursor
- **WHEN** a requisição inclui `cursor` válido
- **THEN** o sistema SHALL retornar os próximos `limit` itens após o cursor, mantendo a ordenação

#### Scenario: Última página
- **WHEN** restam menos de `limit` itens após o cursor
- **THEN** o sistema SHALL retornar os itens restantes com `nextCursor: null`

#### Scenario: Limite excedido
- **WHEN** `limit` é maior que 50
- **THEN** o sistema SHALL usar 50 como limite

### Requirement: Componente de carregamento incremental no client
O componente `ct-questoes-client.tsx` SHALL carregar listas de forma incremental com botão "Carregar mais".

#### Scenario: Carga inicial
- **WHEN** o componente é montado
- **THEN** SHALL carregar as primeiras 20 listas e exibir botão "Carregar mais" se houver `nextCursor`

#### Scenario: Carregar mais
- **WHEN** o aluno clica em "Carregar mais"
- **THEN** SHALL buscar a próxima página e concatenar ao array existente, mantendo filtros e ordenação aplicados

#### Scenario: Sem mais itens
- **WHEN** `nextCursor` é null
- **THEN** o botão "Carregar mais" SHALL não ser exibido

### Requirement: Ordenação client-side
O componente SHALL permitir ordenar as listas carregadas por:
- Data de criação (padrão, mais recente primeiro)
- Disciplina (alfabética)
- Progresso (% concluído, maior primeiro)

#### Scenario: Mudança de ordenação
- **WHEN** o aluno seleciona um critério de ordenação
- **THEN** as listas visíveis (já carregadas e filtradas) SHALL ser reordenadas imediatamente no client

#### Scenario: Ordenação por disciplina com múltiplas disciplinas
- **WHEN** uma lista possui múltiplas disciplinas
- **THEN** a ordenação SHALL usar a primeira disciplina alfabeticamente como chave de ordenação
