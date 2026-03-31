/**
 * Suite de testes: Core - Validação de Variáveis de Ambiente
 *
 * Testa a validação Zod das variáveis de ambiente:
 * - Variáveis obrigatórias
 * - Validação refinada (pelo menos uma server key e uma client key)
 * - Skip durante build
 * - Valores padrão
 */

import { z } from "zod";

// Recriar o schema para testar sem side-effects de import
// (o módulo env.ts executa validação no import)

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: z.string().optional(),
  OAUTH_ENCRYPTION_KEY: z
    .string()
    .min(32, "Encryption key must be at least 32 characters"),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_TUNNEL_ROUTE: z.enum(["true", "false"]).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_REQUIRE_TLS: z.enum(["true", "false"]).optional(),
  SMTP_IGNORE_TLS: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
  CLOUDRON_MAIL_SMTP_SERVER: z.string().optional(),
  CLOUDRON_MAIL_SMTP_PORT: z.string().optional(),
  CLOUDRON_MAIL_SMTPS_PORT: z.string().optional(),
  CLOUDRON_MAIL_SMTP_USERNAME: z.string().optional(),
  CLOUDRON_MAIL_SMTP_PASSWORD: z.string().optional(),
  CLOUDRON_MAIL_FROM: z.string().optional(),
  CLOUDRON_MAIL_FROM_DISPLAY_NAME: z.string().optional(),
  CLOUDRON_MAIL_DOMAIN: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  DOCKER_BUILD: z.enum(["true", "false"]).optional(),
  CI: z.string().optional(),
});

const refinedEnv = envSchema.superRefine((data, ctx) => {
  const hasServerKey = !!(
    data.SUPABASE_SERVICE_ROLE_KEY || data.SUPABASE_SECRET_KEY
  );
  const hasClientKey = !!(
    data.SUPABASE_ANON_KEY ||
    data.SUPABASE_PUBLISHABLE_KEY ||
    data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
  );

  if (!hasServerKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "É necessário definir SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY",
      path: ["SUPABASE_SERVICE_ROLE_KEY"],
    });
  }

  if (!hasClientKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "É necessário definir SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
      path: ["SUPABASE_ANON_KEY"],
    });
  }
});

// Helper para criar env válida
function validEnv(overrides: Record<string, string> = {}) {
  return {
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: "test-anon-key",
    OAUTH_ENCRYPTION_KEY: "test-oauth-encryption-key-minimum-32chars",
    ...overrides,
  };
}

// =============================================================================
// Validação básica
// =============================================================================

describe("env schema - validação básica", () => {
  it("deve aceitar configuração mínima válida", () => {
    const result = refinedEnv.safeParse(validEnv());
    expect(result.success).toBe(true);
  });

  it("deve definir NODE_ENV padrão como development", () => {
    const env = validEnv();
    delete (env as any).NODE_ENV;

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("deve aceitar NODE_ENV válidos", () => {
    for (const nodeEnv of ["development", "test", "production"]) {
      const result = refinedEnv.safeParse(validEnv({ NODE_ENV: nodeEnv }));
      expect(result.success).toBe(true);
    }
  });

  it("deve rejeitar NODE_ENV inválido", () => {
    const result = refinedEnv.safeParse(validEnv({ NODE_ENV: "staging" }));
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SUPABASE_URL
// =============================================================================

describe("env schema - SUPABASE_URL", () => {
  it("deve rejeitar URL inválida", () => {
    const result = refinedEnv.safeParse(
      validEnv({ SUPABASE_URL: "not-a-url" }),
    );
    expect(result.success).toBe(false);
  });

  it("deve aceitar URL válida", () => {
    const result = refinedEnv.safeParse(
      validEnv({ SUPABASE_URL: "https://myproject.supabase.co" }),
    );
    expect(result.success).toBe(true);
  });

  it("deve rejeitar quando SUPABASE_URL está ausente", () => {
    const env = validEnv();
    delete (env as any).SUPABASE_URL;

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// OAUTH_ENCRYPTION_KEY
// =============================================================================

describe("env schema - OAUTH_ENCRYPTION_KEY", () => {
  it("deve rejeitar chave com menos de 32 caracteres", () => {
    const result = refinedEnv.safeParse(
      validEnv({ OAUTH_ENCRYPTION_KEY: "short-key" }),
    );
    expect(result.success).toBe(false);
  });

  it("deve aceitar chave com exatamente 32 caracteres", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        OAUTH_ENCRYPTION_KEY: "12345678901234567890123456789012",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("deve aceitar chave com mais de 32 caracteres", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        OAUTH_ENCRYPTION_KEY:
          "this-is-a-very-long-encryption-key-for-testing-purposes",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("deve rejeitar quando ausente", () => {
    const env = validEnv();
    delete (env as any).OAUTH_ENCRYPTION_KEY;

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Server keys (refinamento)
// =============================================================================

describe("env schema - server keys", () => {
  it("deve aceitar SUPABASE_SERVICE_ROLE_KEY como server key", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        SUPABASE_SERVICE_ROLE_KEY: "key-1",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("deve aceitar SUPABASE_SECRET_KEY como server key alternativa", () => {
    const env = validEnv();
    delete (env as any).SUPABASE_SERVICE_ROLE_KEY;
    (env as any).SUPABASE_SECRET_KEY = "secret-key";

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(true);
  });

  it("deve rejeitar quando nenhuma server key está presente", () => {
    const env = validEnv();
    delete (env as any).SUPABASE_SERVICE_ROLE_KEY;
    delete (env as any).SUPABASE_SECRET_KEY;

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "É necessário definir SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY",
      );
    }
  });
});

// =============================================================================
// Client keys (refinamento)
// =============================================================================

describe("env schema - client keys", () => {
  it("deve aceitar NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: "anon-key",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("deve aceitar SUPABASE_ANON_KEY como alternativa", () => {
    const env = validEnv();
    delete (env as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;
    (env as any).SUPABASE_ANON_KEY = "anon-key";

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(true);
  });

  it("deve aceitar SUPABASE_PUBLISHABLE_KEY como alternativa", () => {
    const env = validEnv();
    delete (env as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;
    (env as any).SUPABASE_PUBLISHABLE_KEY = "pub-key";

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(true);
  });

  it("deve rejeitar quando nenhuma client key está presente", () => {
    const env = validEnv();
    delete (env as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;
    delete (env as any).SUPABASE_ANON_KEY;
    delete (env as any).SUPABASE_PUBLISHABLE_KEY;

    const result = refinedEnv.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "É necessário definir SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
      );
    }
  });
});

// =============================================================================
// Variáveis opcionais
// =============================================================================

describe("env schema - variáveis opcionais", () => {
  it("deve aceitar configuração sem Stripe", () => {
    const result = refinedEnv.safeParse(validEnv());
    expect(result.success).toBe(true);
  });

  it("deve aceitar configuração com Stripe", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        STRIPE_SECRET_KEY: "sk_test_123",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
        STRIPE_WEBHOOK_SECRET: "whsec_123",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("deve aceitar configuração com Sentry", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        SENTRY_AUTH_TOKEN: "token",
        SENTRY_DSN: "https://sentry.io/123",
        NEXT_PUBLIC_SENTRY_DSN: "https://sentry.io/123",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("deve rejeitar SENTRY_DSN com URL inválida", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        SENTRY_DSN: "not-a-url",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("deve aceitar SENTRY_TUNNEL_ROUTE com valores válidos", () => {
    expect(
      refinedEnv.safeParse(validEnv({ SENTRY_TUNNEL_ROUTE: "true" })).success,
    ).toBe(true);
    expect(
      refinedEnv.safeParse(validEnv({ SENTRY_TUNNEL_ROUTE: "false" })).success,
    ).toBe(true);
  });

  it("deve aceitar SMTP parcialmente configurado", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "587",
        SMTP_SECURE: "true",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("deve rejeitar SMTP_SECURE com valor inválido", () => {
    const result = refinedEnv.safeParse(
      validEnv({
        SMTP_SECURE: "yes" as any,
      }),
    );
    expect(result.success).toBe(false);
  });

  it("deve aceitar DOCKER_BUILD com valores válidos", () => {
    expect(
      refinedEnv.safeParse(validEnv({ DOCKER_BUILD: "true" })).success,
    ).toBe(true);
    expect(
      refinedEnv.safeParse(validEnv({ DOCKER_BUILD: "false" })).success,
    ).toBe(true);
  });
});

// =============================================================================
// Múltiplos erros simultâneos
// =============================================================================

describe("env schema - múltiplos erros", () => {
  it("deve reportar múltiplos erros quando várias variáveis estão faltando", () => {
    const result = refinedEnv.safeParse({});
    expect(result.success).toBe(false);

    if (!result.success) {
      // Deve ter erros para SUPABASE_URL, OAUTH_ENCRYPTION_KEY (e possivelmente chaves)
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});
