---
description: Automatically update all documentation files based on recent code changes
allowed-tools: ["Task", "Bash", "Read", "Write", "Edit", "Glob", "Grep"]
argument-hint: "[specific-file] (optional - update docs for a specific file or all if omitted)"
---

# Update Documentation Based on Code Changes

I'll analyze recent code changes and automatically update all relevant documentation including README files, CLAUDE.md, and other documentation.

## Steps I'll take:

1. **Detect Recent Changes**
   - Check git status for modified files
   - Analyze the type and scope of changes

2. **Analyze Code Structure**
   - Review the current project structure
   - Identify new features, removed features, or modified functionality
   - Check for new dependencies or configuration changes

3. **Update Documentation Files**
   - **README.md**: Update features, installation steps, usage examples
   - **CLAUDE.md**: Update development guidelines, patterns, and project-specific instructions
   - **API Documentation**: Update endpoint documentation if API changes detected
   - **Configuration Docs**: Update if config files changed
   - **Package Documentation**: Update if dependencies changed

4. **Validate Updates**
   - Ensure all documentation is consistent
   - Check that examples still work
   - Verify links and references are valid

## Usage:
- `/update-docs` - Updates all documentation based on all recent changes
- `/update-docs path/to/file.ts` - Updates documentation related to specific file changes

Let me start by analyzing your recent changes...

!git status --porcelain
!git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached

Based on the changes detected, I'll now update the relevant documentation files.

$ARGUMENTS