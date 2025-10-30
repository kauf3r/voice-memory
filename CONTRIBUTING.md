# Contributing to Voice Memory

Thank you for your interest in contributing to Voice Memory! This guide will help you get started with our development workflow and contribution process.

## Quick Start for Contributors

### 1. Fork and Clone
```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/voice-memory.git
cd voice-memory

# Add the original repository as upstream
git remote add upstream https://github.com/kauf3r/voice-memory.git
```

### 2. Environment Setup
```bash
# One-command setup
npm run setup

# This automatically:
# - Installs dependencies
# - Creates .env from .env.example
# - Sets up git hooks
# - Configures VS Code settings
# - Validates prerequisites
```

### 3. Start Development
```bash
# Start development server
npm run dev

# In another terminal, start the multi-computer workflow
npm run git:start
```

## Multi-Computer Development Workflow

Voice Memory uses a production-grade git workflow designed for seamless development across multiple computers. **Always use these commands instead of raw git commands.**

### Daily Workflow Commands

```bash
npm run git:start    # Start work (pull latest, stash management)
npm run git:save     # Save work (commit with safety checks, push)
npm run git:sync     # Sync changes (handle conflicts, merge)
npm run git:status   # Check repository health and status
npm run git:clean    # Clean working directory (with confirmation)
```

### Why Use the Workflow Commands?

- **Repository Health Monitoring**: Automatic corruption detection and recovery
- **Smart Stash Management**: Handles uncommitted changes when switching computers  
- **Conflict Prevention**: Intelligent merge strategies and guided resolution
- **Safety Checks**: Pre-commit hooks and validation
- **Recovery Procedures**: Built-in backup and recovery for edge cases

## Development Guidelines

### Code Style

We use automated tooling for consistent code style:

```bash
npm run lint         # ESLint checking
npm run format       # Prettier formatting  
npm run typecheck    # TypeScript validation
npm run precommit    # Run all checks
```

**Pre-commit hooks automatically run these checks**, so your commits will always be clean.

### Project Structure

```
voice-memory/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (34+ endpoints)
│   ├── components/        # React components
│   └── (pages)/          # Page components
├── lib/                   # Shared utilities
│   ├── analysis.ts        # AI analysis logic
│   ├── openai.ts         # OpenAI integration
│   ├── supabase.ts       # Database client
│   └── types.ts          # TypeScript definitions
├── scripts/              # Development scripts
│   ├── git-workflow.sh   # Multi-computer git workflow
│   └── setup-dev.sh     # Environment setup
├── docs/                 # Documentation
└── supabase/            # Database migrations
```

### Technology Stack

- **Frontend**: Next.js 15.4.5 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + Supabase
- **Database**: PostgreSQL (via Supabase)
- **AI**: OpenAI (Whisper + GPT-4)
- **Testing**: Jest + Playwright
- **Deployment**: Vercel

## Types of Contributions

### 🐛 Bug Reports

Before creating a bug report:
1. Check existing issues
2. Use the latest version
3. Test with a clean environment

**Bug Report Template**:
```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [macOS/Windows/Linux]
- Node.js version: 
- Browser: 
- Voice Memory version:

## Additional Context
Screenshots, logs, etc.
```

### ✨ Feature Requests

Feature requests should include:
- **Problem**: What problem does this solve?
- **Solution**: Proposed solution
- **Alternatives**: Other solutions considered
- **Use Cases**: Real-world usage scenarios

### 🛠️ Code Contributions

#### Development Workflow

1. **Create a Feature Branch**
   ```bash
   npm run git:start
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow existing code patterns
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**
   ```bash
   npm run test         # Unit tests
   npm run test:e2e     # End-to-end tests
   npm run build        # Production build test
   ```

4. **Commit and Push**
   ```bash
   npm run git:save     # Uses the workflow safety checks
   ```

5. **Create Pull Request**
   - Use the pull request template
   - Link related issues
   - Add screenshots for UI changes

#### Code Patterns

**React Components**:
```typescript
// Use TypeScript interfaces
interface ComponentProps {
  prop: string;
}

// Use functional components with hooks
export function Component({ prop }: ComponentProps) {
  // Hooks at top level
  const [state, setState] = useState();
  
  // Event handlers
  const handleClick = useCallback(() => {
    // Implementation
  }, [dependencies]);
  
  return (
    <div>
      {/* JSX content */}
    </div>
  );
}
```

**API Routes**:
```typescript
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Implementation
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Database Operations**:
```typescript
// Use proper error handling
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('user_id', user.id);

if (error) {
  throw new Error(`Database error: ${error.message}`);
}
```

### 📝 Documentation

Documentation contributions are always welcome:

- Fix typos or unclear instructions
- Add examples or use cases
- Improve API documentation
- Update setup guides
- Add troubleshooting tips

### 🧪 Testing

We have comprehensive test coverage:

```bash
npm run test              # Jest unit tests
npm run test:watch        # Watch mode
npm run test:e2e          # Playwright E2E tests
npm run test:e2e:ui       # E2E tests with UI
npm run test:supabase     # Database connection tests
npm run test:openai       # AI integration tests
```

**Writing Tests**:

```typescript
// Unit tests (Jest)
describe('Component', () => {
  it('should render correctly', () => {
    render(<Component prop="value" />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});

// E2E tests (Playwright)
test('upload and process voice note', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'test-audio.mp3');
  await expect(page.locator('.processing-status')).toBeVisible();
});
```

## Pull Request Process

### Before Submitting

1. **Run Quality Checks**
   ```bash
   npm run precommit    # Runs lint, format, typecheck
   npm run test         # Run tests
   npm run build        # Verify build works
   ```

2. **Update Documentation**
   - Update README if adding features
   - Add/update API documentation
   - Update CHANGELOG.md

3. **Self-Review**
   - Review your own changes
   - Test on different browsers/devices
   - Verify no console errors

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed
- [ ] Cross-browser testing

## Screenshots
If applicable, add screenshots

## Checklist
- [ ] Code follows project patterns
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] CHANGELOG.md updated
```

### Review Process

1. **Automated Checks**: CI runs tests and linting
2. **Code Review**: Maintainers review code quality
3. **Testing**: Changes are tested in review environment
4. **Approval**: At least one maintainer approval required
5. **Merge**: Squash and merge to main branch

## Development Environment

### Required Software
- **Node.js 18+**: JavaScript runtime
- **npm 8+**: Package manager
- **Git**: Version control
- **VS Code** (recommended): Code editor

### Optional Tools
- **Docker**: For containerized development
- **Supabase CLI**: Database management
- **Vercel CLI**: Deployment testing

### Environment Variables

Create `.env` file with:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# App
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
```

## Troubleshooting

### Common Issues

**Git Workflow Issues**:
```bash
npm run git:status    # Check repository health
npm run git:clean     # Reset working directory
```

**Build Issues**:
```bash
rm -rf node_modules .next
npm install
npm run build
```

**Database Issues**:
```bash
npm run test:supabase    # Test connection
```

**API Issues**:
```bash
npm run test:openai      # Test OpenAI connection
```

### Getting Help

1. **Check Documentation**: README, API docs, troubleshooting guides
2. **Search Issues**: GitHub issues for similar problems
3. **Ask Questions**: Create a GitHub issue with question label
4. **Discord/Slack**: Real-time help (if available)

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment:

- **Be respectful**: Treat everyone with respect and kindness
- **Be constructive**: Focus on helping and improving
- **Be patient**: Remember that everyone has different experience levels
- **Be collaborative**: Work together towards common goals

### Communication

- **Issues**: Technical problems, bugs, feature requests
- **Discussions**: General questions, ideas, feedback
- **Pull Requests**: Code changes, documentation updates
- **Email**: Security issues or sensitive matters

## Recognition

Contributors are recognized in:
- **CHANGELOG.md**: Major contributions noted in releases
- **README.md**: Contributors section
- **GitHub**: Contributor statistics and history

## Development Roadmap

See our [Project Board](https://github.com/kauf3r/voice-memory/projects) for:
- Current priorities
- Upcoming features
- Help wanted issues
- Good first issues for newcomers

## Advanced Development

### Multi-Computer Development

If you develop on multiple computers:

1. **Use the git workflow commands** on all machines
2. **Keep environment files local** (never commit `.env`)
3. **Use machine-specific config** (`.env.local.[computer-name]`)
4. **Always sync before starting work** (`npm run git:start`)

### Performance Testing

```bash
npm run test:performance    # Performance benchmarks
npm run build:analyze      # Bundle analysis
```

### Database Development

```bash
# Apply migrations
supabase db push

# Generate types
supabase gen types typescript --local > lib/database.types.ts
```

## Questions?

Don't hesitate to ask questions! We're here to help:

- **GitHub Issues**: Technical questions
- **GitHub Discussions**: General discussion
- **Documentation**: Check existing guides first

Thank you for contributing to Voice Memory! 🎯