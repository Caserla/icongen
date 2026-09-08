import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create an ICON GEN account and receive 6 experience credits.",
};
export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
