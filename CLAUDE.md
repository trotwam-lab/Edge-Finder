# CLAUDE.md - Edge-Finder

## Project Overview

**Edge-Finder** is a new project in its initial setup phase. No source code, build system, or dependencies have been configured yet.

- **Repository**: trotwam-lab/Edge-Finder
- **Status**: Initial setup — no source code or configuration files exist yet
- **Branch strategy**: Feature branches prefixed with `claude/`

## Repository Structure

```
Edge-Finder/
├── CLAUDE.md          # This file — AI assistant guide
└── .git/              # Git metadata
```

> When adding new files or directories, update this section to reflect the actual layout.

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
- Prefer editing existing files over creating new ones.

### Greenfield Guidelines

Since this project has no code yet, follow these principles when establishing the initial codebase:

- Choose simple, well-understood tools and frameworks. Avoid over-engineering.
- Add a `.gitignore` appropriate for the chosen language/runtime before committing generated or dependency files.
- Set up linting and formatting early so conventions are enforced from the start.
- Include a `README.md` only when there is meaningful content to put in it.
- Keep this `CLAUDE.md` up to date as the project structure evolves.

### Code Style

- Follow whatever linting/formatting configuration is established in the project.
- Match the style of surrounding code when making changes.
- Do not add comments, docstrings, or type annotations to code you didn't change.

### Git

- Write clear, concise commit messages that describe the "why" not the "what".
- Commit only the files relevant to the change.
- Do not commit secrets, credentials, or environment files.
- Use feature branches; do not push directly to `main` without explicit permission.

### Testing

- When tests exist, run them after making changes to verify nothing is broken.
- Add tests for new functionality when a testing framework is in place.
- Prefer fast, deterministic unit tests over slow integration tests where possible.

### Dependencies

- Do not add new dependencies without a clear need.
- Prefer well-maintained, widely-used packages when dependencies are necessary.
- Pin dependency versions to avoid unexpected breakage.
