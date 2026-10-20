"use client";
import { Copy } from "@/components/cms/content-provider";


import { useState } from "react";
import { sizeGuide } from "@/data/size-guide";
export function LengthReference() {
  const [unit, setUnit] = useState<"in" | "cm">("in");
  return (
    <section className="length-reference" aria-labelledby="length-reference-title">
      <div className="length-reference__heading"><div><p className="eyebrow"><Copy text={"SEEN ABAYAS — The size guide"} /></p><h2 id="length-reference-title"><Copy text={"Finding your perfect length."} /></h2></div>
        <div className="unit-switch" role="group" aria-label="Measurement unit">
          <button type="button" aria-pressed={unit === "in"} onClick={() => setUnit("in")}><Copy text={"Inches"} /></button>
          <button type="button" aria-pressed={unit === "cm"} onClick={() => setUnit("cm")}><Copy text={"Centimetres"} /></button>
        </div>
      </div>
      <p><Copy text={"Choose your abaya length using the SEEN size guide below. Sizes 54, 56 and 58 describe garment length in inches, rather than a UK dress size."} /></p>
      <div className="length-reference__table-wrap"><table>
        <caption><Copy text={"SEEN abaya lengths and suggested heights. Centimetre lengths are rounded."} /></caption>
        <thead><tr><th scope="col"><Copy text={"Size"} /></th><th scope="col"><Copy text={"Abaya length"} /></th><th scope="col"><Copy text={"Suggested height"} /></th></tr></thead>
        <tbody>{sizeGuide.map((row) => <tr key={row.size}><th scope="row">{row.size}</th><td>{unit === "in" ? `${row.size} in / ${row.lengthCm} cm` : `${row.lengthCm} cm / ${row.size} in`}</td><td><span>{unit === "in" ? row.heightFeet : row.heightCm}</span><span className="length-reference__secondary">{unit === "in" ? `(${row.heightCm})` : `(${row.heightFeet})`}</span></td></tr>)}</tbody>
      </table></div>
      <p className="content-note"><Copy text={"Suggested heights are a guide. Your preferred hem length, footwear and the shape of each design can affect the fit. Check each product for available sizes and contact us for chest, sleeve or other measurements."} /></p>
    </section>
  );
}
