import type { ReactNode } from "react";
import { AppShell } from "@/components/layouts/app-shell";
import { getOptionalViewer } from "@/lib/auth/viewer";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const viewer = await getOptionalViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
