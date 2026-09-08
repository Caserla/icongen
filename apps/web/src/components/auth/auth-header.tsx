import { Brand } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { ThemeSwitch } from "@/components/i18n/theme-switch";

export function AuthHeader() {
  return (
    <header className="studio-header auth-header workspace-header relative z-30 mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8">
      <Brand />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <ThemeSwitch />
        <LanguageSwitch />
      </div>
    </header>
  );
}
