import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/layouts/marketing-header";
import { getOptionalViewer } from "@/lib/auth/viewer";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const viewer = await getOptionalViewer();
  return (
    <div className="min-h-screen">
      <MarketingHeader viewer={viewer} />
      {children}
    </div>
  );
}
