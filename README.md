<h1 align="center">Aluminify</h1>

<p align="center">
  <strong>A infraestrutura invisível da educação.</strong>
</p>

<p align="center">
  A primeira área do aluno <b>Open Source</b> e White Label projetada para escala.<br/>
  Do vídeo ao financeiro, sem amarras.
</p>

<p align="center">
  <a href="#sobre">Sobre</a> •
  <a href="#módulos">Módulos</a> •
  <a href="#stack">Stack</a> •
  <a href="#início-rápido">Início Rápido</a> •
  <a href="#arquitetura">Arquitetura</a> •
  <a href="#documentação">Documentação</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4.x-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3FCF8E?style=flat-square&logo=supabase" alt="Supabase" />
</p>

---

## Sobre

> _"Alumnus"_ vem do latim _"Alere"_ — nutrir, alimentar, fazer crescer.
> O aluno é aquele que é nutrido para crescer. Nosso papel é garantir que nada atrapalhe esse processo.

**Aluminify** é uma plataforma educacional completa que funciona como o **sistema operacional do seu curso online**. Ideal para cursinhos, preparatórios, pré-vestibulares e cursos livres. Diferente de marketplaces ou redes sociais de cursos, o Aluminify é **infraestrutura pura** — projetado para ser invisível, performático e completamente sob seu controle.

### Por que Aluminify?

| Problema                            | Nossa Solução                                                   |
| ----------------------------------- | --------------------------------------------------------------- |
| Plataformas que escondem seus dados | **Soberania total**: hospede onde quiser, banco Postgres aberto |
| Taxas sobre seu crescimento         | **Open Source**: sem pedágios, sem amarras contratuais          |
| Integrações remendadas              | **Módulos nativos**: tudo fala a mesma língua desde o início    |
| Performance inconsistente           | **Edge-first**: renderizado globalmente com < 100ms TTFB        |

---

## Módulos

O Aluminify é modular por design. Ative apenas o que você precisa.

### Núcleo Acadêmico

| Módulo              | Descrição                                                                |
| ------------------- | ------------------------------------------------------------------------ |
| **Sala de Estudos** | Player de vídeo imersivo com anotações, materiais de apoio e modo teatro |
| **Flashcards**      | Sistema de Repetição Espaçada (SRS) com algoritmo SM-2 e criação via IA  |
| **Cronograma**      | Plano de estudos inteligente e personalizado                             |
| **Biblioteca**      | Repositório centralizado de materiais complementares                     |
| **Foco**            | Ferramenta Pomodoro integrada para gestão de tempo                       |

### Gestão & Backoffice

| Módulo           | Descrição                                                   |
| ---------------- | ----------------------------------------------------------- |
| **Curso**        | Estrutura flexível: segmentos, disciplinas, módulos e aulas |
| **Usuários**     | Gestão de alunos, professores e equipe com RBAC granular    |
| **Agendamentos** | Atendimentos individuais/grupo com sync de calendário       |
| **Financeiro**   | Vendas, transações, cupons e integrações de pagamento       |
| **Empresa**      | Configurações do tenant, personalização e integrações       |

### Plataforma

| Módulo           | Descrição                                                      |
| ---------------- | -------------------------------------------------------------- |
| **Multi-tenant** | Arquitetura isolada por cliente com subdomínios personalizados |
| **Superadmin**   | Painel de gestão multi-empresa para operadores da plataforma   |

---

## Stack

```
Frontend          Backend           Infra
─────────         ────────          ─────
Next.js 16        Supabase          Vercel / AWS / VPS
React 19          PostgreSQL        Edge Functions
TypeScript 5      Auth + RLS        S3 Compatible
Tailwind CSS 4    Realtime          Redis (Upstash)
shadcn/ui         Storage           Docker Ready
TanStack Query
Motion
```

### Diferenciais Técnicos

- **100% Type Safe** — TypeScript end-to-end com tipos gerados do banco
- **99+ Lighthouse Score** — Performance, acessibilidade e SEO otimizados
- **Offline-First Ready** — PWA installable com estratégias de cache
- **AI-Powered** — Integração com OpenAI e Google AI para recursos inteligentes

---

## Início Rápido

### Pré-requisitos

- Node.js 20+ (< 25)
- Conta no [Supabase](https://supabase.com)
- (Opcional) Conta no [Upstash](https://upstash.com) para Redis

### Instalação

```bash
# Clone o repositório
git clone https://github.com/SinesysTech/aluminify.git
cd aluminify

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais

# Execute em desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

### Scripts Disponíveis

| Comando              | Descrição                                        |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Inicia o servidor de desenvolvimento (Turbopack) |
| `npm run build`      | Gera o build de produção                         |
| `npm run start`      | Inicia o servidor de produção                    |
| `npm run check`      | Executa lint, typecheck e testes                 |
| `npm run mastra:dev` | Inicia o Mastra Studio (IA)                      |

---

## Arquitetura

O projeto segue o padrão de **Módulos Funcionais** dentro de Route Groups do Next.js.

```
app/
├── (landing-page)/         # Site público e institucional
├── [tenant]/               # Contexto Multi-tenant
│   ├── (modules)/          # Módulos Funcionais (Layout Protegido)
│   │   ├── dashboard/      # Home e Analytics
│   │   ├── sala-de-estudos/# Player e execução de atividades
│   │   ├── curso/          # Core acadêmico
│   │   ├── flashcards/     # Revisão espaçada
│   │   ├── cronograma/     # Plano de estudos
│   │   ├── agendamentos/   # Atendimentos e reuniões
│   │   ├── biblioteca/     # Materiais de apoio
│   │   ├── financeiro/     # Vendas e Transações
│   │   ├── usuario/        # Gestão de Pessoas
│   │   └── empresa/        # Configurações do Tenant
│   └── auth/               # Autenticação do Tenant
├── auth/                   # Autenticação Global
└── superadmin/             # Gestão Multi-tenant
```

### Organização Interna de Módulos

Cada módulo segue uma estrutura consistente:

```
modulo/
├── (aluno)/        # Rotas visíveis para o aluno
├── (gestao)/       # Rotas administrativas
├── components/     # Componentes isolados do módulo
├── services/       # Lógica de negócio e acesso a dados
├── types/          # Definições de tipos
└── README.md       # Documentação do módulo
```

---

## Documentação

| Documento                                            | Descrição                             |
| ---------------------------------------------------- | ------------------------------------- |
| [Configuração](docs/guides/configuration.md)         | Variáveis de ambiente e setup inicial |
| [Autenticação](docs/architecture/authentication.md)  | Fluxo de auth e RLS                   |
| [Database](docs/architecture/database.md)            | Schema e convenções                   |
| [Deploy Vercel](docs/infra/deployment-vercel.md)     | Deploy na Vercel                      |
| [Deploy Manual](docs/infra/deployment-manual.md)     | Deploy em VPS/Docker                  |
| [Deploy Cloudron](docs/infra/deployment-cloudron.md) | Deploy com addon sendmail             |
| [Docker](docs/infra/docker.md)                       | Containerização                       |

---

## Contribuindo

Contribuições são bem-vindas! Por favor, leia nosso guia de contribuição antes de submeter PRs.

1. Fork o projeto
2. Crie sua branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'feat: add amazing feature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

<p align="center">
  <sub>Feito com dedicação pela equipe Aluminify</sub><br/>
  <sub>A tecnologia deve ser invisível para que o ensino seja inesquecível.</sub>
</p>
