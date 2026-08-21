"use client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale } from "@/components/i18n/locale-provider";

export default function AdminPage() {
  const { locale, t } = useLocale();
  const labels = locale === "zh" ? ["用户", "生成任务", "支付与点数"] : ["Users", "Generation jobs", "Payments & credits"];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t("operations")} title={t("adminWorkspace")} description={t("adminCopy")} />
      <div className="grid gap-4 md:grid-cols-3">
        {labels.map((label) => <Card key={label}><h2 className="font-bold">{label}</h2><p className="mt-2 text-sm text-muted">{t("adminComing")}</p></Card>)}
      </div>
    </div>
  );
}
