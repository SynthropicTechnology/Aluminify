"use client";

import { useEffect, ReactNode } from "react";
import { useBranding } from "./branding-data-provider";
import { getCSSPropertiesManager } from "../services/css-properties-manager";

interface BrandingThemeProviderProps {
    children: ReactNode;
}

export function BrandingThemeProvider({ children }: BrandingThemeProviderProps) {
    const { branding, service } = useBranding();

    useEffect(() => {
        if (branding && service) {
            service.applyTenantBranding({
                branding,
                target: 'document' // Applies to documentElement
            });
            return;
        }

        // When branding is not available (e.g. tenant switch in progress),
        // clear tenant overrides immediately so stale colors don't persist.
        getCSSPropertiesManager().resetToDefaults();

        const legacyCustomCss = document.getElementById("tenant-custom-css");
        if (legacyCustomCss) {
            legacyCustomCss.remove();
        }
    }, [branding, service]);

    return <>{children}</>;
}
