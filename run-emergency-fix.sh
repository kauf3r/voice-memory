#!/bin/bash

# Voice Memory Emergency Fix Script
# Orchestrates the complete emergency fix process for Vercel deployment
# Cross-platform compatible with fallbacks for different environments

# Strict error handling with better recovery
set -euo pipefail
IFS=$'\n\t'

# Detect operating system and shell capabilities
detect_environment() {
    case "$(uname -s)" in
        Linux*)     OS=Linux;;
        Darwin*)    OS=Mac;;
        CYGWIN*)    OS=Cygwin;;
        MINGW*)     OS=MinGW;;
        MSYS*)      OS=MSYS;;
        *)          OS="Unknown";;
    esac

    # Check if we're in a proper terminal for colors
    if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
        COLORS_SUPPORTED=true
        TERM_COLS=$(tput cols 2>/dev/null || echo 80)
    else
        COLORS_SUPPORTED=false
        TERM_COLS=80
    fi
}

# Initialize environment
detect_environment

# Colors with fallbacks for terminals that don't support them
if [[ "$COLORS_SUPPORTED" == true ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
else
    # Fallback to no colors for unsupported terminals
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    BOLD=''
    NC=''
fi

# Cross-platform compatibility functions
is_windows() {
    [[ "$OS" == "Cygwin" || "$OS" == "MinGW" || "$OS" == "MSYS" ]]
}

has_command() {
    command -v "$1" >/dev/null 2>&1
}

# Enhanced logging with timestamps and levels
LOG_FILE="emergency-fix-$(date +%Y%m%d-%H%M%S).log"
SCRIPT_START_TIME=$(date +%s)

log() {
    local level="${2:-INFO}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] [$level] $1"
    
    # Output to console with colors
    echo -e "$1" 
    
    # Output to log file without colors
    echo "$message" >> "$LOG_FILE"
}

log_error() {
    log "${RED}❌ $1${NC}" "ERROR"
}

log_success() {
    log "${GREEN}✅ $1${NC}" "SUCCESS"
}

log_warning() {
    log "${YELLOW}⚠️  $1${NC}" "WARNING"
}

log_info() {
    log "${BLUE}ℹ️  $1${NC}" "INFO"
}

# Error recovery functions
recover_from_error() {
    local error_type="$1"
    local error_message="$2"
    
    log_error "Encountered error: $error_message"
    
    case "$error_type" in
        "missing_deps")
            log_info "Attempting to install missing dependencies..."
            attempt_dependency_installation
            ;;
        "env_vars")
            log_info "Environment variable issues detected"
            show_env_setup_help
            return 1
            ;;
        "network")
            log_warning "Network issue detected, retrying in 5 seconds..."
            sleep 5
            ;;
        *)
            log_warning "Unknown error type, attempting generic recovery..."
            ;;
    esac
}

# Attempt to install dependencies based on the platform
attempt_dependency_installation() {
    if has_command npm; then
        log_info "Installing Node.js dependencies..."
        if npm install; then
            log_success "Dependencies installed successfully"
        else
            log_error "Failed to install dependencies"
            show_manual_dependency_help
            return 1
        fi
    else
        log_error "npm not found"
        show_node_installation_help
        return 1
    fi
}

# Show help for manual dependency installation
show_manual_dependency_help() {
    log_info "Manual dependency installation required:"
    echo "1. Ensure Node.js (v18+) is installed"
    echo "2. Run: npm install"
    echo "3. Re-run this script"
    
    if is_windows; then
        echo ""
        echo "Windows users can also use:"
        echo "- run-emergency-fix.bat (if available)"
        echo "- PowerShell: ./scripts/emergency-fix.ps1"
    fi
}

# Show Node.js installation help
show_node_installation_help() {
    echo ""
    log_info "Node.js installation required:"
    case "$OS" in
        "Mac")
            echo "• Install via Homebrew: brew install node"
            echo "• Or download from: https://nodejs.org/"
            ;;
        "Linux")
            echo "• Ubuntu/Debian: sudo apt install nodejs npm"
            echo "• CentOS/RHEL: sudo yum install nodejs npm"
            echo "• Or use Node Version Manager: https://github.com/nvm-sh/nvm"
            ;;
        *)
            echo "• Download from: https://nodejs.org/"
            echo "• Or use Node Version Manager"
            if is_windows; then
                echo "• Windows users: Consider using Windows Subsystem for Linux (WSL)"
            fi
            ;;
    esac
}

# Show environment setup help
show_env_setup_help() {
    echo ""
    log_info "Environment variable setup required:"
    echo "Create a .env.local file with:"
    echo "NEXT_PUBLIC_SUPABASE_URL=your-supabase-url"
    echo "SUPABASE_SERVICE_KEY=your-service-key"
    echo "OPENAI_API_KEY=your-openai-key"
    echo "CRON_SECRET=your-cron-secret"
    echo ""
    
    if is_windows; then
        echo "Windows alternatives:"
        echo "1. Use PowerShell: \$env:VAR_NAME='value'"
        echo "2. Use run-emergency-fix.bat with environment file"
        echo "3. Set via Control Panel ^> System ^> Environment Variables"
    fi
}

# Create Windows batch file alternative
create_windows_alternative() {
    if is_windows; then
        cat > run-emergency-fix.bat << 'EOF'
@echo off
REM Voice Memory Emergency Fix - Windows Batch Version

echo Voice Memory Emergency Fix (Windows)
echo =====================================

REM Check if Node.js is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js not found
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist package.json (
    echo Error: Not in project root directory
    echo Please run this script from the voice-memory directory
    pause
    exit /b 1
)

REM Load environment variables from .env.local if it exists
if exist .env.local (
    echo Loading environment variables...
    for /f "usebackq tokens=1,2 delims==" %%a in (".env.local") do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" set %%a=%%b
    )
)

REM Check required environment variables
if "%NEXT_PUBLIC_SUPABASE_URL%"=="" (
    echo Error: Missing NEXT_PUBLIC_SUPABASE_URL
    goto :show_env_help
)

echo Running emergency fix...
npx tsx scripts/emergency-vercel-fix.ts

if %errorlevel% equ 0 (
    echo.
    echo Emergency fix completed successfully!
) else (
    echo.
    echo Emergency fix encountered issues. Check the output above.
)

pause
exit /b %errorlevel%

:show_env_help
echo.
echo Please set the required environment variables:
echo - NEXT_PUBLIC_SUPABASE_URL
echo - SUPABASE_SERVICE_KEY  
echo - OPENAI_API_KEY
echo - CRON_SECRET
echo.
echo You can either:
echo 1. Create a .env.local file with these variables
echo 2. Set them via Control Panel ^> System ^> Environment Variables
echo 3. Set them in this session: set VAR_NAME=value
pause
exit /b 1
EOF
        log_success "Created Windows batch alternative: run-emergency-fix.bat"
    fi
}

# Enhanced pre-flight checks
preflight_checks() {
    local checks_passed=0
    local checks_total=5
    
    log_info "Running pre-flight checks..."
    
    # Check 1: Operating system compatibility
    if [[ "$OS" != "Unknown" ]]; then
        log_success "Operating system: $OS"
        ((checks_passed++))
    else
        log_warning "Unknown operating system, proceeding with caution"
    fi
    
    # Check 2: Directory check
    if [[ -f "package.json" ]]; then
        log_success "Project root directory confirmed"
        ((checks_passed++))
    else
        log_error "Not in project root directory"
        echo "Please run this script from the voice-memory directory"
        return 1
    fi
    
    # Check 3: Node.js availability
    if has_command node; then
        local node_version=$(node --version 2>/dev/null || echo "unknown")
        log_success "Node.js available: $node_version"
        ((checks_passed++))
    else
        log_error "Node.js not found"
        recover_from_error "missing_deps" "Node.js not installed"
        return 1
    fi
    
    # Check 4: npm/package manager
    if has_command npm; then
        log_success "npm package manager available"
        ((checks_passed++))
    else
        log_warning "npm not found, looking for alternatives..."
        if has_command yarn; then
            log_info "Using yarn as package manager"
            ((checks_passed++))
        elif has_command pnpm; then
            log_info "Using pnpm as package manager"
            ((checks_passed++))
        else
            log_error "No suitable package manager found"
            return 1
        fi
    fi
    
    # Check 5: Dependencies
    if [[ -d "node_modules" ]] && [[ -f "node_modules/.package-lock.json" || -f "node_modules/.yarn-integrity" ]]; then
        log_success "Dependencies installed"
        ((checks_passed++))
    else
        log_warning "Dependencies not found, will attempt installation"
    fi
    
    log_info "Pre-flight checks: $checks_passed/$checks_total passed"
    
    if [[ $checks_passed -ge 3 ]]; then
        return 0
    else
        log_error "Too many pre-flight checks failed"
        return 1
    fi
}

# Enhanced environment variable checking with recovery
check_environment_variables() {
    local missing_vars=()
    local required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "SUPABASE_SERVICE_KEY"
        "OPENAI_API_KEY"
        "CRON_SECRET"
    )
    
    # Try to load from .env.local if it exists
    if [[ -f ".env.local" ]]; then
        log_info "Loading environment variables from .env.local"
        # Only export variables that aren't already set
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z $key ]] && continue
            
            # Remove quotes if present
            value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
            
            # Only set if not already in environment
            if [[ -z "${!key:-}" ]]; then
                export "$key=$value"
            fi
        done < .env.local
    fi
    
    # Check each required variable
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "   - $var"
        done
        
        recover_from_error "env_vars" "Missing environment variables"
        return 1
    fi
    
    log_success "All environment variables present"
    return 0
}

# Safe execution wrapper with retries
safe_execute() {
    local command="$1"
    local description="$2"
    local max_retries="${3:-1}"
    local retry_delay="${4:-5}"
    
    for ((i=1; i<=max_retries; i++)); do
        log_info "Executing: $description (attempt $i/$max_retries)"
        
        if eval "$command" >> "$LOG_FILE" 2>&1; then
            log_success "$description completed successfully"
            return 0
        else
            local exit_code=$?
            log_warning "$description failed (attempt $i/$max_retries)"
            
            if [[ $i -lt $max_retries ]]; then
                log_info "Retrying in $retry_delay seconds..."
                sleep "$retry_delay"
                
                # Check if it's a network issue and recover
                if [[ $exit_code -eq 1 || $exit_code -eq 7 ]]; then
                    recover_from_error "network" "Possible network issue"
                fi
            else
                log_error "$description failed after $max_retries attempts"
                return $exit_code
            fi
        fi
    done
}

# Main execution flow with improved error handling
main() {
    local start_time=$(date)
    
    # Header with platform info
    log "${BOLD}${BLUE}🚨 Voice Memory Emergency Fix${NC}"
    log "${BLUE}==============================${NC}"
    log "Platform: $OS"
    log "Started: $start_time"
    log "Log file: $LOG_FILE"
    echo ""
    
    # Create Windows alternative if needed
    if is_windows; then
        log_info "Creating Windows batch alternative..."
        create_windows_alternative
        echo ""
    fi
    
    # Pre-flight checks
    if ! preflight_checks; then
        log_error "Pre-flight checks failed"
        exit 1
    fi
    echo ""
    
    # Environment variable checks
    log_info "Step 1: Checking environment variables..."
    if ! check_environment_variables; then
        exit 1
    fi
    echo ""
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Step 2: Installing dependencies..."
        if ! safe_execute "npm install" "Dependency installation" 2 10; then
            log_error "Failed to install dependencies"
            show_manual_dependency_help
            exit 1
        fi
    else
        log_success "Dependencies already installed"
    fi
    echo ""
    
    # Apply migration with retries
    log_info "Step 3: Applying critical migration..."
    if safe_execute "npx tsx scripts/quick-migration-apply.ts" "Migration application" 2 5; then
        log_success "Migration application successful"
    else
        log_warning "Migration application failed"
        log_info "You may need to apply the migration manually via Supabase dashboard"
        log_info "See docs/VERCEL_EMERGENCY_GUIDE.md for manual steps"
    fi
    echo ""
    
    # Test deployment
    log_info "Step 4: Testing Vercel deployment..."
    local tests_passed=false
    if safe_execute "npx tsx scripts/test-vercel-deployment.ts" "Deployment testing" 1; then
        log_success "Deployment tests successful"
        tests_passed=true
    else
        log_warning "Some deployment tests failed"
    fi
    echo ""
    
    # Run emergency fix if needed
    if [[ "$tests_passed" != true ]]; then
        log_info "Step 5: Running full emergency fix..."
        if safe_execute "npx tsx scripts/emergency-vercel-fix.ts" "Emergency fix" 1; then
            log_success "Emergency fix completed"
        else
            log_warning "Emergency fix had issues"
            log_info "Check the log file for details: $LOG_FILE"
        fi
        echo ""
    fi
    
    # Final verification with enhanced checks
    log_info "Step 6: Final verification..."
    
    # Health check with multiple URLs
    local health_checked=false
    local health_urls=()
    
    if [[ -n "${VERCEL_URL:-}" ]]; then
        health_urls+=("https://$VERCEL_URL/api/health")
    fi
    
    if [[ -n "${NEXT_PUBLIC_VERCEL_URL:-}" ]]; then
        health_urls+=("https://$NEXT_PUBLIC_VERCEL_URL/api/health")
    fi
    
    health_urls+=("http://localhost:3000/api/health")
    
    if has_command curl; then
        for url in "${health_urls[@]}"; do
            log_info "Testing health endpoint: $url"
            if curl -s --max-time 10 "$url" > /dev/null 2>&1; then
                log_success "Health endpoint responding: $url"
                health_checked=true
                break
            else
                log_warning "Health endpoint not accessible: $url"
            fi
        done
        
        if [[ "$health_checked" != true ]]; then
            log_warning "No health endpoints accessible"
        fi
    else
        log_warning "curl not available for health check"
    fi
    
    # Database connection check
    log_info "Checking database connection..."
    local db_check_script="
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
client.from('voice_notes').select('id').limit(1).then(({error}) => {
  if (error) throw error;
  console.log('Database connection: OK');
}).catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});
"
    
    if safe_execute "npx tsx -e \"$db_check_script\"" "Database connection check" 2; then
        log_success "Database connection verified"
    else
        log_error "Database connection failed"
    fi
    
    echo ""
    
    # Generate comprehensive summary
    generate_final_summary
}

# Enhanced summary generation
generate_final_summary() {
    local end_time=$(date)
    local duration=$(($(date +%s) - SCRIPT_START_TIME))
    
    log "${BOLD}${BLUE}📊 Emergency Fix Summary${NC}"
    log "${BLUE}========================${NC}"
    
    # Count log entries more accurately
    local success_count=$(grep -c "✅" "$LOG_FILE" 2>/dev/null || echo 0)
    local error_count=$(grep -c "❌" "$LOG_FILE" 2>/dev/null || echo 0)
    local warning_count=$(grep -c "⚠️" "$LOG_FILE" 2>/dev/null || echo 0)
    
    echo "Platform: $OS"
    echo "Duration: ${duration}s"
    echo "✅ Successes: $success_count"
    echo "❌ Errors: $error_count"
    echo "⚠️  Warnings: $warning_count"
    echo ""
    
    # Determine overall status
    if [[ $error_count -eq 0 ]]; then
        log_success "🎉 EMERGENCY FIX SUCCESSFUL!"
        log "${GREEN}✨ Your Vercel deployment should now be processing notes.${NC}"
        echo ""
        log "${BLUE}Next steps:${NC}"
        echo "1. Upload a test audio file to verify processing"
        echo "2. Monitor the processing for a few minutes"
        echo "3. Check Vercel function logs for any issues"
        exit_code=0
    elif [[ $error_count -le 2 ]]; then
        log_warning "⚠️  PARTIAL SUCCESS - Minor issues remain"
        log "${YELLOW}🔧 Review the errors above and the log file: $LOG_FILE${NC}"
        echo ""
        log "${BLUE}Recommended actions:${NC}"
        echo "1. Check docs/VERCEL_EMERGENCY_GUIDE.md"
        echo "2. Run individual fix scripts as needed"
        echo "3. Consider manual migration via Supabase dashboard"
        exit_code=1
    else
        log_error "❌ EMERGENCY FIX INCOMPLETE"
        log "${RED}🚨 Multiple critical issues detected${NC}"
        echo ""
        log "${BLUE}Escalation required:${NC}"
        echo "1. Review the full log file: $LOG_FILE"
        echo "2. Follow docs/VERCEL_EMERGENCY_GUIDE.md"
        echo "3. Check Vercel and Supabase service status"
        echo "4. Consider manual intervention"
        exit_code=2
    fi
    
    echo ""
    log "${BLUE}Full details available in: $LOG_FILE${NC}"
    log "${BLUE}Emergency fix completed at: $end_time${NC}"
    
    # Platform-specific additional help
    if is_windows; then
        echo ""
        log_info "Windows users: run-emergency-fix.bat is also available"
    fi
    
    exit $exit_code
}

# Trap for cleanup on script exit
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log_error "Script exited with error code $exit_code"
        log_info "Log file saved: $LOG_FILE"
    fi
}

trap cleanup EXIT

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 