"use client";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Brand } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { UserMenu } from "@/components/layouts/user-menu";
import type { Viewer } from "@/lib/auth/viewer";
export function MarketingHeader({viewer}:{viewer:Viewer|null}){const{t}=useLocale();return <header className="sticky top-3 z-20 mx-auto mt-3 max-w-7xl px-3"><div className="surface-elevated flex min-h-17 items-center justify-between gap-3 rounded-[5px] border border-[#77736b] bg-[#fffaf0] px-4 sm:px-5"><Brand/><div className="ml-auto flex shrink-0 items-center gap-3">{viewer?<nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation"><Link href="/create" className="nav-draft-link focus-ring whitespace-nowrap px-3 py-2 text-sm font-bold text-muted transition hover:bg-surface-muted hover:text-foreground">{t("workspace")}</Link><Link href="/icons" className="nav-draft-link focus-ring whitespace-nowrap px-3 py-2 text-sm font-bold text-muted transition hover:bg-surface-muted hover:text-foreground">{t("myIcons")}</Link></nav>:null}<LanguageSwitch/>{viewer?<UserMenu viewer={viewer}/>:<ButtonLink href="/auth/sign-in" variant="quiet" className="hidden sm:inline-flex">{t("signIn")}</ButtonLink>}</div></div></header>}
