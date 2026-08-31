export type IconPurpose = "interaction" | "app-icon";

export function IconPurposeSelector({ value, onChange, locale }: { value: IconPurpose; onChange: (value: IconPurpose) => void; locale: "en" | "zh" }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    {(["interaction", "app-icon"] as const).map((purpose) => {
      const selected = value === purpose;
      const title = locale === "zh" ? (purpose === "interaction" ? "App 交互图标" : "App 插画图标") : purpose === "interaction" ? "App interaction icons" : "App illustration icons";
      const description = locale === "zh" ? (purpose === "interaction" ? "用于 App 内的导航和操作，例如首页、搜索、返回、新增和删除。" : "用于手机桌面、启动器和应用商店，重点呈现单枚图标的品牌辨识度。") : purpose === "interaction" ? "For navigation and actions inside your app, such as home, search, back, add, and delete." : "For home screens, launchers, and app stores. Choose one standalone visual style with strong brand recognition.";
      return <button key={purpose} type="button" aria-pressed={selected} onClick={() => onChange(purpose)} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-brand bg-[#f2eeff] shadow-[0_3px_0_#6750E8]" : "border-border bg-background hover:border-[#b8aaf8]"}`}><span className="block font-black">{title}</span><span className="mt-1 block text-sm text-muted">{description}</span></button>;
    })}
  </div>;
}
