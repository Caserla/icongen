// Historical paid raster generation is retired. Six-style SVG generation uses
// /api/generation/icon-plan and /api/generation/svg-icon.
export async function POST(){return Response.json({error:{code:'LEGACY_GENERATION_RETIRED',message:'Use the six-style SVG generation workflow.'}},{status:410});}
