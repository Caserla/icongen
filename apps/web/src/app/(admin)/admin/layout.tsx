import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-10">{children}</main>;
}
