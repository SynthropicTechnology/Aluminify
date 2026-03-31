# Aluminify — Brand Book & Documentação Conceitual

> Documento de referência completo para equipes de design, desenvolvimento, atendimento e marketing.
> Versão: 1.0 | Março 2026

---

## Sumário

1. [Quem Somos](#1-quem-somos)
2. [Brand Book](#2-brand-book)
3. [Design System](#3-design-system)
4. [Catálogo de Features](#4-catálogo-de-features)
5. [Arquitetura & System Design](#5-arquitetura--system-design)
6. [Padrões de UX](#6-padrões-de-ux)
7. [Guia de Comunicação](#7-guia-de-comunicação)
8. [Referências Técnicas](#8-referências-técnicas)

---

## 1. Quem Somos

### Definição

O **Aluminify** é uma plataforma open-source, white-label e multi-tenant para cursos online. Oferece uma suíte completa — área do aluno, vídeo-aulas, pagamentos, relatórios, flashcards, agendamentos e mais — sob a marca do educador, sem comissões.

### Missão

> A tecnologia deve ser invisível para que o ensino seja inesquecível.

Ser a **infraestrutura invisível** da educação online: rápida, segura, customizável e sempre disponível, para que educadores foquem exclusivamente no que fazem de melhor — ensinar.

### Visão

Construir a camada de infraestrutura para a **próxima geração de educação online**. Open source e transparente.

### Valores Fundamentais

| Valor | Significado |
|---|---|
| **Soberania do Educador** | Seus alunos são seus. Sua marca é sua. Sua tecnologia deve ser sua também. |
| **Transparência** | Código aberto (Apache 2.0). Preço justo e sem surpresas. |
| **Infraestrutura Invisível** | A plataforma deve ser tão boa que se torne imperceptível — o foco total está na aula. |
| **Nutrição Intelectual** | Aluno não é "sem luz" — é aquele que é nutrido para crescer. |
| **Autonomia** | Nenhuma dependência de plataformas que cobram pedágio sobre o crescimento do negócio. |

### Organização

- **Empresa**: Aluminify Inc. (2026)
- **Mantido por**: Sinesys Intelligence (sinesys.com.br)
- **Licença**: Apache 2.0
- **Repositório**: github.com/SinesysTech/aluminify
- **Comunidade**: Discord (discord.gg/aluminify)

---

## 2. Brand Book

### 2.1 Narrativa da Marca

#### A Etimologia — O Coração da Marca

O nome **Aluminify** nasce da palavra latina **Alumnus**, particípio passivo do verbo **Alere** — que significa *nutrir, alimentar, sustentar, fazer crescer*.

A marca rejeita explicitamente o mito urbano pedagógico de que "aluno" vem de *A-lumen* (sem luz), de que o estudante é "um vaso vazio e escuro esperando ser preenchido". A verdade etimológica é mais poderosa:

> **Aluno é aquele que é nutrido para crescer.**

O educador **nutre** o intelecto. O Aluminify garante que **nada** atrapalhe esse processo.

#### O Manifesto — "A Soberania de Nutrir Mentes"

O manifesto do Aluminify é estruturado como uma **Carta Aberta aos Educadores**, organizada em três atos:

1. **"Ensinar é um ato de autonomia"** — Crítica às plataformas que transformam professores em "criadores de conteúdo" alugando terreno digital alheio, com dados ocultos, algoritmos instáveis e pedágios sobre crescimento.

2. **"O mito do ser sem luz"** — Desconstrução da falsa etimologia. Apresentação da origem real do Alumnus. Posicionamento: o papel do educador é nutrir; o papel do Aluminify é garantir que nada atrapalhe.

3. **"Nós somos o solo fértil"** — Definição do que a marca é e não é. "Não somos uma rede social de cursos. Não somos um marketplace. Somos **infraestrutura**." A analogia: assim como uma sala de aula física precisa que ar-condicionado não faça barulho e cadeiras não quebrem, o digital precisa de latência zero, dados seguros, interface limpa.

**Chamada final**: *"Retome a sua soberania."*

#### Taglines Oficiais

| Contexto | Tagline |
|---|---|
| **Principal** | A infraestrutura invisível da educação. |
| **Hero (Landing)** | Seu curso online profissional e completo. |
| **Open Source** | Gratuito e seu. Para sempre. |
| **Footer** | Construindo a camada de infraestrutura para a próxima geração de educação online. |
| **Pricing** | Preço justo e transparente. |
| **Features** | Tudo em um só lugar. |

### 2.2 Voz & Tom

#### Voz da Marca

A voz do Aluminify é **direta, empática e empoderadeira**. Fala de igual para igual com o educador, sem jargão técnico desnecessário, sem formalismo excessivo.

| Atributo | Descrição | Exemplo |
|---|---|---|
| **Direta** | Sem rodeios. Vai direto ao ponto. | "Tudo pronto, com a sua marca, sem pagar comissão." |
| **Empática** | Entende a dor do educador. | "Para quem quer focar no curso, não na tecnologia." |
| **Empoderadeira** | Devolve o controle ao professor. | "Seus alunos são seus. Sua marca é sua." |
| **Acessível** | Linguagem que qualquer pessoa entende. | "Se você tem alguém que entende de tecnologia (um sobrinho, um técnico)..." |
| **Confiante** | Afirma sem arrogância. | "Nós discordamos radicalmente dessa visão." |

#### Tom por Contexto

| Contexto | Tom | Exemplo |
|---|---|---|
| **Marketing/Landing** | Inspirador, provocativo | "A Soberania de Nutrir Mentes." |
| **Interface do Produto** | Funcional, conciso | "Salvar", "Cancelar", "Nenhum resultado encontrado." |
| **Erros/Alertas** | Claro, sem culpar o usuário | "Não foi possível carregar os planos." |
| **Sucesso** | Celebrativo mas breve | "Agendamento confirmado!" |
| **Documentação** | Instrucionista, passo-a-passo | "Crie a conta e comece a usar na hora." |
| **Manifesto** | Literário, filosófico | "Quando você fecha a porta da sala de aula, aquele espaço é seu." |

#### Regras de Linguagem

- **Idioma**: Português brasileiro (pt-BR) em toda a interface e comunicação.
- **Tratamento**: "Você" (informal, segunda pessoa). Nunca "tu", nunca "senhor/senhora".
- **Gênero**: Linguagem neutra quando possível. Evitar "o aluno" — preferir "seus alunos", "cada estudante".
- **Termos técnicos**: Manter em inglês quando são universais no mercado: *dashboard*, *login*, *open source*, *status*. Traduzir quando há termo natural: "Preços" (não "Pricing"), "Funcionalidades" (não "Features" na interface).
- **Botões de ação**: Verbos no infinitivo — "Criar Conta", "Começar Agora", "Ver funcionalidades".
- **Mensagens de erro**: Sem códigos técnicos. Sem culpar o usuário. Oferecer caminho de resolução.

### 2.3 Identidade Visual — Logomark

#### Logo Principal

O logomark do Aluminify é a letra **"A"** em negrito dentro de um **quadrado arredondado** (border-radius: 0.5rem).

```
┌─────────┐
│         │
│    A    │  ← Fonte: display (Plus Jakarta Sans), bold
│         │
└─────────┘
   ↑ Fundo: cor primária do tema
   ↑ Texto: branco
```

**Especificações:**

| Propriedade | Valor |
|---|---|
| Forma | Quadrado com cantos arredondados (`rounded-lg`) |
| Fundo | `bg-primary` (variável — adapta ao tema do tenant) |
| Texto | Branco (`text-white` / `text-primary-foreground`) |
| Tipografia | `font-display font-bold` |
| Tamanhos | 24×24px (footer), 32×32px (nav/sidebar), escalável |

#### Wordmark

Ao lado do logomark, o nome "**Aluminify**" em `font-display font-bold text-lg tracking-tight`.

#### Aplicações da Logo

| Contexto | Tamanho | Composição |
|---|---|---|
| **Navbar** | 32×32px + wordmark | Logomark + "Aluminify" lado a lado |
| **Footer** | 24×24px + wordmark | Versão compacta |
| **Manifesto** | 24×24px + texto mono | Logomark + "ALUMINIFY TEAM" em mono uppercase |
| **Tenant** | 32×32px customizado | O tenant substitui pelo seu logo (white-label) |
| **Favicon** | 16×16px | Apenas o "A" |

#### Regras de Uso

- A logo NUNCA aparece rotacionada, distorcida ou com sombra.
- Em fundo escuro (dark mode), o quadrado usa `bg-primary` (que no dark inverte para branco), e o "A" fica escuro.
- O tenant pode substituir totalmente a logo pela sua própria marca — esse é o propósito white-label.

### 2.4 Paleta de Cores

#### Sistema de Cores Semânticas

O Aluminify usa um sistema de **design tokens CSS** baseado em variáveis semânticas. As cores nunca são usadas diretamente nos componentes — sempre via tokens.

##### Tokens Fundamentais (Light Mode)

| Token | Valor HSL | Uso |
|---|---|---|
| `--background` | `hsl(0 0% 100%)` | Fundo principal das páginas |
| `--foreground` | `hsl(240 10% 3.9%)` | Texto principal |
| `--card` | `hsl(0 0% 100%)` | Fundo de cards |
| `--card-foreground` | `hsl(240 10% 3.9%)` | Texto em cards |
| `--popover` | `hsl(0 0% 100%)` | Fundo de popovers e dropdowns |
| `--primary` | `hsl(240 5.9% 10%)` | Cor principal (quase preto) |
| `--primary-foreground` | `hsl(0 0% 98%)` | Texto sobre primária |
| `--secondary` | `hsl(240 4.8% 95.9%)` | Cor secundária (cinza claro) |
| `--muted` | `hsl(240 4.8% 95.9%)` | Fundos sutis |
| `--muted-foreground` | `hsl(240 3.8% 46.1%)` | Texto secundário |
| `--accent` | `hsl(240 4.8% 95.9%)` | Destaques de interação |
| `--destructive` | `hsl(0 84.2% 60.2%)` | Ações destrutivas (vermelho) |
| `--border` | `hsl(240 5.9% 90%)` | Bordas |
| `--input` | `hsl(240 5.9% 90%)` | Bordas de inputs |
| `--ring` | `hsl(240 5.9% 10%)` | Anel de foco |
| `--radius` | `0.75rem` | Arredondamento padrão |

##### Tokens de Status

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--status-warning` | `hsl(45 93% 47%)` | `hsl(45 93% 55%)` | Alertas, avisos |
| `--status-info` | `hsl(217 91% 60%)` | `hsl(217 91% 65%)` | Informações |
| `--status-success` | `hsl(142 71% 45%)` | `hsl(142 71% 50%)` | Sucesso, confirmação |
| `--destructive` | `hsl(0 84.2% 60.2%)` | `hsl(0 72% 51%)` | Erro, exclusão |

##### Tokens de Sidebar

| Token | Light | Dark |
|---|---|---|
| `--sidebar` | `hsl(240 5% 96%)` | `hsl(240 6% 10%)` |
| `--sidebar-foreground` | `hsl(240 5.3% 26.1%)` | `hsl(0 0% 98%)` |
| `--sidebar-primary` | `hsl(240 5.9% 10%)` | `hsl(0 0% 98%)` |
| `--sidebar-accent` | `hsl(240 5% 88%)` | `hsl(240 5% 20%)` |
| `--sidebar-border` | `hsl(240 5.9% 90%)` | `hsl(240 3.7% 15.9%)` |

##### Tokens de Gráficos

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `hsl(240 5.9% 10%)` | `hsl(0 0% 98%)` |
| `--chart-2` | `hsl(240 4.8% 25%)` | `hsl(240 4.9% 83.9%)` |
| `--chart-3` | `hsl(240 3.8% 46.1%)` | `hsl(240 5% 64.9%)` |
| `--chart-4` | `hsl(240 4.8% 65%)` | `hsl(240 3.7% 45%)` |
| `--chart-5` | `hsl(240 4.8% 85%)` | `hsl(240 3.7% 25%)` |

##### Tokens Decorativos

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--deco-line` | `240 5.9% 90%` | `240 3.7% 15.9%` | Linhas do grid de fundo |
| `--deco-alpha` | `0.08` | `0.15` | Opacidade do grid de fundo |

#### Filosofia de Cor

A paleta base do Aluminify é intencionalmente **neutra e monocromática** (tons de cinza com matiz azulada sutil em 240°). Isso garante que:

1. **White-label funciona**: Qualquer cor de tenant fica harmoniosa sobre a base neutra.
2. **Contraste é prioridade**: O sistema privilegia legibilidade sobre estética decorativa.
3. **Dark mode é nativo**: Cada token tem variante light e dark, garantindo adaptação completa.

#### Dark Mode

O dark mode inverte a lógica semântica:
- `--primary` light (`hsl(240 5.9% 10%)` → quase preto) se torna `hsl(0 0% 98%)` (quase branco) no dark.
- Backgrounds vão de branco para `hsl(240 10% 3.9%)`.
- As cores de status ficam ligeiramente mais saturadas no dark para compensar o fundo escuro.

**Ativação**: Via `next-themes` com classe `.dark` no `<html>`. Toggle no dashboard pelo usuário. Custom variant: `@custom-variant dark (&:where(.dark, .dark *))`.

### 2.5 Sistema de Temas (White-Label)

O Aluminify oferece **8 presets de tema** que os tenants podem escolher. Cada preset define uma paleta completa (escalas de 50 a 1000), tipografia e border-radius.

| Preset | Identidade Visual | Cor Primária | Tipografia | Radius |
|---|---|---|---|---|
| **default** | Monocromático neutro | Cinza puro (oklch 0.095-0.985) | Outfit | 0.5rem |
| **underground** | Verde menta + rosa | Verde `oklch(0.53 0.069 156)` | Kumbh Sans + Hedvig Letters Serif | 0.5rem |
| **rose-garden** | Rosa vibrante | Rosa `oklch(0.58 0.242 12)` | Poppins | 1rem |
| **lake-view** | Verde-água natural | Teal `oklch(0.51 0.118 166)` | PT Sans | 0.75rem |
| **sunset-glow** | Laranja quente | Terracota `oklch(0.56 0.188 25)` | (padrão) | 1rem |
| **forest-whisper** | Teal + lavanda | Teal escuro `oklch(0.53 0.107 182)` | (padrão) | 0.5rem |
| **ocean-breeze** | Azul profundo | Azul `oklch(0.49 0.213 264)` | (padrão) | (padrão) |
| **lavender-dream** | Lavanda suave | Lavanda `oklch(?)` | Hedvig Letters Serif | (padrão) |

**Cada tema define:**
- Escala `--base-50` a `--base-1000` (tons neutros)
- Escala `--primary-50` a `--primary-1000` (cor primária)
- Escala `--secondary-50` a `--secondary-1000` (quando tem cor secundária)
- Mapeamento completo de tokens semânticos (light + dark)
- Tipografia (`--text-family`, `--display-family`, `--display-weight`)
- Border radius (`--radius`)

**Personalização dinâmica**: Além dos presets, tenants podem sobrescrever cores individuais via CSS custom properties no branding (hook `use-tenant-branding`).

**Atributos HTML configuráveis** (persistidos em cookies, 365 dias):

| Atributo | Valores | Descrição |
|---|---|---|
| `data-theme-preset` | `default`, `underground`, `rose-garden`, etc. | Preset ativo |
| `data-theme-radius` | `none` (0), `sm` (0.3rem), `md` (0.5rem), `lg` (1rem), `xl` (1.5rem) | Border radius |
| `data-theme-scale` | `sm`, `md`, `lg` | Escala de tipografia |
| `data-theme-font` | `inter`, `roboto`, `poppins`, `montserrat`, `pt-sans`, `overpass-mono` | Fonte selecionada |
| `data-theme-content-layout` | `full`, `centered` | Layout do conteúdo |
| `data-theme-mode` | `light`, `dark`, `system` | Modo de cor |
| `data-theme-chart-preset` | (variável) | Preset de cores de gráficos |

**Escalas de texto** (`data-theme-scale`):

| Escala | `--text-lg` | `--text-base` | `--text-sm` |
|---|---|---|---|
| `sm` | 1.05rem | 0.85rem | 0.75rem |
| `md` | (padrão Tailwind) | (padrão) | (padrão) |
| `lg` | 1.55rem | 1.35rem | 1rem |

### 2.6 Tipografia

#### Fontes Principais

| Papel | Fonte | CSS Variable | Uso |
|---|---|---|---|
| **Sans (corpo)** | Inter | `--font-sans` / `--font-inter` | Texto corrido, parágrafos, labels |
| **Display (títulos)** | Plus Jakarta Sans | `--font-display` / `--font-jakarta` | Headings, títulos de página |
| **Mono (código)** | System monospace | `--font-mono` | Código, dados técnicos, badges |

#### Todas as Fontes Importadas (Google Fonts)

| Fonte | CSS Variable | Pesos | Uso |
|---|---|---|---|
| Inter | `--font-inter` | 400 | Corpo padrão fallback |
| Geist | `--font-geist` | — | Sans alternativa |
| Roboto | `--font-roboto` | 400, 500, 700 | Clássica |
| Plus Jakarta Sans | `--font-plus-jakarta-sans` | 400, 500, 600, 800 | Display padrão |
| Montserrat | `--font-montserrat` | 400, 500, 600 | Geométrica |
| Poppins | `--font-poppins` | 400, 500, 600 | Amigável |
| Overpass Mono | `--font-overpass-mono` | 400, 500, 700 | Monospace |
| PT Sans | `--font-pt-sans` | 400, 700 | Clássica |
| Hedvig Letters Serif | `--font-hedvig-letters-serif` | 400 | Serif decorativa |
| Kumbh Sans | `--font-kumbh-sans` | 400 | Display geométrica |
| Outfit | `--font-outfit` | 400 | Geometric sans |

#### Fontes por Tema

Cada tema pode sobrescrever as fontes:

| Tema | Corpo (`--text-family`) | Display (`--display-family`) | Peso Display |
|---|---|---|---|
| default | Outfit | (Jakarta) | — |
| underground | Kumbh Sans | Hedvig Letters Serif | 800 |
| rose-garden | Poppins | (Jakarta) | 600 |
| lake-view | PT Sans | (Jakarta) | 800 |
| ocean-breeze | Plus Jakarta Sans | (Jakarta) | 800 |
| lavender-dream | (padrão) | Hedvig Letters Serif | — |

#### Escala Tipográfica — Produto

Classes utilitárias definidas em `globals.css`:

| Classe | Tailwind | Uso |
|---|---|---|
| `.page-title` | `font-display text-2xl md:text-3xl font-bold tracking-tight` | H1 de páginas |
| `.page-subtitle` | `text-sm leading-relaxed text-muted-foreground` | Descrição de páginas |
| `.section-title` | `font-display text-lg md:text-xl font-semibold` | H2 de seções |
| `.section-subtitle` | `text-sm leading-relaxed text-muted-foreground` | Descrição de seções |
| `.card-title` | `text-base font-semibold leading-tight` | H3 em cards |
| `.widget-title` | `text-base md:text-lg font-semibold leading-tight` | Títulos de widgets |
| `.metric-label` | `text-sm font-medium text-muted-foreground` | Labels de métricas |
| `.metric-value` | `text-2xl md:text-3xl font-bold tracking-tight leading-none` | Valores numéricos |
| `.empty-state-title` | `text-lg font-semibold` | Títulos de estados vazios |

#### Escala Tipográfica — Landing/Marketing

| Classe | Tailwind | Uso |
|---|---|---|
| `.landing-hero-title` | `font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]` | Hero das landing pages |
| `.landing-section-title` | `font-display text-2xl font-bold tracking-tight` | Seções de landing |
| `.landing-card-title` | `font-display text-2xl font-bold tracking-tight` | Cards em landing |
| `.landing-metric-value` | `text-2xl font-bold tracking-tight` | Métricas em landing |

### 2.7 Espaçamento

#### Design Tokens de Espaçamento

| Token | Mobile | Tablet (768px+) | Desktop (1024px+) |
|---|---|---|---|
| `--space-page-x` | 1rem | 1.5rem | 2rem |
| `--space-page-y` | 1rem | 1.5rem | 2rem |
| `--space-section` | 0.75rem | 1rem | 1.5rem |
| `--space-component` | 0.5rem | 0.75rem | 1rem |
| `--space-page-gap` | 2rem | 2rem | 2rem |
| `--space-page-pb` | 2.5rem | 2.5rem | 2.5rem |

#### Touch Target

| Token | Valor |
|---|---|
| `--touch-target-min` | 44px |
| `--bottom-nav-height` | 64px |
| `--bottom-nav-safe-area` | `env(safe-area-inset-bottom, 0px)` |

### 2.8 Border Radius

| Token | Valor | Cálculo |
|---|---|---|
| `--radius` (base) | `0.75rem` (12px) | Definido por tema |
| `--radius-lg` | `0.75rem` | = `--radius` |
| `--radius-md` | `0.625rem` (10px) | = `--radius - 2px` |
| `--radius-sm` | `0.5rem` (8px) | = `--radius - 4px` |

### 2.9 Animações

| Nome | Duração | Uso |
|---|---|---|
| `accordion-down/up` | 0.2s ease-out | Abertura/fechamento de accordions |
| `fade-in-up` | 0.5s ease-out | Entrada de elementos na tela |
| `aurora-slow` | 30s ease-in-out ∞ | Fundo imersivo de flashcards |
| `aurora-medium` | 20s ease-in-out ∞ | Fundo imersivo de flashcards |
| `aurora-fast` | 15s ease-in-out ∞ | Fundo imersivo de flashcards |

### 2.10 Textura de Fundo

O body do Aluminify exibe uma **textura de grid sutil** como identidade visual:

```css
background-image:
  linear-gradient(to right, hsl(var(--deco-line) / var(--deco-alpha)) 1px, transparent 1px),
  linear-gradient(to bottom, hsl(var(--deco-line) / var(--deco-alpha)) 1px, transparent 1px);
background-size: 4rem 4rem;
```

- Opacidade: 8% (light) / 15% (dark)
- A sidebar é **isenta** da textura (fundo sólido)
- Landing pages usam um grid alternativo de 40×40px com opacidade 50%

### 2.11 Sombras e Profundidade

| Nível | Tailwind | Uso |
|---|---|---|
| **xs** | `shadow-xs` | Botões outline, input groups |
| **sm** | `shadow-sm` | Cards com elevação sutil |
| **md** | `shadow-md` | Context menus, hover cards |
| **lg** | `shadow-lg` | Dialogs, modais |
| **2xl** | `shadow-2xl` | Mockups de landing page |

**Filosofia**: Cards e containers usam apenas `border` (sem sombra), criando profundidade via cor e borda, não elevação. Sombras são reservadas para overlays e estados interativos.

### 2.12 Sistema de Branding Per-Tenant

O branding de cada tenant é gerenciado em `/settings/personalizacao` com 3 tipos de personalização:

**Paleta de Cores** (`ColorPalette`):
- 20+ variáveis de cor customizáveis (primary, secondary, accent, muted, background, card, sidebar, destructive)
- Flag `isCustom` para distinguir paletas geradas de customizadas
- Validação de contraste via endpoint `/validate`

**Esquema de Fontes** (`FontScheme`):
- `fontSans`, `fontMono`: arrays de famílias tipográficas
- `fontSizes`: escalas customizadas (xs a 4xl)
- `fontWeights`: pesos (light a bold)
- `googleFonts`: lista de fontes a importar dinamicamente
- Flag `isCustom`

**Logos**:
- 3 tipos: `login`, `sidebar`, `favicon`
- Upload para Supabase Storage
- Versionamento para cache-busting
- Variantes light/dark

**Providers de Branding** (`settings/personalizacao/providers/`):
1. `BrandingDataProvider` — Carrega dados via API
2. `BrandingThemeProvider` — Aplica CSS custom properties ao documento
3. `BrandingSyncProvider` — Sincroniza mudanças
4. `BrandingProvider` — Agregador

**CSS Properties Manager**: `getCSSPropertiesManager()` expõe `applyTenantBranding()`, `resetToDefaults()`, `setCustomCss()`.

### 2.13 Espaço de Cor: OKLCh

Os temas usam **OKLCh** (`oklch(lightness chroma hue)`) ao invés de HSL:
- Melhor perceptibilidade de cor em diferentes condições
- Lightness linear (diferente do HSL que é não-perceptual)
- Formato: `oklch(0.7122 0.0991 154.66)` = verde teal com luminosidade 71%

### 2.14 Iconografia

- **Biblioteca**: Lucide React (`lucide-react`)
- **Estilo**: Line icons, stroke-based, 24×24px padrão
- **Consistência**: Todos os ícones vêm da mesma família Lucide
- **Cores**: Herdam a cor do contexto (geralmente `text-muted-foreground` ou cor semântica do módulo)

---

## 3. Design System

### 3.1 Stack de UI

| Camada | Tecnologia |
|---|---|
| CSS Framework | Tailwind CSS v4 |
| Component Library | shadcn/ui (Radix UI primitives) |
| Variantes | class-variance-authority (CVA) |
| Merge de Classes | `cn()` = clsx + tailwind-merge |
| Animações | tw-animate-css + motion (Framer Motion) |
| Temas | next-themes (dark/light) |
| Ícones | Lucide React |
| Gráficos | Recharts |
| Tabelas | TanStack Table v8 |
| Formulários | React Hook Form + Zod |
| Drag & Drop | @dnd-kit |
| Rich Text | Tiptap |
| Markdown | react-markdown + remark/rehype |

### 3.2 Componentes Base (shadcn/ui)

Todos os componentes primitivos vivem em `app/shared/components/ui/` e `app/shared/components/forms/`:

**Layout**: Card, Dialog, Sheet, Drawer, Popover, Tooltip, Tabs, Accordion, Collapsible, Resizable Panels, Separator

**Formulários**: Input, Textarea, Select, Checkbox, Switch, Radio Group, Calendar, Date Picker, OTP Input, Form (React Hook Form wrapper)

**Navegação**: Sidebar, Breadcrumb, Command (cmdk), Navigation Menu, Pagination, Bottom Nav (mobile)

**Feedback**: Button, Badge, Alert, Toast (Sonner), Progress, Skeleton, Avatar

**Data**: Table, Data Table (TanStack), Charts (Recharts)

**Overlay**: Dialog, Sheet, Drawer (Vaul), Alert Dialog, Context Menu, Dropdown Menu

### 3.3 Padrão de Componentes

```tsx
// Anatomia de um componente shadcn/ui no Aluminify
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/app/shared/library/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
  }
);
```

### 3.4 Classes Utilitárias de Layout

| Classe | Propósito |
|---|---|
| `.page-container` | `px-4 py-4 md:px-6 md:py-6 lg:px-8` |
| `.section-container` | `space-y-4 md:space-y-6` |
| `.form-grid` | `grid gap-4 grid-cols-1 md:grid-cols-2` |
| `.form-grid-3` | `grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| `.form-grid-4` | `grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4` |
| `.form-field-full` | `col-span-full` |
| `.mobile-only` | `block md:hidden` |
| `.desktop-only` | `hidden md:block` |
| `.pb-bottom-nav` | `pb-20 md:pb-0` |

### 3.5 Overlays & Modais

Todos os overlays (Dialog, Sheet, Drawer) usam:
- Background: `bg-black/20` com `backdrop-blur-sm`
- Todos os triggers interativos recebem `cursor-pointer` forçado
- Touch action: `manipulation` em todos os elementos interativos

---

## 4. Catálogo de Features

### 4.1 Módulos do Tenant (Área do Aluno + Gestão)

#### Dashboard (`/[tenant]/dashboard`)
- **Aluno**: Progresso acadêmico, próximas aulas, atividades recentes, cronogramas
- **Professor**: Estatísticas de turmas, alunos, plantões agendados
- **Admin/Instituição**: Métricas globais (analytics, heatmaps, distribuições, eficiência)
- Gráficos de desempenho (Recharts)
- Redirecionamento automático baseado em role
- Verificação de onboarding (obriga completar cadastro se necessário)

#### Cursos (`/[tenant]/curso`)
- **Aluno**: Visualização de cursos matriculados, progresso por módulo
- **Gestão**: CRUD completo com estrutura hierárquica: Curso → Segmento → Disciplina → Módulo → Conteúdo
- Sub-rotas: `/admin`, `/conteudos`, `/disciplinas`, `/segmentos`, `/cotas`, `/relatorios`
- Modalidades de ensino (online, híbrida)
- Turmas com suporte a grupos de alunos
- Sistema de quotas para limitar plantões por turma
- Conteúdos com templates pré-configurados
- Rastreamento de matrículas e relatórios de performance

#### Sala de Estudos (`/[tenant]/sala-de-estudos`)
- Atividades gamificadas para engajamento
- Sistema de regras personalizáveis
- Sessões com heartbeat (keep-alive)
- Estrutura dinâmica gerada por IA
- Rastreamento de progresso por atividade
- Player de vídeo imersivo com anotações integradas
- Chat em tempo real durante aulas
- Materiais PDF lado a lado com o vídeo

#### Flashcards (`/[tenant]/flashcards`)
- Sistema de repetição espaçada (SRS — Spaced Repetition System)
- Geração de flashcards por IA
- Sessão imersiva com fundo aurora animado
- Feedback de aprendizado: fácil, normal, difícil
- Importação de templates e decks
- Suporte a imagens nos cards
- Admin pode criar templates reutilizáveis
- Atalhos de teclado (Espaço para virar, Esc para sair)

#### Agendamentos (`/[tenant]/agendamentos`)
- Sub-rotas: `/disponibilidade`, `/configuracoes`, `/bloqueios`, `/[professorId]`, `/meus`, `/stats`, `/detalhes/[id]`
- Monitorias, plantões de dúvidas, aulas particulares
- Integração com Google Calendar (OAuth 2.0, criação automática de eventos)
- Integração com Zoom (OAuth 2.0, criação automática de salas)
- Gerenciamento de quotas de plantão por curso
- Sistema de bloqueios de períodos
- Exportação de calendário (iCal)

#### Cronograma (`/[tenant]/cronograma`)
- Cronogramas de estudo personalizados com distribuição automática
- Sub-rotas: `/[id]`, `/calendar`, `/novo`
- Progresso com checkboxes de conclusão
- Exportação: iCal (.ics) e Excel (.xlsx)
- Estatísticas de tempo de estudo por semana
- Modalidades de estudo (intensivo, distribuído)

#### Biblioteca (`/[tenant]/biblioteca`)
- Repositório centralizado de materiais didáticos
- Upload e organização de recursos por disciplina/módulo
- Busca e filtros avançados
- Compartilhamento com turmas

#### Foco (`/[tenant]/foco`)
- Timer Pomodoro integrado com configuração de ciclos
- Interface minimalista para estudo sem distrações
- Bloqueio de notificações durante modo foco
- Registro de sessões de estudo

#### Financeiro (`/[tenant]/financeiro`)
- Sub-rotas: `/transacoes`, `/transacoes/[id]`, `/produtos`, `/produtos/novo`, `/produtos/[id]/editar`, `/cupons`, `/integracoes`
- Dashboard com métricas (total vendas, transações, ticket médio)
- Status de transações (aprovado, pendente, cancelado, reembolsado)
- Métodos de pagamento (cartão crédito, PIX, boleto)
- Importação de transações via API (Hotmart)
- Sistema de cupons de desconto com validação
- Integração com Hotmart (webhooks)

#### Usuários (`/[tenant]/usuario`)
- Sub-rotas: `/alunos`, `/alunos/[id]`, `/professores`, `/alunos/bulk-import`
- Gestão completa de alunos (CRUD, filtros por curso/turma)
- Importação em lote de alunos (CSV)
- Transferência em lote entre cursos/turmas
- Status de ativação/desativação
- Atribuição de roles e papéis customizados
- Avatar de usuário com upload
- Impersonação de alunos pelo admin

#### Empresa (`/[tenant]/empresa`)
- Sub-rotas: `/nova`, `/completar`, `/detalhes/admins`, `/detalhes/alunos`, `/detalhes/professores`, `/detalhes/usuarios`
- Cadastro e configuração de empresa/instituição
- Gerenciamento de admins (promover/remover)
- Visibilidade de usuários por role

#### Settings (`/[tenant]/settings`)
- Sub-rotas: `/detalhes`, `/equipe`, `/equipe/[id]`, `/papeis`, `/papeis/novo`, `/papeis/[papelId]`, `/modulos`, `/personalizacao`, `/integracoes`
- Dados gerais da empresa (nome, slug, contato)
- Criação de roles customizados com permissões granulares
- Visibilidade de módulos por role
- **Branding personalizado**: paletas de cores, esquemas de fontes (Google Fonts), upload de logos (light/dark)
- **Integrações OAuth**: Google Calendar, Zoom, Hotmart

#### Configurações de Plano (`/[tenant]/configuracoes/plano`)
- Visualização do plano atual e uso (alunos ativos, cursos, armazenamento)
- Upgrade/downgrade via Stripe Checkout
- Histórico de assinatura

#### Perfil (`/[tenant]/perfil`)
- Edição de dados pessoais e avatar
- Alteração de senha
- Preferências pessoais

#### Agente IA — TobIAs (`/[tenant]/agente`)
- Chat com assistente IA powered por N8N
- Suporte a múltiplos providers: N8N, CopilotKit, Mastra, custom
- Anexos de arquivos (imagens, PDFs)
- Histórico de conversas persistido
- Configuração por empresa (branding, avatar, prompts customizáveis)

#### Termos (`/[tenant]/termos`)
- Aceitação e versionamento de termos de serviço
- Status de aceitação por usuário
- Histórico de aceites

### 4.2 Painel Superadmin (`/superadmin`)

Sistema completamente separado do tenant, com autenticação própria (`requireSuperadmin()`):

| Seção | Rota | Funcionalidade |
|---|---|---|
| **Login** | `/superadmin/login` | Autenticação exclusiva para admins da plataforma |
| **Dashboard** | `/superadmin/` | Visão geral de métricas globais |
| **Planos** | `/superadmin/planos` | CRUD de planos, preços (mensal/anual), sincronização com Stripe, limites de features |
| **Assinaturas** | `/superadmin/assinaturas` | Listagem de assinaturas de tenants, status, faturamento |
| **Faturas** | `/superadmin/faturas` | Histórico de faturas, status de pagamento |
| **Métricas** | `/superadmin/metricas` | MRR, churn rate, assinaturas ativas, receita por plano, gráficos de tendência |
| **Usuários** | `/superadmin/usuarios` | CRUD de administradores do sistema |
| **Webhooks** | `/superadmin/webhooks` | Monitoramento, histórico e replay de webhooks (Stripe, Hotmart) |

### 4.3 Landing Page Pública

| Página | Rota | Propósito |
|---|---|---|
| Home | `/` | Hero + features + mockup do produto |
| Features | `/features` | Detalhamento de funcionalidades |
| Open Source | `/opensource` | Modelos de deployment + comunidade |
| Pricing | `/pricing` | Planos e preços (dinâmico via API) |
| Manifesto | `/manifesto` | Carta aberta aos educadores |
| Docs | `/docs` | Documentação de uso |
| Roadmap | `/roadmap` | Planejamento público |
| Changelog | `/changelog` | Histórico de mudanças |
| Status | `/status` | Status do serviço |
| Termos de Uso | `/termos-de-uso` | Legal |
| Privacidade | `/politica-de-privacidade` | Legal |
| DPA | `/dpa` | Data Processing Agreement |

### 4.4 APIs

Endpoints RESTful organizados por domínio em `app/api/`:

| Domínio | Rota Base | Funcionalidade |
|---|---|---|
| Agendamentos | `/api/agendamentos` | CRUD de agendamentos |
| AI Agents | `/api/ai-agents` | Integração com IA |
| Aluno | `/api/aluno` | Operações de aluno |
| Auth | `/api/auth` | Autenticação |
| Biblioteca | `/api/biblioteca` | Materiais didáticos |
| Cronograma | `/api/cronograma` | Calendário |
| Curso | `/api/curso` | Cursos e disciplinas |
| Dashboard | `/api/dashboard` | Dados do dashboard |
| Empresa | `/api/empresa` | Gestão da instituição |
| Financeiro | `/api/financeiro` | Pagamentos e faturas |
| Flashcards | `/api/flashcards` | Flashcards |
| Plans | `/api/plans` | Planos públicos |
| Sala de Estudos | `/api/sala-de-estudos` | Vídeo-aulas |
| Stripe | `/api/stripe` | Checkout e webhooks Stripe |
| Superadmin | `/api/superadmin` | Gestão da plataforma |
| Tobias | `/api/tobias` | Agente IA Tobias |
| Usuário | `/api/usuario` | Gestão de usuários |
| Webhooks | `/api/webhooks` | Endpoints de webhook |
| Health | `/api/health` | Health check |
| Docs | `/api/docs` | Swagger/OpenAPI |

### 4.5 Modelos de Pricing

| Plano | Preço | Público |
|---|---|---|
| **Gratuito** (Self-Hosted) | R$ 0 | Quem tem equipe técnica |
| **Nuvem** (Managed) | Variável/mês | Educadores que querem focar no curso |
| **Personalizado** | Sob consulta | Grandes instituições |

- Trial: 14 dias grátis no plano Nuvem
- Billing: Mensal ou anual (-20%)
- Métrica: "Aluno ativo" = login no período de cobrança
- Preço extra por aluno ativo além da franquia

---

## 5. Arquitetura & System Design

### 5.1 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Runtime** | Node.js 22 (Alpine Docker) |
| **Linguagem** | TypeScript 5 (strict mode) |
| **UI** | React 19 + Tailwind CSS v4 + shadcn/ui |
| **Banco de Dados** | PostgreSQL (via Supabase) |
| **Auth** | Supabase Auth (JWT + cookies) |
| **Storage** | Supabase Storage |
| **Pagamentos** | Stripe (Checkout Sessions) |
| **Observabilidade** | Sentry + OpenTelemetry |
| **Analytics** | Google Analytics (react-ga4) |
| **Email** | Nodemailer (SMTP) |
| **IA** | OpenAI + Vercel AI SDK |
| **Testes** | Jest + Testing Library + Playwright |

### 5.2 Arquitetura Multi-Tenant

```
┌─────────────────────────────────────────────┐
│           Next.js Middleware                 │
│  ┌─────────────────────────────────────┐    │
│  │ Tenant Resolution                    │    │
│  │ (subdomain | custom-domain | slug)   │    │
│  └──────────────┬──────────────────────┘    │
│                 │ x-tenant-id header         │
│  ┌──────────────▼──────────────────────┐    │
│  │      App Router [tenant]             │    │
│  │  ┌────────────────────────────┐      │    │
│  │  │ (modules)/ → Feature Pages │      │    │
│  │  │ auth/      → Auth Flows    │      │    │
│  │  └────────────────────────────┘      │    │
│  └──────────────┬──────────────────────┘    │
│                 │                             │
│  ┌──────────────▼──────────────────────┐    │
│  │         Supabase (PostgreSQL)        │    │
│  │  ┌─────────────────────────────┐     │    │
│  │  │  Row Level Security (RLS)   │     │    │
│  │  │  empresa_id isolation       │     │    │
│  │  └─────────────────────────────┘     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Resolução do tenant em 3 camadas:**
1. **Subdomínio**: `meucurso.aluminify.com`
2. **Domínio customizado**: `aluno.meucurso.com.br`
3. **Slug na URL**: `aluminify.com/meucurso`

**Isolamento de dados**: Supabase RLS policies garantem que cada tenant só acessa seus próprios dados ao nível de banco.

### 5.3 Camadas de Autenticação

| Método | Uso |
|---|---|
| **Cookie (Supabase SSR)** | Navegação de páginas (Server Components) |
| **Bearer Token** | API calls de Client Components |
| **API Key (x-api-key)** | Integrações externas |

- Sessions cacheadas em memória (Map) com TTL de 30 min
- `getAuthenticatedUser()` wrappado em `React.cache()` para deduplicação por request
- Impersonação de alunos via cookie httpOnly (8h TTL)
- Superadmin com auth completamente separada

### 5.4 Modelo de Autorização

```
PapelBase = "aluno" | "professor" | "usuario"
       +
    isAdmin flag → ADMIN_PERMISSIONS (acesso total)
       +
  isOwner flag → Marca o criador do tenant
       +
  Custom Permissions (por recurso: view/create/edit/delete)
```

### 5.5 Padrão de Camada de Serviço

```
Interface (Repository) → Implementação (RepositoryImpl)
                              ↓
                      Service (Business Logic)
                              ↓
                    Factory (DI / Client Injection)
```

- Repositories mapeiam `snake_case` do PostgreSQL para `camelCase` do domínio
- Dois clientes: `getDatabaseClient()` (admin, bypassa RLS) e `getDatabaseClientAsUser(token)` (respeita RLS)

### 5.6 Deployment

| Plataforma | Suporte |
|---|---|
| Docker (standalone) | Dockerfile multi-stage, node:22-alpine |
| Docker Compose | Variantes: padrão, Traefik, Portainer |
| Cloudron | CloudronManifest.json, sendmail addon |
| Vercel | Deployment padrão Next.js |
| Self-hosted | Qualquer servidor Node.js |

**Health check**: `/api/health`
**Porta**: 3000
**Memory**: 2048MB (runner), 4096MB (builder)

---

## 6. Padrões de UX

### 6.1 Responsividade

A plataforma é **mobile-first** com 3 breakpoints:

| Breakpoint | Largura | Comportamento |
|---|---|---|
| **Mobile** | < 768px | Bottom navigation, layout single-column, sidebar oculta |
| **Tablet** | 768px+ | Sidebar colapsável, grids de 2 colunas |
| **Desktop** | 1024px+ | Sidebar expandida, grids de 3-4 colunas |

- Bottom navigation em mobile (`--bottom-nav-height: 64px`) com até 5 ícones + botão "Mais"
- Safe area para notch/home bar (`env(safe-area-inset-bottom)`) — suporte iOS
- Touch targets mínimos de 44px
- `overscroll-behavior-y: contain` previne pull-to-refresh acidental
- `-webkit-text-size-adjust: 100%` para legibilidade
- `touch-action: manipulation` elimina delay de 300ms
- `MobileOrgSwitcher`: Sheet (drawer bottom) para troca de organização em mobile
- `BottomNavMoreSheet`: Sheet deslizante para itens extras da navegação

### 6.2 Estados de Interface

| Estado | Componente | Descrição |
|---|---|---|
| **Loading** | `Skeleton`, `ListSkeleton`, `Spinner` | Skeleton com animação pulse; Spinner com `role="status"` e `aria-label` |
| **Vazio** | `Empty` (composable) | `EmptyMedia` + `EmptyTitle` + `EmptyDescription` + `EmptyContent` (CTA) |
| **Erro** | Toast (Sonner) + `Alert` | `toast.error()` para feedback rápido; `Alert variant="destructive"` para inline |
| **Sucesso** | Toast (Sonner) | `toast.success()` com richColors automáticas |
| **Progresso** | `Progress` | Barra de progresso customizável (ex: uploads) |
| **404** | Página dedicada | Logo + badge de status + gradiente + CTAs (voltar, contato) |

**Toasts (Sonner):**
- Posição: `top-center`
- `richColors`: cores automáticas por tipo
- Limite: 1 toast simultâneo
- Suporte a ações e botões customizados

### 6.3 Navegação

| Contexto | Componente | Detalhes |
|---|---|---|
| Desktop | `AppSidebar` | Roteia para `AlunoSidebar`, `ProfessorSidebar` ou `EmpresaSidebar` conforme role |
| Mobile | `BottomNavigation` | Barra fixa no rodapé, `aria-current="page"` no item ativo |
| Landing | `Nav` | Navbar sticky com `backdrop-blur-md`, scroll-aware |
| Contexto | `DynamicBreadcrumb` | Trilha de navegação dinâmica com labels customizados |
| Busca | Command palette (cmdk) | ⌘K para busca global |
| Org Switch (desktop) | `WorkspaceSwitcher` | Dropdown para trocar organização |
| Org Switch (mobile) | `MobileOrgSwitcher` | Sheet bottom com prefetch de branding |
| Impersonação | `ImpersonationBanner` | Banner quando admin impersona outro usuário |

### 6.4 Acessibilidade

| Aspecto | Implementação |
|---|---|
| **ARIA labels** | `role="navigation"`, `aria-label="Navegação principal"`, `aria-current="page"` |
| **Ícones decorativos** | `aria-hidden="true"` em todos os ícones Lucide |
| **Foco visível** | `focus-visible:ring-2 focus:ring-ring` em elementos interativos |
| **Navegação por teclado** | Radix UI fornece Focus Trap, Arrow Keys nativo em todos os primitives |
| **Screen readers** | Estrutura semântica: `<header>`, `<nav>`, `role="status"` para feedback |
| **Touch** | Todos os interativos com `touch-action: manipulation` |
| **HTML lang** | `pt-BR` em todos os layouts |

### 6.5 Onboarding & Fluxos de Primeiro Acesso

| Fluxo | Rota | Descrição |
|---|---|---|
| **Primeiro acesso** | `/[tenant]/auth/primeiro-acesso` | Usuários com `mustChangePassword=true` são redirecionados para definir nova senha |
| **Visibilidade de módulos** | `ModuleVisibilityProvider` | Controla quais módulos aparecem no menu baseado em configuração da empresa |
| **Multi-org (aluno)** | `StudentOrganizationsProvider` | Alunos matriculados em múltiplas instituições podem trocar entre elas |

**Fluxo de primeiro acesso:**
1. Verificar `user.mustChangePassword`
2. Redirecionar para `/primeiro-acesso`
3. Validar nova senha (diferente da temporária, mínimo 8 caracteres, força)
4. Sucesso: redirecionar para dashboard padrão da role

### 6.6 Multi-Organização

Alunos podem estar matriculados em múltiplas instituições. O sistema oferece:

- `StudentOrganizationsProvider`: Context com lista de orgs, org ativa, e função de troca
- Org ativa salva em `localStorage` (`student-active-organization`)
- Ao trocar: prefetch de branding da nova org → redirect com `window.location.assign()`
- `StudentBrandingCoordinator`: Aplica branding (cores, logo) dinamicamente ao trocar
- Staff (professor, admin): atualmente single-tenant por usuário

### 6.7 Provider Composition (Dashboard)

```
<UserProvider>
  <StudentOrganizationsProvider>
    <ModuleVisibilityProvider>
      <SidebarProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </SidebarProvider>
    </ModuleVisibilityProvider>
  </StudentOrganizationsProvider>
</UserProvider>
```

### 6.8 Formulários

- Validação client-side com React Hook Form + Zod
- Labels sempre visíveis (não apenas placeholder)
- Mensagens de erro posicionadas abaixo do campo (`FormMessage`)
- Grid responsivo: 1 col (mobile) → 2 col (tablet) → 3-4 col (desktop)
- Componentes: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`

### 6.9 Internacionalização

| Aspecto | Status |
|---|---|
| Framework i18n | Não implementado (sem next-intl/i18next) |
| Idioma | 100% português brasileiro |
| HTML lang | `pt-BR` |
| Datas | `date-fns` com locale `ptBR` |
| Números | `Intl.NumberFormat('pt-BR')` |
| Moeda | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` |

### 6.10 Idioma por Camada

| Camada | Idioma |
|---|---|
| UI (labels, botões, mensagens) | Português brasileiro |
| Variáveis e tipos | Inglês |
| Banco de dados (colunas) | snake_case em português |
| Erros para o usuário | Português |
| Logs técnicos | Inglês |
| Testes (descrições) | Português |

---

## 7. Guia de Comunicação

### 7.1 Para Atendimento/Suporte

**Postura**: Somos aliados do educador. Nunca usamos linguagem que sugira que o problema é culpa dele.

**Exemplos de resposta:**

| Situação | Não diga | Diga |
|---|---|---|
| Erro do sistema | "Você fez algo errado" | "Encontramos um problema e estamos resolvendo" |
| Feature não disponível | "Isso não funciona" | "Essa funcionalidade está no nosso roadmap" |
| Migração | "É complicado" | "Ajudamos você a trazer todos os seus dados sem perder nada" |

### 7.2 Para Design

- Sempre usar tokens semânticos, nunca cores raw
- Respeitar a hierarquia: page-title > section-title > card-title
- Manter consistência com a família de ícones Lucide
- Dark mode não é "nice to have" — é obrigatório
- White-label: nenhum componente deve ter a marca "Aluminify" hard-coded na área do tenant

### 7.3 Para Marketing

- O Aluminify se posiciona **contra** plataformas de marketplace (Hotmart, Udemy)
- O argumento central é **soberania**: dados, marca e tecnologia pertencem ao educador
- O código aberto é prova de transparência, não apenas um diferencial técnico
- Evitar linguagem de "startup tech" — falar como quem entende o dia a dia do professor

---

## 8. Referências Técnicas

### 8.1 Links Importantes

| Recurso | URL |
|---|---|
| Repositório | github.com/SinesysTech/aluminify |
| Comunidade | discord.gg/aluminify |
| Empresa | sinesys.com.br |
| Documentação | /docs (rota da aplicação) |
| API Docs | /api/docs (Swagger UI) |

### 8.2 Estrutura de Diretórios (Simplificada)

```
app/
├── (landing-page)/        # Site público (marketing)
├── [tenant]/
│   ├── (modules)/         # 16 módulos protegidos
│   └── auth/              # Auth por tenant
├── api/                   # 20+ domínios de API
├── superadmin/            # Painel de admin da plataforma
└── shared/
    ├── components/        # Componentes compartilhados
    │   ├── ui/            # shadcn/ui primitives
    │   ├── forms/         # Componentes de formulário
    │   └── layout/        # Dashboard layout
    ├── core/              # Auth, DB, env, middleware
    ├── hooks/             # React hooks customizados
    ├── types/             # Entidades, DTOs, enums
    └── library/           # Utilitários (cn, api-client)
```

### 8.3 Convenções de Nomenclatura

| O quê | Padrão | Exemplo |
|---|---|---|
| Arquivos | kebab-case | `curso-table.tsx` |
| Componentes | PascalCase | `CursoTable` |
| Funções | camelCase | `getDisponibilidade` |
| Constantes | UPPER_SNAKE_CASE | `AUTH_SESSION_CACHE_TTL` |
| Interfaces/Types | PascalCase | `CreateStudentInput` |
| Colunas DB | snake_case | `empresa_id` |
| Variáveis não usadas | Prefixo `_` | `_env`, `_data` |

### 8.3 Integrações com Serviços Externos

| Serviço | Tipo | Funcionalidade |
|---|---|---|
| **Stripe** | Pagamentos SaaS | Checkout Sessions, Customer Management, Webhooks (invoice.paid, subscription.updated), Portal do Cliente, Sincronização de planos |
| **Hotmart** | Pagamentos de Infoprodutos | Webhook de vendas/reembolsos, importação de transações via API |
| **Google Calendar** | Calendário | OAuth 2.0, criação automática de eventos de agendamento, sincronização de disponibilidade |
| **Zoom** | Videoconferência | OAuth 2.0, criação automática de salas para agendamentos, deep linking |
| **N8N** | IA (TobIAs) | Webhook para envio de mensagens, suporte a anexos, histórico de conversas |
| **CopilotKit** | IA (alternativo) | Actions customizáveis |
| **Mastra** | IA (alternativo) | Multi-step workflows |
| **OpenAI** | IA (geração) | Geração de flashcards, estruturas de atividades |
| **Sentry** | Observabilidade | Error tracking, performance monitoring |
| **OpenTelemetry** | Tracing | Distributed tracing |
| **Google Analytics** | Analytics | Tracking de uso (react-ga4) |
| **Nodemailer** | Email | SMTP para notificações transacionais |
| **Supabase Storage** | Armazenamento | Upload de materiais, logos, avatares, anexos |
| **Google Fonts** | Tipografia | Integração dinâmica para esquemas de fontes por tenant |

### 8.4 Fluxos Principais de Usuário

#### Jornada do Aluno
```
Login → Dashboard (progresso, cronograma, aulas)
  ├── Agendar plantão → Ver disponibilidade do professor → Confirmar
  ├── Estudar → Cronograma / Flashcards / Modo Foco / Sala de Estudos
  ├── Ver progresso → Dashboard com analytics e ranking
  ├── Chat IA → Conversar com TobIAs (dúvidas, resumos)
  └── Multi-org → Trocar entre instituições (se matriculado em várias)
```

#### Jornada do Professor
```
Login → Dashboard (stats de turmas, plantões)
  ├── Configurar disponibilidade → Definir horários → Bloquear períodos
  ├── Visualizar agendamentos → Ver alunos agendados
  ├── Gerenciar curso → Editar conteúdo, disciplinas, módulos
  └── Ver analytics → Performance de alunos por disciplina
```

#### Jornada do Admin/Gestor
```
Login → Dashboard institucional (métricas, heatmap, eficiência)
  ├── Gerenciar usuários → Importar alunos (CSV) / Adicionar professores
  ├── Configurar cursos → Criar estrutura (curso → segmento → disciplina)
  ├── Financeiro → Produtos, transações, cupons, integrações
  ├── Settings → Branding, roles customizadas, integrações OAuth
  ├── Impersonar aluno → Ver a plataforma como o aluno vê
  └── Relatórios → Desempenho, eficiência, distribuição
```

#### Jornada do Superadmin
```
Login → Dashboard da plataforma (MRR, churn, tenants)
  ├── Gerenciar planos → CRUD, sincronizar com Stripe
  ├── Monitorar assinaturas → Status, faturamento
  ├── Analisar métricas → Receita por plano, tendências
  ├── Gerenciar admins → Permissões de acesso
  └── Monitorar webhooks → Eventos de pagamento, replay
```

### 8.5 Autenticação — Fluxos Disponíveis

| Fluxo | Rota | Descrição |
|---|---|---|
| Login | `/auth/login` | Email + senha |
| Cadastro | `/auth/sign-up` | Geralmente gerenciado por admin |
| Magic Link | `/auth/confirm` | Confirmação por email (deep link) |
| Esqueci a senha | `/auth/forgot-password` | Envio de link por email |
| Atualizar senha | `/auth/update-password` | Após receber link |
| Primeiro acesso | `/[tenant]/auth/primeiro-acesso` | Troca de senha temporária |
| Signup com empresa | `/auth/sign-up` | Cria usuário + empresa simultaneamente |
| Signup professor | via API | Convite de professor pelo admin |
| Impersonação | via API | Admin assume visão do aluno |
| Superadmin | `/superadmin/login` | Auth separada, valida contra tabela `superadmins` |

---

*Documento gerado em Março de 2026. Versão 1.0.*
*Mantido pela equipe Aluminify / Sinesys Intelligence.*
