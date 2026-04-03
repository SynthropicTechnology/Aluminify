import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseClient } from '@/app/shared/core/database/database';
import { DisciplineRepositoryImpl } from './discipline.repository';
import { DisciplineService } from './discipline.service';

/**
 * Factory function para criar DisciplineService com cliente Supabase específico.
 * Use esta função quando precisar que as RLS policies sejam aplicadas.
 */
export function createDisciplineService(client: SupabaseClient): DisciplineService {
  const repository = new DisciplineRepositoryImpl(client);
  return new DisciplineService(repository);
}

let _disciplineService: DisciplineService | null = null;

function getDisciplineService(): DisciplineService {
  if (!_disciplineService) {
    const databaseClient = getDatabaseClient();
    const repository = new DisciplineRepositoryImpl(databaseClient);
    _disciplineService = new DisciplineService(repository);
  }
  return _disciplineService;
}

export const disciplineService = new Proxy({} as DisciplineService, {
  get(_target, prop) {
    return getDisciplineService()[prop as keyof DisciplineService];
  },
});

export * from './discipline.types';
export * from './discipline.service';
export * from './discipline.repository';
export * from './errors';


