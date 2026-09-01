export const VARIANT_DIRECTIONS = [
  [
    "Concept A — canonical:",
    "Use the most familiar, direct symbol for the requested meaning.",
    "Favor a balanced front-facing silhouette, conventional proportions, and maximum recognition at a glance.",
    "Do not add secondary motifs or decorative cutouts.",
  ].join(" "),
  [
    "Concept B — structural alternative:",
    "Keep the requested meaning and the canonical semantic skeleton, but use a controlled geometric construction alternative.",
    "Change secondary proportions, internal negative space, or the arrangement of non-critical parts while preserving topology, symmetry requirements, and structural integrity.",
    "The result must read as a distinct design concept, not a minor redraw, rotation, color change, or stroke adjustment.",
  ].join(" "),
  [
    "Concept C — expressive simplification:",
    "Keep the requested meaning and canonical semantic skeleton, but create a visibly distinct compact composition through controlled simplification.",
    "Use a different visual rhythm or inventive negative-space treatment only when it does not break required symmetry, topology, point count, circularity, alignment, or structural balance.",
    "Never manufacture variation by skewing, stretching, twisting, collapsing, or deforming the subject.",
  ].join(" "),
] as const;
