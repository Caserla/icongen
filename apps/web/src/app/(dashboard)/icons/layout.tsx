import type { ReactNode } from "react";
import { FavoritesProvider } from "@/features/generation/components/favorites-drawer";

export default function IconsLayout({ children }: { children: ReactNode }) {
  return <FavoritesProvider>{children}</FavoritesProvider>;
}
