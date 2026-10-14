import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create an EASY ICON account.",
};
export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
