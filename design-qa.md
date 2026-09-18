# Design QA

- Scope: right-side canvas toolbar theme, select, and pan controls.
- Reference: `/Users/s2/Desktop/截屏2026-09-16 14.21.04.png`.
- Verified state: dark theme at `/create` in the Codex in-app browser.
- Theme mark is contained within the same 36 px control box as the other tools.
- All three controls share one horizontal center axis.
- Toolbar padding, divider, selected state, and circular hit areas remain intact.
- No clipping or overflow is visible.
- Theme panel reduced to a 312 px compact layout with 16 px padding and 20 px radius.
- Theme panel hierarchy and color controls remain readable in both dark and light themes.
- Preset and color-row disclosure indicators use fixed-proportion chevrons without glyph distortion.
- Each theme color expands its picker inline; opening another color collapses the previous editor.

Final result: passed
# Theme color picker follow-up

- [x] Color field, attached hue strip, circular handles, and hex-value row match the supplied light/dark references.
- [x] Saturation handle remains white in both themes.
- [x] Theme panel uses a dedicated scrolling body; the Save action remains fixed and visible at the bottom.
- [x] TypeScript validation and whitespace checks pass.
