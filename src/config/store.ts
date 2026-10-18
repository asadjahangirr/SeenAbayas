export const store = {
  name: "SEEN ABAYAS",
  slogan: "Made to Be Seen.",
  supportEmail: "info@seenabayas.co.uk",
  freeStandardDeliveryThresholdPence: 8_000,
} as const;

// Story and contact stay on the homepage until their dedicated pages are built.
export const navigation = [
  { label: "Home", href: "/#home" },
  { label: "Collection", href: "/collection" },
  { label: "Our Story", href: "/#our-story" },
  { label: "Contact Us", href: "/#contact" },
] as const;

export const deliveryThreshold = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
}).format(store.freeStandardDeliveryThresholdPence / 100);
