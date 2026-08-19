import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/layouts/marketing-header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      {children}
    </div>
  );
}
