import { z } from "zod";

const envSchema = z.object({
  // Core
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),

  // Keys - pelo menos um par de chaves deve existir (Client e Server)
  // Server-side keys (Service Role)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  // Client-side keys (Anon/Public)
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: z.string().optional(),

  // OAuth
  OAUTH_ENCRYPTION_KEY: z
    .string()
    .min(32, "Encryption key must be at least 32 characters"),

  // Google Analytics
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),

  // Sentry
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_TUNNEL_ROUTE: z.enum(["true", "false"]).optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // SMTP customizado
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_REQUIRE_TLS: z.enum(["true", "false"]).optional(),
  SMTP_IGNORE_TLS: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),

  // Cloudron sendmail addon
  CLOUDRON_MAIL_SMTP_SERVER: z.string().optional(),
  CLOUDRON_MAIL_SMTP_PORT: z.string().optional(),
  CLOUDRON_MAIL_SMTPS_PORT: z.string().optional(),
  CLOUDRON_MAIL_SMTP_USERNAME: z.string().optional(),
  CLOUDRON_MAIL_SMTP_PASSWORD: z.string().optional(),
  CLOUDRON_MAIL_FROM: z.string().optional(),
  CLOUDRON_MAIL_FROM_DISPLAY_NAME: z.string().optional(),
  CLOUDRON_MAIL_DOMAIN: z.string().optional(),

  // Build & CI
  DOCKER_BUILD: z.enum(["true", "false"]).optional(),
  CI: z.string().optional(),
});

// Validação refinada para garantir que temos chaves suficientes
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

// Skip validation during build time (e.g., Docker builds)
const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "true" ||
  process.env.NEXT_PHASE === "phase-production-build";

function getValidatedEnv(): z.infer<typeof envSchema> {
  if (skipValidation) {
    return process.env as unknown as z.infer<typeof envSchema>;
  }

  const _env = refinedEnv.safeParse(process.env);

  if (!_env.success) {
    console.error(
      "❌ Invalid environment variables:",
      _env.error.flatten().fieldErrors,
    );
    throw new Error("Invalid environment variables");
  }

  return _env.data;
}

export const env = getValidatedEnv();
