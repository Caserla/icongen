import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ICON_STYLE_PRESET_IDS, type IconStylePresetId } from "@icongen/shared";
import { IconJobList } from "@/features/generation/components/icon-job-list";
import type { GenerationJobStatusFilter, GenerationJobStructureFilter, GenerationJobUsageFilter } from "@/features/generation/server/generation-job-list-reader";

export const metadata: Metadata = { title: "My Icons" };

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

const statusFilters: GenerationJobStatusFilter[] = ["in-progress", "completed", "partial", "failed"];

export default async function IconsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; style?: string | string[]; status?: string | string[]; usage?: string | string[]; structure?: string | string[] }> }) {
  const params = await searchParams;
  const hasExplicitFilters = Boolean(params.style || params.status || params.usage || params.structure);
  let remembered = new URLSearchParams();
  if (!hasExplicitFilters) {
    const stored = (await cookies()).get("icongen_icon_filters")?.value;
    if (stored) {
      try { remembered = new URLSearchParams(decodeURIComponent(stored)); } catch { /* ignore an invalid preference cookie */ }
    }
  }
  const requestedPage = Number.parseInt(first(params.page) ?? remembered.get("page") ?? "1", 10);
  const requestedStyle = first(params.style) ?? remembered.get("style") ?? undefined;
  const requestedStatus = first(params.status) ?? remembered.get("status") ?? undefined;
  const requestedUsage = first(params.usage) ?? remembered.get("usage") ?? undefined;
  const requestedStructure = first(params.structure) ?? remembered.get("structure") ?? undefined;
  const stylePreset = requestedStyle && ICON_STYLE_PRESET_IDS.includes(requestedStyle as IconStylePresetId) ? requestedStyle as IconStylePresetId : undefined;
  const statusFilter = requestedStatus && statusFilters.includes(requestedStatus as GenerationJobStatusFilter) ? requestedStatus as GenerationJobStatusFilter : undefined;
  const usageFilter: GenerationJobUsageFilter = requestedUsage === "illustration" ? "illustration" : "interaction";
  const structureFilter: GenerationJobStructureFilter | undefined = usageFilter === "interaction" && (requestedStructure === "linear" || requestedStructure === "filled") ? requestedStructure : undefined;
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const effectiveStyle = stylePreset && (usageFilter === "interaction" ? stylePreset === "line-icon" : stylePreset !== "line-icon") ? stylePreset : undefined;
  return <IconJobList key={`${usageFilter}:${effectiveStyle ?? "all"}:${structureFilter ?? "all"}:${statusFilter ?? "all"}:${page}`} selectedPage={page} selectedUsage={usageFilter} selectedStyle={effectiveStyle} selectedStructure={structureFilter} selectedStatus={statusFilter}/>;
}
