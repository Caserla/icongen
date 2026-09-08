import { getGenerationSettings } from "@/features/generation/server/generation-settings";

export function GET() {
  try {
    return Response.json(getGenerationSettings(), {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "SETTINGS_UNAVAILABLE",
          message: "Generation settings are temporarily unavailable.",
        },
      },
      { status: 500 },
    );
  }
}
