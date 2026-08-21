import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (user.app_metadata.role !== "admin") notFound();
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-10">{children}</main>;
}
