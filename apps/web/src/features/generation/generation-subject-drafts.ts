import type {
  BackgroundContainer,
  BackgroundMode,
} from "./components/interaction-icon-editor";

export type GenerationSubjectDraft = {
  input: string;
  backgroundMode: BackgroundMode;
  backgroundContainer: BackgroundContainer;
  backgroundCornerRadius: number;
};

export type GenerationSubjectDraftAction =
  | { type: "update-input"; index: number; value: string }
  | { type: "set-background-mode"; index: number; value: BackgroundMode }
  | {
      type: "set-background-container";
      index: number;
      value: BackgroundContainer;
    }
  | { type: "set-background-corner-radius"; index: number; value: number }
  | { type: "add"; maxSubjects: number }
  | { type: "remove"; index: number };

export const initialGenerationSubjectDrafts: GenerationSubjectDraft[] = [
  {
    input: "",
    backgroundMode: "solid",
    backgroundContainer: "rounded-square",
    backgroundCornerRadius: 22,
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
        backgroundMode: "solid",
        backgroundContainer: "rounded-square",
        backgroundCornerRadius: 22,
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
    if (action.type === "set-background-container")
      return { ...draft, backgroundContainer: action.value };
    return { ...draft, backgroundCornerRadius: action.value };
  });
}
