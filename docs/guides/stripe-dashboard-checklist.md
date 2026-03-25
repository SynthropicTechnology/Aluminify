# Stripe Dashboard Checklist

Checklist operacional para validar configuracao exigida por STRP-07.

## Smart Retries

- Caminho: Stripe Dashboard -> Billing -> Revenue recovery
- Criterio aprovado: Smart Retries habilitado para assinaturas ativas e past_due
- Evidencia: captura de tela da configuracao com timestamp

## Customer Portal

- Caminho: Stripe Dashboard -> Settings -> Billing -> Customer portal
- Criterio aprovado: portal ativo com opcoes de atualizar metodo de pagamento e cancelar assinatura
- Evidencia: captura da tela de configuracao e preview de portal

## billing emails

- Caminho: Stripe Dashboard -> Settings -> Billing -> Subscriptions and emails
- Criterio aprovado: emails de pagamento bem-sucedido, falha e fatura em aberto habilitados
- Evidencia: captura da secao de emails com toggles ativos

## Resultado

Preencher no UAT da fase 02 cada item como `aprovado` ou `reprovado`, incluindo link para evidencia.
