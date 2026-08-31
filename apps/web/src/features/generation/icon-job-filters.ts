import type { IconStylePresetId } from "@icongen/shared";
import type {
  GenerationJobStatusFilter,
  GenerationJobStructureFilter,
  GenerationJobUsageFilter,
} from "./server/generation-job-list-reader";

export type IconJobFilters = {
  usage: GenerationJobUsageFilter;
  style?: IconStylePresetId;
  structure?: GenerationJobStructureFilter;
  status?: GenerationJobStatusFilter;
};

export type IconJobFilterAction =
  | { type: "select-usage"; usage: GenerationJobUsageFilter }
  | { type: "select-style"; style?: IconStylePresetId }
  | { type: "select-structure"; structure?: GenerationJobStructureFilter }
  | { type: "select-status"; status?: GenerationJobStatusFilter };

export function reduceIconJobFilters(
  state: IconJobFilters,
  action: IconJobFilterAction,
): IconJobFilters {
  switch (action.type) {
    case "select-usage":
      return { usage: action.usage };
    case "select-style":
      return { usage: state.usage, style: action.style };
    case "select-structure":
      return { usage: state.usage, structure: action.structure };
    case "select-status":
      return { ...state, status: action.status };
  }
}
