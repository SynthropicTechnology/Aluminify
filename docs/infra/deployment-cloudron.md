# Deploy na Cloudron

Este guia documenta a integração oficial do Aluminify com os add-ons da Cloudron, com foco no envio de e-mails via servidor SMTP interno.

## Add-on correto para SMTP

Na documentação oficial da Cloudron, o add-on usado para **envio** de e-mails por aplicações é o `sendmail`.

Ele injeta automaticamente no container variáveis como:

- `CLOUDRON_MAIL_SMTP_SERVER`
- `CLOUDRON_MAIL_SMTP_PORT`
- `CLOUDRON_MAIL_SMTPS_PORT`
- `CLOUDRON_MAIL_SMTP_USERNAME`
- `CLOUDRON_MAIL_SMTP_PASSWORD`
- `CLOUDRON_MAIL_FROM`
- `CLOUDRON_MAIL_FROM_DISPLAY_NAME`
- `CLOUDRON_MAIL_DOMAIN`

No Aluminify, esse add-on já está habilitado em `CloudronManifest.json`.

## Como o app resolve SMTP

O runtime Node do Aluminify agora segue esta ordem:

1. Usa o add-on `sendmail` da Cloudron quando `CLOUDRON_MAIL_SMTP_SERVER` estiver presente.
2. Faz fallback para SMTP manual com variáveis `SMTP_*` fora da Cloudron.
3. Marca o provedor como `none` quando nenhuma configuração estiver disponível.

Essa resolução fica centralizada em `app/shared/core/email.ts`.

## Verificando se o add-on está disponível

Após instalar ou atualizar o app na Cloudron, valide:

```bash
curl https://SEU-DOMINIO/api/health
```

O retorno deve incluir algo como:

```json
{
  "status": "ok",
  "integrations": {
    "email": {
      "configured": true,
      "provider": "cloudron-sendmail"
    }
  }
}
```

## Observações importantes

- Em Cloudron, não configure `SMTP_*` manualmente se o objetivo for usar o servidor interno da plataforma.
- O hostname e as credenciais do add-on podem mudar após restart, restore ou reprovisionamento. Por isso, o app lê `process.env` em runtime.
- O fluxo atual de notificações em `supabase/functions/enviar-notificacao-agendamento/index.ts` continua usando `Resend`. Essa função roda no runtime do Supabase, não no container Next.js da Cloudron, então ela não consome automaticamente `CLOUDRON_MAIL_*`.

## Referência oficial

- Packaging Addons: https://docs.cloudron.io/packaging/addons/
- Manifest / addons: https://docs.cloudron.io/packaging/manifest/#addons
