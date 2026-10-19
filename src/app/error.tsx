"use client";
import { CmsAnchor } from "@/components/cms/anchor";

import { Copy } from "@/components/cms/content-provider";


import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="catalog-error container"><h1><Copy text={"We couldn't load the collection."} /></h1><p><Copy text={"Please try again in a moment, or contact customer care."} /></p><Button disabled={pending} onClick={() => startTransition(() => { router.refresh(); reset(); })}><Copy text={pending ? "Trying again" : "Try again"} /></Button><CmsAnchor className="text-link" href="mailto:info@seenabayas.co.uk"><Copy text={"Customer care"} /></CmsAnchor></div>;
}
