"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo, useRef } from "react";
import { createClient } from "@/app/shared/core/client";
import { BrandingService } from "../services/branding.service";
import type { CompleteBrandingConfig } from "../services/brand-customization.types";
import {
    getCachedPrefetchedBranding,
    setCachedPrefetchedBranding,
} from "../services/branding-prefetch-cache";

interface BrandingContextType {
    branding: CompleteBrandingConfig | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    service: BrandingService | null;
    setEmpresaId: (id: string | null) => void;
    activeEmpresaId: string | null;
}

const BrandingContext = createContext<BrandingContextType>({
    branding: null,
    isLoading: true,
    error: null,
    refresh: async () => { },
    service: null,
    setEmpresaId: () => { },
    activeEmpresaId: null
});

export const useBranding = () => useContext(BrandingContext);

interface BrandingDataProviderProps {
    children: ReactNode;
    empresaId: string;
    initialData?: CompleteBrandingConfig | null;
}

export function BrandingDataProvider({ children, empresaId, initialData = null }: BrandingDataProviderProps) {
    const [customEmpresaId, setCustomEmpresaId] = useState<string | null | undefined>(undefined);
    const effectiveEmpresaId = customEmpresaId !== undefined ? customEmpresaId : empresaId;
    const previousEffectiveEmpresaId = useRef<string | null>(effectiveEmpresaId);

    // Keep initial render deterministic between SSR and client hydration.
    const [branding, setBranding] = useState<CompleteBrandingConfig | null>(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [error, setError] = useState<string | null>(null);

    const supabase = useMemo(() => createClient(), []);
    const service = useMemo(() => new BrandingService(supabase), [supabase]);

    const loadBranding = useCallback(async (
        idToLoad?: string | null,
        options?: { background?: boolean },
    ) => {
        const targetId = idToLoad !== undefined ? idToLoad : effectiveEmpresaId;
        const isBackground = options?.background ?? false;

        if (!service) return;

        // If targetId is null, reset to default (or clean state)
        if (!targetId) {
            setBranding(null);
            setIsLoading(false);
            return;
        }

        if (!isBackground) {
            setIsLoading(true);
        }
        try {
            const result = await service.loadTenantBranding({ empresaId: targetId });
            if (result.success && result.data) {
                setBranding(result.data);
                setError(null);
                setCachedPrefetchedBranding(targetId, result.data);
            } else {
                setError(result.error || "Failed to load branding");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            if (!isBackground) {
                setIsLoading(false);
            }
        }
    }, [service, effectiveEmpresaId]);

    // Initial load and reaction to effectiveId change
    useEffect(() => {
        const hasEmpresaChanged = previousEffectiveEmpresaId.current !== effectiveEmpresaId;

        if (hasEmpresaChanged) {
            // Clear stale branding immediately when tenant changes.
            // This prevents the previous tenant visual identity from lingering.
            setBranding(null);
            setError(null);
        }

        if (customEmpresaId === undefined && initialData) {
            setBranding(initialData);
            setIsLoading(false);
        } else {
            const prefetchedBranding = effectiveEmpresaId
                ? getCachedPrefetchedBranding(effectiveEmpresaId)
                : null;

            if (prefetchedBranding) {
                setBranding(prefetchedBranding);
                setIsLoading(false);
                void loadBranding(effectiveEmpresaId, { background: true });
            } else {
                void loadBranding(effectiveEmpresaId);
            }
        }

        previousEffectiveEmpresaId.current = effectiveEmpresaId;
    }, [loadBranding, effectiveEmpresaId, initialData, customEmpresaId]);

    const setEmpresaId = useCallback((id: string | null) => {
        setCustomEmpresaId(id);
    }, []);

    const contextValue = useMemo(() => ({
        branding,
        isLoading,
        error,
        refresh: () => loadBranding(),
        service,
        setEmpresaId,
        activeEmpresaId: effectiveEmpresaId
    }), [branding, isLoading, error, loadBranding, service, setEmpresaId, effectiveEmpresaId]);

    return (
        <BrandingContext.Provider value={contextValue}>
            {children}
        </BrandingContext.Provider>
    );
}
