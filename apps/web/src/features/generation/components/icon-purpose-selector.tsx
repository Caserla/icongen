export type IconPurpose = "interaction" | "app-icon";

export function IconPurposeSelector({ value, onChange, locale }: { value: IconPurpose; onChange: (value: IconPurpose) => void; locale: "en" | "zh" }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    {(["interaction", "app-icon"] as const).map((purpose) => {
      const selected = value === purpose;
      const title = locale === "zh" ? (purpose === "interaction" ? "App 交互图标" : "App 图标") : purpose === "interaction" ? "App interaction icons" : "App icon";
      const description = locale === "zh" ? (purpose === "interaction" ? "用于 App 内的导航、操作、状态和功能入口，适合搜索、返回、新增、删除等成套小尺寸图标。" : "用于手机桌面、启动器和应用商店，强调品牌辨识度与单枚图标的高质量视觉表现。") : purpose === "interaction" ? "For in-app navigation, actions, states, and feature entry points such as search, back, add, and delete." : "For home screens, launchers, and app stores, with emphasis on brand recognition and a polished standalone visual.";
      return <button key={purpose} type="button" aria-pressed={selected} onClick={() => onChange(purpose)} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-brand bg-[#f2eeff] shadow-[0_3px_0_#6750E8]" : "border-border bg-background hover:border-[#b8aaf8]"}`}><span className="block font-black">{title}</span><span className="mt-1 block text-sm text-muted">{description}</span></button>;
    })}
  </div>;
}
