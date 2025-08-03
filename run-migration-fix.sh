#!/bin/bash

# Voice Memory Migration Fix Script
# Cross-platform script to apply critical database migrations
# Supports Windows, macOS, and Linux with appropriate fallbacks

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

# Enhanced logging with timestamps
LOG_FILE="migration-fix-$(date +%Y%m%d-%H%M%S).log"
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

# Enhanced error recovery functions
recover_from_env_error() {
    echo ""
    log_error "Environment file issues detected"
    log_info "Attempting recovery strategies..."
    
    # Strategy 1: Look for alternative env files
    local env_files=(".env" ".env.development" ".env.development.local")
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            log_info "Found alternative environment file: $env_file"
            log_warning "Consider copying to .env.local: cp $env_file .env.local"
        fi
    done
    
    # Strategy 2: Check if variables are already in environment
    local required_vars=("NEXT_PUBLIC_SUPABASE_URL" "SUPABASE_SERVICE_KEY")
    local env_vars_present=0
    
    for var in "${required_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            ((env_vars_present++))
            log_success "Environment variable $var is already set"
        fi
    done
    
    if [[ $env_vars_present -eq ${#required_vars[@]} ]]; then
        log_info "All required environment variables are set, proceeding without .env.local"
        return 0
    fi
    
    # Strategy 3: Provide setup instructions
    show_env_file_help
    return 1
}

show_env_file_help() {
    echo ""
    log_info "Environment file setup required:"
    echo "Create a .env.local file in the project root with:"
    echo ""
    echo "# Required for migration"
    echo "NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url"
    echo "SUPABASE_SERVICE_KEY=your-supabase-service-role-key"
    echo ""
    echo "# Optional but recommended"
    echo "OPENAI_API_KEY=your-openai-api-key"
    echo "CRON_SECRET=your-cron-secret"
    echo ""
    
    if is_windows; then
        echo "Windows alternatives:"
        echo "1. Create .env.local using notepad: notepad .env.local"
        echo "2. Use PowerShell: New-Item .env.local -ItemType File"
        echo "3. Set environment variables via Control Panel"
        echo "4. Use the Windows batch alternative: run-migration-fix.bat"
    fi
    
    echo ""
    echo "You can find these values in your Supabase project dashboard:"
    echo "- URL: Project Settings > API > Project URL"
    echo "- Service Key: Project Settings > API > Service Role Key"
}

# Create Windows batch file alternative
create_windows_alternative() {
    if is_windows; then
        cat > run-migration-fix.bat << 'EOF'
@echo off
REM Voice Memory Migration Fix - Windows Batch Version

echo Voice Memory Migration Fix (Windows)
echo ====================================

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

REM Check for environment file
if not exist .env.local (
    echo Warning: .env.local file not found
    echo Looking for alternative environment files...
    
    if exist .env (
        echo Found .env file, you may want to copy it:
        echo copy .env .env.local
        pause
    ) else (
        echo No environment files found.
        echo Please create .env.local with your Supabase credentials.
        echo See the README or run the shell script for detailed instructions.
        pause
        exit /b 1
    )
)

REM Load environment variables from .env.local
echo Loading environment variables...
for /f "usebackq tokens=1,2 delims==" %%a in (".env.local") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" set %%a=%%b
)

REM Check critical environment variables
if "%NEXT_PUBLIC_SUPABASE_URL%"=="" (
    echo Error: Missing NEXT_PUBLIC_SUPABASE_URL in .env.local
    goto :show_env_help
)

if "%SUPABASE_SERVICE_KEY%"=="" (
    echo Error: Missing SUPABASE_SERVICE_KEY in .env.local
    goto :show_env_help
)

echo Running migration fix...
npx tsx scripts/immediate-migration-fix.ts

if %errorlevel% equ 0 (
    echo.
    echo Migration fix completed successfully!
) else (
    echo.
    echo Migration fix encountered issues. Check the output above.
)

pause
exit /b %errorlevel%

:show_env_help
echo.
echo Please add the missing environment variables to .env.local:
echo NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
echo SUPABASE_SERVICE_KEY=your-service-key
echo.
echo You can find these in your Supabase project dashboard.
pause
exit /b 1
EOF
        log_success "Created Windows batch alternative: run-migration-fix.bat"
    fi
}

# Enhanced pre-flight checks
preflight_checks() {
    local checks_passed=0
    local checks_total=4
    
    log_info "Running pre-flight checks..."
    
    # Check 1: Operating system
    if [[ "$OS" != "Unknown" ]]; then
        log_success "Operating system: $OS"
        ((checks_passed++))
    else
        log_warning "Unknown operating system, proceeding with caution"
    fi
    
    # Check 2: Project directory
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
        show_node_installation_help
        return 1
    fi
    
    # Check 4: TypeScript execution capability
    if has_command npx; then
        log_success "npx available for TypeScript execution"
        ((checks_passed++))
    else
        log_warning "npx not found, checking for alternative..."
        if has_command tsx; then
            log_info "tsx available as alternative"
            ((checks_passed++))
        else
            log_error "No TypeScript execution method available"
            return 1
        fi
    fi
    
    log_info "Pre-flight checks: $checks_passed/$checks_total passed"
    
    if [[ $checks_passed -ge 3 ]]; then
        return 0
    else
        log_error "Too many pre-flight checks failed"
        return 1
    fi
}

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

# Environment file loading with error recovery
load_environment_file() {
    # Try to find and load environment file
    local env_files=(".env.local" ".env" ".env.development")
    local env_file_found=""
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            env_file_found="$env_file"
            break
        fi
    done
    
    if [[ -z "$env_file_found" ]]; then
        log_warning "No environment file found"
        if ! recover_from_env_error; then
            return 1
        fi
    else
        log_info "Loading environment variables from $env_file_found"
        
        # Load environment variables safely
        while IFS='=' read -r key value || [[ -n "$key" ]]; do
            # Skip comments and empty lines
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z $key ]] && continue
            
            # Remove quotes if present
            value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
            
            # Only set if not already in environment
            if [[ -z "${!key:-}" ]]; then
                export "$key=$value"
            fi
        done < "$env_file_found"
        
        log_success "Environment variables loaded from $env_file_found"
    fi
    
    return 0
}

# Validate critical environment variables
validate_environment() {
    local required_vars=("NEXT_PUBLIC_SUPABASE_URL" "SUPABASE_SERVICE_KEY")
    local missing_vars=()
    
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
        
        show_env_file_help
        return 1
    fi
    
    log_success "All required environment variables present"
    return 0
}

# Safe execution with retries
safe_execute() {
    local command="$1"
    local description="$2"
    local max_retries="${3:-2}"
    local retry_delay="${4:-3}"
    
    for ((i=1; i<=max_retries; i++)); do
        log_info "Executing: $description (attempt $i/$max_retries)"
        
        if eval "$command" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "$description completed successfully"
            return 0
        else
            local exit_code=$?
            log_warning "$description failed (attempt $i/$max_retries) - Exit code: $exit_code"
            
            if [[ $i -lt $max_retries ]]; then
                log_info "Retrying in $retry_delay seconds..."
                sleep "$retry_delay"
            else
                log_error "$description failed after $max_retries attempts"
                return $exit_code
            fi
        fi
    done
}

# Main execution function
main() {
    local start_time=$(date)
    
    # Header
    log "${BOLD}${BLUE}🔧 Voice Memory Migration Fix${NC}"
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
    
    # Load environment variables
    log_info "Step 1: Loading environment variables..."
    if ! load_environment_file; then
        exit 1
    fi
    echo ""
    
    # Validate environment
    log_info "Step 2: Validating environment..."
    if ! validate_environment; then
        exit 1
    fi
    echo ""
    
    # Execute migration fix
    log_info "Step 3: Running migration fix script..."
    if safe_execute "npx tsx scripts/immediate-migration-fix.ts" "Migration fix execution" 2 5; then
        log_success "Migration fix completed successfully"
        exit_code=0
    else
        log_error "Migration fix failed"
        exit_code=1
    fi
    echo ""
    
    # Summary
    local end_time=$(date)
    local duration=$(($(date +%s) - SCRIPT_START_TIME))
    
    log "${BOLD}${BLUE}📊 Migration Fix Summary${NC}"
    log "${BLUE}========================${NC}"
    echo "Platform: $OS"
    echo "Duration: ${duration}s"
    echo "Started: $start_time"
    echo "Completed: $end_time"
    echo ""
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "🎉 MIGRATION FIX SUCCESSFUL!"
        log "${GREEN}✨ Database migrations have been applied.${NC}"
        echo ""
        log "${BLUE}Next steps:${NC}"
        echo "1. Test the application to ensure migrations work correctly"
        echo "2. Run emergency fix if needed: ./run-emergency-fix.sh"
        echo "3. Check application logs for any issues"
    else
        log_error "❌ MIGRATION FIX INCOMPLETE"
        echo ""
        log "${BLUE}Troubleshooting:${NC}"
        echo "1. Check the log file for detailed error information: $LOG_FILE"
        echo "2. Verify your Supabase credentials are correct"
        echo "3. Ensure your Supabase project is accessible"
        echo "4. Try running the migration script directly:"
        echo "   npx tsx scripts/immediate-migration-fix.ts"
    fi
    
    echo ""
    log "${BLUE}Full details available in: $LOG_FILE${NC}"
    
    # Platform-specific additional help
    if is_windows; then
        echo ""
        log_info "Windows users: run-migration-fix.bat is also available"
    fi
    
    exit $exit_code
}

# Cleanup function
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