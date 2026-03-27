import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ColorPalette,
  CreateColorPaletteRequest,
  AccessibilityReport,
  CSSCustomProperties,
} from '@/app/[tenant]/(modules)/settings/personalizacao/services/brand-customization.types';
import { ColorValidationError } from '@/app/[tenant]/(modules)/settings/personalizacao/services/brand-customization.types';

/**
 * Color Palette Manager Interface
 * Validates Requirements 2.2, 2.3, 2.4, 2.5
 */
export interface ColorPaletteManager {
  // Palette CRUD operations
  createPalette(empresaId: string, palette: CreateColorPaletteRequest): Promise<string>;
  updatePalette(paletteId: string, palette: Partial<CreateColorPaletteRequest>): Promise<void>;
  deletePalette(paletteId: string): Promise<void>;
  getPalette(paletteId: string): Promise<ColorPalette | null>;
  getPalettesByEmpresa(empresaId: string): Promise<ColorPalette[]>;
  
  // Palette application
  applyPalette(palette: ColorPalette, target?: HTMLElement): void;
  generateCSSProperties(palette: ColorPalette): Partial<CSSCustomProperties>;
  
  // Validation
  validateColorContrast(palette: CreateColorPaletteRequest): Promise<AccessibilityReport>;
  validateColorFormat(color: string): boolean;
}

/**
 * Color Palette Manager Implementation
 * Manages creation, updating, and application of color palettes with accessibility validation
 */
export class ColorPaletteManagerImpl implements ColorPaletteManager {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Create a new color palette
   * Validates Requirements 2.2: Allow editing of primary, secondary, accent, and background colors
   */
  async createPalette(empresaId: string, palette: CreateColorPaletteRequest): Promise<string> {
    try {
      // Validate empresa exists
      const { data: empresa, error: empresaError } = await this.client
        .from('empresas')
        .select('id')
        .eq('id', empresaId)
        .maybeSingle();

      if (empresaError) {
        throw new ColorValidationError(`Failed to validate empresa: ${empresaError.message}`);
      }

      if (!empresa) {
        throw new ColorValidationError(`Empresa with ID ${empresaId} not found`);
      }

      // Validate all color formats
      const colorFields = [
        'primaryColor', 'primaryForeground', 'secondaryColor', 'secondaryForeground',
        'accentColor', 'accentForeground', 'mutedColor', 'mutedForeground',
        'backgroundColor', 'foregroundColor', 'cardColor', 'cardForeground',
        'destructiveColor', 'destructiveForeground', 'sidebarBackground',
        'sidebarForeground', 'sidebarPrimary', 'sidebarPrimaryForeground'
      ];

      for (const field of colorFields) {
        const colorValue = palette[field as keyof CreateColorPaletteRequest] as string;
        if (colorValue && !this.validateColorFormat(colorValue)) {
          throw new ColorValidationError(`Invalid color format for ${field}: ${colorValue}`);
        }
      }

      // Monta payload com colunas do banco (snake_case).
      // Importante: Supabase NÃO entende os campos camelCase do nosso domínio.
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
        .from('color_palettes')
        .insert(paletteData)
        .select('id')
        .single();

      if (error) {
        throw new ColorValidationError(`Failed to create color palette: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      if (error instanceof ColorValidationError) {
        throw error;
      }
      throw new ColorValidationError(
        `Failed to create color palette: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing color palette
   * Validates Requirements 2.2: Allow editing of color palette
   */
  async updatePalette(paletteId: string, palette: Partial<CreateColorPaletteRequest>): Promise<void> {
    try {
      // Validate palette exists
      const existingPalette = await this.getPalette(paletteId);
      if (!existingPalette) {
        throw new ColorValidationError(`Color palette with ID ${paletteId} not found`);
      }

      // Validate color formats for provided colors
      const colorFields = Object.keys(palette).filter(key => key.includes('Color') || key.includes('Foreground'));
      
      for (const field of colorFields) {
        const colorValue = palette[field as keyof CreateColorPaletteRequest] as string;
        if (colorValue && !this.validateColorFormat(colorValue)) {
          throw new ColorValidationError(`Invalid color format for ${field}: ${colorValue}`);
        }
      }

      // Monta update com colunas do banco (snake_case) e só inclui campos enviados.
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (palette.name !== undefined) updateData.name = palette.name;
      if (palette.primaryColor !== undefined) updateData.primary_color = palette.primaryColor;
      if (palette.primaryForeground !== undefined) updateData.primary_foreground = palette.primaryForeground;
      if (palette.secondaryColor !== undefined) updateData.secondary_color = palette.secondaryColor;
      if (palette.secondaryForeground !== undefined) updateData.secondary_foreground = palette.secondaryForeground;
      if (palette.accentColor !== undefined) updateData.accent_color = palette.accentColor;
      if (palette.accentForeground !== undefined) updateData.accent_foreground = palette.accentForeground;
      if (palette.mutedColor !== undefined) updateData.muted_color = palette.mutedColor;
      if (palette.mutedForeground !== undefined) updateData.muted_foreground = palette.mutedForeground;
      if (palette.backgroundColor !== undefined) updateData.background_color = palette.backgroundColor;
      if (palette.foregroundColor !== undefined) updateData.foreground_color = palette.foregroundColor;
      if (palette.cardColor !== undefined) updateData.card_color = palette.cardColor;
      if (palette.cardForeground !== undefined) updateData.card_foreground = palette.cardForeground;
      if (palette.destructiveColor !== undefined) updateData.destructive_color = palette.destructiveColor;
      if (palette.destructiveForeground !== undefined) updateData.destructive_foreground = palette.destructiveForeground;
      if (palette.sidebarBackground !== undefined) updateData.sidebar_background = palette.sidebarBackground;
      if (palette.sidebarForeground !== undefined) updateData.sidebar_foreground = palette.sidebarForeground;
      if (palette.sidebarPrimary !== undefined) updateData.sidebar_primary = palette.sidebarPrimary;
      if (palette.sidebarPrimaryForeground !== undefined) updateData.sidebar_primary_foreground = palette.sidebarPrimaryForeground;

      const { error } = await this.client
        .from('color_palettes')
        .update(updateData)
        .eq('id', paletteId);

      if (error) {
        throw new ColorValidationError(`Failed to update color palette: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof ColorValidationError) {
        throw error;
      }
      throw new ColorValidationError(
        `Failed to update color palette: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a color palette
   */
  async deletePalette(paletteId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('color_palettes')
        .delete()
        .eq('id', paletteId);

      if (error) {
        throw new ColorValidationError(`Failed to delete color palette: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof ColorValidationError) {
        throw error;
      }
      throw new ColorValidationError(
        `Failed to delete color palette: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a color palette by ID
   */
  async getPalette(paletteId: string): Promise<ColorPalette | null> {
    try {
      const { data, error } = await this.client
        .from('color_palettes')
        .select('*')
        .eq('id', paletteId)
        .maybeSingle();

      if (error) {
        throw new ColorValidationError(`Failed to get color palette: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      // Convert database format to ColorPalette interface
      return {
        id: data.id,
        name: data.name,
        empresaId: data.empresa_id,
        primaryColor: data.primary_color,
        primaryForeground: data.primary_foreground,
        secondaryColor: data.secondary_color,
        secondaryForeground: data.secondary_foreground,
        accentColor: data.accent_color,
        accentForeground: data.accent_foreground,
        mutedColor: data.muted_color,
        mutedForeground: data.muted_foreground,
        backgroundColor: data.background_color,
        foregroundColor: data.foreground_color,
        cardColor: data.card_color,
        cardForeground: data.card_foreground,
        destructiveColor: data.destructive_color,
        destructiveForeground: data.destructive_foreground,
        sidebarBackground: data.sidebar_background,
        sidebarForeground: data.sidebar_foreground,
        sidebarPrimary: data.sidebar_primary,
        sidebarPrimaryForeground: data.sidebar_primary_foreground,
        isCustom: data.is_custom,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by,
        updatedBy: data.updated_by,
      };
    } catch (error) {
      if (error instanceof ColorValidationError) {
        throw error;
      }
      throw new ColorValidationError(
        `Failed to get color palette: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all color palettes for an empresa
   */
  async getPalettesByEmpresa(empresaId: string): Promise<ColorPalette[]> {
    try {
      const { data, error } = await this.client
        .from('color_palettes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ColorValidationError(`Failed to get color palettes: ${error.message}`);
      }

      return data.map(item => ({
        id: item.id,
        name: item.name,
        empresaId: item.empresa_id,
        primaryColor: item.primary_color,
        primaryForeground: item.primary_foreground,
        secondaryColor: item.secondary_color,
        secondaryForeground: item.secondary_foreground,
        accentColor: item.accent_color,
        accentForeground: item.accent_foreground,
        mutedColor: item.muted_color,
        mutedForeground: item.muted_foreground,
        backgroundColor: item.background_color,
        foregroundColor: item.foreground_color,
        cardColor: item.card_color,
        cardForeground: item.card_foreground,
        destructiveColor: item.destructive_color,
        destructiveForeground: item.destructive_foreground,
        sidebarBackground: item.sidebar_background,
        sidebarForeground: item.sidebar_foreground,
        sidebarPrimary: item.sidebar_primary,
        sidebarPrimaryForeground: item.sidebar_primary_foreground,
        isCustom: item.is_custom,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        createdBy: item.created_by,
        updatedBy: item.updated_by,
      }));
    } catch (error) {
      if (error instanceof ColorValidationError) {
        throw error;
      }
      throw new ColorValidationError(
        `Failed to get color palettes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Apply color palette to DOM element
   * Validates Requirements 2.3, 2.4: Apply palette immediately and update CSS custom properties
   */
  applyPalette(palette: ColorPalette, target?: HTMLElement): void {
    try {
      // Determine target element
      let targetElement: HTMLElement;
      if (target) {
        targetElement = target;
      } else if (typeof document !== 'undefined') {
        targetElement = document.documentElement;
      } else {
        throw new ColorValidationError('No target element available for palette application');
      }

      // Generate CSS properties
      const cssProperties = this.generateCSSProperties(palette);

      // Apply CSS custom properties
      Object.entries(cssProperties).forEach(([property, value]) => {
        if (value) {
          targetElement.style.setProperty(property, value);
        }
      });
    } catch (error) {
      throw new ColorValidationError(
        `Failed to apply color palette: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate CSS custom properties from color palette
   * Validates Requirements 2.4: Update all CSS custom properties to reflect new colors
   */
  generateCSSProperties(palette: ColorPalette): Partial<CSSCustomProperties> {
    return {
      '--primary': palette.primaryColor,
      '--primary-foreground': palette.primaryForeground,
      '--secondary': palette.secondaryColor,
      '--secondary-foreground': palette.secondaryForeground,
      '--accent': palette.accentColor,
      '--accent-foreground': palette.accentForeground,
      '--muted': palette.mutedColor,
      '--muted-foreground': palette.mutedForeground,
      '--background': palette.backgroundColor,
      '--foreground': palette.foregroundColor,
      '--card': palette.cardColor,
      '--card-foreground': palette.cardForeground,
      '--destructive': palette.destructiveColor,
      '--destructive-foreground': palette.destructiveForeground,
      '--sidebar': palette.sidebarBackground,
      '--sidebar-foreground': palette.sidebarForeground,
      '--sidebar-primary': palette.sidebarPrimary,
      '--sidebar-primary-foreground': palette.sidebarPrimaryForeground,
    };
  }

  /**
   * Validate color contrast for accessibility compliance
   * Validates Requirements 2.5: Validate color contrast ratios to ensure accessibility compliance
   */
  async validateColorContrast(palette: CreateColorPaletteRequest): Promise<AccessibilityReport> {
    try {
      // Calculate contrast ratios for key color combinations
      const primaryOnBackground = this.calculateContrastRatio(palette.primaryColor, palette.backgroundColor);
      const secondaryOnBackground = this.calculateContrastRatio(palette.secondaryColor, palette.backgroundColor);
      const accentOnBackground = this.calculateContrastRatio(palette.accentColor, palette.backgroundColor);

      // WCAG AA compliance requires 4.5:1 for normal text, 3:1 for large text
      const minContrastRatio = 4.5;
      const isCompliant = 
        primaryOnBackground >= minContrastRatio &&
        secondaryOnBackground >= minContrastRatio &&
        accentOnBackground >= minContrastRatio;

      const recommendations: string[] = [];
      const warnings: string[] = [];

      if (primaryOnBackground < minContrastRatio) {
        recommendations.push(`Primary color contrast ratio (${primaryOnBackground.toFixed(2)}:1) is below WCAG AA standard (4.5:1)`);
      }

      if (secondaryOnBackground < minContrastRatio) {
        recommendations.push(`Secondary color contrast ratio (${secondaryOnBackground.toFixed(2)}:1) is below WCAG AA standard (4.5:1)`);
      }

      if (accentOnBackground < minContrastRatio) {
        recommendations.push(`Accent color contrast ratio (${accentOnBackground.toFixed(2)}:1) is below WCAG AA standard (4.5:1)`);
      }

      // Add warnings for borderline cases
      if (primaryOnBackground >= minContrastRatio && primaryOnBackground < 7) {
        warnings.push('Primary color meets AA but not AAA accessibility standards');
      }

      return {
        isCompliant,
        contrastRatios: {
          primaryOnBackground,
          secondaryOnBackground,
          accentOnBackground,
        },
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      throw new ColorValidationError(
        `Failed to validate color contrast: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate color format (hex, hsl, rgb)
   */
  validateColorFormat(color: string): boolean {
    if (!color || typeof color !== 'string') {
      return false;
    }

    // Hex format: #000000 or #000
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexRegex.test(color)) {
      return true;
    }

    // HSL format: hsl(0, 0%, 0%) or hsl(0 0% 0%)
    const hslRegex = /^hsl\(\s*\d+(\.\d+)?\s*,?\s*\d+(\.\d+)?%\s*,?\s*\d+(\.\d+)?%\s*\)$/i;
    if (hslRegex.test(color)) {
      return true;
    }

    // RGB format: rgb(0, 0, 0) or rgb(0 0 0)
    const rgbRegex = /^rgb\(\s*\d+\s*,?\s*\d+\s*,?\s*\d+\s*\)$/i;
    if (rgbRegex.test(color)) {
      return true;
    }

    // RGBA format: rgba(0, 0, 0, 0.5)
    const rgbaRegex = /^rgba\(\s*\d+\s*,?\s*\d+\s*,?\s*\d+\s*,?\s*(0|1|0?\.\d+)\s*\)$/i;
    if (rgbaRegex.test(color)) {
      return true;
    }

    // HSLA format: hsla(0, 0%, 0%, 0.5)
    const hslaRegex = /^hsla\(\s*\d+(\.\d+)?\s*,?\s*\d+(\.\d+)?%\s*,?\s*\d+(\.\d+)?%\s*,?\s*(0|1|0?\.\d+)\s*\)$/i;
    if (hslaRegex.test(color)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate contrast ratio between two colors
   * Uses WCAG formula for contrast ratio calculation
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    try {
      const luminance1 = this.getLuminance(color1);
      const luminance2 = this.getLuminance(color2);
      
      const lighter = Math.max(luminance1, luminance2);
      const darker = Math.min(luminance1, luminance2);
      
      return (lighter + 0.05) / (darker + 0.05);
    } catch (_error) {
      // Return minimum contrast ratio if calculation fails
      return 1;
    }
  }

  /**
   * Get relative luminance of a color
   * Uses WCAG formula for luminance calculation
   */
  private getLuminance(color: string): number {
    const rgb = this.parseColor(color);
    if (!rgb) return 0;

    // Convert to relative luminance
    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Parse color string to RGB values
   */
  private parseColor(color: string): [number, number, number] | null {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16),
        ];
      } else if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
      }
    }

    // Handle HSL colors - simplified conversion
    if (color.startsWith('hsl')) {
      const match = color.match(/hsl\(\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)%\s*,?\s*(\d+(?:\.\d+)?)%\s*\)/i);
      if (match) {
        const h = parseFloat(match[1]) / 360;
        const s = parseFloat(match[2]) / 100;
        const l = parseFloat(match[3]) / 100;
        
        return this.hslToRgb(h, s, l);
      }
    }

    // Handle RGB colors
    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\s*(?:,?\s*[\d.]+)?\s*\)/i);
      if (match) {
        return [
          parseInt(match[1], 10),
          parseInt(match[2], 10),
          parseInt(match[3], 10),
        ];
      }
    }

    return null;
  }

  /**
   * Convert HSL to RGB
   */
  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
}