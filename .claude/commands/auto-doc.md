---
description: Comprehensive automatic documentation updater with intelligent code analysis
allowed-tools: ["Task", "Bash", "Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "TodoWrite"]
argument-hint: "[options: --preview, --verbose, --focus=README|CLAUDE|API|ALL]"
---

# Automatic Documentation Updater

I'll comprehensively analyze your codebase and update all documentation to reflect the current state of your project.

## Documentation Update Process

### Phase 1: Code Analysis
I'll use the Task tool to perform deep code analysis:

```
Analyzing the codebase for:
- New features and functionality
- Modified APIs and interfaces  
- Dependency changes
- Configuration updates
- Architectural changes
- Breaking changes
- Security considerations
```

### Phase 2: Documentation Targets

#### Primary Documentation Files:
1. **README.md**
   - Project description and purpose
   - Installation instructions
   - Usage examples
   - Features list
   - Configuration options
   - Troubleshooting

2. **CLAUDE.md** 
   - Development patterns and conventions
   - Code style guidelines
   - Architecture decisions
   - Testing strategies
   - Performance considerations
   - Security notes

3. **API Documentation**
   - Endpoint definitions
   - Request/response formats
   - Authentication details
   - Error codes
   - Rate limiting

4. **Package Files**
   - package.json dependencies
   - requirements.txt (Python)
   - Gemfile (Ruby)
   - go.mod (Go)

#### Secondary Documentation:
- CONTRIBUTING.md
- CHANGELOG.md
- docs/ directory
- Wiki pages
- Code comments
- JSDoc/TypeDoc

### Phase 3: Intelligent Updates

The system will:
1. **Detect Patterns** - Identify coding patterns and update CLAUDE.md
2. **Extract Features** - Find new functionality and update README
3. **API Analysis** - Document API changes automatically
4. **Dependency Tracking** - Update installation instructions
5. **Example Generation** - Create working code examples
6. **Cross-Reference** - Ensure consistency across all docs

### Phase 4: Validation
- Verify all code examples work
- Check markdown formatting
- Validate links
- Ensure completeness

## Starting Documentation Update...

Parsing arguments: $ARGUMENTS

Let me begin the comprehensive documentation update process...