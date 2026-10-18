import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <a href="/#home" className={`brand-logo ${className}`} aria-label="SEEN ABAYAS home">
      {/* Frame the supplied artwork without changing the original logo file. */}
      <Image
        className="brand-logo__image"
        src="/images/brand/logo.webp"
        alt="SEEN ABAYAS"
        width={1024}
        height={1536}
        sizes="150px"
      />
    </a>
  );
}
