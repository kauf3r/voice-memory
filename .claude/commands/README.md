# Claude Code Documentation Commands

This directory contains custom slash commands for automatically updating documentation based on code changes.

## Available Commands

### `/update-docs`
Basic documentation updater that analyzes code changes and updates README, CLAUDE.md, and other docs.

**Usage:**
```
/update-docs                    # Update all documentation
/update-docs src/api/routes.ts  # Update docs related to specific file
```

### `/smart-docs`
Intelligent documentation system with advanced analysis and consistency checking.

**Usage:**
```
/smart-docs                     # Full documentation update
/smart-docs --preview           # Preview changes without writing
/smart-docs --aggressive        # Include all possible updates
/smart-docs --specific=file.ts  # Focus on specific file
```

### `/auto-doc`
Comprehensive documentation updater with deep code analysis using AI agents.

**Usage:**
```
/auto-doc                       # Complete documentation sync
/auto-doc --preview             # Preview mode
/auto-doc --verbose             # Detailed output
/auto-doc --focus=README        # Update only README
/auto-doc --focus=CLAUDE        # Update only CLAUDE.md
/auto-doc --focus=API           # Update only API docs
```

### `/docs-sync`
Most advanced documentation synchronizer with multi-agent support and quality assurance.

**Usage:**
```
/docs-sync                      # Full sync with all features
/docs-sync --dry-run            # Preview without changes
/docs-sync --focus=README       # Target specific docs
/docs-sync --include-examples   # Generate code examples
/docs-sync --git-commit         # Auto-commit changes
```

## Features

### 🔍 Automatic Detection
- New features and functionality
- API changes and additions
- Dependency updates
- Configuration changes
- Breaking changes
- Security updates

### 📝 Documentation Updates
- **README.md**: Features, installation, usage
- **CLAUDE.md**: Dev patterns, conventions, architecture
- **API Docs**: Endpoints, requests, responses
- **Config Docs**: Environment variables, settings
- **Examples**: Working code samples

### ✅ Quality Assurance
- Validates code examples
- Checks for broken links
- Ensures consistency
- Verifies formatting
- Maintains style guidelines

## Configuration

Edit `.claude/commands/config/docs-config.json` to customize:
- Target documentation files
- Update sections
- Formatting preferences
- Git integration settings

## Best Practices

1. **Run regularly**: Use after significant code changes
2. **Review changes**: Always review auto-generated updates
3. **Use preview**: Test with `--preview` or `--dry-run` first
4. **Incremental updates**: Use `--focus` for targeted updates
5. **Commit separately**: Review docs changes before committing

## Examples

### After adding a new feature:
```
/docs-sync --focus=README --include-examples
```

### Before a release:
```
/auto-doc --verbose
```

### For quick updates:
```
/update-docs
```

### For comprehensive sync:
```
/docs-sync --git-commit
```

## Tips

- Commands analyze git history to understand changes
- Use `--dry-run` to see what would be updated
- Configure preferences in `docs-config.json`
- Commands work best with clean git status
- Review generated documentation for accuracy

## Troubleshooting

If commands don't appear:
1. Ensure `.claude/commands/` directory exists
2. Restart Claude Code
3. Check file permissions
4. Verify `.md` file extension

## Contributing

To add new documentation commands:
1. Create `.md` file in `.claude/commands/`
2. Add YAML frontmatter with metadata
3. Include clear instructions
4. Test thoroughly