# Bamboo IconGen interface flow audit — 2026-08-20

## Scope

Marketing home, pricing, sign-in, sign-up, password recovery, icon creation, icon history, generation result, account, account deletion/export, checkout, and admin route protection.

## Acceptance result

1. Home → Create icons: PASS. Guests redirect to `/auth/sign-in?next=/create`.
2. Header → My Icons: PASS. Guests redirect to sign-in and retain `/icons`.
3. Pricing → Choose pack: PASS for authentication routing. Each pack uses a dedicated protected checkout URL and retains the selected pack through sign-in/sign-up.
4. Account and account deletion: PASS for authentication routing. Guests cannot see the workspace shell or account-loading state.
5. Sign-in ↔ Sign-up: PASS. The intended destination is preserved across both pages.
6. Missing Supabase configuration: PASS. Protected routes now fail closed and show a clear bilingual setup notice instead of rendering a fake logged-in workspace.
7. Workspace credit card: PASS. Removed the hard-coded fake `20 Credits / 5 generations` state.
8. Public home, pricing, sign-in, and sign-up: PASS. They remain reachable without authentication.
9. Create submission → generation job: BLOCKED BY UNFINISHED IMPLEMENTATION. The form currently validates a temporary payload but does not create a generation job.
10. Generation progress and result refresh: BLOCKED BY UNFINISHED IMPLEMENTATION. Pages still use mock jobs.
11. Single PNG and ZIP download: BLOCKED BY UNFINISHED IMPLEMENTATION. Mock asset URLs do not exist in `public/`.
12. Stripe payment completion: BLOCKED BY UNFINISHED IMPLEMENTATION. Checkout routing is complete, but `/api/billing/checkout` intentionally returns `501 NOT_IMPLEMENTED` until Stripe is configured.
13. Authenticated end-to-end regression: NOT RUN. The local environment does not contain Supabase credentials, so real login/session, authenticated account data, generation creation, and Stripe return/webhook behavior cannot be exercised yet.

## Evidence

- `09-create-redirect-fixed.png`: guest Create icons flow lands on sign-in with a retained `/create` destination.
- `10-checkout-redirect-fixed.png`: guest credit-pack flow lands on sign-in with a retained `/checkout/starter` destination.
- Browser route sweep verified `/create`, `/icons`, `/icons/:jobId`, `/account`, `/account/delete`, `/checkout/:packId`, and `/admin` all redirect to sign-in.
- Automated checks: ESLint passed; TypeScript passed; 11/11 tests passed.
- Production build was not used as evidence because Turbopack attempted to bind a sandbox-restricted local port and failed with `Operation not permitted`; this is an execution-environment restriction rather than an application compile error.

## Accessibility evidence limit

This pass verified semantic roles exposed in the browser snapshot for navigation, headings, form controls, links, alerts, and status messages. It did not run screen-reader software, keyboard-only traversal on every page, or a formal WCAG contrast scanner.
