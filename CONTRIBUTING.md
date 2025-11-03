# Contributing to Laraset

Thank you for your interest in contributing to Laraset! This document provides guidelines for contributors.

## Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/fiandev/laraset.git
   cd laraset
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```

## Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add comments where necessary
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm run build
   npm test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for code style changes (formatting, etc.)
- `refactor:` for code refactoring
- `test:` for adding or updating tests
- `chore:` for maintenance tasks

Examples:
```
feat: add support for MySQL database
fix: resolve docker container permission issue
docs: update installation instructions
```

## Pull Request Process

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request**
   - Use a descriptive title
   - Describe what you changed and why
   - Link any relevant issues

3. **Code Review**
   - Address any feedback from maintainers
   - Ensure all CI checks pass

## Testing

- Build the project: `npm run build`
- Test CLI functionality: `npm start -- --help`
- Test with actual Laravel repository if possible

## Release Process

Releases are automated using semantic-release:
- Commits to `main` branch trigger version analysis
- Version bumps are automatic based on commit messages
- Releases are published to npm and GitHub automatically

## Code Style

- Use TypeScript for type safety
- Follow existing code patterns
- Add conventional comments (TODO, FIXME, NOTE)
- Keep functions focused and small

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Join discussions in existing issues

Thank you for contributing! 🚀
