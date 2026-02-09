# CLAUDE.md - Edge-Finder

## Project Overview

**Edge-Finder** is a new project. This repository is currently in its initial setup phase with no source code, build system, or dependencies configured yet.

- **Repository**: trotwam-lab/Edge-Finder
- **Status**: Initial setup — no source code or configuration files exist yet

## Repository Structure

```
Edge-Finder/
├── CLAUDE.md          # This file — AI assistant guide
└── .git/              # Git metadata
```

As the project grows, update this section to reflect the actual directory layout.

## Development Setup

No setup steps are required yet. When dependencies and tooling are added, document them here:

- **Language(s)**: TBD
- **Package manager**: TBD
- **Runtime requirements**: TBD

## Common Commands

<!-- Update these as the project evolves -->

| Task         | Command |
|--------------|---------|
| Install deps | TBD     |
| Build        | TBD     |
| Run tests    | TBD     |
| Lint         | TBD     |
| Format       | TBD     |
| Start        | TBD     |

## Architecture

No architecture has been established yet. When it is, document:

- Entry points
- Key modules and their responsibilities
- Data flow patterns
- External service dependencies

## Conventions for AI Assistants

### General

- Read existing code before proposing changes. Never modify files you haven't read.
- Keep changes minimal and focused on the task at hand. Avoid unrelated refactors.
- Do not add features, abstractions, or error handling beyond what is requested.
- Do not introduce security vulnerabilities (command injection, XSS, SQL injection, etc.).

### Code Style

- Follow whatever linting/formatting configuration is established in the project.
- Match the style of surrounding code when making changes.
- Do not add comments, docstrings, or type annotations to code you didn't change.

### Git

- Write clear, concise commit messages that describe the "why" not the "what".
- Commit only the files relevant to the change.
- Do not commit secrets, credentials, or environment files.

### Testing

- When tests exist, run them after making changes to verify nothing is broken.
- Add tests for new functionality when a testing framework is in place.

### Dependencies

- Do not add new dependencies without a clear need.
- Prefer well-maintained, widely-used packages when dependencies are necessary.
