export const SHARED_PRODUCTION_BOUNDARIES = [
  "Create one independent production asset for exactly one requested subject.",
  "The only visible elements are the requested subject, at most one semantically necessary supporting symbol, and the explicitly selected icon background.",
  "Keep every visible element complete, centered, uncropped, and inside balanced safe margins.",
  "Do not create a collection, grid, contact sheet, sprite sheet, style board, title, label, watermark, device mockup, or presentation layout.",
  "Use crisp closed silhouettes, clean color boundaries, natural antialiasing, and no stray fragments or unrelated decoration.",
].join(" ");

export const APP_ICON_CANVAS_SPEC = [
  "The final square canvas is the production app-icon asset itself, not a preview of an icon on another surface.",
  "The icon's own opaque background fills the complete canvas edge to edge; there is no second presentation backdrop, exterior stage, frame, pedestal, or outer tile.",
  "If the internal app-icon composition uses rounded corners, all remaining canvas pixels use solid white #FFFFFF.",
].join(" ");

export const INTERACTION_ASSET_SPEC = [
  "Treat the output as a production UI control asset, not an App Store icon or illustration board.",
  "Preserve open negative space and immediate recognition at the smallest requested size.",
].join(" ");
