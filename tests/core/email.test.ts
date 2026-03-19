import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { getEmailConfig } from "@/app/shared/core/email";

const originalEnv = { ...process.env };

const emailKeys = [
  "CLOUDRON_MAIL_SMTP_SERVER",
  "CLOUDRON_MAIL_SMTP_PORT",
  "CLOUDRON_MAIL_SMTPS_PORT",
  "CLOUDRON_MAIL_SMTP_USERNAME",
  "CLOUDRON_MAIL_SMTP_PASSWORD",
  "CLOUDRON_MAIL_FROM",
  "CLOUDRON_MAIL_FROM_DISPLAY_NAME",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_REQUIRE_TLS",
  "SMTP_IGNORE_TLS",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "SMTP_FROM_NAME",
] as const;

describe("email config", () => {
  beforeEach(() => {
    for (const key of emailKeys) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prioriza o addon sendmail da Cloudron quando disponível", () => {
    process.env.CLOUDRON_MAIL_SMTP_SERVER = "mail";
    process.env.CLOUDRON_MAIL_SMTP_PORT = "2525";
    process.env.CLOUDRON_MAIL_SMTP_USERNAME = "aluminify";
    process.env.CLOUDRON_MAIL_SMTP_PASSWORD = "secret";
    process.env.CLOUDRON_MAIL_FROM = "no-reply@cloudron.test";
    process.env.CLOUDRON_MAIL_FROM_DISPLAY_NAME = "Aluminify Cloudron";

    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_FROM = "fallback@example.com";

    const config = getEmailConfig();

    expect(config.provider).toBe("cloudron-sendmail");
    expect(config.configured).toBe(true);
    expect(config.host).toBe("mail");
    expect(config.port).toBe(2525);
    expect(config.ignoreTLS).toBe(true);
    expect(config.from).toBe("no-reply@cloudron.test");
  });

  it("usa SMTP customizado fora da Cloudron", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_FROM = "no-reply@example.com";
    process.env.SMTP_FROM_NAME = "Aluminify SMTP";

    const config = getEmailConfig();

    expect(config.provider).toBe("custom-smtp");
    expect(config.configured).toBe(true);
    expect(config.secure).toBe(true);
    expect(config.fromDisplayName).toBe("Aluminify SMTP");
  });

  it("retorna provider none quando nenhum SMTP está configurado", () => {
    const config = getEmailConfig();

    expect(config.provider).toBe("none");
    expect(config.configured).toBe(false);
    expect(config.host).toBeNull();
  });
});