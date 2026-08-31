import type { Metadata } from "next";
import { ICON_STYLE_PRESET_IDS, type IconStylePresetId } from "@icongen/shared";
import { IconJobList } from "@/features/generation/components/icon-job-list";
import { preloadGenerationJobFirstPages, readGenerationJobs, readPreloadedGenerationJobPage, type GenerationJobStatusFilter, type GenerationJobStructureFilter, type GenerationJobUsageFilter } from "@/features/generation/server/generation-job-list-reader";
import { requireActiveUser } from "@/lib/auth/require-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "My Icons" };

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

const statusFilters: GenerationJobStatusFilter[] = ["in-progress", "completed", "partial", "failed"];

export default async function IconsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; style?: string | string[]; status?: string | string[]; usage?: string | string[]; structure?: string | string[] }> }) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(first(params.page) ?? "1", 10);
  const requestedStyle = first(params.style);
  const requestedStatus = first(params.status);
  const requestedUsage = first(params.usage);
  const requestedStructure = first(params.structure);
  const stylePreset = requestedStyle && ICON_STYLE_PRESET_IDS.includes(requestedStyle as IconStylePresetId) ? requestedStyle as IconStylePresetId : undefined;
  const statusFilter = requestedStatus && statusFilters.includes(requestedStatus as GenerationJobStatusFilter) ? requestedStatus as GenerationJobStatusFilter : undefined;
  const usageFilter: GenerationJobUsageFilter = requestedUsage === "illustration" ? "illustration" : "interaction";
  const structureFilter: GenerationJobStructureFilter | undefined = usageFilter === "interaction" && (requestedStructure === "linear" || requestedStructure === "filled") ? requestedStructure : undefined;
  const user = await requireActiveUser();
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const client = createAdminSupabaseClient();
  const preload = await preloadGenerationJobFirstPages(client, user.id);
  const effectiveStyle = stylePreset && (usageFilter === "interaction" ? stylePreset === "line-icon" : stylePreset !== "line-icon") ? stylePreset : undefined;
  const result = page === 1 ? readPreloadedGenerationJobPage(preload, effectiveStyle, statusFilter) : await readGenerationJobs(client, user.id, { page, stylePreset: effectiveStyle, statusFilter, usageFilter, structureFilter });
  return <IconJobList key={`${usageFilter}:${effectiveStyle ?? "all"}:${structureFilter ?? "all"}:${statusFilter ?? "all"}:${page}`} result={result} preload={preload} selectedUsage={usageFilter} selectedStyle={effectiveStyle} selectedStructure={structureFilter} selectedStatus={statusFilter}/>;
}
