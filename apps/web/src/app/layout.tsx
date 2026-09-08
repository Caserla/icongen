import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./light-theme.css";
import { LocaleProvider } from "@/components/i18n/locale-provider";

export const metadata: Metadata = {
  title: {
    default: "EASY ICON — AI UI Icon Generator",
    template: "%s · EASY ICON",
  },
  description:
    "Create consistent UI icon PNGs, with three options for every icon.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('icongen-theme')||'dark';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch{document.documentElement.dataset.theme='dark'}` }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
import "./page-state.css";
