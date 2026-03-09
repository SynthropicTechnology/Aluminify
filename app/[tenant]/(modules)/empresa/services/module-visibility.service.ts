import { SupabaseClient } from '@supabase/supabase-js';
import { ModuleVisibilityRepositoryImpl } from './module-visibility.repository';
import { CursoModulosService } from '@/app/[tenant]/(modules)/curso/services/curso-modulos.service';
import { getPlanLimits } from '@/app/shared/core/services/plan-limits.service';
import type {
  ModuleWithVisibility,
  VisibleModule,
  UpdateModuleVisibilityInput,
  UpdateSubmoduleVisibilityInput,
  BulkUpdateModuleVisibilityInput,
  ModuleDefinition,
} from './module-visibility.types';

export class ModuleVisibilityService {
  private readonly repository: ModuleVisibilityRepositoryImpl;
  private readonly cursoModulosService: CursoModulosService;

  constructor(private readonly client: SupabaseClient) {
    this.repository = new ModuleVisibilityRepositoryImpl(client);
    this.cursoModulosService = new CursoModulosService(client);
  }

  /**
   * Filter modules based on subscription plan's allowed_modules.
   * Empty allowed_modules = all modules allowed (enterprise/unlimited).
   */
  private async filterByPlanAccess(modules: VisibleModule[], empresaId: string): Promise<VisibleModule[]> {
    const limits = await getPlanLimits(empresaId);
    if (limits.allowed_modules.length === 0) {
      return modules; // All modules allowed
    }
    return modules.filter(m => m.isCore || limits.allowed_modules.includes(m.id));
  }

  /**
   * Get visible modules for a tenant (used by sidebar)
   * Returns all modules with their visibility applied
   * Default: all modules visible if no configuration exists
   */
  async getVisibleModules(empresaId: string): Promise<VisibleModule[]> {
    const modules = await this.repository.getVisibleModulesForEmpresa(empresaId);
    return this.filterByPlanAccess(modules, empresaId);
  }

  /**
   * Get visible modules for a student, filtered by their enrolled courses
   * Logic:
   * 1. Get tenant-visible modules (existing behavior)
   * 2. Get modules granted by student's enrolled courses (via curso_modulos)
   * 3. Return INTERSECTION: tenant-visible AND course-granted
   * 4. Core modules (Dashboard) are always visible
   * 5. Backward compat: if no curso_modulos bindings exist for the tenant, return all
   */
  async getVisibleModulesForStudent(empresaId: string, userId: string): Promise<VisibleModule[]> {
    // Get tenant-level visible modules (the "ceiling")
    const tenantModules = await this.repository.getVisibleModulesForEmpresa(empresaId);

    // Check if any course-module bindings exist for this tenant
    const hasBindings = await this.cursoModulosService.hasAnyCourseModuleBindings(empresaId);
    if (!hasBindings) {
      // No bindings configured yet - backward compat: show all tenant modules
      return tenantModules;
    }

    // Get modules from student's enrolled courses
    const studentModuleIds = await this.cursoModulosService.getModulesForStudentCourses(userId, empresaId);

    // Filter: keep only modules that are both tenant-visible AND course-granted (or core)
    const courseFiltered = tenantModules.filter(
      module => module.isCore || studentModuleIds.includes(module.id)
    );

    // Also filter by plan access
    return this.filterByPlanAccess(courseFiltered, empresaId);
  }

  /**
   * Get full module visibility config for admin UI
   * Includes all modules with their definitions and tenant-specific settings
   */
  async getModuleVisibilityConfig(empresaId: string): Promise<ModuleWithVisibility[]> {
    return this.repository.getModuleVisibilityConfig(empresaId);
  }

  /**
   * Get all module definitions (for reference)
   */
  async getModuleDefinitions(): Promise<ModuleDefinition[]> {
    return this.repository.findAllModuleDefinitions();
  }

  /**
   * Update visibility for a single module
   * Validates that core modules cannot be hidden
   */
  async updateModuleVisibility(
    empresaId: string,
    input: UpdateModuleVisibilityInput,
    userId: string
  ): Promise<void> {
    // Validate that core modules cannot be hidden
    if (input.isVisible === false) {
      const definitions = await this.repository.findAllModuleDefinitions();
      const moduleDef = definitions.find(m => m.id === input.moduleId);

      if (moduleDef?.isCore) {
        throw new Error(`O módulo "${moduleDef.name}" é essencial e não pode ser desabilitado`);
      }
    }

    await this.repository.upsertModuleVisibility(
      empresaId,
      input.moduleId,
      {
        isVisible: input.isVisible,
        customName: input.customName,
        customUrl: input.customUrl,
        displayOrder: input.displayOrder,
        options: input.options,
      },
      userId
    );
  }

  /**
   * Update visibility for a single submodule
   */
  async updateSubmoduleVisibility(
    empresaId: string,
    input: UpdateSubmoduleVisibilityInput,
    userId: string
  ): Promise<void> {
    await this.repository.upsertSubmoduleVisibility(
      empresaId,
      input.moduleId,
      input.submoduleId,
      {
        isVisible: input.isVisible,
        customName: input.customName,
        customUrl: input.customUrl,
        displayOrder: input.displayOrder,
      },
      userId
    );
  }

  /**
   * Bulk update module and submodule visibility
   * Used when saving the entire configuration from admin UI
   */
  async bulkUpdateVisibility(
    empresaId: string,
    input: BulkUpdateModuleVisibilityInput,
    userId: string
  ): Promise<void> {
    // Validate core modules
    const definitions = await this.repository.findAllModuleDefinitions();
    const coreModules = definitions.filter(m => m.isCore);

    for (const moduleInput of input.modules) {
      const isCore = coreModules.some(m => m.id === moduleInput.moduleId);
      if (isCore && moduleInput.isVisible === false) {
        const moduleName = coreModules.find(m => m.id === moduleInput.moduleId)?.name;
        throw new Error(`O módulo "${moduleName}" é essencial e não pode ser desabilitado`);
      }
    }

    // Update modules
    if (input.modules.length > 0) {
      await this.repository.bulkUpsertModuleVisibility(
        empresaId,
        input.modules.map(m => ({
          moduleId: m.moduleId,
          data: {
            isVisible: m.isVisible,
            customName: m.customName,
            customUrl: m.customUrl,
            displayOrder: m.displayOrder,
            options: m.options,
          }
        })),
        userId
      );
    }

    // Update submodules
    if (input.submodules.length > 0) {
      await this.repository.bulkUpsertSubmoduleVisibility(
        empresaId,
        input.submodules.map(s => ({
          moduleId: s.moduleId,
          submoduleId: s.submoduleId,
          data: {
            isVisible: s.isVisible,
            customName: s.customName,
            customUrl: s.customUrl,
            displayOrder: s.displayOrder,
          }
        })),
        userId
      );
    }
  }

  /**
   * Reset visibility to defaults (delete all customizations)
   * After reset, all modules will be visible with default names and order
   */
  async resetToDefaults(empresaId: string): Promise<void> {
    await this.repository.deleteAllVisibilityForEmpresa(empresaId);
  }

  /**
   * Check if user is admin of the empresa
   */
  async isEmpresaAdmin(userId: string, empresaId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('is_empresa_admin', {
      user_id_param: userId,
      empresa_id_param: empresaId,
    });

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return data === true;
  }
}
