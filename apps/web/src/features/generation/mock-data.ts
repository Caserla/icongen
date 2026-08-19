import type { GenerationJob } from "@icongen/shared";

export const mockJobs: GenerationJob[] = [
  {
    id: "demo-focus-timer",
    description: "A calm focus timer for remote teams with a warm sunrise symbol.",
    status: "completed",
    createdAt: "2026-08-19T08:00:00.000Z",
    results: [1, 2, 3, 4].map((index) => ({ id: `result-${index}`, imageUrl: `/placeholder-${index}.png` })),
  },
  {
    id: "demo-budget-app",
    description: "A friendly personal budgeting app with a simple pocket motif.",
    status: "processing",
    createdAt: "2026-08-19T09:30:00.000Z",
    results: [],
  },
];
