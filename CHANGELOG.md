# Changelog

All notable changes to the "Gherkin Step Navigator" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024

### Added
- **Go to Definition** - Navigate from Gherkin steps to Python step definitions using F12 or Ctrl+Click
- **Hover Information** - View step definition details, function name, file location, and docstring
- **CodeLens** - See step definition file locations inline above each step
- **Automatic Cache Refresh** - Step definitions are automatically re-indexed when files change
- **Commands**
  - `Go to Step Definition` - Navigate to step definition from feature file
  - `Refresh Step Cache` - Manually refresh the step definition cache
  - `Find All Step Usages` - Find all feature files using a specific step definition
- **Configuration Options**
  - Customizable step definition file patterns
  - Configurable step decorators
  - Toggle hover and CodeLens features
- Support for Behave step patterns:
  - Basic string patterns
  - Named parameters `{param}`
  - Typed parameters `{param:d}`, `{param:w}`, `{param:S}`, `{param:f}`
  - Multiple decorator aliases (`@step`, `@given`, `@when`, `@then`, `@and`, `@but`)

### Technical Details
- Written in TypeScript
- Efficient caching mechanism for fast navigation
- File system watcher for real-time updates
- Comprehensive Gherkin line parsing

## [Unreleased]

### Planned
- Support for step definition snippets
- Quick fix for undefined steps
- Multiple step definition sources (e.g., different projects)
- Support for Cucumber.js and other BDD frameworks
- Support for additional languages (Ruby, Java)
