export type CheckoutInformationMode = "preview" | "test" | "live";

/** Describe the actual checkout capability without inventing merchant policies. */
export function checkoutPublicCopy(mode: CheckoutInformationMode) {
  const live = mode === "live";
  return {
    ordering: live
      ? ", select an available size and add it to your bag. At checkout, enter your contact and UK delivery details, review the final total and continue to secure payment with Stripe. Continuing reserves the selected pieces temporarily. Your order is confirmed after payment is verified. If a delivery charge is unavailable, that selection cannot proceed to payment."
      : ", select an available size on a product page and add it to your bag. You can review your contact and delivery details in the checkout preview. Reviewing does not place an order or reserve stock. If test payment is enabled, continuing creates a private sandbox checkout with a temporary reservation. It does not make a real purchase.",
    methods: live
      ? "Secure checkout supports card payments and eligible Apple Pay, Klarna and Clearpay options through Stripe. The methods available for your device, order and eligibility are shown on the payment page."
      : "Real-money payments are not enabled for this checkout. Test checkout supports cards, Apple Pay, Klarna and Clearpay where Stripe makes them available. No real money is charged during testing.",
    eligibility: live
      ? "Stripe shows eligible options for the account, customer, device and order. Apple Pay requires a compatible device and wallet setup. Klarna and Clearpay make their own eligibility decisions and display their applicable payment terms before you choose them."
      : "The store is being configured for Apple Pay, Klarna and Clearpay. Stripe shows eligible options for the account, customer, device and order; an enabled method is not guaranteed for every checkout. Real purchasing remains unavailable during testing.",
    orderPrivacy: live
      ? "Reviewing checkout sends your contact and UK delivery details to our server for validation. Continuing to payment saves a private order in Supabase, temporarily reserves stock and sends the necessary customer, delivery and item information to Stripe-hosted Checkout. Payment details are entered on Stripe, not on this website. The website verifies payment before confirming the order. A secure browser cookie authorises access to your order status; it is not a public order lookup. When order emails are enabled, the confirmed purchase details are used for your confirmation and the store's order notification."
      : "The checkout preview sends your entered contact and UK delivery details to our server when you request a review. They are validated and returned to the current page, without being saved as an order or stored in your browser. Reloading clears those details. Reviewing alone does not collect payment details or reserve stock. When test payments are enabled, continuing saves a private test order in Supabase, temporarily reserves stock and sends the required customer, delivery and item details to Stripe-hosted Checkout. Use test customer details. Payment details are entered on Stripe, not on this website.",
    termsOrdering: live
      ? "Choose an available product and size, review your bag, enter your delivery and contact details and review the payable total before continuing to Stripe. You can correct your details before continuing. Payment creates a confirmed store order only after verification; a failed or pending payment is not shown as a confirmed purchase. Adding to the bag or reviewing details alone does not reserve stock or take payment. Final contract-acceptance wording remains subject to the business's review of these draft terms."
      : "The website supports browsing, a shopping bag and a checkout review preview. Real-money payments and commercial order placement are not available in this checkout mode. Sandbox checkout may be enabled for testing: it saves private test orders and temporarily reserves stock, without a purchase contract or dispatch. Adding a piece or reviewing your details does not reserve stock, take payment or create a purchase contract.",
    termsPayments: live
      ? "The final GBP total, delivery charge and any added tax are displayed for review before payment. The current checkout adds no tax; this statement does not establish VAT registration or exemption. Payments use Stripe-hosted Checkout. Available methods are shown there and remain subject to provider, customer and device eligibility."
      : "Live payments are not enabled in this checkout mode. Test checkout uses sandbox totals without charging real money. The final commercial payable total, any applicable taxes, delivery costs and available payment methods must be disclosed before live payment. An option is available only when shown at the active checkout.",
    inactiveFeatures: live
      ? "Customer accounts and newsletter subscriptions are not active. Real-money checkout processes order and payment information as described above. The storefront has no analytics or advertising trackers. The business must confirm order, email and provider retention arrangements and complete review of this draft policy."
      : "Customer accounts, real-money payments and newsletter subscriptions are not active in this checkout mode. Sandbox payments may be enabled for testing; test orders are private and do not purchase garments. The business must confirm test-order retention and the final order/payment privacy disclosures before launch. The storefront has no analytics or advertising trackers.",
  };
}
