import type {
  BackgroundContainer,
  BackgroundMode,
} from "./components/interaction-icon-editor";
import type { ColorSetting, IllustrationComposition } from "@icongen/shared";

export type GenerationSubjectDraft = {
  input: string;
  backgroundMode: BackgroundMode;
  backgroundColor: ColorSetting;
  backgroundColorCustomized: boolean;
  backgroundContainer: BackgroundContainer;
  backgroundCornerRadius: number;
  illustrationComposition: IllustrationComposition;
};

export type GenerationSubjectDraftAction =
  | { type: "update-input"; index: number; value: string }
  | { type: "set-background-mode"; index: number; value: BackgroundMode }
  | {
      type: "set-background-color";
      index: number;
      value: ColorSetting;
      customized?: boolean;
    }
  | { type: "set-background-auto-color"; index: number; value: boolean }
  | {
      type: "set-background-container";
      index: number;
      value: BackgroundContainer;
    }
  | { type: "set-background-corner-radius"; index: number; value: number }
  | {
      type: "set-illustration-composition";
      index: number;
      value: IllustrationComposition;
    }
  | {
      type: "add";
      maxSubjects: number;
      backgroundMode?: BackgroundMode;
      backgroundColor?: ColorSetting;
    }
  | { type: "remove"; index: number };

export const initialGenerationSubjectDrafts: GenerationSubjectDraft[] = [
  {
    input: "",
    backgroundMode: "transparent",
    backgroundColor: { mode: "solid", color: "#FFFFFF" },
    backgroundColorCustomized: false,
    backgroundContainer: "rounded-square",
    backgroundCornerRadius: 22,
    illustrationComposition: "centered",
  },
];

export function generationSubjectDraftReducer(
  state: GenerationSubjectDraft[],
  action: GenerationSubjectDraftAction,
): GenerationSubjectDraft[] {
  if (action.type === "add") {
    if (state.length >= action.maxSubjects) return state;
    return [
      ...state,
      {
        input: "",
        backgroundMode: action.backgroundMode ?? "transparent",
        backgroundColor:
          action.backgroundColor ?? { mode: "solid", color: "#FFFFFF" },
        backgroundColorCustomized: false,
        backgroundContainer: "rounded-square",
        backgroundCornerRadius: 22,
        illustrationComposition: "centered",
      },
    ];
  }
  if (action.type === "remove") {
    if (state.length === 1) return initialGenerationSubjectDrafts;
    return state.filter((_, index) => index !== action.index);
  }
  return state.map((draft, index) => {
    if (index !== action.index) return draft;
    if (action.type === "update-input")
      return { ...draft, input: action.value };
    if (action.type === "set-background-mode")
      return { ...draft, backgroundMode: action.value };
    if (action.type === "set-background-color")
      return {
        ...draft,
        backgroundColor: action.value,
        backgroundColorCustomized: action.customized ?? true,
      };
    if (action.type === "set-background-auto-color")
      return { ...draft, backgroundColorCustomized: !action.value };
    if (action.type === "set-background-container")
      return { ...draft, backgroundContainer: action.value };
    if (action.type === "set-illustration-composition")
      return { ...draft, illustrationComposition: action.value };
    return { ...draft, backgroundCornerRadius: action.value };
  });
}
