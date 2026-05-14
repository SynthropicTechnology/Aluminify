## Why

Alunos resolvendo listas longas (50-100+ questões) não conseguem pausar e retomar a resolução com controle de tempo preciso. O cronômetro atual é puramente frontend (`setInterval` em `resolver-lista-client.tsx`), não persiste entre sessões, e continua contando se o aluno deixa a aba aberta sem responder. O progresso das respostas já persiste (via `respostas_aluno`), mas o tempo total de estudo efetivo é perdido — impactando métricas da dashboard e relatórios do professor.

Já existe a tabela `sessoes_estudo` com suporte a pausas (`log_pausas` JSONB, `tempo_total_liquido_segundos`), mas ela não está integrada ao fluxo de resolução de listas de questões.

## What Changes

- Criar sessão de estudo (`sessoes_estudo`) automaticamente ao abrir uma lista para resolução, vinculada via `atividade_relacionada_id`
- Adicionar botão **Pausar / Continuar** no componente de resolução (`resolver-lista-client.tsx`)
- Persistir pausas no `log_pausas` da sessão via API (heartbeat + eventos explícitos)
- Calcular tempo total líquido (excluindo pausas) server-side em vez de depender do timer frontend
- Fechar sessão automaticamente via `beforeunload` / `visibilitychange` quando o aluno sai sem pausar
- Ao retomar lista incompleta, carregar tempo acumulado das sessões anteriores e continuar o timer de onde parou
- Integrar `sessoes_estudo` nas métricas da dashboard para refletir tempo efetivo de estudo por lista

## Capabilities

### New Capabilities
- `sessao-lista-questoes`: Gerenciamento de sessões de estudo durante resolução de listas de questões — iniciar, pausar, retomar, finalizar, heartbeat, e cálculo de tempo líquido

### Modified Capabilities
- `dashboard-analytics`: Métricas de tempo passam a usar `sessoes_estudo.tempo_total_liquido_segundos` para listas de questões, em vez de somar apenas `respostas_aluno.tempo_resposta_segundos`

## Impact

- **Frontend**: `resolver-lista-client.tsx` — novo estado de pausa, botão Pausar/Continuar, heartbeat periódico, handlers de `beforeunload`/`visibilitychange`
- **API**: 3 novos endpoints — `POST /api/listas/[id]/sessao` (iniciar), `PATCH /api/listas/[id]/sessao` (pausar/retomar/heartbeat), `POST /api/listas/[id]/sessao/finalizar`
- **Banco**: Reutiliza `sessoes_estudo` existente; pode precisar de nova coluna `lista_id` ou usar `atividade_relacionada_id` para vincular à lista
- **Dashboard service**: `dashboard-analytics.service.ts` — queries de tempo por disciplina/frente passam a consultar `sessoes_estudo` quando vinculada a listas
- **Sem breaking changes**: o fluxo atual de responder questões e salvar em `respostas_aluno` não muda
