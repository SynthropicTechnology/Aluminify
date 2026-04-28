/**
 * Course Structure Cache Service
 * 
 * Cache para estrutura hierárquica: Cursos → Disciplinas → Frentes → Módulos → Aulas
 * TTL: 1 hora (invalidação manual quando estrutura muda)
 */

import { cacheService } from './cache.service';
import { getDatabaseClient } from '@/app/shared/core/database/database';

export interface CourseStructure {
  cursoId: string;
  cursoNome: string;
  disciplinas: DisciplineStructure[];
}

export interface DisciplineStructure {
  disciplinaId: string;
  disciplinaNome: string;
  frentes: FrenteStructure[];
}

export interface FrenteStructure {
  frenteId: string;
  frenteNome: string;
  modulos: ModuloStructure[];
}

export interface ModuloStructure {
  moduloId: string;
  moduloNome: string;
  numeroModulo: number | null;
  aulas: AulaStructure[];
}

export interface AulaStructure {
  aulaId: string;
  aulaNome: string;
  numeroAula: number | null;
  tempoEstimadoMinutos: number | null;
  prioridade: number | null;
}

class CourseStructureCacheService {
  /**
   * Obter estrutura completa de um curso
   */
  async getCourseStructure(courseId: string): Promise<CourseStructure | null> {
    const cacheKey = `cache:curso:${courseId}:estrutura`;
    
    return cacheService.getOrSet(
      cacheKey,
      () => this.fetchCourseStructureFromDB(courseId),
      3600 // TTL: 1 hora
    );
  }

  /**
   * Obter frentes de uma disciplina
   */
  async getDisciplineFrentes(disciplinaId: string): Promise<FrenteStructure[]> {
    const cacheKey = `cache:disciplina:${disciplinaId}:frentes`;
    
    return cacheService.getOrSet(
      cacheKey,
      () => this.fetchFrentesFromDB(disciplinaId),
      3600 // TTL: 1 hora
    );
  }

  /**
   * Obter módulos de uma frente
   */
  async getFrenteModulos(frenteId: string): Promise<ModuloStructure[]> {
    const cacheKey = `cache:frente:${frenteId}:modulos`;
    
    return cacheService.getOrSet(
      cacheKey,
      () => this.fetchModulosFromDB(frenteId),
      3600 // TTL: 1 hora
    );
  }

  /**
   * Obter aulas de um módulo
   */
  async getModuloAulas(moduloId: string): Promise<AulaStructure[]> {
    const cacheKey = `cache:modulo:${moduloId}:aulas`;
    
    return cacheService.getOrSet(
      cacheKey,
      () => this.fetchAulasFromDB(moduloId),
      3600 // TTL: 1 hora
    );
  }

  /**
   * Invalidar cache de um curso completo
   */
  async invalidateCourse(courseId: string): Promise<void> {
    await cacheService.del(`cache:curso:${courseId}:estrutura`);
    
    // Buscar disciplinas do curso para invalidar também
    const client = getDatabaseClient();
    const { data: cursosDisciplinas } = await client
      .from('cursos_disciplinas')
      .select('disciplina_id')
      .eq('curso_id', courseId);

    if (cursosDisciplinas) {
      const disciplinaIds = cursosDisciplinas.map(cd => cd.disciplina_id);
      await this.invalidateDisciplines(disciplinaIds);
    }
  }

  /**
   * Invalidar cache de disciplinas
   */
  async invalidateDisciplines(disciplinaIds: string[]): Promise<void> {
    const keys = disciplinaIds.map(id => `cache:disciplina:${id}:frentes`);
    await cacheService.delMany(keys);
    
    // Buscar frentes para invalidar também
    const client = getDatabaseClient();
    const { data: frentes } = await client
      .from('frentes')
      .select('id')
      .in('disciplina_id', disciplinaIds);

    if (frentes) {
      const frenteIds = frentes.map(f => f.id);
      await this.invalidateFrentes(frenteIds);
    }
  }

  /**
   * Invalidar cache de frentes
   */
  async invalidateFrentes(frenteIds: string[]): Promise<void> {
    const keys = frenteIds.map(id => `cache:frente:${id}:modulos`);
    await cacheService.delMany(keys);
    
    // Buscar módulos para invalidar também
    const client = getDatabaseClient();
    const { data: modulos } = await client
      .from('modulos')
      .select('id')
      .in('frente_id', frenteIds);

    if (modulos) {
      const moduloIds = modulos.map(m => m.id);
      await this.invalidateModulos(moduloIds);
    }
  }

  /**
   * Invalidar cache de módulos
   */
  async invalidateModulos(moduloIds: string[]): Promise<void> {
    const keys = moduloIds.map(id => `cache:modulo:${id}:aulas`);
    await cacheService.delMany(keys);
  }

  /**
   * Invalidar cache de uma aula (invalida o módulo)
   */
  async invalidateAula(aulaId: string): Promise<void> {
    const client = getDatabaseClient();
    const { data: aula } = await client
      .from('aulas')
      .select('modulo_id')
      .eq('id', aulaId)
      .maybeSingle();

    if (aula?.modulo_id) {
      await cacheService.del(`cache:modulo:${aula.modulo_id}:aulas`);
    }
  }

  // Métodos privados para buscar do banco

  private async fetchCourseStructureFromDB(courseId: string): Promise<CourseStructure | null> {
    const client = getDatabaseClient();
    
    // Buscar curso
    const { data: curso } = await client
      .from('cursos')
      .select('id, nome')
      .eq('id', courseId)
      .maybeSingle();

    if (!curso) return null;

    // Buscar disciplinas do curso
    const { data: cursosDisciplinas } = await client
      .from('cursos_disciplinas')
      .select('disciplina_id, disciplinas(id, nome)')
      .eq('curso_id', courseId);

    if (!cursosDisciplinas) return null;

    const disciplinaIds: string[] = [];
    const disciplinaInfo: Record<string, string> = {};

    for (const cd of cursosDisciplinas) {
      const disciplinaData = Array.isArray(cd.disciplinas) 
        ? cd.disciplinas[0] 
        : cd.disciplinas;
      
      const disciplina = disciplinaData as { id: string; nome: string } | null | undefined;
      if (!disciplina || !disciplina.id || !disciplina.nome) continue;

      disciplinaIds.push(disciplina.id);
      disciplinaInfo[disciplina.id] = disciplina.nome;
    }

    if (disciplinaIds.length === 0) {
      return {
        cursoId: curso.id,
        cursoNome: curso.nome,
        disciplinas: [],
      };
    }

    // Busca todas as frentes de todas as disciplinas de uma vez (Otimização N+1)
    const allFrentes = await this.fetchFrentesBatch(disciplinaIds) as (FrenteStructure & { disciplina_id: string })[];

    const frentesByDisciplinaId: Record<string, FrenteStructure[]> = {};
    for (const frente of allFrentes) {
      if (!frentesByDisciplinaId[frente.disciplina_id]) {
        frentesByDisciplinaId[frente.disciplina_id] = [];
      }
      const { disciplina_id, ...frenteStructure } = frente;
      frentesByDisciplinaId[frente.disciplina_id].push(frenteStructure);
    }

    const disciplinas: DisciplineStructure[] = disciplinaIds.map(id => ({
      disciplinaId: id,
      disciplinaNome: disciplinaInfo[id],
      frentes: frentesByDisciplinaId[id] || [],
    }));

    return {
      cursoId: curso.id,
      cursoNome: curso.nome,
      disciplinas,
    };
  }

  private async fetchFrentesFromDB(disciplinaId: string): Promise<FrenteStructure[]> {
    return this.fetchFrentesBatch([disciplinaId]);
  }

  private async fetchFrentesBatch(disciplinaIds: string[]): Promise<FrenteStructure[]> {
    const client = getDatabaseClient();
    
    const { data: frentes } = await client
      .from('frentes')
      .select('id, nome, disciplina_id')
      .in('disciplina_id', disciplinaIds)
      .order('nome', { ascending: true });

    if (!frentes || frentes.length === 0) return [];

    const frenteIds = frentes.map(f => f.id);

    // Busca todos os módulos de todas as frentes de uma vez (Otimização N+1)
    const allModulos = await this.fetchModulosBatch(frenteIds) as (ModuloStructure & { frente_id: string })[];

    const modulosByFrenteId: Record<string, ModuloStructure[]> = {};
    for (const modulo of allModulos) {
      if (!modulosByFrenteId[modulo.frente_id]) {
        modulosByFrenteId[modulo.frente_id] = [];
      }
      // Remove o campo temporário frente_id antes de adicionar ao resultado
      const { frente_id, ...moduloStructure } = modulo;
      modulosByFrenteId[modulo.frente_id].push(moduloStructure);
    }

    return frentes.map(frente => ({
      frenteId: frente.id,
      frenteNome: frente.nome,
      disciplina_id: frente.disciplina_id, // Temp field for mapping
      modulos: modulosByFrenteId[frente.id] || [],
    })) as (FrenteStructure & { disciplina_id: string })[];
  }

  private async fetchModulosFromDB(frenteId: string): Promise<ModuloStructure[]> {
    return this.fetchModulosBatch([frenteId]);
  }

  private async fetchModulosBatch(frenteIds: string[]): Promise<ModuloStructure[]> {
    const client = getDatabaseClient();
    
    const { data: modulos } = await client
      .from('modulos')
      .select('id, nome, numero_modulo, frente_id')
      .in('frente_id', frenteIds)
      .order('numero_modulo', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true });

    if (!modulos || modulos.length === 0) return [];

    const moduloIds = modulos.map(m => m.id);

    // Buscar todas as aulas dos módulos de uma vez (Otimização N+1)
    const allAulas = await this.fetchAulasBatch(moduloIds) as (AulaStructure & { modulo_id: string })[];

    const aulasByModuloId: Record<string, AulaStructure[]> = {};
    for (const aula of allAulas) {
      if (!aulasByModuloId[aula.modulo_id]) {
        aulasByModuloId[aula.modulo_id] = [];
      }
      const { modulo_id, ...aulaStructure } = aula;
      aulasByModuloId[modulo.modulo_id].push(aulaStructure);
    }

    return modulos.map(modulo => ({
      moduloId: modulo.id,
      moduloNome: modulo.nome,
      numeroModulo: modulo.numero_modulo,
      frente_id: modulo.frente_id, // Temp field for mapping
      aulas: aulasByModuloId[modulo.id] || [],
    })) as (ModuloStructure & { frente_id: string })[];
  }

  private async fetchAulasFromDB(moduloId: string): Promise<AulaStructure[]> {
    return this.fetchAulasBatch([moduloId]);
  }

  private async fetchAulasBatch(moduloIds: string[]): Promise<AulaStructure[]> {
    const client = getDatabaseClient();
    
    const { data: aulas } = await client
      .from('aulas')
      .select('id, nome, numero_aula, tempo_estimado_minutos, prioridade, modulo_id')
      .in('modulo_id', moduloIds)
      .order('numero_aula', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true });

    if (!aulas) return [];

    return aulas.map(aula => ({
      aulaId: aula.id,
      aulaNome: aula.nome,
      numeroAula: aula.numero_aula,
      tempoEstimadoMinutos: aula.tempo_estimado_minutos,
      prioridade: aula.prioridade,
      modulo_id: aula.modulo_id, // Temp field for mapping
    })) as (AulaStructure & { modulo_id: string })[];
  }
}

export const courseStructureCacheService = new CourseStructureCacheService();

















