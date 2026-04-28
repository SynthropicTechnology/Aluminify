import { SupabaseClient } from '@supabase/supabase-js';
import type {
  FontScheme,
  CreateFontSchemeRequest,
  CSSCustomProperties,
} from '@/app/[tenant]/(modules)/settings/personalizacao/services/brand-customization.types';
import { FontLoadingError } from '@/app/[tenant]/(modules)/settings/personalizacao/services/brand-customization.types';

/**
 * Font Scheme Manager Interface
 * Validates Requirements 3.1, 3.2, 3.3, 3.5
 */
export interface FontSchemeManager {
  // Font scheme CRUD operations
  createFontScheme(empresaId: string, scheme: CreateFontSchemeRequest): Promise<string>;
  updateFontScheme(schemeId: string, scheme: Partial<CreateFontSchemeRequest>): Promise<void>;
  deleteFontScheme(schemeId: string): Promise<void>;
  getFontScheme(schemeId: string): Promise<FontScheme | null>;
  getFontSchemesByEmpresa(empresaId: string): Promise<FontScheme[]>;
  
  // Font scheme application
  applyFontScheme(scheme: FontScheme, target?: HTMLElement): Promise<void>;
  generateFontCSSProperties(scheme: FontScheme): Partial<CSSCustomProperties>;
  
  // Google Fonts integration
  loadGoogleFont(fontFamily: string): Promise<void>;
  loadGoogleFonts(fontFamilies: string[]): Promise<void>;
  validateGoogleFont(fontFamily: string): Promise<boolean>;
  
  // Font validation
  validateFontFallbacks(fontSans: string[], fontMono: string[]): boolean;
}

/**
 * Font Scheme Manager Implementation
 * Manages creation, updating, and application of font schemes with Google Fonts integration
 */
export class FontSchemeManagerImpl implements FontSchemeManager {
  private readonly loadedGoogleFonts = new Set<string>();
  private readonly defaultFontSizes = {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  };
  private readonly defaultFontWeights = {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  };

  constructor(private readonly client: SupabaseClient) {}

  /**
   * Create a new font scheme
   * Validates Requirements 3.1: Apply font scheme to all text elements
   */
  async createFontScheme(empresaId: string, scheme: CreateFontSchemeRequest): Promise<string> {
    try {
      // Validate empresa exists
      const { data: empresa, error: empresaError } = await this.client
        .from('empresas')
        .select('id')
        .eq('id', empresaId)
        .maybeSingle();

      if (empresaError) {
        throw new FontLoadingError(`Failed to validate empresa: ${empresaError.message}`);
      }

      if (!empresa) {
        throw new FontLoadingError(`Empresa with ID ${empresaId} not found`);
      }

      // Validate font fallbacks
      if (!this.validateFontFallbacks(scheme.fontSans, scheme.fontMono)) {
        throw new FontLoadingError('Invalid font fallback configuration');
      }

      // Validate Google Fonts if provided
      if (scheme.googleFonts && scheme.googleFonts.length > 0) {
        await Promise.all(
          scheme.googleFonts.map(async (fontFamily) => {
            const isValid = await this.validateGoogleFont(fontFamily);
            if (!isValid) {
              throw new FontLoadingError(`Invalid Google Font: ${fontFamily}`);
            }
          })
        );
      }

      // Create font scheme insert data (using snake_case for database columns)
      const schemeData = {
        name: scheme.name,
        empresa_id: empresaId,
        font_sans: scheme.fontSans,
        font_mono: scheme.fontMono,
        font_sizes: scheme.fontSizes || this.defaultFontSizes,
        font_weights: scheme.fontWeights || this.defaultFontWeights,
        google_fonts: scheme.googleFonts || [],
        is_custom: true,
      };

      const { data, error } = await this.client
        .from('font_schemes')
        .insert(schemeData)
        .select('id')
        .single();

      if (error) {
        throw new FontLoadingError(`Failed to create font scheme: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      if (error instanceof FontLoadingError) {
        throw error;
      }
      throw new FontLoadingError(
        `Failed to create font scheme: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing font scheme
   * Validates Requirements 3.1: Allow font scheme modifications
   */
  async updateFontScheme(schemeId: string, scheme: Partial<CreateFontSchemeRequest>): Promise<void> {
    try {
      // Validate scheme exists
      const existingScheme = await this.getFontScheme(schemeId);
      if (!existingScheme) {
        throw new FontLoadingError(`Font scheme with ID ${schemeId} not found`);
      }

      // Validate font fallbacks if provided
      if (scheme.fontSans || scheme.fontMono) {
        const fontSans = scheme.fontSans || existingScheme.fontSans;
        const fontMono = scheme.fontMono || existingScheme.fontMono;
        
        if (!this.validateFontFallbacks(fontSans, fontMono)) {
          throw new FontLoadingError('Invalid font fallback configuration');
        }
      }

      // Validate Google Fonts if provided
      if (scheme.googleFonts && scheme.googleFonts.length > 0) {
        await Promise.all(
          scheme.googleFonts.map(async (fontFamily) => {
            const isValid = await this.validateGoogleFont(fontFamily);
            if (!isValid) {
              throw new FontLoadingError(`Invalid Google Font: ${fontFamily}`);
            }
          })
        );
      }

      // Create update data (using snake_case for database columns)
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (scheme.name !== undefined) updateData.name = scheme.name;
      if (scheme.fontSans !== undefined) updateData.font_sans = scheme.fontSans;
      if (scheme.fontMono !== undefined) updateData.font_mono = scheme.fontMono;
      if (scheme.fontSizes !== undefined) updateData.font_sizes = scheme.fontSizes;
      if (scheme.fontWeights !== undefined) updateData.font_weights = scheme.fontWeights;
      if (scheme.googleFonts !== undefined) updateData.google_fonts = scheme.googleFonts;

      const { error } = await this.client
        .from('font_schemes')
        .update(updateData)
        .eq('id', schemeId);

      if (error) {
        throw new FontLoadingError(`Failed to update font scheme: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof FontLoadingError) {
        throw error;
      }
      throw new FontLoadingError(
        `Failed to update font scheme: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a font scheme
   */
  async deleteFontScheme(schemeId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('font_schemes')
        .delete()
        .eq('id', schemeId);

      if (error) {
        throw new FontLoadingError(`Failed to delete font scheme: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof FontLoadingError) {
        throw error;
      }
      throw new FontLoadingError(
        `Failed to delete font scheme: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a font scheme by ID
   */
  async getFontScheme(schemeId: string): Promise<FontScheme | null> {
    try {
      const { data, error } = await this.client
        .from('font_schemes')
        .select('*')
        .eq('id', schemeId)
        .maybeSingle();

      if (error) {
        throw new FontLoadingError(`Failed to get font scheme: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      // Convert database format to FontScheme interface
      return {
        id: data.id,
        name: data.name,
        empresaId: data.empresa_id,
        fontSans: data.font_sans,
        fontMono: data.font_mono,
        fontSizes: data.font_sizes,
        fontWeights: data.font_weights,
        googleFonts: data.google_fonts || [],
        isCustom: data.is_custom,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by,
        updatedBy: data.updated_by,
      };
    } catch (error) {
      if (error instanceof FontLoadingError) {
        throw error;
      }
      throw new FontLoadingError(
        `Failed to get font scheme: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all font schemes for an empresa
   */
  async getFontSchemesByEmpresa(empresaId: string): Promise<FontScheme[]> {
    try {
      const { data, error } = await this.client
        .from('font_schemes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new FontLoadingError(`Failed to get font schemes: ${error.message}`);
      }

      return data.map(item => ({
        id: item.id,
        name: item.name,
        empresaId: item.empresa_id,
        fontSans: item.font_sans,
        fontMono: item.font_mono,
        fontSizes: item.font_sizes,
        fontWeights: item.font_weights,
        googleFonts: item.google_fonts || [],
        isCustom: item.is_custom,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        createdBy: item.created_by,
        updatedBy: item.updated_by,
      }));
    } catch (error) {
      if (error instanceof FontLoadingError) {
        throw error;
      }
      throw new FontLoadingError(
        `Failed to get font schemes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Apply font scheme to DOM element
   * Validates Requirements 3.1, 3.5: Apply font scheme without page refresh
   */
  async applyFontScheme(scheme: FontScheme, target?: HTMLElement): Promise<void> {
    try {
      // Determine target element
      let targetElement: HTMLElement;
      if (target) {
        targetElement = target;
      } else if (typeof document !== 'undefined') {
        targetElement = document.documentElement;
      } else {
        throw new FontLoadingError('No target element available for font scheme application');
      }

      // Load Google Fonts if needed
      if (scheme.googleFonts && scheme.googleFonts.length > 0) {
        await this.loadGoogleFonts(scheme.googleFonts);
      }

      // Generate CSS properties
      const cssProperties = this.generateFontCSSProperties(scheme);

      // Apply CSS custom properties
      Object.entries(cssProperties).forEach(([property, value]) => {
        if (value) {
          targetElement.style.setProperty(property, value);
        }
      });

      // Apply font sizes
      Object.entries(scheme.fontSizes).forEach(([size, value]) => {
        targetElement.style.setProperty(`--font-size-${size}`, value);
      });

      // Apply font weights
      Object.entries(scheme.fontWeights).forEach(([weight, value]) => {
        targetElement.style.setProperty(`--font-weight-${weight}`, value.toString());
      });
    } catch (error) {
      throw new FontLoadingError(
        `Failed to apply font scheme: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate CSS custom properties from font scheme
   * Validates Requirements 3.5: Update interface without requiring page refresh
   */
  generateFontCSSProperties(scheme: FontScheme): Partial<CSSCustomProperties> {
    return {
      '--font-sans': scheme.fontSans.join(', '),
      '--font-mono': scheme.fontMono.join(', '),
    };
  }

  /**
   * Load a single Google Font
   * Validates Requirements 3.2: Support Google Fonts integration
   */
  async loadGoogleFont(fontFamily: string): Promise<void> {
    if (typeof document === 'undefined') {
      throw new FontLoadingError('Document is not available (server-side context)');
    }

    // Check if font is already loaded
    if (this.loadedGoogleFonts.has(fontFamily)) {
      return;
    }

    try {
      // Validate font exists
      const isValid = await this.validateGoogleFont(fontFamily);
      if (!isValid) {
        throw new FontLoadingError(`Google Font not found: ${fontFamily}`);
      }

      // Create link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700&display=swap`;
      link.setAttribute('data-google-fonts', fontFamily);

      // Add to document head
      document.head.appendChild(link);

      // Mark as loaded
      this.loadedGoogleFonts.add(fontFamily);

      // Wait for font to load
      await new Promise<void>((resolve, reject) => {
        link.onload = () => resolve();
        link.onerror = () => reject(new FontLoadingError(`Failed to load Google Font: ${fontFamily}`));
        
        // Timeout after 10 seconds
        setTimeout(() => reject(new FontLoadingError(`Timeout loading Google Font: ${fontFamily}`)), 10000);
      });
    } catch (error) {
      throw new FontLoadingError(
        `Failed to load Google Font ${fontFamily}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load multiple Google Fonts
   * Validates Requirements 3.2: Support Google Fonts integration
   */
  async loadGoogleFonts(fontFamilies: string[]): Promise<void> {
    const loadPromises = fontFamilies.map(fontFamily => this.loadGoogleFont(fontFamily));
    
    try {
      await Promise.all(loadPromises);
    } catch (error) {
      // If some fonts fail to load, continue with the ones that succeeded
      console.warn('Some Google Fonts failed to load:', error);
    }
  }

  /**
   * Validate if a Google Font exists
   * Validates Requirements 3.2: Ensure proper font support
   */
  async validateGoogleFont(fontFamily: string): Promise<boolean> {
    try {
      // Simple validation - check if font family name is reasonable
      if (!fontFamily || typeof fontFamily !== 'string' || fontFamily.trim().length === 0) {
        return false;
      }

      // Check for invalid characters
      const invalidChars = /[<>:"\/\\|?*]/;
      if (invalidChars.test(fontFamily)) {
        return false;
      }

      // For now, we'll assume the font is valid if it passes basic checks
      // In a production environment, you might want to make an actual API call
      // to Google Fonts API to verify the font exists
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Validate font fallback configuration
   * Validates Requirements 3.3: Ensure proper fallback fonts are configured
   */
  validateFontFallbacks(fontSans: string[], fontMono: string[]): boolean {
    try {
      // Validate fontSans
      if (!Array.isArray(fontSans) || fontSans.length === 0) {
        return false;
      }

      // Validate fontMono
      if (!Array.isArray(fontMono) || fontMono.length === 0) {
        return false;
      }

      // Check that each font family is a valid string
      const allFonts = [...fontSans, ...fontMono];
      for (const font of allFonts) {
        if (!font || typeof font !== 'string' || font.trim().length === 0) {
          return false;
        }
      }

      // Ensure we have proper fallbacks
      const sansHasSystemFallback = fontSans.some(font => 
        font.includes('system-ui') || 
        font.includes('sans-serif') || 
        font.includes('-apple-system')
      );

      const monoHasSystemFallback = fontMono.some(font => 
        font.includes('monospace') || 
        font.includes('ui-monospace') || 
        font.includes('SFMono-Regular')
      );

      return sansHasSystemFallback && monoHasSystemFallback;
    } catch (_error) {
      return false;
    }
  }
}