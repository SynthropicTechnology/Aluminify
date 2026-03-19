# Docker Documentation - Aluminify

Este documento fornece instruções completas para executar o Aluminify usando Docker, incluindo desenvolvimento local e deploy em produção.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Build da Imagem](#build-da-imagem)
- [Execução Local](#execução-local)
- [Docker Compose](#docker-compose)
- [Produção](#produção)
- [Troubleshooting](#troubleshooting)
- [Otimizações](#otimizações)
- [Deploy em Cloud](#deploy-em-cloud)

## Pré-requisitos

### Software Necessário

- **Docker**: versão 20.10 ou superior
  - [Instalar Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Docker Compose**: versão 2.0 ou superior (incluído no Docker Desktop)
- **Node.js 20**: apenas para desenvolvimento local sem Docker

### Verificar Instalação

```bash
docker --version
docker-compose --version
```

## Variáveis de Ambiente

### Configuração Inicial

1. Copie o arquivo de exemplo:

```bash
cp .env.docker.example .env.local
```

2. Edite `.env.local` com suas credenciais:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=sua-chave-publica
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SECRET_KEY=sua-chave-secreta

# Redis (para desenvolvimento local com Docker)
UPSTASH_REDIS_REST_URL=http://redis:6379
UPSTASH_REDIS_REST_TOKEN=

# N8N
N8N_WEBHOOK_URL=https://seu-webhook.n8n.cloud

# Next.js
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
```

### Variáveis Importantes

| Variável                                       | Descrição                  | Obrigatória |
| ---------------------------------------------- | -------------------------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`                     | URL do projeto Supabase    | ✅          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | Chave pública do Supabase  | ✅          |
| `SUPABASE_SECRET_KEY`                          | Chave secreta do Supabase  | ✅          |
| `SMTP_HOST`                                    | Host SMTP customizado      | ❌          |
| `SMTP_FROM`                                    | Remetente SMTP customizado | ❌          |
| `N8N_WEBHOOK_URL`                              | URL do webhook N8N         | ❌          |
| `NODE_ENV`                                     | Ambiente de execução       | ✅          |

### SMTP na Cloudron

Quando o app roda na Cloudron, use o addon oficial `sendmail` em vez de preencher `SMTP_*` manualmente.

O addon injeta automaticamente variáveis como:

- `CLOUDRON_MAIL_SMTP_SERVER`
- `CLOUDRON_MAIL_SMTP_PORT`
- `CLOUDRON_MAIL_SMTP_USERNAME`
- `CLOUDRON_MAIL_SMTP_PASSWORD`
- `CLOUDRON_MAIL_FROM`
- `CLOUDRON_MAIL_FROM_DISPLAY_NAME`

O Aluminify agora resolve essa configuração automaticamente em runtime e expõe o status em `GET /api/health` no campo `integrations.email`.

## Build da Imagem

### Método 1: Script Automatizado (Recomendado)

**Linux/Mac:**

```bash
chmod +x scripts/docker-build.sh
./scripts/docker-build.sh
```

**Windows (PowerShell):**

```powershell
.\scripts\docker-build.ps1
```

### Método 2: Docker CLI

```bash
# Build básico
docker build -t sinesystec/aluminify:latest .

# Build com versão específica
docker build -t sinesystec/aluminify:v1.0.0 .

# Build multi-plataforma (requer Docker Buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t sinesystec/aluminify:latest .
```

### Build para Produção

Para builds de produção com output standalone:

```bash
DOCKER_BUILD=true docker build --build-arg DOCKER_BUILD=true -t sinesystec/aluminify:prod .
```

## Execução Local

### Método 1: Script Automatizado (Recomendado)

**Linux/Mac:**

```bash
chmod +x scripts/docker-run.sh
./scripts/docker-run.sh
```

**Windows (PowerShell):**

```powershell
.\scripts\docker-run.ps1
```

### Método 2: Docker CLI

```bash
docker run -d \
  --name aluminify-app \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  sinesystec/aluminify:latest
```

### Acessar a Aplicação

Após iniciar o container, acesse:

- **URL**: http://localhost:3000

### Comandos Úteis

```bash
# Ver logs em tempo real
docker logs -f aluminify-app

# Parar o container
docker stop aluminify-app

# Iniciar o container novamente
docker start aluminify-app

# Remover o container
docker rm aluminify-app

# Verificar status de saúde
docker inspect --format='{{.State.Health.Status}}' aluminify-app

# Executar comando dentro do container
docker exec -it aluminify-app sh
```

## Docker Compose

### Desenvolvimento

O `docker-compose.yml` inclui:

- Aplicação Next.js com hot-reload
- Redis local para cache

**Iniciar:**

```bash
docker-compose up
```

**Iniciar em background:**

```bash
docker-compose up -d
```

**Ver logs:**

```bash
docker-compose logs -f app
```

**Parar:**

```bash
docker-compose down
```

**Rebuild e iniciar:**

```bash
docker-compose up --build
```

### Produção

O `docker-compose.prod.yml` inclui:

- Build otimizado para produção
- Resource limits (CPU, memória)
- Logging configurado
- Restart automático

**Iniciar:**

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Ver logs:**

```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

**Parar:**

```bash
docker-compose -f docker-compose.prod.yml down
```

**Atualizar:**

```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Produção

### Preparação para Deploy

1. **Configure variáveis de ambiente de produção:**
   - Use Redis do Upstash em vez do Redis local
   - Configure URLs de produção
   - Use secrets para dados sensíveis

2. **Build otimizado:**

```bash
DOCKER_BUILD=true docker build -t sinesystec/aluminify:prod .
```

3. **Tag para registry:**

```bash
docker tag sinesystec/aluminify:prod sinesystec/aluminify:v1.0.0
```

4. **Push para registry:**

```bash
docker push sinesystec/aluminify:v1.0.0
```

### Health Check

A imagem inclui health check automático que verifica:

- Endpoint: `http://localhost:3000/api/health`
- Intervalo: 30 segundos
- Timeout: 10 segundos
- Start period: 40 segundos
- Retries: 3

> **Nota**: Certifique-se de que o endpoint `/api/health` existe na aplicação.

### Resource Limits

O `docker-compose.prod.yml` define:

**App:**

- CPU: 1-2 cores
- Memória: 1-2 GB

Ajuste conforme necessário para seu ambiente.

## Troubleshooting

### Problema: Container não inicia

**Solução:**

```bash
# Ver logs detalhados
docker logs aluminify-app

# Verificar se a porta está em uso
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac
```

### Problema: Erro de conexão com Supabase

**Solução:**

- Verifique as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`
- Confirme que as URLs estão corretas
- Teste a conexão manualmente

### Problema: Build falha

**Solução:**

```bash
# Limpar cache do Docker
docker builder prune -a

# Rebuild sem cache
docker build --no-cache -t aluminify:latest .
```

### Problema: Hot-reload não funciona

**Solução:**

- Certifique-se de estar usando `docker-compose.yml` (não o `.prod.yml`)
- Verifique se os volumes estão montados corretamente
- No Windows, pode ser necessário habilitar WSL 2

## Otimizações

### Reduzir Tamanho da Imagem

1. **Use multi-stage builds** (já implementado)
2. **Minimize dependências:**
   ```bash
   npm prune --production
   ```
3. **Use Alpine Linux** (já implementado)

### Melhorar Performance

1. **Cache de layers:**
   - Copie `package.json` antes do código-fonte
   - Aproveite o cache do Docker

2. **Build paralelo:**

   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 .
   ```

3. **Compressão:**
   - Já habilitada no `next.config.ts`

### Segurança

1. **Usuário não-root** (já implementado)
2. **Scan de vulnerabilidades:**
   ```bash
   docker scan aluminify:latest
   ```
3. **Secrets:**
   - Nunca inclua secrets no Dockerfile
   - Use Docker secrets ou variáveis de ambiente

## Deploy em Cloud

### AWS ECS (Elastic Container Service)

1. **Push para ECR:**

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin seu-account.dkr.ecr.us-east-1.amazonaws.com
docker tag aluminify:latest seu-account.dkr.ecr.us-east-1.amazonaws.com/aluminify:latest
docker push seu-account.dkr.ecr.us-east-1.amazonaws.com/aluminify:latest
```

2. **Criar Task Definition:**
   - Use a imagem do ECR
   - Configure variáveis de ambiente
   - Defina resource limits

3. **Criar Service:**
   - Configure load balancer
   - Defina auto-scaling

### Google Cloud Run

```bash
# Build e push
gcloud builds submit --tag gcr.io/seu-projeto/aluminify

# Deploy
gcloud run deploy aluminify \
  --image gcr.io/seu-projeto/aluminify \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Azure Container Instances

```bash
# Login
az login

# Criar container registry
az acr create --resource-group myResourceGroup --name myRegistry --sku Basic

# Push imagem
az acr build --registry myRegistry --image aluminify:latest .

# Deploy
az container create \
  --resource-group myResourceGroup \
  --name aluminify \
  --image myRegistry.azurecr.io/aluminify:latest \
  --dns-name-label aluminify \
  --ports 3000
```

### DigitalOcean App Platform

1. Conecte seu repositório Git
2. Configure Dockerfile deployment
3. Defina variáveis de ambiente
4. Deploy automático

### Render

1. Conecte seu repositório Git
2. Selecione "Docker" como ambiente
3. Configure variáveis de ambiente
4. Deploy automático

## Comandos Rápidos

```bash
# Build
docker build -t aluminify:latest .

# Run desenvolvimento
docker-compose up

# Run produção
docker-compose -f docker-compose.prod.yml up -d

# Logs
docker-compose logs -f app

# Stop
docker-compose down

# Rebuild
docker-compose up --build

# Clean all
docker-compose down -v
docker system prune -a
```

## Próximos Passos

1. Configure CI/CD para builds automáticos
2. Implemente monitoramento (Prometheus, Grafana)
3. Configure backup automático do Redis
4. Implemente blue-green deployment
5. Configure CDN para assets estáticos

## Suporte

Para mais informações, consulte:

- [Documentação do Next.js](https://nextjs.org/docs)
- [Documentação do Docker](https://docs.docker.com/)
- [Documentação do Supabase](https://supabase.com/docs)
