export const store = {
  name: "SEEN ABAYAS",
  slogan: "Made to Be Seen.",
  supportEmail: "info@seenabayas.co.uk",
  freeStandardDeliveryThresholdPence: 8_000,
} as const;

export const navigation = [
  { label: "Home", href: "/" },
  { label: "Collection", href: "/collection" },
  { label: "Our Story", href: "/our-story" },
  { label: "Contact Us", href: "/contact" },
] as const;

export const helpNavigation = [
  { label: "Shipping & Delivery", href: "/shipping-delivery" },
  { label: "Returns & Exchanges", href: "/returns-exchanges" },
  { label: "Size Guide", href: "/size-guide" },
  { label: "FAQs", href: "/faqs" },
] as const;

export const legalNavigation = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-conditions" },
  { label: "Cookie Policy", href: "/cookie-policy" },
] as const;

export const deliveryThreshold = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
}).format(store.freeStandardDeliveryThresholdPence / 100);
