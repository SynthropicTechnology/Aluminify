# Multi-stage Dockerfile for Aluminify
# Next.js (port 3000)
# Optimized for production with security best practices

# Stage 1: Dependencies - Install and cache node_modules
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files and npm config
COPY package.json package-lock.json .npmrc ./

# Install dependencies (--loglevel=error suppresses cosmetic peer-dep warnings
# that are already handled by overrides in package.json)
RUN npm install --no-audit --loglevel=error

# Stage 2: Builder - Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build-time environment variables
# Supabase
ARG SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SECRET_KEY
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
# Auth
ARG OAUTH_ENCRYPTION_KEY
# Analytics
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
# Sentry (Optional)
ARG SENTRY_AUTH_TOKEN
ARG DOCKER_BUILD=true

# Set environment variables for build
ENV SUPABASE_URL=$SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SECRET_KEY=$SUPABASE_SECRET_KEY
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
ENV OAUTH_ENCRYPTION_KEY=$OAUTH_ENCRYPTION_KEY
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV DOCKER_BUILD=$DOCKER_BUILD

# Skip env validation at build time (validated at runtime)
ENV SKIP_ENV_VALIDATION=true

# Increase memory for Next.js build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build Next.js application
RUN npm run build

# Stage 3: Runner - Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Increase Node.js heap memory to prevent OOM crashes under load
# (The builder stage has this too, but each stage is independent)
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Build-time environment variables (repeated for Runner stage — bakes NEXT_PUBLIC_* into client bundle)
ARG SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SECRET_KEY
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
ARG OAUTH_ENCRYPTION_KEY
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG SENTRY_AUTH_TOKEN

ENV SUPABASE_URL=$SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SECRET_KEY=$SUPABASE_SECRET_KEY
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
ENV OAUTH_ENCRYPTION_KEY=$OAUTH_ENCRYPTION_KEY
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

# Install sharp for Next.js image optimization in standalone mode
RUN npm install --global sharp@0.33.5 && npm cache clean --force
ENV NEXT_SHARP_PATH=/usr/local/lib/node_modules/sharp

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output (includes server.js and minimal node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check for Next.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Next.js standalone server directly (no need for start.sh)
CMD ["node", "server.js"]
