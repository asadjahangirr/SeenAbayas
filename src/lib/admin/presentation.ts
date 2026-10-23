import type { AdminSection } from "./model";

export const adminNavigation: { label: string; sections: AdminSection[] }[] = [
  { label: "Run your shop", sections: ["dashboard", "orders", "products", "categories", "inbox", "finance", "coupons"] },
  { label: "Edit your website", sections: ["content", "hero", "media", "appearance", "settings"] },
  { label: "Your account", sections: ["history", "security"] },
];
export const sectionDescriptions: Record<AdminSection, string> = {
  dashboard: "Your orders, stock and website updates in one place.",
  products: "Change the pieces, prices, photographs and sizes customers see in your collection.",
  categories: "Organise the category choices on your collection page.",
  orders: "Review purchases, prepare parcels and add tracking details.",
  inbox: "Read messages customers send through Contact Us.",
  finance: "Review received payments and record business expenses.",
  coupons: "Prepare discount codes. Customer redemption is not available yet.",
  content: "Choose a website page, find its wording and edit it below.",
  hero: "Change the opening film and collection button on your homepage.",
  media: "Upload photos and videos, then choose where they appear.",
  appearance: "Choose website colours, movement and the products featured on Home.",
  settings: "Change delivery charges, the announcement banner and business information.",
  history: "Review previous changes and bring an earlier website version back as a draft.",
  security: "Manage your password, recovery email and administrator access.",
};
export const sectionDestinations: Partial<Record<AdminSection, { name: string; path: string }>> = {
  products: { name: "Collection and product pages", path: "/collection" },
  categories: { name: "Collection category menu", path: "/collection" },
  content: { name: "Website wording", path: "/" },
  hero: { name: "Homepage opening film", path: "/" },
  media: { name: "Your chosen website pages", path: "/" },
  appearance: { name: "Website colours and homepage products", path: "/" },
  settings: { name: "Delivery, announcement and information pages", path: "/shipping-delivery" },
};

const pages = [
  ["our-story", "Our Story"], ["contact", "Contact Us"], ["size-guide", "Size Guide"], ["faqs", "FAQs"],
  ["shipping-delivery", "Shipping & Delivery"], ["returns-exchanges", "Returns & Exchanges"],
  ["privacy-policy", "Privacy Policy"], ["terms-conditions", "Terms & Conditions"], ["cookie-policy", "Cookie Policy"],
  ["order-confirmation", "Order Confirmation"], ["checkout", "Checkout"], ["bag", "Shopping Bag"],
] as const;
export function copyLocation(source: string): { name: string; path: string } | null {
  const group = source.toLowerCase().split(" · ");
  if (group.includes("api") || group.includes("proxy") || group.includes("environment")) return null;
  for (const [path, name] of pages) if (group.some(part => part === path || part.startsWith(`${path}-`))) return { name, path: `/${path}` };
  if (group.includes("payments")) return { name: "Checkout", path: "/checkout" };
  if (group.includes("home") || group.includes("page") || group.includes("film-hero") || group.includes("featured-collection")) return { name: "Homepage", path: "/" };
  if (group.includes("product")) return { name: "Product pages", path: "/collection" };
  if (group.includes("collection")) return { name: "Collection", path: "/collection" };
  if (group.some(part => /header|logo|announcement/.test(part))) return { name: "Header & announcement", path: "/" };
  if (group.some(part => /footer/.test(part))) return { name: "Footer", path: "/" };
  if (group.includes("store")) return { name: "Navigation & shared wording", path: "/" };
  if (group.includes("content") || group.includes("not-found")) return { name: "Information pages", path: "/our-story" };
  return null;
}
export function customerCopy(entries: { text: string; groups: string[] }[]) {
  return entries.flatMap(entry => {
    const places = [...new Map(entry.groups.map(copyLocation).filter((v): v is NonNullable<typeof v> => v !== null).map(v => [v.name, v])).values()];
    // Source tokens and internal diagnostics are not website wording controls.
    if (!places.length || (!entry.text.includes(" ") && entry.text === entry.text.toLowerCase()) || /SUPABASE_|STRIPE_|PAYMENTS_|\bRPC\b|\bAPI\b|PGRST|application\/json|^cross-site$/.test(entry.text)) return [];
    return [{ ...entry, places }];
  });
}
