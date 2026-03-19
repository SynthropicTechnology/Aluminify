#!/bin/bash
# Aluminify - Cloudron Build & Deploy Script
#
# Usage:
#   ./cloudron/build-and-deploy.sh              # Build (remote) + install (first time)
#   ./cloudron/build-and-deploy.sh --update     # Build (remote) + update existing app
#   ./cloudron/build-and-deploy.sh --build-only # Build only (no deploy)
#   ./cloudron/build-and-deploy.sh --local      # Build locally instead of remote builder
#
# Prerequisites:
#   1. npm install -g cloudron
#   2. cloudron login my.sinesys.online
#   3. .env.local with environment variables
#
# Environment overrides:
#   CLOUDRON_REGISTRY  — Registry URL (default: registry.sinesys.online)
#   CLOUDRON_IMAGE     — Image name (default: registry.sinesys.online/aluminify)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration — Sinesys private registry
REGISTRY="${CLOUDRON_REGISTRY:-registry.sinesys.online}"
IMAGE_NAME="${CLOUDRON_IMAGE:-${REGISTRY}/aluminify}"
TIMESTAMP_TAG=$(date +"%Y%m%d-%H%M%S")

# Parse arguments
ACTION="install"
BUILD_MODE="remote"
for arg in "$@"; do
  case $arg in
    --update)     ACTION="update" ;;
    --build-only) ACTION="build-only" ;;
    --local)      BUILD_MODE="local" ;;
    *)            echo -e "${RED}Unknown argument: $arg${NC}"; exit 1 ;;
  esac
done

echo -e "${GREEN}=== Aluminify — Cloudron Build & Deploy ===${NC}"
echo "Action:     ${ACTION}"
echo "Build mode: ${BUILD_MODE}"
echo "Registry:   ${REGISTRY}"
echo "Image:      ${IMAGE_NAME}:${TIMESTAMP_TAG}"
echo ""

# -------------------------------------------------------------------
# Checks
# -------------------------------------------------------------------
if ! command -v cloudron &>/dev/null; then
  echo -e "${RED}Error: Cloudron CLI is not installed${NC}"
  echo -e "${YELLOW}Install with: npm install -g cloudron${NC}"
  exit 1
fi

if [ ! -f .env.local ]; then
  echo -e "${RED}Error: .env.local not found${NC}"
  echo -e "${YELLOW}Create .env.local with your environment variables (see .env.example).${NC}"
  exit 1
fi

if [ ! -f CloudronManifest.json ]; then
  echo -e "${RED}Error: CloudronManifest.json not found${NC}"
  echo -e "${YELLOW}Run this script from the project root directory.${NC}"
  exit 1
fi

# -------------------------------------------------------------------
# Load build args from .env.local
# -------------------------------------------------------------------
BUILD_ARGS=""
echo -e "${GREEN}Loading environment variables from .env.local...${NC}"
while IFS='=' read -r key value; do
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z $key ]] && continue
  if [[ $key =~ ^NEXT_PUBLIC_ ]] || \
     [[ $key =~ ^SUPABASE_ ]] || \
     [[ $key =~ ^OAUTH_ ]] || \
     [[ $key =~ ^SENTRY_ ]] || \
     [[ $key =~ ^DOCKER_ ]]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg $key=$value"
    echo "  + ${key}"
  fi
done < .env.local

# Always set DOCKER_BUILD=true
BUILD_ARGS="$BUILD_ARGS --build-arg DOCKER_BUILD=true"

# -------------------------------------------------------------------
# Build Docker image
# -------------------------------------------------------------------
echo ""

if [ "$BUILD_MODE" = "remote" ]; then
  # ---------------------------------------------------------------
  # Remote build via Cloudron Docker Remote Builder
  # ---------------------------------------------------------------
  echo -e "${GREEN}Building via Cloudron Remote Builder...${NC}"
  echo -e "${YELLOW}(Using build service at builder.sinesys.online)${NC}"
  echo ""

  # Configure the build service if not already set.
  # Run this once:
  #   cloudron build --set-build-service 'https://builder.sinesys.online' \
  #     --build-service-token <YOUR_TOKEN>
  #
  # Or set CLOUDRON_BUILD_SERVICE_TOKEN env var to auto-configure.
  if [ -n "${CLOUDRON_BUILD_SERVICE_TOKEN:-}" ]; then
    cloudron build login \
      --build-service-url 'https://builder.sinesys.online' \
      --build-service-token "${CLOUDRON_BUILD_SERVICE_TOKEN}"
  fi

  # Build using cloudron CLI with the Cloudron Dockerfile
  cloudron build build \
    --file Dockerfile.cloudron \
    --repository "${IMAGE_NAME}" \
    --tag "${TIMESTAMP_TAG}" \
    $BUILD_ARGS

else
  # ---------------------------------------------------------------
  # Local build via Docker
  # ---------------------------------------------------------------
  echo -e "${GREEN}Building locally with Docker...${NC}"

  if ! command -v docker &>/dev/null; then
    echo -e "${RED}Error: Docker is not installed (required for --local)${NC}"; exit 1
  fi

  docker build \
    --platform linux/amd64 \
    -f Dockerfile.cloudron \
    $BUILD_ARGS \
    -t "${IMAGE_NAME}:${TIMESTAMP_TAG}" \
    -t "${IMAGE_NAME}:latest" \
    .

  echo -e "${GREEN}Pushing to ${REGISTRY}...${NC}"
  docker push "${IMAGE_NAME}:${TIMESTAMP_TAG}"
  docker push "${IMAGE_NAME}:latest"
fi

echo -e "${GREEN}Build completed: ${IMAGE_NAME}:${TIMESTAMP_TAG}${NC}"

if [ "$ACTION" = "build-only" ]; then
  echo ""
  echo -e "${GREEN}Done! Image ready: ${IMAGE_NAME}:${TIMESTAMP_TAG}${NC}"
  echo -e "${YELLOW}To install: cloudron install --image ${IMAGE_NAME}:${TIMESTAMP_TAG}${NC}"
  echo -e "${YELLOW}To update:  cloudron update --image ${IMAGE_NAME}:${TIMESTAMP_TAG}${NC}"
  exit 0
fi

# -------------------------------------------------------------------
# Deploy to Cloudron
# -------------------------------------------------------------------
echo ""
if [ "$ACTION" = "install" ]; then
  echo -e "${GREEN}Installing app on Cloudron (my.sinesys.online)...${NC}"
  echo -e "${YELLOW}You will be prompted for the subdomain.${NC}"
  cloudron install --image "${IMAGE_NAME}:${TIMESTAMP_TAG}"
elif [ "$ACTION" = "update" ]; then
  echo -e "${GREEN}Updating app on Cloudron...${NC}"
  cloudron update --image "${IMAGE_NAME}:${TIMESTAMP_TAG}"
fi

echo ""
echo -e "${GREEN}=== Deploy completed! ===${NC}"
