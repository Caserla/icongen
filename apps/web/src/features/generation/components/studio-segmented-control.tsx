type Option<T extends string> = { value: T; label: string };

export function StudioSegmentedControl<T extends string>({ value, options, onChange, ariaLabel, className = "", size = "medium" }: {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
  size?: "small" | "medium";
}) {
  return <div className={`studio-segmented ${className}`.trim()} aria-label={ariaLabel}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`draft-option ${size === "small" ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm"} font-semibold`}>
      {option.label}
    </button>)}
  </div>;
}
