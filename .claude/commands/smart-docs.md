---
description: Intelligently update documentation by analyzing code changes and maintaining consistency
allowed-tools: ["Task", "Bash", "Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "WebSearch"]
argument-hint: "[--aggressive] [--preview] [--specific=file.ts] (optional flags)"
---

# Smart Documentation Update System

I'll intelligently analyze your codebase changes and update all documentation to maintain consistency and accuracy.

## Intelligent Documentation Analysis

### 1. Change Detection & Classification
!echo "🔍 Detecting changes..." && git diff --name-status HEAD~5 2>/dev/null || git status --porcelain

### 2. Documentation Targets
I'll check and update these documentation files:
- `README.md` - Project overview, features, installation
- `CLAUDE.md` - AI assistant guidelines and project conventions  
- `CLAUDE.local.md` - Personal project notes (if exists)
- `docs/` directory - All technical documentation
- `API.md` or `api-docs/` - API documentation
- `CONTRIBUTING.md` - Contribution guidelines
- `CHANGELOG.md` - Version history
- Package files (`package.json`, `requirements.txt`, etc.)

### 3. Update Strategy Based on Changes

#### For New Features (new files/functions):
- Add feature descriptions to README
- Update usage examples
- Add to CLAUDE.md if it affects development patterns
- Update API docs if new endpoints

#### For Modified Code:
- Update affected documentation sections
- Revise examples if behavior changed
- Update configuration documentation
- Adjust development guidelines in CLAUDE.md

#### For Deletions:
- Remove deprecated sections
- Update migration guides
- Clean up obsolete references

### 4. Documentation Consistency Checks
- Verify all code examples compile/run
- Check that all referenced files exist
- Ensure version numbers are consistent
- Validate markdown formatting
- Update table of contents

### 5. Special Handling for CLAUDE.md
- Maintain AI-specific instructions
- Update codebase patterns and conventions
- Document new architectural decisions
- Keep security and performance notes current

## Execution Plan

Let me analyze your project and perform the updates:

$ARGUMENTS