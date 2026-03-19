import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export type EmailProvider = "cloudron-sendmail" | "custom-smtp" | "none";

export type EmailRuntimeStatus = {
  configured: boolean;
  provider: EmailProvider;
};

export type ResolvedEmailConfig = {
  configured: boolean;
  provider: EmailProvider;
  host: string | null;
  port: number | null;
  secure: boolean;
  ignoreTLS: boolean;
  requireTLS: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string | null;
  fromDisplayName: string | null;
};

function cleanEnv(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parsePort(value?: string): number | null {
  if (!value) return null;

  const port = Number.parseInt(value, 10);
  if (!Number.isFinite(port) || port <= 0) return null;

  return port;
}

function parseBoolean(value?: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function getCloudronEmailConfig(): ResolvedEmailConfig | null {
  const host = cleanEnv(process.env.CLOUDRON_MAIL_SMTP_SERVER);
  if (!host) return null;

  const plainPort = parsePort(process.env.CLOUDRON_MAIL_SMTP_PORT);
  const securePort = parsePort(process.env.CLOUDRON_MAIL_SMTPS_PORT);
  const useImplicitTls = !plainPort && !!securePort;
  const port = plainPort ?? securePort;
  const username = cleanEnv(process.env.CLOUDRON_MAIL_SMTP_USERNAME);
  const password = cleanEnv(process.env.CLOUDRON_MAIL_SMTP_PASSWORD);
  const from = cleanEnv(process.env.CLOUDRON_MAIL_FROM);
  const fromDisplayName = cleanEnv(process.env.CLOUDRON_MAIL_FROM_DISPLAY_NAME);

  return {
    configured: Boolean(host && port && from),
    provider: "cloudron-sendmail",
    host,
    port,
    secure: useImplicitTls,
    ignoreTLS: !useImplicitTls,
    requireTLS: false,
    auth:
      username && password
        ? {
            user: username,
            pass: password,
          }
        : undefined,
    from,
    fromDisplayName,
  };
}

function getCustomSmtpConfig(): ResolvedEmailConfig | null {
  const host = cleanEnv(process.env.SMTP_HOST);
  if (!host) return null;

  const port = parsePort(process.env.SMTP_PORT);
  const secure = parseBoolean(process.env.SMTP_SECURE) ?? port === 465;
  const requireTLS = parseBoolean(process.env.SMTP_REQUIRE_TLS) ?? false;
  const ignoreTLS = parseBoolean(process.env.SMTP_IGNORE_TLS) ?? false;
  const username = cleanEnv(process.env.SMTP_USER);
  const password = cleanEnv(process.env.SMTP_PASSWORD);
  const from = cleanEnv(process.env.SMTP_FROM);
  const fromDisplayName = cleanEnv(process.env.SMTP_FROM_NAME);

  return {
    configured: Boolean(host && port && from),
    provider: "custom-smtp",
    host,
    port,
    secure,
    ignoreTLS,
    requireTLS,
    auth:
      username && password
        ? {
            user: username,
            pass: password,
          }
        : undefined,
    from,
    fromDisplayName,
  };
}

export function getEmailConfig(): ResolvedEmailConfig {
  return (
    getCloudronEmailConfig() ??
    getCustomSmtpConfig() ?? {
      configured: false,
      provider: "none",
      host: null,
      port: null,
      secure: false,
      ignoreTLS: false,
      requireTLS: false,
      from: null,
      fromDisplayName: null,
    }
  );
}

export function getEmailRuntimeStatus(): EmailRuntimeStatus {
  const config = getEmailConfig();

  return {
    configured: config.configured,
    provider: config.provider,
  };
}

export function getEmailFromValue(config: ResolvedEmailConfig = getEmailConfig()): string | null {
  if (!config.from) return null;

  return config.fromDisplayName
    ? `${config.fromDisplayName} <${config.from}>`
    : config.from;
}

export function createEmailTransport(
  config: ResolvedEmailConfig = getEmailConfig(),
): nodemailer.Transporter {
  if (!config.configured || !config.host || !config.port) {
    throw new Error("SMTP não configurado. Defina o addon sendmail da Cloudron ou as variáveis SMTP_*");
  }

  const transportOptions: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    ignoreTLS: config.ignoreTLS,
    requireTLS: config.requireTLS,
  };

  if (config.auth) {
    transportOptions.auth = config.auth;
  }

  if (config.provider === "cloudron-sendmail" && !config.secure) {
    transportOptions.tls = {
      rejectUnauthorized: false,
    };
  }

  return nodemailer.createTransport(transportOptions);
}