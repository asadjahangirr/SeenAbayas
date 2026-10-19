"use client";
import { Copy } from "@/components/cms/content-provider";


import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { useBag } from "@/components/bag/bag-provider";
import { Button } from "@/components/ui/button";

export function BrowserStorageControls() {
  const { busy, ready, clearSavedBag } = useBag();
  const [result, setResult] = useState("");
  return <div className="storage-controls"><p><Copy text={"This removes every saved piece from your bag on this browser. It does not affect an order or delete an enquiry you have sent."} /></p><Button variant="secondary" disabled={busy || !ready} onClick={() => setResult({ cleared: "Your saved bag has been cleared on this browser.", blocked: "Your bag is empty, but browser storage could not be cleared. Please remove this site's saved data using your browser settings.", busy: "Please wait for the bag update to finish, then try again." }[clearSavedBag()])}><Copy text={"Clear saved bag"} /><ArrowRight size={16} strokeWidth={1.3} aria-hidden="true" /></Button><p className="storage-controls__status" role="status" aria-live="polite"><Copy text={result} /></p></div>;
}
