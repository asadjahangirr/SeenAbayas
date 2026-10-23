"use client";
import type { ReactNode } from "react";
import type { AdminProduct } from "@/lib/admin/model";
import { missingShippingSettings, type ShippingSettings } from "@/lib/shipping/settings";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}
export function ShippingSettingsEditor({ value, products, onChange }: {
  value: ShippingSettings; products: AdminProduct[]; onChange: (value: ShippingSettings) => void;
}) {
  const update = <K extends keyof ShippingSettings>(key: K, next: ShippingSettings[K]) => onChange({ ...value, [key]: next });
  const number = (key: "packagingWeightGrams" | "lengthMm" | "widthMm" | "heightMm" | "maxItemsPerParcel", label: string, factor = 1) =>
    <Field label={label}><input type="number" inputMode="decimal" min={key === "packagingWeightGrams" ? 0 : 1/factor}
      step={1/factor} value={value[key] === null ? "" : value[key]! / factor}
      onChange={e => update(key, e.target.value === "" ? null : Math.round(Number(e.target.value) * factor))} /></Field>;
  const missing = missingShippingSettings(value);
  return <section className="admin-panel">
    <div className="admin-panel__heading"><h2>Royal Mail & parcel setup</h2>
      <p>Set your measured packaging and garment weights. Checkout uses additional parcels when an order exceeds one parcel's capacity. No labels or postage are purchased here.</p></div>
    <div className="admin-fields">
      <Field label="Delivery calculation"><select value={value.mode} onChange={e => update("mode", e.target.value as ShippingSettings["mode"])}>
        <option value="fixed">Admin fixed delivery fee</option><option value="royal_mail_olp">Royal Mail pay-as-you-go prices</option></select></Field>
      <Field label="Royal Mail account type"><select value={value.accountType} onChange={e => update("accountType", e.target.value as ShippingSettings["accountType"])}>
        <option value="unknown">Not confirmed</option><option value="olp">Click & Drop pay-as-you-go</option><option value="oba">Click & Drop Online Business Account</option><option value="developer_portal">Royal Mail developer portal API</option></select></Field>
      <Field label="Dispatch postcode"><input value={value.dispatchPostcode} maxLength={12} onChange={e => update("dispatchPostcode", e.target.value.toUpperCase())} /></Field>
      <Field label="Parcel format"><select value={value.packageFormat} onChange={e => update("packageFormat", e.target.value as ShippingSettings["packageFormat"])}>
        <option value="SmallParcel">Small parcel</option><option value="MediumParcel">Medium parcel</option></select></Field>
      {number("packagingWeightGrams", "Empty packaging weight (g)")}
      {number("lengthMm", "Packed parcel length (cm)", 10)}
      {number("widthMm", "Packed parcel width (cm)", 10)}
      {number("heightMm", "Packed parcel height (cm)", 10)}
      {number("maxItemsPerParcel", "Maximum pieces this parcel holds")}
      <Field label="Standard Royal Mail service code"><input value={value.standardServiceCode} maxLength={30} onChange={e => update("standardServiceCode", e.target.value)} /></Field>
      <Field label="Express Royal Mail service code"><input value={value.expressServiceCode} maxLength={30} onChange={e => update("expressServiceCode", e.target.value)} /></Field>
      <Field label="Royal Mail price interpretation"><select value={value.priceBasis} onChange={e => update("priceBasis", e.target.value as ShippingSettings["priceBasis"])}>
        <option value="unconfirmed">Not verified yet</option><option value="cost_includes_vat">Cost already includes carrier VAT</option><option value="cost_plus_vat">Add cost and carrier VAT</option></select></Field>
    </div>
    <p className="admin-caption">Verify service codes and the price interpretation against your own Royal Mail quote. The store's zero added product tax does not remove VAT included in postage. OBA/developer-portal credentials are different integrations; selecting a type does not convert the key.</p>
    <p className="admin-caption">Maximum pieces applies to each parcel, not the whole order. Checkout splits garments across additional parcels using the saved capacity and weight limits, includes packaging weight for every parcel, and combines their prices. Confirm how many garments fit the measured packaging; no weights or dimensions are guessed. Standard delivery is free when the enabled offer's threshold is reached, including multi-parcel orders.</p>
    {missing.length > 0 && <p className="admin-caption">Setup still needs: {missing.join(", ")}.</p>}
    <h3>Garment weight by size</h3>
    <p className="admin-caption">Enter the garment weight without packaging. Only sizes with a confirmed weight can use carrier-calculated checkout. Save & update store publishes these settings.</p>
    {products.filter(product => product.status !== "archived").map(product => <details className="admin-policy-group" key={product.id}>
      <summary>{product.name || product.design_reference}</summary>
      <div className="admin-fields">{product.variants.filter(variant => variant.active).map(variant => <Field key={variant.id} label={`${product.name || product.design_reference} · size ${variant.size_label} weight (g)`}>
        <input type="number" inputMode="numeric" min={1} max={20000} step={1} value={value.variantWeights[variant.id] ?? ""}
          onChange={e => { const weights = { ...value.variantWeights }; if (e.target.value === "") delete weights[variant.id]; else weights[variant.id] = Number(e.target.value); update("variantWeights", weights); }} />
      </Field>)}</div>
    </details>)}
  </section>;
}
