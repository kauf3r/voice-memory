# Shell Script Improvements

This document describes the enhanced shell scripts in the Voice Memory project, which now include cross-platform compatibility, better error recovery, color fallbacks, and Windows alternatives.

## Overview

The shell scripts have been significantly improved with the following enhancements:

1. **Explicit `#!/bin/bash` shebang** for better compatibility
2. **Color code fallbacks** for terminals that don't support colors
3. **Enhanced error recovery** with automatic retry mechanisms
4. **Cross-platform compatibility** detection and handling
5. **Windows alternatives** with batch file generation

## Available Scripts

### 1. Emergency Fix Script (`run-emergency-fix.sh`)

A comprehensive script that orchestrates the complete emergency fix process for Vercel deployment issues.

**Features:**
- Automatic platform detection (Linux, macOS, Windows)
- Color output with fallbacks for unsupported terminals
- Detailed logging with timestamps
- Retry mechanisms for network issues
- Environment variable auto-loading from `.env.local`
- Health checks and database connection verification
- Comprehensive error recovery

**Usage:**
```bash
# Make executable (if needed)
chmod +x run-emergency-fix.sh

# Run the script
./run-emergency-fix.sh
```

### 2. Migration Fix Script (`run-migration-fix.sh`)

A focused script for applying critical database migrations with enhanced error handling.

**Features:**
- Multi-environment file detection (`.env.local`, `.env`, `.env.development`)
- Safe environment variable loading
- TypeScript execution capability detection
- Comprehensive validation and recovery
- Windows batch file alternative generation

**Usage:**
```bash
# Make executable (if needed)
chmod +x run-migration-fix.sh

# Run the script
./run-migration-fix.sh
```

## Cross-Platform Compatibility

### Platform Detection

Both scripts automatically detect the operating system:
- **Linux** - Full support with package manager detection
- **macOS** - Native support with Homebrew integration
- **Windows** - Cygwin, MinGW, MSYS support + batch alternatives

### Terminal Compatibility

The scripts detect terminal capabilities:
- **Color support** - Automatically detected using `tput`
- **Terminal width** - Adaptive formatting
- **Fallback mode** - Plain text for unsupported terminals

### Package Manager Support

Multiple package managers are supported:
- **npm** (primary)
- **yarn** (alternative)
- **pnpm** (alternative)

## Windows Support

### Automatic Batch File Generation

When run on Windows systems, the scripts automatically generate `.bat` alternatives:

- `run-emergency-fix.bat`
- `run-migration-fix.bat`

These batch files provide:
- Windows-native environment variable handling
- Error checking and validation
- User-friendly prompts and pauses
- Help text and troubleshooting guidance

### Windows Usage Options

1. **Windows Subsystem for Linux (WSL)** - Recommended
   ```bash
   # In WSL terminal
   ./run-emergency-fix.sh
   ```

2. **Git Bash / MinGW**
   ```bash
   # In Git Bash
   ./run-emergency-fix.sh
   ```

3. **Command Prompt with batch files**
   ```cmd
   REM Run the batch alternative
   run-emergency-fix.bat
   ```

4. **PowerShell**
   ```powershell
   # Set execution policy if needed
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   
   # Run via bash (if available)
   bash ./run-emergency-fix.sh
   ```

## Error Recovery Features

### Automatic Dependency Installation

The scripts detect missing dependencies and attempt automatic recovery:

```bash
# Detects missing node_modules and installs
npm install

# Falls back to alternative package managers
yarn install  # or pnpm install
```

### Environment Variable Recovery

Multiple strategies for handling missing environment variables:

1. **Auto-detection** of alternative `.env` files
2. **Environment scanning** for already-set variables
3. **Interactive help** with platform-specific instructions
4. **Fallback mechanisms** for partial configurations

### Network Issue Handling

Automatic retry mechanisms for network-related failures:
- Configurable retry counts and delays
- Exponential backoff for repeated failures
- Network connectivity detection
- Timeout handling for health checks

### Validation and Pre-flight Checks

Comprehensive validation before execution:
- Operating system compatibility
- Node.js version verification
- Package manager availability
- Project directory validation
- Environment variable presence

## Logging and Monitoring

### Enhanced Logging

All scripts provide detailed logging:
- **Timestamped entries** for troubleshooting
- **Log levels** (INFO, WARNING, ERROR, SUCCESS)
- **Persistent log files** with unique names
- **Real-time console output** with colors

### Log File Locations

Log files are automatically created with timestamps:
- `emergency-fix-YYYYMMDD-HHMMSS.log`
- `migration-fix-YYYYMMDD-HHMMSS.log`

### Monitoring Features

- Progress tracking with step-by-step reporting
- Success/failure counting
- Duration tracking
- Platform information recording
- Exit code handling for automation

## Configuration Options

### Environment Variables

The scripts automatically detect and load from multiple sources:

1. **Command line environment** (highest priority)
2. **`.env.local`** (recommended)
3. **`.env`** (fallback)
4. **`.env.development`** (development fallback)

### Required Variables

**Emergency Fix Script:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`
- `CRON_SECRET`

**Migration Fix Script:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Optional Variables

- `VERCEL_URL` - For health check endpoints
- `NEXT_PUBLIC_VERCEL_URL` - Alternative health check URL

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   chmod +x run-emergency-fix.sh run-migration-fix.sh
   ```

2. **Node.js Not Found**
   - **macOS:** `brew install node`
   - **Ubuntu/Debian:** `sudo apt install nodejs npm`
   - **Windows:** Download from [nodejs.org](https://nodejs.org/)

3. **Environment Variables Missing**
   - Check `.env.local` file exists
   - Verify variable names and values
   - Use the help output for setup instructions

4. **Network Issues**
   - Scripts automatically retry failed network operations
   - Check firewall and proxy settings
   - Verify Supabase and OpenAI service availability

### Windows-Specific Issues

1. **Script Won't Run**
   - Use WSL for best compatibility
   - Try Git Bash as alternative
   - Use the generated `.bat` files

2. **Environment Variables Not Loading**
   - Check `.env.local` format (no BOM, LF line endings)
   - Use the batch file alternatives
   - Set variables via Control Panel

3. **Permission Issues**
   - Run as Administrator if needed
   - Check antivirus software blocking execution
   - Use Windows Defender exclusions if necessary

## Advanced Usage

### Automation Integration

The scripts return appropriate exit codes for automation:
- `0` - Complete success
- `1` - Partial success with warnings
- `2` - Multiple failures requiring intervention

### CI/CD Integration

Example usage in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Emergency Fix
  run: |
    chmod +x run-emergency-fix.sh
    ./run-emergency-fix.sh
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

### Custom Configuration

Environment variables for customization:
- `MAX_RETRIES` - Override default retry counts
- `RETRY_DELAY` - Override default retry delays
- `LOG_LEVEL` - Control logging verbosity
- `FORCE_COLORS` - Force color output in non-TTY environments

## Security Considerations

### Environment Variable Handling

- Variables are loaded safely without shell injection
- Quotes are properly handled and stripped
- Comments and empty lines are ignored
- Variables are only set if not already present

### File Permissions

- Scripts check for appropriate permissions before execution
- Log files are created with secure permissions
- Temporary files are cleaned up on exit

### Network Security

- HTTPS is used for all external communications
- Timeouts prevent hanging connections
- Retry mechanisms include backoff to prevent abuse

## Performance Optimizations

### Parallel Execution

Where possible, operations are performed in parallel:
- Environment variable validation
- Pre-flight checks
- Health endpoint testing

### Caching

- Node.js dependency detection uses cached results
- Platform detection is performed once per execution
- Environment variables are loaded once and reused

### Resource Management

- Memory usage is minimized through efficient scripting
- Network connections include appropriate timeouts
- Cleanup functions ensure no resource leaks

## Contributing

### Adding New Features

When extending the scripts:
1. Maintain cross-platform compatibility
2. Add appropriate error handling and recovery
3. Include logging for all operations
4. Update both shell and batch versions
5. Test on multiple platforms

### Testing

Test the scripts on:
- Multiple Linux distributions
- macOS with different terminal applications
- Windows with WSL, Git Bash, and Command Prompt
- Various Node.js versions
- Different network conditions

### Code Style

Follow the established patterns:
- Use `log_*` functions for all output
- Include error recovery mechanisms
- Maintain consistent function naming
- Add comprehensive comments
- Use strict error handling (`set -euo pipefail`)

## Support

For issues with the shell scripts:

1. Check the generated log files for detailed error information
2. Verify your environment meets the requirements
3. Try the platform-specific alternatives (batch files for Windows)
4. Review the troubleshooting section above
5. Check the main project documentation for related issues

The improved shell scripts provide robust, cross-platform automation for the Voice Memory project while maintaining ease of use and comprehensive error handling. 