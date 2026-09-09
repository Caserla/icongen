import Link from "next/link";
export function Brand() {
  return (
    <Link
      href="/"
      aria-label="EASY ICON home"
      className="brand-wordmark focus-ring flex shrink-0 items-center gap-3 rounded-xl text-lg font-black tracking-[-.035em]"
    >
      <span className="whitespace-nowrap">
        EASY ICON
      </span>
    </Link>
  );
}
