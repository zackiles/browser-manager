# Contributing to Browser Manager

Thank you for your interest in contributing to Browser Manager! This document provides guidelines for contributing and publishing new versions.

## Development

1. Fork the repository
2. Create a new branch for your feature/fix
3. Make your changes
4. Run tests: `deno task test`
   - Tests are written using Deno's built-in test runner
   - Tests are located in the `test/` directory
   - The test task includes all necessary permissions via `--allow-all`
5. Submit a Pull Request

## Code Style

- Follow the existing code style
- Use TypeScript
- Ensure all tests pass
- Add tests for new features

## Publishing to JSR

To publish a new version:

1. Update version numbers in relevant files
2. Create and push a new tag:
   ```bash
   git tag v1.0.0  # Use appropriate version number
   git push origin v1.0.0
   ```
3. The GitHub Action will automatically publish to JSR when the tag is pushed

### Version Numbers

We follow [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality
- PATCH version for backwards-compatible bug fixes

## Questions?

Feel free to open an issue for any questions or concerns. 