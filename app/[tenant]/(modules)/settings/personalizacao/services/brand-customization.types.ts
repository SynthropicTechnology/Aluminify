/**
 * Brand Customization Types
 *
 * TypeScript interfaces for the brand customization system that allows
 * each empresa (tenant) to customize logos, colors, fonts, and themes.
 */

// ============================================================================
// Core Types
// ============================================================================

export type LogoType = "login" | "sidebar" | "favicon";

export type ThemeMode = "light" | "dark";

/**
 * Mode of operation for TenantLogo component
 * - connected: Uses data from TenantBrandingProvider context
 * - standalone: Fetches data via API (for unauthenticated pages)
 */
export type TenantLogoMode = "connected" | "standalone";

/**
 * Processed logos state for the provider
 * Contains URLs with cache-busting parameters
 */
export interface LogosState {
  login: string | null;
  sidebar: string | null;
  favicon: string | null;
  version: number; // Incremented on each update for cache-busting
}

// ============================================================================
// Database Entity Types
// ============================================================================

/**
 * Main tenant branding configuration
 */
export interface TenantBranding {
  id: string;
  empresaId: string;

  // References to active color palette and font scheme
  colorPaletteId?: string | null;
  fontSchemeId?: string | null;

  // Custom CSS for advanced customizations
  customCss?: string | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Logo storage for different contexts
 */
export interface TenantLogo {
  id: string;
  tenantBrandingId: string;
  logoType: LogoType;
  logoUrl: string;

  // File metadata
  fileName?: string;
  fileSize?: number;
  mimeType?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Color palette definition
 */
export interface ColorPalette {
  id: string;
  name: string;
  empresaId: string;

  // Primary colors
  primaryColor: string;
  primaryForeground: string;
  secondaryColor: string;
  secondaryForeground: string;

  // Support colors
  accentColor: string;
  accentForeground: string;
  mutedColor: string;
  mutedForeground: string;

  // System colors
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  cardForeground: string;

  // Status colors
  destructiveColor: string;
  destructiveForeground: string;

  // Sidebar specific colors
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;

  // Metadata
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Font scheme definition
 */
export interface FontScheme {
  id: string;
  name: string;
  empresaId: string;

  // Font families
  fontSans: string[];
  fontMono: string[];

  // Font sizes
  fontSizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
  };

  // Font weights
  fontWeights: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  // Google Fonts integration
  googleFonts: string[];

  // Metadata
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Complete theme preset combining colors, fonts, and theme customizer settings
 */
export interface CustomThemePreset {
  id: string;
  name: string;
  empresaId: string;

  // References
  colorPaletteId?: string;
  fontSchemeId?: string;

  // Theme customizer settings
  radius: number;
  scale: number;
  mode: ThemeMode;

  // Preview colors for UI
  previewColors: string[];

  // Default preset flag
  isDefault: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// ============================================================================
// Service Interface Types
// ============================================================================

/**
 * Logo upload result
 */
export interface LogoUploadResult {
  success: boolean;
  logoUrl?: string;
  error?: string;
  validationErrors?: string[];
}

/**
 * File validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Accessibility report for color palettes
 */
export interface AccessibilityReport {
  isCompliant: boolean;
  contrastRatios: {
    primaryOnBackground: number;
    secondaryOnBackground: number;
    accentOnBackground: number;
  };
  recommendations?: string[];
  warnings?: string[];
}

/**
 * Complete branding configuration with all related data
 */
export interface CompleteBrandingConfig {
  tenantBranding: TenantBranding;
  logos: Record<LogoType, TenantLogo | null>;
  colorPalette?: ColorPalette;
  fontScheme?: FontScheme;
  customThemePresets: CustomThemePreset[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to create or update tenant branding
 */
export interface SaveTenantBrandingRequest {
  colorPaletteId?: string | null;
  fontSchemeId?: string | null;
  customCss?: string | null;
}

/**
 * Request to create a color palette
 */
export interface CreateColorPaletteRequest {
  name: string;
  primaryColor: string;
  primaryForeground: string;
  secondaryColor: string;
  secondaryForeground: string;
  accentColor: string;
  accentForeground: string;
  mutedColor: string;
  mutedForeground: string;
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  cardForeground: string;
  destructiveColor: string;
  destructiveForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
}

/**
 * Request to create a font scheme
 */
export interface CreateFontSchemeRequest {
  name: string;
  fontSans: string[];
  fontMono: string[];
  fontSizes?: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
  };
  fontWeights?: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  googleFonts?: string[];
}

/**
 * Request to create a custom theme preset
 */
export interface CreateCustomThemePresetRequest {
  name: string;
  colorPaletteId?: string;
  fontSchemeId?: string;
  radius?: number;
  scale?: number;
  mode?: ThemeMode;
  previewColors?: string[];
  isDefault?: boolean;
}

// ============================================================================
// UI Component Props Types
// ============================================================================

/**
 * Props for brand customization panel
 */
export interface BrandCustomizationPanelProps {
  empresaId: string;
  currentBranding?: CompleteBrandingConfig;
  onSave: (branding: SaveTenantBrandingRequest) => Promise<void>;
  onReset: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Props for logo upload component
 */
export interface LogoUploadComponentProps {
  logoType: LogoType;
  currentLogoUrl?: string;
  onUpload: (file: File, logoType: LogoType) => Promise<LogoUploadResult>;
  onRemove: (logoType: LogoType) => Promise<void>;
  maxFileSize?: number;
  acceptedFormats?: string[];
}

/**
 * Props for color palette editor
 */
export interface ColorPaletteEditorProps {
  currentPalette?: ColorPalette;
  onSave: (palette: CreateColorPaletteRequest) => Promise<void>;
  onPreview: (palette: CreateColorPaletteRequest) => void;
  onValidate: (
    palette: CreateColorPaletteRequest,
  ) => Promise<AccessibilityReport>;
}

/**
 * Props for font scheme selector
 */
export interface FontSchemeSelectorProps {
  currentScheme?: FontScheme;
  availableGoogleFonts: string[];
  onSave: (scheme: CreateFontSchemeRequest) => Promise<void>;
  onPreview: (scheme: CreateFontSchemeRequest) => void;
  onLoadGoogleFont: (fontFamily: string) => Promise<void>;
}

// ============================================================================
// CSS Custom Properties Types
// ============================================================================

/**
 * CSS custom properties for theme application
 */
export interface CSSCustomProperties {
  "--primary": string;
  "--primary-foreground": string;
  "--secondary": string;
  "--secondary-foreground": string;
  "--accent": string;
  "--accent-foreground": string;
  "--muted": string;
  "--muted-foreground": string;
  "--background": string;
  "--foreground": string;
  "--card": string;
  "--card-foreground": string;
  "--destructive": string;
  "--destructive-foreground": string;
  "--sidebar": string;
  "--sidebar-foreground": string;
  "--sidebar-primary": string;
  "--sidebar-primary-foreground": string;
  "--font-sans": string;
  "--font-mono": string;
  "--radius": string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Brand customization specific errors
 */
export class BrandCustomizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BrandCustomizationError";
  }
}

/**
 * Logo upload specific errors
 */
export class LogoUploadError extends BrandCustomizationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "LOGO_UPLOAD_ERROR", details);
    this.name = "LogoUploadError";
  }
}

/**
 * Color validation specific errors
 */
export class ColorValidationError extends BrandCustomizationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "COLOR_VALIDATION_ERROR", details);
    this.name = "ColorValidationError";
  }
}

/**
 * Font loading specific errors
 */
export class FontLoadingError extends BrandCustomizationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "FONT_LOADING_ERROR", details);
    this.name = "FontLoadingError";
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Partial update types for each entity
 */
export type TenantBrandingUpdate = Partial<
  Omit<TenantBranding, "id" | "empresaId" | "createdAt" | "createdBy">
>;
export type ColorPaletteUpdate = Partial<
  Omit<ColorPalette, "id" | "empresaId" | "createdAt" | "createdBy">
>;
export type FontSchemeUpdate = Partial<
  Omit<FontScheme, "id" | "empresaId" | "createdAt" | "createdBy">
>;
export type CustomThemePresetUpdate = Partial<
  Omit<CustomThemePreset, "id" | "empresaId" | "createdAt" | "createdBy">
>;

/**
 * Database insert types (without generated fields)
 */
export type TenantBrandingInsert = Omit<
  TenantBranding,
  "id" | "createdAt" | "updatedAt"
>;
export type TenantLogoInsert = Omit<
  TenantLogo,
  "id" | "createdAt" | "updatedAt"
>;
export type ColorPaletteInsert = Omit<
  ColorPalette,
  "id" | "createdAt" | "updatedAt"
>;
export type FontSchemeInsert = Omit<
  FontScheme,
  "id" | "createdAt" | "updatedAt"
>;
export type CustomThemePresetInsert = Omit<
  CustomThemePreset,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * State for the brand customization panel
 */
export interface BrandCustomizationState {
  logos: Partial<Record<LogoType, string | null>>;
  colorPalette?: ColorPalette;
  fontScheme?: FontScheme;
  customCss?: string | null;

  // IDs for saving references
  colorPaletteId?: string | null;
  fontSchemeId?: string | null;
}

/**
 * Options for loading tenant branding
 */
export interface LoadTenantBrandingOptions {
  empresaId: string;
  includeLogos?: boolean;
  includeColorPalette?: boolean;
  includeFontScheme?: boolean;
  includeCustomPresets?: boolean;
}

/**
 * Options for applying tenant branding
 */
export interface ApplyTenantBrandingOptions {
  branding: CompleteBrandingConfig;
  target?: "document" | "element";
  element?: HTMLElement;
  immediate?: boolean;
}

/**
 * Options for saving tenant branding
 */
export interface SaveTenantBrandingOptions {
  empresaId: string;
  branding: SaveTenantBrandingRequest;
  userId?: string;
}

/**
 * Options for resetting to default
 */
export interface ResetToDefaultOptions {
  empresaId: string;
  userId?: string;
  preserveLogos?: boolean;
}

/**
 * Result of branding operations
 */
export interface BrandingOperationResult {
  success: boolean;
  data?: CompleteBrandingConfig;
  error?: string;
  warnings?: string[];
}

/**
 * CSS application result
 */
export interface CSSApplicationResult {
  success: boolean;
  appliedProperties: Partial<CSSCustomProperties>;
  errors?: string[];
}

/**
 * Default branding configuration
 */
export interface DefaultBrandingConfig {
  colorPalette: {
    primaryColor: string;
    primaryForeground: string;
    secondaryColor: string;
    secondaryForeground: string;
    accentColor: string;
    accentForeground: string;
    mutedColor: string;
    mutedForeground: string;
    backgroundColor: string;
    foregroundColor: string;
    cardColor: string;
    cardForeground: string;
    destructiveColor: string;
    destructiveForeground: string;
    sidebarBackground: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
  };
  fontScheme: {
    fontSans: string[];
    fontMono: string[];
    fontSizes: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      "2xl": string;
      "3xl": string;
      "4xl": string;
    };
    fontWeights: {
      light: number;
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
}
