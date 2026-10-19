
import { CmsAnchor } from "@/components/cms/anchor";
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <CmsAnchor href="/#home" className={`brand-logo ${className}`} aria-label="SEEN ABAYAS home">
      <span className="brand-logo__art" aria-hidden="true" />
    </CmsAnchor>
  );
}
