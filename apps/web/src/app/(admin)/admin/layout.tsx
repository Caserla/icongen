import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/features/admin/server/admin-auth";
import { AdminHeader } from "@/features/admin/components/admin-header";

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
    <main className="admin-studio min-h-screen bg-background">
      <AdminHeader />
      <div className="mx-auto max-w-[1500px] px-5 py-8">{children}</div>
    </main>
  );
}
