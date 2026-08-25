export const VARIANT_DIRECTIONS = [
  [
    "Concept A — canonical:",
    "Use the most familiar, direct symbol for the requested meaning.",
    "Favor a balanced front-facing silhouette, conventional proportions, and maximum recognition at a glance.",
    "Do not add secondary motifs or decorative cutouts.",
  ].join(" "),
  [
    "Concept B — structural alternative:",
    "Keep the requested meaning, but use a clearly different geometric construction from the canonical solution.",
    "Change the silhouette proportions, internal negative space, or arrangement of essential parts while remaining immediately recognizable.",
    "The result must read as a distinct design concept, not a minor redraw, rotation, color change, or stroke adjustment.",
  ].join(" "),
  [
    "Concept C — expressive simplification:",
    "Keep the requested meaning, but create a visibly distinct compact composition with a stronger signature silhouette.",
    "Use purposeful asymmetry, a different visual rhythm, or an inventive negative-space treatment where semantically appropriate.",
    "The result must not repeat the canonical front-facing construction and must differ in geometry, not merely rendering details.",
  ].join(" "),
] as const;
