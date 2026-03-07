# Contributing to EcoSquad

Thank you for your interest in contributing to EcoSquad! This document provides guidelines and instructions for contributing.

## 🚀 Development Workflow

### Setting Up Your Environment

1. **Fork and clone** the repository:
```bash
git clone https://github.com/YOUR_USERNAME/eco-squad.git
cd eco-squad
```

2. **Install dependencies**:
```bash
npm install
cd backend && npm install && cd ..
cd infra && npm install && cd ..
```

3. **Set up environment**:
```bash
cp .env.development .env
# Edit .env with your configuration
```

4. **Verify setup**:
```bash
npm run validate
npm run build:all
npm test
```

### Creating a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### Making Changes

1. **Write code** following our style guidelines
2. **Add tests** for new functionality
3. **Update documentation** if needed
4. **Run quality checks**:
```bash
npm run lint
npm run format
npm test
npm run type-check
```

### Committing Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add user authentication
fix: resolve mission creation bug
docs: update API documentation
refactor: simplify database queries
test: add mission service tests
chore: update dependencies
```

### Submitting a Pull Request

1. **Push your branch**:
```bash
git push origin feature/your-feature-name
```

2. **Create a Pull Request** on GitHub
3. **Fill out the PR template** with:
   - Description of changes
   - Related issue numbers
   - Testing performed
   - Screenshots (if UI changes)

4. **Wait for CI checks** to pass
5. **Request review** from maintainers

## 📝 Code Style

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Enable **strict mode** in tsconfig
- Use **explicit types** (avoid `any`)
- Follow **ESLint** rules (run `npm run lint`)

### Formatting

We use **Prettier** for code formatting:
```bash
npm run format       # Format all files
npm run format:check # Check formatting
```

Pre-commit hooks will automatically format your code.

### File Organization

```
src/
├── app/                 # Next.js app router pages
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── forms/          # Form components
│   └── layout/         # Layout components
├── lib/                # Utility functions
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── __tests__/          # Test files
```

## 🧪 Testing

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run with coverage report
```

### Writing Tests

- Use **Jest** and **React Testing Library**
- Place tests in `__tests__` directories or `.test.ts` files
- Write tests for:
  - Utility functions
  - React components
  - API handlers
  - Custom hooks

Example:
```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## 🏗️ Architecture Guidelines

### Frontend (Next.js)

- Use **App Router** (not Pages Router)
- Use **Server Components** by default
- Use **Client Components** only when needed (interactivity, browser APIs)
- Use **Tailwind CSS** for styling
- Follow **responsive design** principles

### Backend (AWS Lambda)

- Keep functions **small and focused**
- Use **Zod** for input validation
- Return **standardized responses**
- Handle **errors gracefully**

### Infrastructure (CDK)

- Use **constructs** for reusable components
- Tag all resources appropriately
- Use **environment-based configuration**
- Follow **least privilege** IAM principles

## 🔒 Security

- **Never commit secrets** or credentials
- Use **environment variables** for configuration
- Validate all **user inputs**
- Use **parameterized queries** (DynamoDB is safe by default)
- Follow **OWASP** guidelines

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description** of the bug
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshots** (if applicable)
6. **Environment details**:
   - OS
   - Node.js version
   - Browser (if frontend issue)

Use the [bug report template](https://github.com/SKTECHCONSULTING/eco-squad/issues/new?template=bug_report.md).

## 💡 Feature Requests

For feature requests:

1. Check if the feature already exists or is planned
2. Describe the **use case** and **benefits**
3. Suggest **implementation approach** (if you have ideas)

Use the [feature request template](https://github.com/SKTECHCONSULTING/eco-squad/issues/new?template=feature_request.md).

## 📚 Documentation

- Update **README.md** if adding new features
- Update **API.md** for API changes
- Add **JSDoc comments** for public functions
- Update **TROUBLESHOOTING.md** for common issues

## 🏷️ Release Process

1. Changes are merged to `develop` branch
2. After testing, `develop` is merged to `main`
3. GitHub Actions automatically deploys to production
4. Tag is created for the release

## 🤝 Code of Conduct

- Be **respectful** and **inclusive**
- Provide **constructive feedback**
- Focus on the **code**, not the person
- Help **others learn and grow**

## 📞 Getting Help

- **GitHub Discussions**: For questions and ideas
- **GitHub Issues**: For bugs and features
- **Documentation**: Check README.md and other docs

## 🙏 Thank You!

Your contributions help make EcoSquad better for everyone working to protect our environment!
