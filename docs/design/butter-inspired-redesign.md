# Butter-inspired frontend redesign

## Goal

Rebuild the product UI with an original editorial-tool aesthetic inspired by the interaction principles observed on Butter, without copying its brand, copy, fonts, trademarks, or media assets.

## Verified design direction

- Use a warm neutral canvas and charcoal tool surfaces. Accent colors belong to media, active controls, and progress—not full-page decoration.
- Marketing pages are spacious and editorial; authenticated workspace pages are denser, but both share the same tokens, radii, typography hierarchy, and motion rules.
- Prefer continuous storytelling over stacked marketing cards. Use at most two pinned/scrubbed scroll moments on the homepage.
- Hover feedback changes opacity, surface, radius, or media state. Avoid large layout-moving lifts and heavy hard shadows.
- The icon editor is the product demonstration: live canvas on the left, compact controls on the right, editorial explanation alongside it.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | `#F7F6F1` |
| Surface | `#ECEAE4` |
| Active surface | `#DFDDD5` |
| Ink | `#171717` |
| Muted ink | `rgba(23, 23, 23, .56)` |
| Tool surface | `#15151A` |
| Iris accent | `#7357FF` |
| Mint accent | `#91E2C0` |
| Peach accent | `#FFB28D` |

Radii: 8, 12, 24, 32, and pill. Shadows stay soft and low contrast.

## Motion rules

- First-load sequence completes within 1.6 seconds.
- Entrance easing: `cubic-bezier(.2,.72,.2,.99)`.
- Quick control transitions: `cubic-bezier(0,0,0,1)`.
- Exit easing: `cubic-bezier(.82,0,.81,.2)`.
- Scroll-linked icon motion uses `requestAnimationFrame`, transforms, and opacity only.
- `prefers-reduced-motion` must remove decorative motion and immediately expose content.

## Motion inventory

| Context | Motion | Implementation rule |
| --- | --- | --- |
| First page load | Wordmark/copy reveal, icon rail, progress, curtain exit | One sequence, maximum 1.6s; never replay on client navigation |
| Hero | Staggered copy plus floating option composition | Transform/opacity only; hover settles rather than jumps |
| Scroll story | Brand icons fall into a fixed system grid | Scroll-linked RAF, clamped progress, no React render loop |
| Product editor demo | Live scale, corner and color interpolation | Immediate local feedback with quick easing |
| Section entry | Editorial copy and product panels reveal once | IntersectionObserver; disconnect after entry |
| Buttons and filters | Quiet opacity/surface feedback | No geometry-changing border or padding transitions |
| Images | Skeleton until decode, then atomic fade/reveal | Never progressively expose partially decoded assets |
| Route loading | Page-specific structural skeleton | Static chrome remains visible; only data regions shimmer |
| Lists | Stagger only the first visible batch | Small delays; disable after cached/back navigation |
| Modals and menus | Fade plus short scale/translate | Focus-safe, reversible, maximum 220ms |

## Migration order

1. Shared tokens, header, typography, button and loading behavior.
2. Homepage narrative, icon-drop sequence, and interactive editor demonstration.
3. Creation workspace and icon library filters/cards.
4. Result/detail editor, account, pricing, authentication, and admin surfaces.
5. Responsive, keyboard, reduced-motion, loading, visual-regression, and performance acceptance.

## Acceptance cases

1. First visit: intro never blocks interaction beyond 1.6 seconds; reduced-motion mode finishes immediately.
2. Homepage scroll: nine brand-icon assets settle into their target grid without reflow or horizontal overflow.
3. Editor demo: scale, radius, and background controls update the preview without network calls.
4. Keyboard: all controls and navigation links expose visible focus and correct labels.
5. Mobile: hero, icon grid, editor, and workflow stay readable at 360px without clipped content.
6. Performance: decorative animation uses transforms/opacity and does not trigger continuous React state updates.
