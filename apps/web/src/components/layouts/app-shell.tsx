"use client";

import type { ReactNode } from "react";
import { WorkspaceHeader } from "@/components/layouts/workspace-header";
import type { Viewer } from "@/lib/auth/viewer";

export function AppShell({
  children,
  viewer,
}: {
  children: ReactNode;
  viewer: Viewer | null;
}) {
  return (
    <div className="studio-shell min-h-screen">
      <WorkspaceHeader viewer={viewer} />
      <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 sm:pt-12">
        <main className="studio-main page-paper-enter relative min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
