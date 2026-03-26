"use client";

import type { CompleteBrandingConfig } from "./brand-customization.types";

const STORAGE_PREFIX = "tenant-branding-prefetch";
const DEFAULT_TTL_MS = 60_000;

interface CachedBrandingPayload {
  fetchedAt: number;
  data: CompleteBrandingConfig;
}

const inFlightRequests = new Map<string, Promise<CompleteBrandingConfig | null>>();

function isBrowser() {
  return typeof window !== "undefined";
}

function getStorageKey(empresaId: string) {
  return `${STORAGE_PREFIX}:${empresaId}`;
}

export function getCachedPrefetchedBranding(
  empresaId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): CompleteBrandingConfig | null {
  if (!isBrowser() || !empresaId) return null;

  try {
    const rawValue = sessionStorage.getItem(getStorageKey(empresaId));
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as CachedBrandingPayload;
    if (!parsed?.data || typeof parsed.fetchedAt !== "number") {
      sessionStorage.removeItem(getStorageKey(empresaId));
      return null;
    }

    const isExpired = Date.now() - parsed.fetchedAt > ttlMs;
    if (isExpired) {
      sessionStorage.removeItem(getStorageKey(empresaId));
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedPrefetchedBranding(
  empresaId: string,
  data: CompleteBrandingConfig,
): void {
  if (!isBrowser() || !empresaId) return;

  try {
    const payload: CachedBrandingPayload = {
      fetchedAt: Date.now(),
      data,
    };

    sessionStorage.setItem(getStorageKey(empresaId), JSON.stringify(payload));
  } catch {
    // Ignore storage quota and serialization failures
  }
}

export async function prefetchTenantBranding(
  empresaId: string,
  options?: { ttlMs?: number; force?: boolean },
): Promise<CompleteBrandingConfig | null> {
  if (!isBrowser() || !empresaId) return null;

  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const force = options?.force ?? false;

  if (!force) {
    const cached = getCachedPrefetchedBranding(empresaId, ttlMs);
    if (cached) {
      return cached;
    }
  }

  const existingRequest = inFlightRequests.get(empresaId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(`/api/empresa/personalizacao/${empresaId}/public`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const result = (await response.json()) as {
        success?: boolean;
        data?: CompleteBrandingConfig;
      };

      if (!result?.success || !result.data) {
        return null;
      }

      setCachedPrefetchedBranding(empresaId, result.data);
      return result.data;
    })
    .catch(() => null)
    .finally(() => {
      inFlightRequests.delete(empresaId);
    });

  inFlightRequests.set(empresaId, request);
  return request;
}
