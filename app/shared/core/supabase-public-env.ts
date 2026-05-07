import { env } from "@/app/shared/core/env"

type PublicSupabaseConfig = {
  url: string
  anonKey: string
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
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY

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
      '[Supabase] Anon key do Supabase não configurada. ' +
        'Defina NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ou SUPABASE_ANON_KEY no ambiente.'
    )
  }

  if (anonKey.trim().length < 20) {
    throw new Error(
      '[Supabase] Anon key do Supabase parece inválida (muito curta). ' +
        'Cole a anon/public key completa do Supabase.'
    )
  }

  return { url, anonKey }
}
