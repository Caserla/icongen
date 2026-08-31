export const SHARED_PRODUCTION_BOUNDARIES = [
  "Create one independent production asset for exactly one requested subject.",
  "The only visible elements are the requested subject, at most one semantically necessary supporting symbol, and the explicitly selected icon background.",
  "Keep every visible element complete, centered, uncropped, and inside balanced safe margins.",
  "Do not create a collection, grid, contact sheet, sprite sheet, style board, title, label, watermark, device mockup, or presentation layout.",
  "Use crisp closed silhouettes, clean color boundaries, natural antialiasing, and no stray fragments or unrelated decoration.",
].join(" ");

export const APP_ICON_CANVAS_SPEC = [
  "The final square canvas is the production app-icon asset itself, not a preview of an icon on another surface.",
  "By default, one background treatment fills the complete square master canvas edge to edge; there is no model-drawn rounded container, second presentation backdrop, exterior stage, frame, pedestal, or outer tile.",
  "The delivery pipeline applies the selected rounded, circular, or square container shape after generation; do not paint a second container boundary into the image.",
  "A transparent-background setting or an explicit no-background request removes the full-canvas background.",
].join(" ");

export const INTERACTION_ASSET_SPEC = [
  "Treat the output as a production UI control asset, not an App Store icon or illustration board.",
  "Preserve open negative space and immediate recognition at the smallest requested size.",
].join(" ");
