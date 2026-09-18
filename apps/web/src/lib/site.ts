import { myIconsEnabled } from "@/lib/product-features";

const navigation = [
  { href: "/create", label: "Create" },
  ...(myIconsEnabled ? [{ href: "/icons", label: "My Icons" }] : []),
  { href: "/pricing", label: "Pricing" },
] as const;

export const siteConfig = {
  name: "EASY ICON",
  brandName: "EASY ICON",
  productName: "EASY ICON",
  description:
    "Create consistent UI icon sets with three options for every icon.",
  navigation,
} as const;
