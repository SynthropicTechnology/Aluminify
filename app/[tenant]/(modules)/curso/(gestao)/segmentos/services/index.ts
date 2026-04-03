import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseClient } from '@/app/shared/core/database/database';
import { SegmentRepositoryImpl } from './segment.repository';
import { SegmentService } from './segment.service';

/**
 * Factory function para criar SegmentService com cliente Supabase específico.
 * Use esta função quando precisar que as RLS policies sejam aplicadas.
 */
export function createSegmentService(client: SupabaseClient): SegmentService {
  const repository = new SegmentRepositoryImpl(client);
  return new SegmentService(repository);
}

let _segmentService: SegmentService | null = null;

function getSegmentService(): SegmentService {
  if (!_segmentService) {
    const databaseClient = getDatabaseClient();
    const repository = new SegmentRepositoryImpl(databaseClient);
    _segmentService = new SegmentService(repository);
  }
  return _segmentService;
}

export const segmentService = new Proxy({} as SegmentService, {
  get(_target, prop) {
    return getSegmentService()[prop as keyof SegmentService];
  },
});

export * from './segment.types';
export * from './segment.service';
export * from './segment.repository';
export * from './errors';

