import Image from "next/image";
import Link from "next/link";
export function Brand() {
  return (
    <Link
      href="/"
      aria-label="EASY DESIGN / ICON GEN home"
      className="focus-ring flex shrink-0 items-center gap-3 rounded-xl text-lg font-black tracking-[-.035em]"
    >
      <span className="relative size-9 shrink-0 overflow-hidden rounded-xl">
        <Image
          src="/images/easy-design-brand-icon.png"
          alt=""
          fill
          priority
          sizes="36px"
          className="object-cover"
          aria-hidden="true"
        />
      </span>
      <span className="whitespace-nowrap">
        EASY DESIGN <span className="font-medium text-muted">/ ICON GEN</span>
      </span>
    </Link>
  );
}
