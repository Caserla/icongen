"use client";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Brand } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { UserMenu } from "@/components/layouts/user-menu";
import type { Viewer } from "@/lib/auth/viewer";
export function MarketingHeader({viewer}:{viewer:Viewer|null}){const{t}=useLocale();return <header className="butter-marketing-header sticky top-0 z-20"><div className="butter-marketing-header__inner"><Brand/><div className="ml-auto flex shrink-0 items-center gap-2">{viewer?<nav className="hidden items-center md:flex" aria-label="Main navigation"><Link href="/create" className="butter-nav-link focus-ring">{t("workspace")}</Link><Link href="/icons" className="butter-nav-link focus-ring">{t("myIcons")}</Link></nav>:null}<LanguageSwitch/>{viewer?<UserMenu viewer={viewer}/>:<ButtonLink href="/auth/sign-in" variant="quiet" className="hidden rounded-full sm:inline-flex">{t("signIn")}</ButtonLink>}</div></div></header>}
