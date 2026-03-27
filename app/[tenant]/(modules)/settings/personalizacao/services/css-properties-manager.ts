/**
 * CSS Custom Properties Manager
 *
 * Manages dynamic CSS custom properties for tenant branding.
 * Extends existing theme system with tenant-specific customizations.
 *
 * Performance optimizations:
 * - Batched CSS property updates to minimize reflows
 * - Caching of computed properties
 * - Lazy loading of Google Fonts
 * - Debounced property application
 */

import type {
  ColorPalette,
  FontScheme,
  CSSCustomProperties,
  CompleteBrandingConfig,
} from "@/app/[tenant]/(modules)/settings/personalizacao/services/brand-customization.types";

/**
 * Surface properties that should only apply in light mode.
 * In dark mode, these fall through to the theme preset's @variant dark rules.
 */
const SURFACE_PROPERTIES = new Set([
  "--background", "--foreground",
  "--card", "--card-foreground",
  "--muted", "--muted-foreground",
  "--popover", "--popover-foreground",
  "--sidebar", "--sidebar-foreground",
  "--sidebar-primary", "--sidebar-primary-foreground",
  "--sidebar-accent", "--sidebar-accent-foreground",
  "--sidebar-border", "--sidebar-ring",
]);

const BRANDING_STYLE_ID = "tenant-branding-vars";

export class CSSPropertiesManager {
  private static instance: CSSPropertiesManager;
  private root!: HTMLElement;
  private appliedProperties: Set<string> = new Set();
  private propertyCache: Map<string, string> = new Map();
  private pendingUpdates: Map<string, string> = new Map();
  private updateTimeout: NodeJS.Timeout | null = null;
  private loadedGoogleFonts: Set<string> = new Set();
  private fontLoadPromises: Map<string, Promise<void>> = new Map();

  private constructor() {
    if (typeof document !== "undefined") {
      this.root = document.documentElement;
    }
  }

  public static getInstance(): CSSPropertiesManager {
    if (!CSSPropertiesManager.instance) {
      CSSPropertiesManager.instance = new CSSPropertiesManager();
    }
    return CSSPropertiesManager.instance;
  }

  /**
   * Apply complete branding configuration to CSS custom properties
   * Optimized with batched updates
   */
  public applyBrandingConfiguration(branding: CompleteBrandingConfig): void {
    // Batch all property updates
    const properties: Record<string, string> = {};

    // Apply color palette if available
    if (branding.colorPalette) {
      Object.assign(
        properties,
        this.generateColorProperties(branding.colorPalette),
      );
    }

    // Apply font scheme if available
    if (branding.fontScheme) {
      Object.assign(
        properties,
        this.generateFontProperties(branding.fontScheme),
      );

      // Load Google Fonts asynchronously
      if (branding.fontScheme.googleFonts.length > 0) {
        this.loadGoogleFontsLazy(branding.fontScheme.googleFonts);
      }
    }

    // Apply all properties in a single batch
    this.setBatchedProperties(properties);

    // Apply custom CSS if available
    if (branding.tenantBranding?.customCss) {
      this.applyCustomCSS(branding.tenantBranding.customCss);
    }
  }

  /**
   * Generate CSS properties object from branding config
   * Used for caching and performance optimization
   */
  public generateCSSProperties(
    branding: CompleteBrandingConfig,
  ): CSSCustomProperties {
    const properties: Partial<CSSCustomProperties> = {};

    if (branding.colorPalette) {
      Object.assign(
        properties,
        this.generateColorProperties(branding.colorPalette),
      );
    }

    if (branding.fontScheme) {
      Object.assign(
        properties,
        this.generateFontProperties(branding.fontScheme),
      );
    }

    return properties as CSSCustomProperties;
  }

  /**
   * Apply color palette to CSS custom properties
   * Optimized version with property generation
   */
  public applyColorPalette(palette: ColorPalette): void {
    const colorProperties = this.generateColorProperties(palette);
    this.setBatchedProperties(colorProperties);
  }

  /**
   * Generate color properties from palette
   */
  private generateColorProperties(
    palette: ColorPalette,
  ): Record<string, string> {
    return {
      "--primary": palette.primaryColor,
      "--primary-foreground": palette.primaryForeground,
      "--secondary": palette.secondaryColor,
      "--secondary-foreground": palette.secondaryForeground,
      "--accent": palette.accentColor,
      "--accent-foreground": palette.accentForeground,
      "--muted": palette.mutedColor,
      "--muted-foreground": palette.mutedForeground,
      "--background": palette.backgroundColor,
      "--foreground": palette.foregroundColor,
      "--card": palette.cardColor,
      "--card-foreground": palette.cardForeground,
      "--destructive": palette.destructiveColor,
      "--destructive-foreground": palette.destructiveForeground,
      "--sidebar": palette.sidebarBackground,
      "--sidebar-foreground": palette.sidebarForeground,
      "--sidebar-primary": palette.sidebarPrimary,
      "--sidebar-primary-foreground": palette.sidebarPrimaryForeground,
    };
  }

  /**
   * Apply font scheme to CSS custom properties
   * Optimized with lazy Google Fonts loading
   */
  public applyFontScheme(fontScheme: FontScheme): void {
    const fontProperties = this.generateFontProperties(fontScheme);
    this.setBatchedProperties(fontProperties);

    // Load Google Fonts lazily if needed
    if (fontScheme.googleFonts.length > 0) {
      this.loadGoogleFontsLazy(fontScheme.googleFonts);
    }
  }

  /**
   * Generate font properties from scheme
   */
  private generateFontProperties(
    fontScheme: FontScheme,
  ): Record<string, string> {
    const properties: Record<string, string> = {
      "--font-sans": fontScheme.fontSans.join(", "),
      "--font-mono": fontScheme.fontMono.join(", "),
    };

    // Add font sizes
    Object.entries(fontScheme.fontSizes).forEach(([size, value]) => {
      properties[`--font-size-${size}`] = value;
    });

    // Add font weights
    Object.entries(fontScheme.fontWeights).forEach(([weight, value]) => {
      properties[`--font-weight-${weight}`] = value.toString();
    });

    return properties;
  }

  /**
   * Apply custom CSS styles with caching
   */
  public applyCustomCSS(customCss: string): void {
    // Check cache first
    const cacheKey = `custom-css-${customCss}`;
    if (this.propertyCache.has(cacheKey)) {
      return;
    }

    // Remove existing custom CSS
    const existingStyle = document.querySelector(
      "style[data-tenant-custom-css]",
    );
    if (existingStyle) {
      existingStyle.remove();
    }

    // Add new custom CSS
    if (customCss.trim()) {
      const style = document.createElement("style");
      style.setAttribute("data-tenant-custom-css", "true");
      style.textContent = customCss;
      document.head.appendChild(style);

      // Cache the applied CSS
      this.propertyCache.set(cacheKey, customCss);
    }
  }

  /**
   * Reset all tenant-specific CSS properties to defaults
   * Optimized with batch operations
   */
  public resetToDefaults(): void {
    // Clear caches
    this.propertyCache.clear();
    this.pendingUpdates.clear();

    // Cancel pending updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    this.appliedProperties.clear();

    if (typeof document !== "undefined") {
      // Remove branding style element
      document.getElementById(BRANDING_STYLE_ID)?.remove();

      // Remove custom CSS
      const customStyle = document.querySelector("style[data-tenant-custom-css]");
      if (customStyle) {
        customStyle.remove();
      }

      // Remove Google Fonts
      const googleFontsLinks = document.querySelectorAll(
        "link[data-google-fonts]",
      );
      googleFontsLinks.forEach((link) => link.remove());
    }

    // Clear font loading state
    this.loadedGoogleFonts.clear();
    this.fontLoadPromises.clear();
  }

  /**
   * Get current CSS property value with caching
   */
  public getProperty(property: string): string {
    if (typeof document === "undefined") return "";

    // Check cache first
    if (this.propertyCache.has(property)) {
      return this.propertyCache.get(property)!;
    }

    const value = getComputedStyle(this.root).getPropertyValue(property);
    this.propertyCache.set(property, value);
    return value;
  }

  /**
   * Check if a property has been applied by tenant branding
   */
  public isPropertyApplied(property: string): boolean {
    return this.appliedProperties.has(property);
  }

  /**
   * Get all applied tenant properties
   */
  public getAppliedProperties(): string[] {
    return Array.from(this.appliedProperties);
  }

  /**
   * Apply theme customizer properties (radius, scale) with batching
   */
  public applyThemeCustomizerProperties(radius: number, scale: number): void {
    const properties = {
      "--radius": `${radius}rem`,
      "--scale": scale.toString(),
    };

    this.setBatchedProperties(properties);
  }

  /**
   * Apply dark/light mode efficiently
   */
  public applyThemeMode(mode: "light" | "dark"): void {
    if (typeof document === "undefined") return;

    // Use requestAnimationFrame for smooth transitions
    requestAnimationFrame(() => {
      if (mode === "dark") {
        this.root.classList.add("dark");
      } else {
        this.root.classList.remove("dark");
      }
    });
  }

  /**
   * Optimized method to set CSS properties with batching and debouncing.
   * Properties are applied via a <style> element, not inline styles.
   */
  public setBatchedProperties(properties: Record<string, string>): void {
    if (typeof document === "undefined") return;

    // Add properties to pending updates
    Object.entries(properties).forEach(([property, value]) => {
      if (value) {
        this.pendingUpdates.set(property, value);
      }
    });

    // Debounce the actual DOM updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.flushPendingUpdates();
    }, 16); // ~60fps
  }

  /**
   * Flush all pending property updates to DOM via <style> element.
   * Surface properties are scoped to :root:not(.dark) so dark mode CSS can take over.
   * Identity/font properties apply in both modes via :root.
   */
  private flushPendingUpdates(): void {
    if (typeof document === "undefined") return;

    // Track new properties
    this.pendingUpdates.forEach((value, property) => {
      this.appliedProperties.add(property);
      this.propertyCache.set(property, value);
    });

    this.pendingUpdates.clear();
    this.updateTimeout = null;

    // Build CSS from all tracked properties
    this.rebuildBrandingStyleElement();
  }

  /**
   * Rebuild the <style> element with all currently applied branding properties.
   * Separates identity (both modes) from surface (light-only) properties.
   */
  private rebuildBrandingStyleElement(): void {
    if (typeof document === "undefined") return;

    const identityEntries: string[] = [];
    const surfaceEntries: string[] = [];

    this.appliedProperties.forEach((property) => {
      const value = this.propertyCache.get(property);
      if (!value) return;

      const declaration = `  ${property}: ${value};`;
      if (SURFACE_PROPERTIES.has(property)) {
        surfaceEntries.push(declaration);
      } else {
        identityEntries.push(declaration);
      }
    });

    // Build CSS string
    const parts: string[] = [];
    if (identityEntries.length > 0) {
      parts.push(`:root {\n${identityEntries.join("\n")}\n}`);
    }
    if (surfaceEntries.length > 0) {
      parts.push(`:root:not(.dark) {\n${surfaceEntries.join("\n")}\n}`);
    }

    if (parts.length === 0) {
      // Nothing to apply — remove element if it exists
      document.getElementById(BRANDING_STYLE_ID)?.remove();
      return;
    }

    let styleEl = document.getElementById(BRANDING_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = BRANDING_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = parts.join("\n\n");
  }

  /**
   * Legacy method for backward compatibility
   */
  private setProperties(properties: Record<string, string>): void {
    this.setBatchedProperties(properties);
  }

  /**
   * Load Google Fonts with lazy loading and caching
   */
  private loadGoogleFontsLazy(fonts: string[]): void {
    if (typeof document === "undefined") return;

    const fontsToLoad = fonts.filter(
      (font) => !this.loadedGoogleFonts.has(font),
    );

    if (fontsToLoad.length === 0) return;

    // Check if we already have a loading promise for these fonts
    const fontKey = fontsToLoad.sort().join(",");
    if (this.fontLoadPromises.has(fontKey)) {
      return;
    }

    // Create loading promise
    const loadPromise = this.createGoogleFontsLink(fontsToLoad);
    this.fontLoadPromises.set(fontKey, loadPromise);

    // Mark fonts as loaded when promise resolves
    loadPromise
      .then(() => {
        fontsToLoad.forEach((font) => this.loadedGoogleFonts.add(font));
      })
      .catch((error) => {
        console.warn("Failed to load Google Fonts:", error);
      });
  }

  /**
   * Create Google Fonts link with optimized loading
   */
  private async createGoogleFontsLink(fonts: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remove existing Google Fonts link for these fonts
      const existingLinks = document.querySelectorAll(
        "link[data-google-fonts]",
      );
      existingLinks.forEach((link) => {
        const href = link.getAttribute("href") || "";
        const hasAnyFont = fonts.some((font) =>
          href.includes(font.replace(/\s+/g, "+")),
        );
        if (hasAnyFont) {
          link.remove();
        }
      });

      if (fonts.length === 0) {
        resolve();
        return;
      }

      // Create optimized Google Fonts URL
      const fontFamilies = fonts
        .map((font) => font.replace(/\s+/g, "+"))
        .join("&family=");

      const link = document.createElement("link");
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}:wght@300;400;500;600;700&display=swap`;
      link.rel = "stylesheet";
      link.setAttribute("data-google-fonts", "true");

      // Add loading optimization attributes
      link.setAttribute("crossorigin", "anonymous");

      // Handle load events
      link.onload = () => resolve();
      link.onerror = () =>
        reject(new Error(`Failed to load fonts: ${fonts.join(", ")}`));

      // Use requestIdleCallback for non-blocking loading
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => {
          document.head.appendChild(link);
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          document.head.appendChild(link);
        }, 0);
      }
    });
  }

  /**
   * Preload Google Fonts for better performance
   */
  public preloadGoogleFonts(fonts: string[]): Promise<void[]> {
    const preloadPromises = fonts.map((font) => {
      if (this.loadedGoogleFonts.has(font)) {
        return Promise.resolve();
      }
      return this.loadGoogleFontsLazy([font]);
    });

    return Promise.all(preloadPromises);
  }

  /**
   * Get cache statistics for debugging
   */
  public getCacheStats(): {
    propertyCacheSize: number;
    loadedFontsCount: number;
    pendingUpdatesCount: number;
  } {
    return {
      propertyCacheSize: this.propertyCache.size,
      loadedFontsCount: this.loadedGoogleFonts.size,
      pendingUpdatesCount: this.pendingUpdates.size,
    };
  }

  /**
   * Clear all caches (useful for memory management)
   */
  public clearCaches(): void {
    this.propertyCache.clear();
    this.pendingUpdates.clear();

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
  }
}

/**
 * Utility functions for CSS properties management
 */

/**
 * Convert color palette to CSS custom properties object
 */
export function colorPaletteToCSSProperties(
  palette: ColorPalette,
): Partial<CSSCustomProperties> {
  return {
    "--primary": palette.primaryColor,
    "--primary-foreground": palette.primaryForeground,
    "--secondary": palette.secondaryColor,
    "--secondary-foreground": palette.secondaryForeground,
    "--accent": palette.accentColor,
    "--accent-foreground": palette.accentForeground,
    "--muted": palette.mutedColor,
    "--muted-foreground": palette.mutedForeground,
    "--background": palette.backgroundColor,
    "--foreground": palette.foregroundColor,
    "--card": palette.cardColor,
    "--card-foreground": palette.cardForeground,
    "--destructive": palette.destructiveColor,
    "--destructive-foreground": palette.destructiveForeground,
    "--sidebar": palette.sidebarBackground,
    "--sidebar-foreground": palette.sidebarForeground,
    "--sidebar-primary": palette.sidebarPrimary,
    "--sidebar-primary-foreground": palette.sidebarPrimaryForeground,
  };
}

/**
 * Convert font scheme to CSS custom properties object
 */
export function fontSchemeToCSSProperties(
  fontScheme: FontScheme,
): Partial<CSSCustomProperties> {
  return {
    "--font-sans": fontScheme.fontSans.join(", "),
    "--font-mono": fontScheme.fontMono.join(", "),
  };
}

/**
 * Validate CSS property name
 */
export function isValidCSSProperty(property: string): boolean {
  return property.startsWith("--") && property.length > 2;
}

/**
 * Validate CSS property value
 */
export function isValidCSSValue(value: string): boolean {
  // Basic validation - not empty and doesn't contain dangerous characters
  return value.trim().length > 0 && !value.includes("<script>");
}

/**
 * Get singleton instance of CSS Properties Manager
 */
export function getCSSPropertiesManager(): CSSPropertiesManager {
  return CSSPropertiesManager.getInstance();
}
