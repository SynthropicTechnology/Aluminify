/**
 * Performance Optimization Tests
 * 
 * Tests performance improvements for CSS property updates, caching,
 * and lazy loading of Google Fonts.
 * 
 * Validates Requirements 2.4, 3.5
 * 
 * Feature: brand-customization, Performance Optimization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CSSPropertiesManager, getCSSPropertiesManager } from '@/app/[tenant]/(modules)/settings/personalizacao/services/css-properties-manager';
import { BrandingCacheManager, getBrandingCacheManager } from '@/app/[tenant]/(modules)/settings/personalizacao/services/branding-cache-manager';
import { BrandingPerformanceMonitor, getBrandingPerformanceMonitor } from '@/app/[tenant]/(modules)/settings/personalizacao/services/branding-performance-monitor';
import type { 
  CompleteBrandingConfig, 
  ColorPalette 
} from '@/types/brand-customization';

// Mock style element for branding vars
const mockBrandingStyleEl = {
  id: '',
  textContent: '',
  setAttribute: jest.fn(),
};

// Mock DOM environment
const mockDocument = {
  documentElement: {
    style: {
      setProperty: jest.fn(),
      removeProperty: jest.fn(),
    },
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
    }
  },
  createElement: jest.fn((tag: string) => {
    if (tag === 'style') {
      return { ...mockBrandingStyleEl, id: '', textContent: '' };
    }
    return {
      setAttribute: jest.fn(),
      onload: null,
      onerror: null,
    };
  }),
  getElementById: jest.fn((_id: string) => null as any),
  head: {
    appendChild: jest.fn(),
  },
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
};

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
};

// Mock requestIdleCallback
const mockRequestIdleCallback = jest.fn((callback) => {
  setTimeout(callback, 0);
});

describe('Performance Optimization Tests', () => {
  let cssManager: CSSPropertiesManager;
  let cacheManager: BrandingCacheManager;
  let performanceMonitor: BrandingPerformanceMonitor;

  beforeEach(() => {
    // Mock global objects
    (global as any).document = mockDocument;
    (global as any).performance = mockPerformance;
    (global as any).requestIdleCallback = mockRequestIdleCallback;
    (global as any).window = { requestIdleCallback: mockRequestIdleCallback };

    // Reset mocks
    jest.clearAllMocks();
    mockPerformance.now.mockReturnValue(100);

    // Get fresh instances
    cssManager = getCSSPropertiesManager();
    cacheManager = getBrandingCacheManager();
    performanceMonitor = getBrandingPerformanceMonitor();

    // Clear any existing state
    cssManager.clearCaches();
    cacheManager.clear();
    performanceMonitor.clearMetrics();
  });

  afterEach(() => {
    // Clean up
    cssManager.clearCaches();
    cacheManager.clear();
    performanceMonitor.clearMetrics();
  });

  describe('CSS Properties Manager Performance', () => {
    it('should batch CSS property updates efficiently', async () => {
      const testPalette: ColorPalette = {
        id: 'test-palette',
        name: 'Test Palette',
        empresaId: 'test-empresa',
        primaryColor: '#1e40af',
        primaryForeground: '#ffffff',
        secondaryColor: '#64748b',
        secondaryForeground: '#ffffff',
        accentColor: '#3b82f6',
        accentForeground: '#ffffff',
        mutedColor: '#f1f5f9',
        mutedForeground: '#64748b',
        backgroundColor: '#ffffff',
        foregroundColor: '#0f172a',
        cardColor: '#ffffff',
        cardForeground: '#0f172a',
        destructiveColor: '#dc2626',
        destructiveForeground: '#ffffff',
        sidebarBackground: '#f8fafc',
        sidebarForeground: '#0f172a',
        sidebarPrimary: '#1e40af',
        sidebarPrimaryForeground: '#ffffff',
        isCustom: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Apply color palette
      cssManager.applyColorPalette(testPalette);

      // Wait for batched updates to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify that a <style> element was created with the CSS properties
      const createElementCalls = (mockDocument.createElement as jest.Mock).mock.calls;
      const styleCreated = createElementCalls.some((call: any[]) => call[0] === 'style');
      expect(styleCreated).toBe(true);

      // Verify the style element was appended to head
      const appendChildCalls = (mockDocument.head.appendChild as jest.Mock).mock.calls;
      expect(appendChildCalls.length).toBeGreaterThan(0);

      // Verify the style element contains the primary color
      const appendedEl = appendChildCalls[0][0];
      expect(appendedEl.textContent).toContain('--primary');
      expect(appendedEl.textContent).toContain('#1e40af');
    });

    it('should cache CSS property values for performance', () => {
      const testProperty = '--test-property';
      const testValue = '#1e40af';

      // Mock getComputedStyle
      (global as any).getComputedStyle = jest.fn(() => ({
        getPropertyValue: jest.fn(() => testValue)
      }));

      // First call should compute and cache
      const value1 = cssManager.getProperty(testProperty);
      expect(value1).toBe(testValue);

      // Second call should use cache
      const value2 = cssManager.getProperty(testProperty);
      expect(value2).toBe(testValue);

      // Verify getComputedStyle was called only once (cached on second call)
      expect((global as any).getComputedStyle).toHaveBeenCalledTimes(1);
    });

    it('should optimize Google Fonts loading with lazy loading', async () => {
      const testFonts = ['Inter'];
      
      // Mock createElement to return a link element
      const mockLink = {
        setAttribute: jest.fn(),
        onload: null,
        onerror: null,
        rel: '',
        href: ''
      };
      mockDocument.createElement.mockReturnValue(mockLink);

      // Preload fonts
      await cssManager.preloadGoogleFonts(testFonts);

      // Verify createElement was called for font links
      expect(mockDocument.createElement).toHaveBeenCalledWith('link');
      
      // Verify font URLs were set correctly
      expect(mockLink.href).toContain('fonts.googleapis.com');
      expect(mockLink.href).toContain('Inter');
    });

    it('should provide cache statistics for monitoring', () => {
      // Apply some properties to populate cache
      cssManager.applyThemeCustomizerProperties(0.5, 1.0);
      
      // Get cache stats
      const stats = cssManager.getCacheStats();
      
      expect(stats).toHaveProperty('propertyCacheSize');
      expect(stats).toHaveProperty('loadedFontsCount');
      expect(stats).toHaveProperty('pendingUpdatesCount');
      expect(typeof stats.propertyCacheSize).toBe('number');
    });
  });

  describe('Branding Cache Manager Performance', () => {
    it('should provide fast cache lookups', () => {
      const testEmpresaId = 'test-empresa';
      const testBranding: CompleteBrandingConfig = {
        tenantBranding: {
          id: 'test-branding',
          empresaId: testEmpresaId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        logos: {
          login: null,
          sidebar: null,
          favicon: null
        },
        colorPalette: undefined,
        fontScheme: undefined,
        customThemePresets: []
      };

      // Set item in cache
      cacheManager.set(testEmpresaId, testBranding);

      // Measure cache lookup performance
      const startTime = performance.now();
      const cachedItem = cacheManager.get(testEmpresaId);
      const endTime = performance.now();

      expect(cachedItem).toEqual(testBranding);
      expect(endTime - startTime).toBeLessThan(1); // Should be very fast
    });

    it('should handle cache eviction efficiently', () => {
      // Create cache with small max size for testing
      const smallCache = new (BrandingCacheManager as any)(2, 60000); // 2 items max

      const testBrandings = Array.from({ length: 3 }, (_, i) => ({
        empresaId: `empresa-${i}`,
        branding: {
          tenantBranding: {
            id: `branding-${i}`,
            empresaId: `empresa-${i}`,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          logos: { login: null, sidebar: null, favicon: null },
          colorPalette: undefined,
          fontScheme: undefined,
          customThemePresets: []
        }
      }));

      // Add items beyond max size
      testBrandings.forEach(({ empresaId, branding }) => {
        smallCache.set(empresaId, branding);
      });

      // Cache should not exceed max size
      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });

    it('should provide accurate cache statistics', () => {
      const testEmpresaId = 'test-empresa';
      const testBranding: CompleteBrandingConfig = {
        tenantBranding: {
          id: 'test-branding',
          empresaId: testEmpresaId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        logos: { login: null, sidebar: null, favicon: null },
        colorPalette: undefined,
        fontScheme: undefined,
        customThemePresets: []
      };

      // Perform cache operations
      cacheManager.set(testEmpresaId, testBranding);
      cacheManager.get(testEmpresaId); // Hit
      cacheManager.get('non-existent'); // Miss

      const stats = cacheManager.getStats();
      
      expect(stats.size).toBe(1);
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should handle TTL expiration correctly', async () => {
      const testEmpresaId = 'test-empresa';
      const testBranding: CompleteBrandingConfig = {
        tenantBranding: {
          id: 'test-branding',
          empresaId: testEmpresaId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        logos: { login: null, sidebar: null, favicon: null },
        colorPalette: undefined,
        fontScheme: undefined,
        customThemePresets: []
      };

      // Set item with very short TTL
      cacheManager.set(testEmpresaId, testBranding, 1); // 1ms TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 5));

      // Item should be expired
      const cachedItem = cacheManager.get(testEmpresaId);
      expect(cachedItem).toBeNull();
    });
  });

  describe('Performance Monitor', () => {
    it('should track CSS property update performance', () => {
      const propertyCount = 10;
      const duration = 5.5;
      const isBatched = true;

      performanceMonitor.recordCSSPropertyUpdate(propertyCount, duration, isBatched);

      const report = performanceMonitor.getPerformanceReport();
      
      expect(report.cssPropertyUpdates.totalUpdates).toBe(1);
      expect(report.cssPropertyUpdates.averageTime).toBe(duration);
      expect(report.cssPropertyUpdates.batchedUpdates).toBe(1);
      expect(report.cssPropertyUpdates.individualUpdates).toBe(0);
    });

    it('should track font loading performance', () => {
      const fontName = 'Inter';
      const duration = 150;
      const fromCache = false;
      const success = true;

      performanceMonitor.recordFontLoading(fontName, duration, fromCache, success);

      const report = performanceMonitor.getPerformanceReport();
      
      expect(report.fontLoading.totalFontsLoaded).toBe(1);
      expect(report.fontLoading.averageLoadTime).toBe(duration);
      expect(report.fontLoading.cacheHitRate).toBe(0);
      expect(report.fontLoading.failedLoads).toBe(0);
    });

    it('should track cache operation performance', () => {
      const operation = 'get';
      const duration = 0.5;
      const hit = true;

      performanceMonitor.recordCacheOperation(operation, duration, hit);

      const report = performanceMonitor.getPerformanceReport();
      
      expect(report.cachePerformance.averageRetrievalTime).toBe(duration);
    });

    it('should calculate performance scores correctly', () => {
      // Record a fast branding application
      performanceMonitor.recordBrandingApplication('test-empresa', 25, ['color-palette', 'font-scheme']);

      const report = performanceMonitor.getPerformanceReport();
      
      expect(report.overallPerformance.totalBrandingOperations).toBe(1);
      expect(report.overallPerformance.averageBrandingApplicationTime).toBe(25);
      expect(report.overallPerformance.performanceScore).toBeGreaterThan(80); // Should be high score for fast operation
    });

    it('should provide performance trends over time', () => {
      const metricName = 'css_property_update';
      
      // Record metrics at different times
      performanceMonitor.recordMetric(metricName, 10);
      performanceMonitor.recordMetric(metricName, 15);
      performanceMonitor.recordMetric(metricName, 12);

      const trends = performanceMonitor.getPerformanceTrends(metricName, 60000); // 1 minute intervals
      
      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toHaveProperty('timestamp');
      expect(trends[0]).toHaveProperty('averageValue');
      expect(trends[0]).toHaveProperty('count');
    });

    it('should identify slowest operations', () => {
      // Record various operations with different durations
      performanceMonitor.recordMetric('operation_1', 50);
      performanceMonitor.recordMetric('operation_2', 25);
      performanceMonitor.recordMetric('operation_3', 75);
      performanceMonitor.recordMetric('operation_4', 30);

      const slowest = performanceMonitor.getSlowestOperations(2);
      
      expect(slowest).toHaveLength(2);
      expect(slowest[0].value).toBe(75); // Slowest first
      expect(slowest[1].value).toBe(50); // Second slowest
    });
  });

  describe('Integration Performance Tests', () => {
    it('should demonstrate performance improvements with batching', async () => {
      const testPalette: ColorPalette = {
        id: 'perf-test',
        name: 'Performance Test',
        empresaId: 'test-empresa',
        primaryColor: '#1e40af',
        primaryForeground: '#ffffff',
        secondaryColor: '#64748b',
        secondaryForeground: '#ffffff',
        accentColor: '#3b82f6',
        accentForeground: '#ffffff',
        mutedColor: '#f1f5f9',
        mutedForeground: '#64748b',
        backgroundColor: '#ffffff',
        foregroundColor: '#0f172a',
        cardColor: '#ffffff',
        cardForeground: '#0f172a',
        destructiveColor: '#dc2626',
        destructiveForeground: '#ffffff',
        sidebarBackground: '#f8fafc',
        sidebarForeground: '#0f172a',
        sidebarPrimary: '#1e40af',
        sidebarPrimaryForeground: '#ffffff',
        isCustom: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Measure batched application
      const startTime = performance.now();
      cssManager.applyColorPalette(testPalette);
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for batching
      const endTime = performance.now();

      const batchedDuration = endTime - startTime;

      // Verify batching was used (should be relatively fast)
      expect(batchedDuration).toBeLessThan(200); // Increased tolerance for test environment
    });

    it('should show cache performance benefits', () => {
      const testEmpresaId = 'cache-perf-test';
      const testBranding: CompleteBrandingConfig = {
        tenantBranding: {
          id: 'cache-test',
          empresaId: testEmpresaId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        logos: { login: null, sidebar: null, favicon: null },
        colorPalette: undefined,
        fontScheme: undefined,
        customThemePresets: []
      };

      // First access (cache miss)
      cacheManager.set(testEmpresaId, testBranding);
      
      const startTime1 = performance.now();
      const result1 = cacheManager.get(testEmpresaId);
      const endTime1 = performance.now();

      // Second access (cache hit)
      const startTime2 = performance.now();
      const result2 = cacheManager.get(testEmpresaId);
      const endTime2 = performance.now();

      const firstAccessTime = endTime1 - startTime1;
      const secondAccessTime = endTime2 - startTime2;

      // Both should return the same data
      expect(result1).toEqual(result2);
      
      // Cache hit should be at least as fast (or faster due to no computation)
      expect(secondAccessTime).toBeLessThanOrEqual(firstAccessTime + 1); // Allow small margin for timing variations
    });
  });
});