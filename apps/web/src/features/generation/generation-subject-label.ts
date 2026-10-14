import type { IconPlan } from "./icon-plan";
import { generationStyleLabel } from "./generation-intent";

type Subject = IconPlan["subjects"][number];

export function generationSubjectLabel(subject: Subject, snapshot: { styleId?: string; secondaryStyleId?: string }, zh: boolean) {
  if (subject.styleRole) {
    const styleId = subject.styleRole === "secondary" ? snapshot.secondaryStyleId : snapshot.styleId;
    return styleId ? `${subject.name} · ${generationStyleLabel(styleId, zh)}` : subject.name;
  }
  if (subject.state) return `${subject.name} · ${subject.state === "outline" ? (zh ? "默认态" : "Default") : (zh ? "选中态" : "Selected")}`;
  return subject.name;
}
