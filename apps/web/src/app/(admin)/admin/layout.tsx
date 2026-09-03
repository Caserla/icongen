import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminUser } from "@/features/admin/server/admin-auth";
import { Brand } from "@/components/ui/brand";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireAdminUser();
  } catch {
    notFound();
  }
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between px-5">
          <div className="flex items-center gap-5">
            <Brand />
            <span className="rounded-full bg-foreground px-3 py-1 text-xs font-black text-white">
              管理后台
            </span>
          </div>
          <Link
            href="/icons"
            className="focus-ring text-sm font-black text-muted hover:text-foreground"
          >
            返回产品
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-5 py-8">{children}</div>
    </main>
  );
}
