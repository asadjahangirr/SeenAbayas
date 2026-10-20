import type { AdminSection } from "@/lib/admin/model";

const help: Record<AdminSection, string[]> = {
  dashboard: [
    "Use Products & stock to add a piece or change sizes and stock.",
    "Use Website text, Hero video and Media library to change the website.",
    "View the store opens the public website. Preview draft shows saved private changes.",
  ],
  products: [
    "Add a product, enter its name, price in pounds and description, then choose photographs and stock per size.",
    "Visible in store + Save & show in store makes the product public. Hidden draft keeps it private.",
    "Tick several products or Select all matching products, then Show in collection or Hide from collection. Saved details must be complete; an incomplete selection is not partly published. Show/Hide on a row works without opening Edit. View opens its public product page.",
    "Choose its category here. Homepage pieces are selected separately in Appearance & motion.",
    "Owners can Delete unused products permanently. Products with orders or reserved stock must be archived; uploaded files stay in the library.",
  ],
  categories: [
    "Add a category and enter its name. Its link name is filled automatically.",
    "Save category shows it in the collection's Category menu, including categories with no products yet.",
    "Assign products to it in Products & stock. Move assigned products before deleting a category.",
  ],
  orders: [
    "Open an order for its saved products, sizes, quantities, prices, customer contact and delivery address. Later catalogue edits do not change purchased item details.",
    "Filter payment and fulfilment separately, or show only customer/test orders. Paid means provider-confirmed payment; awaiting confirmation must not be dispatched.",
    "Edit fulfilment, tracking and notes, then save. Export CSV downloads the filtered orders with one row per purchased size. Order totals repeat on each row; use line totals when summing items.",
    "Refresh payment statuses checks Stripe for up to five reserved checkouts. Repeat for more. Payment state cannot be edited manually.",
    "Test orders are labelled Do not dispatch and excluded from commercial totals. This screen cannot charge or refund a customer.",
  ],
  inbox: [
    "Open a message to read it, mark it read or archive it.",
    "Reply by email opens your email app. It does not send an email automatically.",
    "New website messages need the contact email and optional inbox integration to be configured.",
  ],
  finance: [
    "Add an expense with an amount in pounds, a date and a note.",
    "Edit or delete recorded expenses below. Totals update after saving.",
    "Cash after expenses uses recorded payments and expenses; it is not an accounting profit calculation.",
  ],
  coupons: [
    "Add a code, choose percentage or a fixed amount in pounds, and enter its discount.",
    "Set an optional expiry and usage limit. Save the coupon or turn Active off to disable it.",
    "Customer redemption starts when checkout is connected. A saved coupon does not enable payment.",
  ],
  hero: [
    "Browse videos to upload an MP4 from your computer or reuse a library file. Add or reorder clips to play them in sequence.",
    "Choose a poster image for loading and reduced-motion visitors; set the button's destination.",
    "Save & update store applies your changes. Edit the slogan or button wording in Website text.",
  ],
  media: [
    "Upload JPG, PNG, WebP or MP4 files from your computer, up to 25 MB each and 20 files at a time. Uploading alone does not place a file on a page.",
    "Use on a page adds an image/video section. Choose the target page and position, add a description/caption, then Save & update store. The same file can be reused on several pages.",
    "Browse buttons throughout the admin open the same visual library. Logo/product-photo slots take images; video slots take MP4. Page sections accept either. Files in use cannot be deleted.",
  ],
  content: [
    "Search for the words currently visible on the website, or filter by page.",
    "Enter a replacement. Repeated matching phrases are shared; Reset restores the original.",
    "Save & update store applies the text immediately. Save draft + Preview draft is available for private review.",
  ],
  appearance: [
    "Choose the website colours and scroll/hover effects. Reduced-motion preferences are respected.",
    "Select the published products to feature in the homepage edit.",
    "Save & update store applies these choices. Products still appear in the full collection independently.",
  ],
  settings: [
    "Change the delivery banner, free delivery threshold and confirmed business information.",
    "Amounts are in pounds. Unknown legal or delivery information can stay blank until confirmed.",
    "Save & update store applies the settings. API keys and payment provider accounts are configured separately.",
  ],
  history: [
    "A published content update creates a saved revision.",
    "Restore brings a revision back as a draft. Preview it, then Save & update store in a content section.",
    "Activity lists catalog, content and record changes. It does not contain passwords or API keys.",
  ],
  security: [
    "Use your current password and a fresh authenticator code to change account details.",
    "Confirm email changes using the messages sent by Supabase.",
    "Password changes sign out sessions. Contact your project owner if you lose your authenticator.",
  ],
};
export function AdminPageHelp({ section }: { section: AdminSection }) {
  return (
    <details className="admin-help">
      <summary>How to use this page</summary>
      <ol>
        {help[section].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
