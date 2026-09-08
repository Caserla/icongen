import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { serverLogger } from "@/lib/security/server-log";

const createSchema = z.object({ variantId: z.string().uuid() });
const deleteManySchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(100),
}).refine((value) => new Set(value.variantIds).size === value.variantIds.length);

export async function GET() {
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const { data: favorites, error } = await client
      .from("generation_favorites")
      .select("id,variant_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const variantIds = (favorites ?? []).map((item) => item.variant_id);
    if (!variantIds.length) return Response.json({ items: [], count: 0 });
    const { data: variants, error: variantsError } = await client
      .from("generation_variants")
      .select("id,subject_id,slot,status,active_revision_id")
      .in("id", variantIds);
    if (variantsError) throw variantsError;
    const subjectIds = (variants ?? []).map((item) => item.subject_id);
    const { data: subjects, error: subjectsError } = await client
      .from("generation_subjects")
      .select("id,job_id,name")
      .in("id", subjectIds);
    if (subjectsError) throw subjectsError;
    const jobIds = [...new Set((subjects ?? []).map((item) => item.job_id))];
    const { data: jobs, error: jobsError } = await client
      .from("generation_jobs")
      .select("id,generation_spec")
      .in("id", jobIds);
    if (jobsError) throw jobsError;
    const activeRevisionIds = (variants ?? []).flatMap((item) =>
      item.active_revision_id ? [item.active_revision_id] : [],
    );
    const [{ data: assets, error: assetsError }, revisionResult] = await Promise.all([
      client
        .from("generation_assets")
        .select("id,variant_id,asset_role,format,size")
        .in("variant_id", variantIds),
      activeRevisionIds.length
        ? client
            .from("generation_variant_revisions")
            .select("id,variant_id,assets")
            .in("id", activeRevisionIds)
            .eq("status", "completed")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (assetsError) throw assetsError;
    if (revisionResult.error) throw revisionResult.error;
    const revisionByVariant = new Map(
      (revisionResult.data ?? []).map((revision) => [revision.variant_id, revision]),
    );
    const items = (favorites ?? []).flatMap((favorite) => {
      const variant = (variants ?? []).find((item) => item.id === favorite.variant_id);
      if (!variant) return [];
      const subject = (subjects ?? []).find((item) => item.id === variant.subject_id);
      if (!subject) return [];
      const job = (jobs ?? []).find((item) => item.id === subject.job_id);
      const revision = revisionByVariant.get(variant.id);
      const revisionAssets = revision && Array.isArray(revision.assets) ? revision.assets : [];
      const baseAssets = (assets ?? []).filter((item) => item.variant_id === variant.id);
      const previewAsset = revisionAssets.find((item) => item.assetRole === "preview" && item.format === "png")
        ?? revisionAssets.find((item) => item.assetRole === "source" && item.format === "png")
        ?? [...revisionAssets].filter((item) => item.format === "png").sort((a, b) => Number(b.size) - Number(a.size))[0];
      const basePreview = baseAssets.find((item) => item.asset_role === "preview" && item.format === "png")
        ?? baseAssets.find((item) => item.asset_role === "source" && item.format === "png")
        ?? [...baseAssets].filter((item) => item.format === "png").sort((a, b) => b.size - a.size)[0];
      const previewUrl = previewAsset && revision
        ? `/api/generation/variant-revisions/${revision.id}/assets/${String(previewAsset.id)}/preview`
        : basePreview ? `/api/generation/assets/${basePreview.id}/preview` : undefined;
      const spec = job?.generation_spec as { purpose?: string; style?: { preset?: string } } | null;
      return [{
        id: favorite.id,
        variantId: variant.id,
        jobId: subject.job_id,
        subjectName: subject.name,
        slot: variant.slot,
        usage: spec?.purpose === "app-icon" ? "illustration" : "interaction",
        stylePreset: spec?.style?.preset,
        previewUrl,
        createdAt: favorite.created_at,
      }];
    });
    return Response.json({ items, count: items.length });
  } catch (error) {
    serverLogger.error("generation_favorites_read_failed", { error });
    return authErrorResponse(error) ?? apiError("FAVORITES_READ_FAILED", "Favorites could not be loaded.", 500);
  }
}

export async function POST(request: Request) {
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_FAVORITE", "Choose a valid icon option.", 400);
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const { data: variant } = await client
      .from("generation_variants")
      .select("id,subject_id")
      .eq("id", body.data.variantId)
      .eq("status", "completed")
      .maybeSingle();
    if (!variant) return apiError("VARIANT_NOT_FOUND", "This icon option is unavailable.", 404);
    const { data: subject } = await client.from("generation_subjects").select("job_id").eq("id", variant.subject_id).maybeSingle();
    const { data: job } = subject ? await client.from("generation_jobs").select("id").eq("id", subject.job_id).eq("user_id", user.id).maybeSingle() : { data: null };
    if (!job) return apiError("VARIANT_NOT_FOUND", "This icon option is unavailable.", 404);
    const { error } = await client.from("generation_favorites").upsert(
      { user_id: user.id, variant_id: body.data.variantId },
      { onConflict: "user_id,variant_id", ignoreDuplicates: true },
    );
    if (error) throw error;
    return Response.json({ variantId: body.data.variantId }, { status: 201 });
  } catch (error) {
    serverLogger.error("generation_favorite_create_failed", { error });
    return authErrorResponse(error) ?? apiError("FAVORITE_CREATE_FAILED", "The icon could not be saved to favorites.", 500);
  }
}

export async function DELETE(request: Request) {
  const body = deleteManySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_FAVORITES", "Choose one or more valid favorites.", 400);
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const { error } = await client
      .from("generation_favorites")
      .delete()
      .eq("user_id", user.id)
      .in("variant_id", body.data.variantIds);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (error) {
    serverLogger.error("generation_favorites_delete_many_failed", { error });
    return authErrorResponse(error) ?? apiError("FAVORITES_DELETE_FAILED", "The selected favorites could not be removed.", 500);
  }
}
