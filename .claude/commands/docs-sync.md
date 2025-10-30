---
description: Synchronize all documentation with current codebase using intelligent agents
allowed-tools: ["Task", "Bash", "Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "TodoWrite", "WebSearch"]
argument-hint: "[--dry-run] [--focus=area] [--include-examples] [--git-commit]"
---

# Documentation Sync - Intelligent Code-to-Docs Synchronization

I'll use specialized agents to analyze your codebase and automatically update all documentation files to match the current implementation.

## 🚀 Documentation Sync Strategy

### Step 1: Comprehensive Code Analysis
First, I'll analyze recent changes and the overall codebase structure:

!echo "📊 Analyzing recent changes..."
!git log --oneline -10
!echo -e "\n📁 Modified files:"
!git diff --name-only HEAD~5 2>/dev/null || git status --porcelain

### Step 2: Multi-Agent Documentation Update

I'll launch specialized agents to handle different aspects:

1. **Code Analysis Agent** - Deep dive into code changes
2. **Documentation Writer** - Update docs with proper technical writing
3. **API Documentation Agent** - Extract and document APIs
4. **Example Generator** - Create working code examples

### Step 3: Documentation Targets

#### 📄 README.md Updates:
- Project overview and features
- Installation instructions 
- Quick start guide
- Usage examples
- Configuration options
- Troubleshooting section

#### 🤖 CLAUDE.md Updates:
- Development patterns discovered in code
- Coding conventions actually used
- Architecture decisions
- Performance optimizations found
- Security considerations
- Testing approaches

#### 📚 Additional Documentation:
- API endpoint documentation
- Database schema docs
- Environment variables
- Docker/deployment docs
- Contributing guidelines

### Step 4: Intelligent Features

🔍 **Smart Detection:**
- New functions/classes → Add to API docs
- New dependencies → Update installation
- Config changes → Update setup docs
- New files → Update project structure
- Deleted code → Remove from docs

🔄 **Consistency Checks:**
- Verify all examples compile
- Check referenced files exist
- Validate configuration samples
- Ensure version consistency

📝 **Auto-Generation:**
- Extract JSDoc/comments
- Generate API signatures
- Create usage examples
- Build feature matrices

### Step 5: Quality Assurance

Before finalizing:
- ✅ Lint markdown files
- ✅ Verify code examples
- ✅ Check broken links
- ✅ Validate formatting
- ✅ Ensure completeness

## Execution Options

Parsed options: $ARGUMENTS

### Available Options:
- `--dry-run` - Preview changes without writing
- `--focus=README` - Update only README
- `--focus=CLAUDE` - Update only CLAUDE.md
- `--focus=API` - Update only API docs
- `--include-examples` - Generate code examples
- `--git-commit` - Auto-commit changes

---

🎯 Starting intelligent documentation synchronization...