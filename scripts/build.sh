#!/bin/bash
# =============================================================================
# Build Script for EcoSquad
# Works on Linux, macOS, and Windows (with WSL/Git Bash)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# Parse arguments
BUILD_TARGET="${1:-all}"
ENVIRONMENT="${2:-${ENVIRONMENT:-dev}}"

export ENVIRONMENT

log_info "Starting build for target: $BUILD_TARGET"
log_info "Environment: $ENVIRONMENT"
log_info "Project root: $PROJECT_ROOT"

# Validate environment
if [ -f ".env" ]; then
    log_info "Loading environment from .env file..."
    set -a
    source .env
    set +a
else
    log_warn ".env file not found. Using existing environment variables."
fi

# Run environment validation
log_info "Validating environment variables..."
node scripts/validate-env.js || exit 1

# Build functions
build_frontend() {
    log_info "Building Frontend (Next.js)..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm not found. Please install Node.js."
        exit 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm ci
    fi
    
    # Build
    npm run build
    
    log_success "Frontend build completed!"
}

build_backend() {
    log_info "Building Backend (Lambda functions)..."
    
    cd "$PROJECT_ROOT/backend"
    
    if [ ! -d "node_modules" ]; then
        log_info "Installing backend dependencies..."
        npm ci
    fi
    
    # Clean dist directory
    rm -rf dist
    
    # Compile TypeScript
    npm run build
    
    log_success "Backend build completed!"
    
    cd "$PROJECT_ROOT"
}

build_infra() {
    log_info "Building Infrastructure (CDK)..."
    
    cd "$PROJECT_ROOT/infra"
    
    if [ ! -d "node_modules" ]; then
        log_info "Installing infrastructure dependencies..."
        npm ci
    fi
    
    # Clean dist directory
    rm -rf dist
    
    # Compile TypeScript
    npm run build
    
    # Synthesize CloudFormation
    log_info "Synthesizing CloudFormation templates..."
    npx cdk synth > /dev/null 2>&1 || npx cdk synth
    
    log_success "Infrastructure build completed!"
    
    cd "$PROJECT_ROOT"
}

# Main build logic
case "$BUILD_TARGET" in
    frontend|fe)
        build_frontend
        ;;
    backend|be)
        build_backend
        ;;
    infra|infrastructure)
        build_infra
        ;;
    all)
        build_backend
        build_infra
        build_frontend
        log_success "All builds completed successfully!"
        ;;
    *)
        log_error "Unknown build target: $BUILD_TARGET"
        echo "Usage: $0 [frontend|backend|infra|all] [environment]"
        exit 1
        ;;
esac

exit 0
