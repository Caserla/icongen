import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifiedRedirect } from "@/components/auth/verified-redirect";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getOptionalViewer } from "@/lib/auth/viewer";
export default async function VerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const viewer = await getOptionalViewer();
  if (!viewer) redirect("/auth/sign-in?error=invalid_callback");
  const params = await searchParams;
  const next = safeNextPath(
    Array.isArray(params.next) ? params.next[0] : params.next,
    "/create",
  );
  return (
    <AuthShell eyebrow="EASY ICON" title="">
      <VerifiedRedirect next={next} />
    </AuthShell>
  );
}
