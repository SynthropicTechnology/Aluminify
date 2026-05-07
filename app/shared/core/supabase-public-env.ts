type PublicSupabaseConfig = {
  url: string
  anonKey: string
}

// Turbopack replaces `process.env.NEXT_PUBLIC_*` with build-time literals (empty
// string when not set during Docker build). Dynamic key access prevents static
// replacement so values are resolved at runtime.
function runtimeEnv(key: string): string | undefined {
  return process.env[key] || undefined
}

function isPlaceholderSupabaseUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('seu-projeto.supabase.co') ||
    lower.includes('your-project-url') ||
    lower.includes('your-supabase-url')
  )
}

function assertValidUrl(url: string): void {
  try {
    new URL(url)
  } catch {
    throw new Error(
      `[Supabase] NEXT_PUBLIC_SUPABASE_URL inválida: "${url}". ` +
        `Use uma URL completa, ex.: https://xxxx.supabase.co`
    )
  }
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = runtimeEnv("NEXT_PUBLIC_SUPABASE_URL") || runtimeEnv("SUPABASE_URL")
  const anonKey = runtimeEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY")

  if (!url) {
    throw new Error(
      '[Supabase] URL pública do Supabase não configurada. ' +
        'Defina NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL no ambiente.'
    )
  }

  if (isPlaceholderSupabaseUrl(url)) {
    throw new Error(
      `[Supabase] URL pública do Supabase parece ser placeholder: "${url}". ` +
        'Substitua pelo valor real da Project URL do seu projeto Supabase.'
    )
  }

  assertValidUrl(url)

  if (!anonKey) {
    throw new Error(
      '[Supabase] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY não configurada. ' +
        'Crie/edite seu `.env.local` e preencha com a anon/public key do Supabase.'
    )
  }

  if (anonKey.trim().length < 20) {
    throw new Error(
      '[Supabase] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY parece inválida (muito curta). ' +
        'Cole a anon/public key completa do Supabase.'
    )
  }

  return { url, anonKey }
}


