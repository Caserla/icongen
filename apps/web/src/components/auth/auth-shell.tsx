import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
export function AuthShell({eyebrow,title,children}:{eyebrow:string;title:string;children:ReactNode}){return <main className="auth-studio min-h-screen p-4 sm:p-6"><header className="studio-panel mx-auto flex min-h-17 max-w-5xl items-center justify-between px-5"><Brand/><LanguageSwitch/></header><section className="studio-panel page-paper-enter relative mx-auto mt-10 max-w-lg overflow-hidden p-7 sm:p-10"><p className="draft-label text-accent">{eyebrow}</p><h1 className="display-serif mt-3 text-4xl leading-tight tracking-[-.045em] sm:text-5xl">{title}</h1>{children}</section></main>}
