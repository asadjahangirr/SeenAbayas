
import { Copy } from "@/components/cms/content-provider";
import Link from "@/components/cms/link";

export function PageBreadcrumb({ current }: { current: string }) {
  return (
    <nav className="page-breadcrumb" aria-label="Breadcrumb">
      <Link href="/"><Copy text={"Home"} /></Link><span aria-hidden="true"><Copy text={"/"} /></span><span aria-current="page"><Copy text={current} /></span>
    </nav>
  );
}
