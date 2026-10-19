"use client";
import { Copy } from "@/components/cms/content-provider";


import { useState } from "react";
export function LengthReference({ lengths }: { lengths: readonly number[] }) {
  const [unit, setUnit] = useState<"in" | "cm">("in");
  return (
    <section className="length-reference" aria-labelledby="length-reference-title">
      <div className="length-reference__heading"><div><p className="eyebrow"><Copy text={"Understanding length"} /></p><h2 id="length-reference-title"><Copy text={"A length reference."} /></h2></div>
        <div className="unit-switch" role="group" aria-label="Measurement unit">
          <button type="button" aria-pressed={unit === "in"} onClick={() => setUnit("in")}><Copy text={"Inches"} /></button>
          <button type="button" aria-pressed={unit === "cm"} onClick={() => setUnit("cm")}><Copy text={"Centimetres"} /></button>
        </div>
      </div>
      <p><Copy text={"A length label describes the garment length in inches, rather than a UK dress size. These conversions explain the temporary length options shown in our preview collection."} /></p>
      <div className="length-reference__table-wrap"><table>
        <caption><Copy text={"Reference conversions only — confirmed SEEN garment measurements will be added for each design."} /></caption>
        <thead><tr><th scope="col"><Copy text={"Length label"} /></th><th scope="col"><Copy text={"Length ("} /><Copy text={unit === "in" ? "inches" : "cm"} /><Copy text={")"} /></th></tr></thead>
        <tbody>{lengths.map((length) => <tr key={length}><th scope="row"><Copy text={length} /></th><td><Copy text={unit === "in" ? length : (length * 2.54).toFixed(2)} /></td></tr>)}</tbody>
      </table></div>
      <p className="content-note"><Copy text={"This is a conversion reference, not a confirmed size chart. Bust, sleeve, fit and actual garment lengths are being confirmed. Please contact us for measurements before choosing a size."} /></p>
    </section>
  );
}
