# Security CI remediation

The failed `verify` job stopped at `npm audit --omit=dev --audit-level=high`, before tests and build. Security auditing remains enabled with the same threshold.

## Dependency updates

| Dependency | Updated version |
| --- | --- |
| Next.js / eslint-config-next | 16.4.0 |
| Sharp | 0.35.5 |
| Playwright / @playwright/test | 1.64.0 |
| source-map-js | 1.2.2 |

The lockfile also updates compatible js-yaml and brace-expansion versions. Production dependency auditing reports zero vulnerabilities at verification time. The full audit still reports the development-only `braces` issue and its fast-glob / micromatch / Next ESLint dependency chain; no fixed braces release was available during this verification. Do not downgrade Next.js or disable auditing to hide it. Recheck when upstream publishes a fix.

## Verification fixes

- Retired paid-edit tests now assert HTTP 410 and no billing/refund RPC. Historical SQL accounting tests remain.
- Legacy retry assertions cover the existing local-worker RPC dispatch rather than a stale one-line source pattern.
- Admin copy checks validate the local overview and absence of retired CD-Key controls.
- Derived style contracts are synchronized with their source. Accepted reference images and their manifest are included so tests do not depend on untracked local files.
- Type checking generates Next.js route types first, supporting fresh clones without a prior dev run.
- Client hydration uses a stable external-store snapshot. Prop-driven selection, theme, toast, and library-detail resets happen before committing stale UI, rather than causing synchronous effect cascades. Color-picker portal targets are read in layout synchronization, not render.
- CI builds the documented SQLite local mode with `npm run build:local`.

Testing uses an isolated snapshot of staged files with a fresh `npm ci`, not private environment files or the working directory's untracked assets. A passing suite does not guarantee model quality, upstream availability, or safe public hosting. Local mode remains single-user and loopback-only.

The clean snapshot passed 480 tests (13 root, 340 web, 6 backend-core, 23 icon-skill, 20 shared, 78 worker), type checking, linting (zero errors, 12 warnings), and the local production build. Local launchers provide explicit non-indexable environment defaults, so first-time builds do not require private deployment settings.
