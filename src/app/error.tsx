"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="catalog-error container"><h1>We couldn&apos;t load the collection.</h1><p>Please try again in a moment, or contact customer care.</p><Button disabled={pending} onClick={() => startTransition(() => { router.refresh(); reset(); })}>{pending ? "Trying again" : "Try again"}</Button><a className="text-link" href="mailto:info@seenabayas.co.uk">Customer care</a></div>;
}
