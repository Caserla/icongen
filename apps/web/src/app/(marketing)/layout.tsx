import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/layouts/marketing-footer";
import { WorkspaceHeader } from "@/components/layouts/workspace-header";
import { getOptionalViewer } from "@/lib/auth/viewer";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const viewer = await getOptionalViewer();

  return (
    <div className="min-h-screen">
      <WorkspaceHeader viewer={viewer} />
      {children}
      <MarketingFooter />
    </div>
  );
}
