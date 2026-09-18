export const ICON_STRUCTURE_QUALITY_PROMPT = `
EASYDESIGN V3.2.1 — COMMON AUTHORING PROCEDURE FOR ALL 46 STYLES.
Keep the user's requested subject and intent unchanged. Improve only the drawing decisions. This procedure happens before SVG construction; it is not a post-generation review gate.

SILENT DESIGN CARD — Before writing any SVG, internally complete a subject-specific card from the unchanged name and description:
- recognition: canonical silhouette and proportions; identity-bearing structures; most likely look-alike; visible feature that prevents that misreading.
- formPlan: chosen viewpoint; primary visual center; contour rhythm; internal openings and their clearance; attachment size, direction, connection and occlusion; repeated-part count and alignment; retained identity features; omitted nonessential decoration.
- styleConstruction: how the selected substyle renders the primary contour, interior space and attachments while preserving the same anatomy.
- parts: stable semantic parts with real containment, adjacency and connection relationships.
Do not output this card. Use it to author the final SVG.

1. IDENTITY BEFORE STYLE. For a concrete object, draw its familiar complete form, not a logo, monogram, symbolic abbreviation or generic geometric shell with a label attached. Choose the view that communicates identity without crowded detail. Every identity-bearing part must be visibly present. Preserve exact part count, relative proportion, mechanism and the feature that distinguishes the subject from its closest look-alike.

2. FORM BEFORE DETAIL. Establish the object's width/height relationship, mass distribution, primary contour, real openings and attachment space before internal marks. Use one clear visual center. Keep only structures that materially improve first-glance recognition; omit textures, repeated decoration and redundant edges. Do not solve crowding by shrinking the whole icon, thinning every line or deleting an identity-bearing part.

3. REAL GEOMETRY AND TOPOLOGY. Basic primitives are construction tools, never the final design by themselves. Do not assemble the subject from generic rounded rectangles, pills, blocks or blobs. Rigid parts use shared axes, parallelism, equal spacing and consistent radii; organic parts use smooth directional curves. Bilateral manufactured objects use an explicit centerline and optically matched paired parts. Plan every junction and occlusion: a connected attachment has one believable root, and a hidden rear contour stops at the occluder.

4. CLEARANCE BY INKED EDGES. Measure spacing from visible painted edges, including half the stroke width and round caps. Separate contours must keep an unmistakable visible gap, normally near one optical stroke width at 24px. Connected parts need no artificial gap, but may not double-run the same boundary. Unrelated contours may not overlap, cross, touch tangentially or hide behind one another. If two parts share a boundary, draw one intentional contour; otherwise keep clear negative space. A connector terminates at its receiving contour instead of passing through it. Build enclosing bodies and their openings as one coherent contour-and-cutout system, not overlapping independently stroked boxes.

5. CONTROLLED CONTOUR LANGUAGE. Roundness comes from proportion, curve rhythm and tangent transitions, not merely round caps and joins. Allocate enough length and width for turns, openings and attachments before drawing curves. Ban pinched turns, accidental notches, arbitrary bulges, dangling lobes, short spikes, doubled edges and floating fragments. Use one optical line weight unless the selected substyle explicitly requires another treatment.

6. STYLE CONSTRUCTION. Apply AUTHORITATIVE_PREVIEW_STYLE only after the canonical structure works. Transfer its optical weight, corner family, spacing rhythm, line/fill treatment, material and detail density without copying its subject. Style may transform rendering but may not change anatomy, viewpoint, part count, proportions, alignment, identity-bearing openings or attachment topology.

7. COLOR AFTER STRUCTURE. Assign project-aware colors to real structural surfaces only after geometry is complete. Color must not create fake side planes, arbitrary slices or patches that disguise broken structure. The icon must remain recognizable when imagined in one color.

FINAL AUTHORING CHECK. Before returning SVG, inspect the actual 24px result with the label mentally hidden. Confirm first-glance identity, correct part relationships, clean negative space, consistent optical weight, intentional occlusion and no stroke collisions. If it reads as an abstract mark or neighboring object, rebuild the form plan and geometry before returning the SVG.
`;

export function buildIconStructurePlan(subject: { name: string; description: string }) {
  const concreteSubject = `${subject.name}: ${subject.description}`;
  return {
    preservedIntent: concreteSubject,
    representation: concreteSubject,
    authoringProtocol: "EasyDesign V3.2.1 form-first single-icon task card; preserve the user request verbatim and improve only internal drawing decisions.",
    internalDesignCard: {
      recognition: "Derive canonical silhouette, identity-bearing structures, closest look-alike and visible disambiguation from the complete subject.",
      formPlan: "Choose viewpoint, proportions, contour rhythm, internal-space allocation, attachment topology, repeated-part alignment, retained identity features and omitted decoration before drawing.",
      styleConstruction: "Describe how the selected substyle renders contour, interior space and attachments without changing the canonical anatomy.",
      semanticParts: "Assign stable semantic parts and define their containment, adjacency, shared boundaries, gaps, junctions and occlusion order.",
    },
    canonicalStructure: "Derive the familiar canonical structure from both the name and complete description before selecting geometry.",
    styleIndependentMaster: "Define one canonical silhouette, essential cutouts and stable part layout first; the selected style may render this master but may not redesign its anatomy.",
    recognitionTest: `Without its label or colors, the 24px icon must remain immediately recognizable as ${subject.name} and visibly express: ${subject.description}`,
    symmetryPlan: "Classify the subject as bilateral, radial, axial or intentionally asymmetric; establish its governing axes before drawing paired or repeated parts.",
    componentTopology: "List the real components, their count, relative size, containment, junctions and occlusion order. Preserve separation where the real object is separate and connection where it is connected. Define whether every neighboring pair shares one contour or keeps a visible gap; never stack two independent strokes on the same boundary.",
    silhouettePlan: "Define the complete one-color outer silhouette before color or material. Remove any arbitrary protrusion, notch or blob that does not describe a real part.",
    negativeSpacePlan: "Define every essential opening, inset and gap as an intentional shape with a stable relationship to its parent contour. At 24px, separate contours keep at least one optical stroke width of visible clearance; do not rely on accidental overlap gaps.",
    curvaturePlan: "Use one radius family and smooth tangent transitions; rigid curves stay controlled and repeated curves remain optically matched.",
    styleTransferPlan: "Apply the selected substyle to the canonical master without changing part count, layout, proportions, symmetry class or identity-bearing cutouts.",
    variantFidelity: "Do not substitute a neighboring object variant; preserve the exact mechanism and attachments stated in the subject description.",
    partHierarchy: "Give the primary identity-bearing body the dominant area and visual weight; functional attachments are secondary and connectors or accents remain subordinate.",
    primitivePolicy: "Do not design by stacking generic rectangles, rounded rectangles, pills or blobs. Every primitive must be reshaped and connected according to a real semantic part.",
    gridPlan: "Use a 24-unit grid, approximately 2-unit safe margins and optical centering.",
    lineSystem: "Use one consistent optical thickness from the selected reference style.",
    cornerSystem: "Use one coherent corner and curve family from the selected reference style without rounding away structural identity.",
    complexityBudget: "One dominant composition, a canonical outer structure and only identity-bearing supporting parts needed for recognition.",
    mainContour: `Build the canonical structure described by ${concreteSubject}; do not substitute a generic block silhouette.`,
    identitySpecification: subject.description,
    connections: ["Connected parts need one intentional junction or shared contour; their strokes must terminate at the junction instead of crossing or double-running. Separate parts need at least one optical stroke width of clear spacing at 24px."],
    alignment: "Use explicit centerlines, shared baselines, matched paired-part dimensions, repeatable radii and regular spacing wherever structurally appropriate.",
    contourQuality: "Use smooth deliberate contours, consistent inset relationships and clean tangent junctions without wobble, accidental asymmetry, pinched curves, melted corners, stacked primitives or arbitrary bulges.",
    forbidden: ["generic rounded-rectangle collage", "abstract shorthand for a concrete object", "overlapping or double-run strokes", "missing clearance between separate contours", "connector strokes continuing through their receiving part", "accidental asymmetry or unequal paired parts", "distorted rigid geometry", "accidental negative-space gaps", "pinched curves or dangling lobes", "floating or melted attachments", "unrelated decorative clutter", "color patches that disguise broken structure"],
  };
}
