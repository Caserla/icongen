import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/layouts/marketing-footer";
import { MarketingHeader } from "@/components/layouts/marketing-header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <MarketingHeader viewer={null} />
      {children}
      <MarketingFooter />
    </div>
  );
}
