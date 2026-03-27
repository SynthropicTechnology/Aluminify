import { SupabaseClient } from "@supabase/supabase-js";
import { BrandingTransformers } from "./branding.transformers";
import { BrandingValidators } from "./branding.validators";
import { SimpleCache } from "./simple-cache";
import { BrandingSync } from "./branding-sync";
import { getCSSPropertiesManager } from "./css-properties-manager";
import type {
  AccessibilityReport,
  ApplyTenantBrandingOptions,
  BrandingOperationResult,
  ColorPalette,
  CompleteBrandingConfig,
  CreateColorPaletteRequest,
  CSSApplicationResult,
  CSSCustomProperties,
  CustomThemePreset,
  DefaultBrandingConfig,
  FontScheme,
  LoadTenantBrandingOptions,
  LogoType,
  LogoUploadResult,
  ResetToDefaultOptions,
  SaveTenantBrandingOptions,
  TenantBranding,
  TenantBrandingInsert,
  TenantBrandingUpdate,
  TenantLogo,
} from "./brand-customization.types";
import {
  BrandCustomizationError,
  ColorValidationError,
  LogoUploadError,
} from "./brand-customization.types";

export class BrandingService {
  private cache = new SimpleCache<CompleteBrandingConfig>();
  private sync = new BrandingSync();
  private readonly defaultBranding: DefaultBrandingConfig;
  private readonly STORAGE_BUCKET = "tenant-logos";

  constructor(private readonly client: SupabaseClient) {
    this.defaultBranding = this.getDefaultBrandingConfig();
  }

  // ==========================================================================
  // Core Business Logic (Load, Apply, Save, Reset)
  // ==========================================================================

  /**
   * Load tenant branding configuration with caching
   */
  async loadTenantBranding(
    options: LoadTenantBrandingOptions,
  ): Promise<BrandingOperationResult> {
    try {
      const { empresaId } = options;

      // Check cache first
      const cached = this.cache.get(empresaId);
      if (cached) {
        return { success: true, data: cached };
      }

      // Validate empresa exists
      const { data: empresa, error: empresaError } = await this.client
        .from("empresas")
        .select("id")
        .eq("id", empresaId)
        .maybeSingle();

      if (empresaError) {
        return {
          success: false,
          error: `Failed to validate empresa: ${empresaError.message}`,
        };
      }

      if (!empresa) {
        return {
          success: false,
          error: `Empresa with ID ${empresaId} not found`,
        };
      }

      // Load complete branding configuration
      const brandingConfig = await this.getCompleteBrandingConfig(empresaId);

      if (!brandingConfig) {
        const defaultConfig = this.createDefaultBrandingConfig(empresaId);
        // Cache default configuration with shorter TTL (2 mins)
        this.cache.set(empresaId, defaultConfig, 2 * 60 * 1000);
        return {
          success: true,
          data: defaultConfig,
          warnings: ["No custom branding found, using default configuration"],
        };
      }

      // Cache the loaded configuration
      this.cache.set(empresaId, brandingConfig);
      return { success: true, data: brandingConfig };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load tenant branding: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Apply tenant branding to DOM
   */
  async applyTenantBranding(
    options: ApplyTenantBrandingOptions,
  ): Promise<CSSApplicationResult> {
    const { branding, target = "document", element } = options;
    const appliedProperties: Partial<CSSCustomProperties> = {};
    const errors: string[] = [];

    try {
      let targetElement: HTMLElement;
      if (target === "document") {
        if (typeof document === "undefined") {
          return {
            success: false,
            appliedProperties,
            errors: ["Document is not available (server-side context)"],
          };
        }
        targetElement = document.documentElement;
      } else if (element) {
        targetElement = element;
      } else {
        return {
          success: false,
          appliedProperties,
          errors: ["No target element specified"],
        };
      }

      const propertiesToApply: Record<string, string> = {};

      // Apply color palette
      if (branding.colorPalette) {
        try {
          Object.assign(
            propertiesToApply,
            this.generateColorCSSProperties(branding.colorPalette),
          );
        } catch (error) {
          errors.push(
            `Failed to apply color palette: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      // Apply font scheme
      if (branding.fontScheme) {
        try {
          Object.assign(
            propertiesToApply,
            this.generateFontCSSProperties(branding.fontScheme),
          );
          if (branding.fontScheme.googleFonts?.length > 0) {
            this.loadGoogleFontsOptimized(branding.fontScheme.googleFonts);
          }
        } catch (error) {
          errors.push(
            `Failed to apply font scheme: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      // Apply updates in batch
      if (target === "document") {
        // Delegate to CSSPropertiesManager which uses a <style> element
        // instead of inline styles, allowing dark mode CSS to cascade properly
        getCSSPropertiesManager().setBatchedProperties(propertiesToApply);
      } else {
        // Preview on a specific element — keep inline styles (scoped)
        Object.entries(propertiesToApply).forEach(([property, value]) => {
          targetElement.style.setProperty(property, value);
        });
      }
      Object.entries(propertiesToApply).forEach(([property, value]) => {
        appliedProperties[property as keyof CSSCustomProperties] = value;
      });

      // Apply custom CSS
      if (branding.tenantBranding.customCss) {
        this.applyCustomCSS(branding.tenantBranding.customCss);
      }

      return {
        success: errors.length === 0,
        appliedProperties,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        appliedProperties: {},
        errors: [
          `Failed to apply tenant branding: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  /**
   * Save tenant branding configuration
   */
  async saveTenantBranding(
    options: SaveTenantBrandingOptions,
  ): Promise<BrandingOperationResult> {
    try {
      const { empresaId, branding, userId } = options;
      this.cache.invalidate(empresaId);

      const existingBranding = await this.findTenantBranding(empresaId);

      if (existingBranding) {
        await this.updateTenantBrandingDB(existingBranding.id, {
          colorPaletteId: branding.colorPaletteId,
          fontSchemeId: branding.fontSchemeId,
          customCss: branding.customCss,
          updatedBy: userId,
        });
      } else {
        await this.createTenantBrandingDB({
          empresaId,
          colorPaletteId: branding.colorPaletteId,
          fontSchemeId: branding.fontSchemeId,
          customCss: branding.customCss,
          createdBy: userId,
          updatedBy: userId,
        });
      }

      const completeConfig = await this.getCompleteBrandingConfig(empresaId);
      if (completeConfig) {
        this.cache.set(empresaId, completeConfig);
        // Notify other tabs
        this.sync.publishUpdate(empresaId, completeConfig);
      }

      return { success: true, data: completeConfig || undefined };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save tenant branding: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Reset tenant branding to default
   */
  async resetToDefault(
    options: ResetToDefaultOptions,
  ): Promise<BrandingOperationResult> {
    try {
      const { empresaId, userId, preserveLogos = false } = options;
      this.cache.invalidate(empresaId);

      const existingBranding = await this.findTenantBranding(empresaId);

      if (existingBranding) {
        if (preserveLogos) {
          await this.updateTenantBrandingDB(existingBranding.id, {
            colorPaletteId: null,
            fontSchemeId: null,
            customCss: null,
            updatedBy: userId,
          });
        } else {
          await this.deleteTenantBrandingDB(existingBranding.id);
        }
      }

      const defaultConfig = this.createDefaultBrandingConfig(empresaId);
      this.cache.set(empresaId, defaultConfig, 2 * 60 * 1000); // 2 mins

      // Notify other tabs
      this.sync.publishInvalidation(empresaId);

      return { success: true, data: defaultConfig };
    } catch (error) {
      return {
        success: false,
        error: `Failed to reset to default: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ==========================================================================
  // Logo Management
  // ==========================================================================

  async uploadLogo(
    empresaId: string,
    file: File,
    type: LogoType,
  ): Promise<LogoUploadResult> {
    try {
      const validation = await BrandingValidators.validateLogo(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: "File validation failed",
          validationErrors: validation.errors,
        };
      }

      // Check empresa existence
      const { data: empresa, error: empresaError } = await this.client
        .from("empresas")
        .select("id")
        .eq("id", empresaId)
        .maybeSingle();

      if (empresaError || !empresa) {
        return { success: false, error: `Invalid empresa ID: ${empresaId}` };
      }

      const sanitizedFileName = this.sanitizeFileName(file.name);
      const timestamp = Date.now();
      const secureFileName = `${empresaId}/${type}/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await this.client.storage
        .from(this.STORAGE_BUCKET)
        .upload(secureFileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        throw new LogoUploadError(
          `Failed to upload file: ${uploadError.message}`,
          { uploadError },
        );
      }

      const { data: urlData } = this.client.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(secureFileName);
      const logoUrl = urlData.publicUrl;

      const tenantBrandingId = await this.findOrCreateTenantBranding(empresaId);
      await this.removeExistingLogo(tenantBrandingId, type);

      const { error: saveError } = await this.client
        .from("tenant_logos")
        .insert({
          tenant_branding_id: tenantBrandingId,
          logo_type: type,
          logo_url: logoUrl,
          file_name: sanitizedFileName,
          file_size: file.size,
          mime_type: file.type,
        })
        .single();

      if (saveError) {
        // Cleanup on DB fail
        await this.client.storage
          .from(this.STORAGE_BUCKET)
          .remove([secureFileName]);
        throw new LogoUploadError(
          `Failed to save logo metadata: ${saveError.message}`,
          { saveError },
        );
      }

      this.cache.invalidate(empresaId);
      this.sync.publishInvalidation(empresaId);

      return { success: true, logoUrl };
    } catch (error) {
      if (
        error instanceof LogoUploadError ||
        error instanceof BrandCustomizationError
      ) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: `Unexpected upload error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  async removeLogo(empresaId: string, type: LogoType): Promise<void> {
    try {
      const tenantBranding = await this.findTenantBranding(empresaId);
      if (!tenantBranding) return;

      const { data: existingLogo } = await this.client
        .from("tenant_logos")
        .select("*")
        .eq("tenant_branding_id", tenantBranding.id)
        .eq("logo_type", type)
        .maybeSingle();

      if (!existingLogo) return;

      const filePath = this.extractFilePathFromUrl(existingLogo.logo_url);
      if (filePath) {
        await this.client.storage.from(this.STORAGE_BUCKET).remove([filePath]);
      }

      await this.client.from("tenant_logos").delete().eq("id", existingLogo.id);

      this.cache.invalidate(empresaId);
      this.sync.publishInvalidation(empresaId);
    } catch (error) {
      throw new LogoUploadError(
        `Failed to remove logo: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  // ==========================================================================
  // Color Palette Management
  // ==========================================================================

  async createPalette(
    empresaId: string,
    palette: CreateColorPaletteRequest,
  ): Promise<string> {
    try {
      const { data: empresa } = await this.client
        .from("empresas")
        .select("id")
        .eq("id", empresaId)
        .maybeSingle();
      if (!empresa)
        throw new ColorValidationError(`Empresa ${empresaId} not found`);

      // Validation logic is now in BrandingValidators, but here we construct the object
      const paletteData = {
        name: palette.name,
        empresa_id: empresaId,
        primary_color: palette.primaryColor,
        primary_foreground: palette.primaryForeground,
        secondary_color: palette.secondaryColor,
        secondary_foreground: palette.secondaryForeground,
        accent_color: palette.accentColor,
        accent_foreground: palette.accentForeground,
        muted_color: palette.mutedColor,
        muted_foreground: palette.mutedForeground,
        background_color: palette.backgroundColor,
        foreground_color: palette.foregroundColor,
        card_color: palette.cardColor,
        card_foreground: palette.cardForeground,
        destructive_color: palette.destructiveColor,
        destructive_foreground: palette.destructiveForeground,
        sidebar_background: palette.sidebarBackground,
        sidebar_foreground: palette.sidebarForeground,
        sidebar_primary: palette.sidebarPrimary,
        sidebar_primary_foreground: palette.sidebarPrimaryForeground,
        is_custom: true,
      };

      const { data, error } = await this.client
        .from("color_palettes")
        .insert(paletteData)
        .select("id")
        .single();

      if (error)
        throw new ColorValidationError(
          `Failed to create palette: ${error.message}`,
        );
      return data.id;
    } catch (error) {
      throw error instanceof ColorValidationError
        ? error
        : new ColorValidationError(
            error instanceof Error ? error.message : "Unknown",
          );
    }
  }

  async getPalettesByEmpresa(empresaId: string): Promise<ColorPalette[]> {
    const { data, error } = await this.client
      .from("color_palettes")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to find palettes: ${error.message}`);
    return data.map(BrandingTransformers.toColorPalette);
  }

  async validateColorContrast(
    palette: CreateColorPaletteRequest,
  ): Promise<AccessibilityReport> {
    return BrandingValidators.validateColorContrast(palette);
  }

  // ==========================================================================
  // Internal Helpers & Repository-like Methods
  // ==========================================================================

  private async getCompleteBrandingConfig(
    empresaId: string,
  ): Promise<CompleteBrandingConfig | null> {
    const tenantBranding = await this.findTenantBranding(empresaId);
    if (!tenantBranding) return null;

    const logos = await this.findTenantLogos(tenantBranding.id);
    const logosMap: Record<LogoType, TenantLogo | null> = {
      login: null,
      sidebar: null,
      favicon: null,
    };
    logos.forEach((l) => (logosMap[l.logoType] = l));

    let colorPalette: ColorPalette | undefined;
    if (tenantBranding.colorPaletteId) {
      const cp = await this.findColorPalette(tenantBranding.colorPaletteId);
      if (cp) colorPalette = cp;
    }

    let fontScheme: FontScheme | undefined;
    if (tenantBranding.fontSchemeId) {
      const fs = await this.findFontScheme(tenantBranding.fontSchemeId);
      if (fs) fontScheme = fs;
    }

    const customThemePresets = await this.findCustomThemePresets(empresaId);

    return {
      tenantBranding,
      logos: logosMap,
      colorPalette,
      fontScheme,
      customThemePresets,
    };
  }

  private async findTenantBranding(
    empresaId: string,
  ): Promise<TenantBranding | null> {
    const { data, error } = await this.client
      .from("tenant_branding")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) throw new Error(`Find TB error: ${error.message}`);
    return data ? BrandingTransformers.toTenantBranding(data) : null;
  }

  private async createTenantBrandingDB(
    data: Omit<TenantBrandingInsert, "updatedAt">,
  ): Promise<TenantBranding> {
    const { data: res, error } = await this.client
      .from("tenant_branding")
      .insert({
        empresa_id: data.empresaId,
        color_palette_id: data.colorPaletteId,
        font_scheme_id: data.fontSchemeId,
        custom_css: data.customCss,
        created_by: data.createdBy,
        updated_by: data.updatedBy,
      })
      .select()
      .single();
    if (error) throw error;
    return BrandingTransformers.toTenantBranding(res);
  }

  private async updateTenantBrandingDB(
    id: string,
    data: TenantBrandingUpdate,
  ): Promise<TenantBranding> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.colorPaletteId !== undefined)
      updateData.color_palette_id = data.colorPaletteId;
    if (data.fontSchemeId !== undefined)
      updateData.font_scheme_id = data.fontSchemeId;
    if (data.customCss !== undefined) updateData.custom_css = data.customCss;
    if (data.updatedBy !== undefined) updateData.updated_by = data.updatedBy;

    const { data: res, error } = await this.client
      .from("tenant_branding")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return BrandingTransformers.toTenantBranding(res);
  }

  private async deleteTenantBrandingDB(id: string): Promise<void> {
    const { error } = await this.client
      .from("tenant_branding")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  private async findTenantLogos(
    tenantBrandingId: string,
  ): Promise<TenantLogo[]> {
    const { data, error } = await this.client
      .from("tenant_logos")
      .select("*")
      .eq("tenant_branding_id", tenantBrandingId);
    if (error) throw error;
    return data.map(BrandingTransformers.toTenantLogo);
  }

  private async findColorPalette(id: string): Promise<ColorPalette | null> {
    const { data, error } = await this.client
      .from("color_palettes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? BrandingTransformers.toColorPalette(data) : null;
  }

  private async findFontScheme(id: string): Promise<FontScheme | null> {
    const { data, error } = await this.client
      .from("font_schemes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? BrandingTransformers.toFontScheme(data) : null;
  }

  private async findCustomThemePresets(
    empresaId: string,
  ): Promise<CustomThemePreset[]> {
    const { data, error } = await this.client
      .from("custom_theme_presets")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(BrandingTransformers.toCustomThemePreset);
  }

  private async findOrCreateTenantBranding(empresaId: string): Promise<string> {
    const existing = await this.findTenantBranding(empresaId);
    if (existing) return existing.id;
    const { data: created, error } = await this.client
      .from("tenant_branding")
      .insert({ empresa_id: empresaId })
      .select("id")
      .single();
    if (error || !created) throw new Error("Failed to create tenant branding");
    return created.id;
  }

  private async removeExistingLogo(tenantBrandingId: string, type: LogoType) {
    const { data } = await this.client
      .from("tenant_logos")
      .select("*")
      .eq("tenant_branding_id", tenantBrandingId)
      .eq("logo_type", type)
      .maybeSingle();
    if (data) {
      const filePath = this.extractFilePathFromUrl(data.logo_url);
      if (filePath)
        await this.client.storage.from(this.STORAGE_BUCKET).remove([filePath]);
      await this.client.from("tenant_logos").delete().eq("id", data.id);
    }
  }

  private extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split("/");
      const idx = parts.findIndex((p) => p === this.STORAGE_BUCKET);
      if (idx >= 0 && idx < parts.length - 1)
        return parts.slice(idx + 1).join("/");
      return null;
    } catch {
      return null;
    }
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
  }

  private createDefaultBrandingConfig(
    empresaId: string,
  ): CompleteBrandingConfig {
    return {
      tenantBranding: {
        id: "default",
        empresaId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      logos: { login: null, sidebar: null, favicon: null },
      colorPalette: {
        ...this.defaultBranding.colorPalette,
        id: "default",
        name: "Default",
        empresaId,
        isCustom: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      fontScheme: {
        ...this.defaultBranding.fontScheme,
        id: "default",
        name: "Default",
        empresaId,
        isCustom: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        googleFonts: [],
      },
      customThemePresets: [],
    };
  }

  private getDefaultBrandingConfig(): DefaultBrandingConfig {
    return {
      colorPalette: {
        primaryColor: "hsl(222.2 84% 4.9%)",
        primaryForeground: "hsl(210 40% 98%)",
        secondaryColor: "hsl(210 40% 96%)",
        secondaryForeground: "hsl(222.2 84% 4.9%)",
        accentColor: "hsl(210 40% 96%)",
        accentForeground: "hsl(222.2 84% 4.9%)",
        mutedColor: "hsl(210 40% 96%)",
        mutedForeground: "hsl(215.4 16.3% 46.9%)",
        backgroundColor: "hsl(0 0% 100%)",
        foregroundColor: "hsl(222.2 84% 4.9%)",
        cardColor: "hsl(0 0% 100%)",
        cardForeground: "hsl(222.2 84% 4.9%)",
        destructiveColor: "hsl(0 84.2% 60.2%)",
        destructiveForeground: "hsl(210 40% 98%)",
        sidebarBackground: "hsl(0 0% 98%)",
        sidebarForeground: "hsl(240 5.3% 26.1%)",
        sidebarPrimary: "hsl(240 5.9% 10%)",
        sidebarPrimaryForeground: "hsl(0 0% 98%)",
      },
      fontScheme: {
        fontSans: ["ui-sans-serif", "system-ui", "sans-serif"],
        fontMono: ["ui-monospace", "monospace"],
        fontSizes: {
          xs: "0.75rem",
          sm: "0.875rem",
          base: "1rem",
          lg: "1.125rem",
          xl: "1.25rem",
          "2xl": "1.5rem",
          "3xl": "1.875rem",
          "4xl": "2.25rem",
        },
        fontWeights: {
          light: 300,
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
      },
    };
  }

  private generateColorCSSProperties(
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

  private generateFontCSSProperties(
    scheme: FontScheme,
  ): Partial<CSSCustomProperties> {
    return {
      "--font-sans": scheme.fontSans.join(", "),
      "--font-mono": scheme.fontMono.join(", "),
    };
  }

  private async loadGoogleFontsOptimized(googleFonts: string[]): Promise<void> {
    if (typeof document === "undefined") return;
    googleFonts.forEach((font) => {
      if (document.querySelector(`link[data-google-fonts="${font}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700&display=swap`;
      link.setAttribute("data-google-fonts", font);
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });
  }

  private applyCustomCSS(css: string) {
    let style = document.getElementById(
      "tenant-custom-css",
    ) as HTMLStyleElement;
    if (!style) {
      style = document.createElement("style");
      style.id = "tenant-custom-css";
      document.head.appendChild(style);
    }
    style.textContent = css;
  }
}
