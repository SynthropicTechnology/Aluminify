export type EmpresaPlano = 'basico' | 'profissional' | 'enterprise';

export interface Empresa {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  emailContato: string | null;
  telefone: string | null;
  logoUrl: string | null;
  plano: EmpresaPlano;
  ativo: boolean;
  configuracoes: Record<string, unknown>;
  codigoPrefixo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmpresaInput {
  nome: string;
  cnpj?: string;
  emailContato?: string;
  telefone?: string;
  logoUrl?: string;
  plano?: EmpresaPlano;
  configuracoes?: Record<string, unknown>;
}

export interface UpdateEmpresaInput {
  nome?: string;
  cnpj?: string;
  emailContato?: string;
  telefone?: string;
  logoUrl?: string;
  plano?: EmpresaPlano;
  ativo?: boolean;
  configuracoes?: Record<string, unknown>;
  codigoPrefixo?: string;
}

