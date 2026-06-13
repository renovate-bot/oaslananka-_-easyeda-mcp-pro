# Contributing Guide

Welcome! We appreciate your contributions to `easyeda-mcp-pro`. Please review these guidelines to ensure a smooth contribution process.

---

## 1. Local Development Setup

Ensure you are using **Node.js >= 24 < 27** and **pnpm >= 11** (matching `package.json` specifications).

```bash
# Clone the repository
git clone https://github.com/oaslananka/easyeda-mcp-pro.git
cd easyeda-mcp-pro

# Install dependencies
pnpm install --frozen-lockfile

# Sync versions, compile TS, and build the extension
pnpm build
pnpm build:extension
```

---

## 2. Quality Gates Checklist

Before proposing a pull request, you must ensure that all local quality checks pass:

```bash
# Verify formatting (Prettier)
pnpm format:check

# TypeScript typechecks
pnpm typecheck
pnpm typecheck:extension

# Linting check
pnpm lint

# Unit tests
pnpm test

# Build checks
pnpm build
pnpm build:extension
pnpm verify:extension

# Renovate config validation (if you modified .github/renovate.json)
npx --yes -p renovate renovate-config-validator .github/renovate.json
```

---

## 3. Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) to track changes and automate version bumps. All commit messages and pull request titles must use one of the following formats:

- `fix(scope): desc` -> Triggers a **PATCH** release (e.g. `fix(bridge): resolve timeout error`)
- `feat(scope): desc` -> Triggers a **MINOR** release (e.g. `feat(schematic): add wire tool`)
- `feat!(scope): desc` or `BREAKING CHANGE:` -> Triggers a **MAJOR** release (e.g. `feat!(bridge): change JSON protocol`)
- `chore(deps): desc` -> Updates a runtime dependency (no release)
- `chore(deps-dev): desc` -> Updates a dev dependency (no release)
- `ci(deps): desc` -> Updates a GitHub Action (no release)
- `docs: desc`, `test: desc`, `ci: desc` -> Non-release updates

---

## 4. Renovate PR Review Policy

- **DevDependency Auto-merging**: Patch/minor updates to `devDependencies` are automatically merged by Renovate once CI checks pass.
- **Runtime Dependencies**: Upgrades to runtime dependencies (`@modelcontextprotocol/sdk`, `zod`, `jose`, `ws`, `undici`) must be reviewed and merged manually by maintainers.
- **Major Updates**: All major version upgrades require explicit approval on the **Dependency Dashboard** or manual pull request review.

---

## 5. Release Please Lifecycle

1. When conventional commits are merged into `main`, Release Please will create/update a **Release PR** that increments version numbers and appends to `CHANGELOG.md`.
2. Do **not** manually edit the Release PR contents or tag the release yourself.
3. Once the Release PR is merged into `main`, GitHub Actions automatically:
   - Tags the commit and creates a GitHub Release.
   - Re-verifies all quality gates.
   - Publishes to npm with cryptographic provenance.
   - Uploads the compiled `easyeda-bridge-extension.eext` package to the GitHub Release.
