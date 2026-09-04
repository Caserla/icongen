import type { CSSProperties } from "react";

export function StudioRange({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  decimals = 0,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  decimals?: number;
  onChange: (value: number) => void;
}) {
  const progress = (value / max) * 100;
  const normalizedValue = value.toFixed(decimals);
  const clamp = (nextValue: number) =>
    onChange(Math.min(max, Math.max(min, nextValue)));

  return (
    <div
      className={`studio-range ${value >= max ? "is-max" : ""}`}
      style={{ "--range-progress": `${progress}%` } as CSSProperties}
    >
      <span className="studio-range__header">
        <span className="studio-range__label">{label}</span>
        <span className="studio-range__value">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={normalizedValue}
            onChange={(event) => clamp(Number(event.target.value))}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={`${label} value`}
          />
          {suffix}<span>/{max}{suffix}</span>
        </span>
      </span>
      <input
        className="studio-range__input"
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onInput={(event) => clamp(Number(event.currentTarget.value))}
        aria-label={label}
      />
    </div>
  );
}
