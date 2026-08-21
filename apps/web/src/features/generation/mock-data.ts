import type { GenerationJobV2 } from "@icongen/shared";

const completedJobId = "11111111-1111-4111-8111-111111111111";
const processingJobId = "22222222-2222-4222-8222-222222222222";

function variants(subjectNumber: number, completed: boolean): GenerationJobV2["subjects"][number]["variants"] {
  return ([1, 2, 3] as const).map((slot) => ({
    id: `${subjectNumber}${slot}000000-0000-4000-8000-000000000000`,
    slot,
    status: completed ? "completed" : "queued",
    isPrimary: completed && slot === 1,
    assets: completed ? [{
      id: `${subjectNumber}${slot}100000-0000-4000-8000-000000000000`, size: 256,
      width: 256, height: 256, hasAlpha: true, previewUrl: `/placeholder-${slot}.png`,
    }] : [],
  }));
}

export const mockJobs: GenerationJobV2[] = [
  {
    id: completedJobId, status: "completed", settingsVersion: "core-settings-2026-08-20.1",
    skillVersion: "0.2.0", model: "mock-image-provider",
    progress: { percent: 100, phase: "completed", completedSubjects: 2, totalSubjects: 2 },
    creditSummary: { charged: 2, refunded: 0 }, createdAt: "2026-08-19T08:00:00.000Z", completedAt: "2026-08-19T08:02:00.000Z",
    subjects: [
      { id: "31000000-0000-4000-8000-000000000000", clientId: "add", name: "Add", description: "Add a new item", position: 0, status: "completed", variants: variants(3, true), creditRefunded: false },
      { id: "41000000-0000-4000-8000-000000000000", clientId: "search", name: "Search", description: "Find an existing item", position: 1, status: "completed", variants: variants(4, true), creditRefunded: false },
    ],
  },
  {
    id: processingJobId, status: "processing", settingsVersion: "core-settings-2026-08-20.1",
    progress: { percent: 36, phase: "generating", completedSubjects: 0, totalSubjects: 1, currentSubjectName: "Delete" },
    creditSummary: { charged: 1, refunded: 0 }, createdAt: "2026-08-19T09:30:00.000Z",
    subjects: [{ id: "51000000-0000-4000-8000-000000000000", clientId: "delete", name: "Delete", description: "Remove an item safely", position: 0, status: "processing", variants: variants(5, false), creditRefunded: false }],
  },
];
