import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/layouts/marketing-footer";
import { WorkspaceHeader } from "@/components/layouts/workspace-header";
import { getOptionalViewer } from "@/lib/auth/viewer";
import css from "@/components/layouts/marketing-layout.module.css";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const viewer = await getOptionalViewer();

  return (
    <div className={css.surface}>
      <WorkspaceHeader viewer={viewer} />
      {children}
      <MarketingFooter />
    </div>
  );
}
