import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { FavoritesProvider } from "@/features/generation/components/favorites-drawer";
import { myIconsEnabled } from "@/lib/product-features";

export default function IconsLayout({ children }: { children: ReactNode }) {
  if (!myIconsEnabled) redirect("/create");
  return <FavoritesProvider>{children}</FavoritesProvider>;
}
