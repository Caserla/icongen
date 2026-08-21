import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LocaleProvider } from "@/components/i18n/locale-provider";

export const metadata: Metadata = {
  title: {
    default: "Bamboo IconGen — AI UI Icon Generator",
    template: "%s · Bamboo IconGen",
  },
  description: "Generate production-ready UI icon sets with three variants per icon.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-background text-foreground"><LocaleProvider>{children}</LocaleProvider></body>
    </html>
  );
}
