# SEEN ABAYAS — COMPLETE E-COMMERCE WEBSITE DEVELOPMENT MASTER PLAN

## PROJECT NAME
SEEN ABAYAS

## BRAND SLOGAN
Made to Be Seen.

## SECONDARY BRAND SLOGAN
Elegance that speaks for itself.

## BRAND CATEGORY
Luxury Modest Fashion / Abayas / Women's Fashion

## BUSINESS LOCATION
United Kingdom

## WEBSITE CURRENCY
GBP (£)

## CUSTOMER SUPPORT EMAIL
info@seenabayas.co.uk

## TECHNOLOGY
React, Next.js, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Stripe and Royal Mail integration.

---

# 1. MASTER INSTRUCTIONS FOR THE CODING AGENT

Build a complete, modern, professional, fully responsive, luxury e-commerce website for a UK-based modest fashion brand named SEEN ABAYAS.

This must be a genuinely elegant fashion website, not a generic e-commerce template.

The brand sells eight different abaya designs.

The website must use a modern minimalist luxury aesthetic with a predominantly white background, sophisticated typography, beautiful product photography, subtle transitions, thoughtful spacing, and a premium fashion-boutique shopping experience.

The main visual goal is simplicity combined with luxury.

The website must feel like a real premium women's fashion brand.

Design inspiration should come from contemporary minimalist luxury fashion boutiques and refined clothing e-commerce websites.

The website should not resemble:
- An electronics store
- A large discount marketplace
- A cluttered Shopify template
- An overly decorative Arabic-themed website
- A traditional gold-and-black luxury store
- A SaaS landing page
- A generic AI-generated website

Instead, it should resemble a modern boutique with beautiful product photography, generous white space, carefully selected typography, and an elegant shopping journey.

Do not copy the identity, logos, protected images, or distinctive creative assets of another brand.

If an existing Next.js project is provided, inspect its structure before making changes. Preserve working components and existing integrations wherever reasonable. Avoid unnecessary rebuilding or changing filenames.

All functionality must be real and properly connected.

Do not create non-functional placeholder buttons, fake payment integrations, fake customer reviews, invented products, or simulated successful orders.

Where credentials, business information, actual product assets, or pricing are missing, create configuration points and safe incomplete states rather than inventing real business data.

Prioritize:
1. Beautiful and consistent design
2. Smooth user experience
3. Mobile responsiveness
4. Product presentation
5. Functional shopping cart
6. Secure checkout
7. Royal Mail delivery workflow
8. Customer communication
9. Performance
10. Accessibility and security

---

# 2. COMPLETE BRAND IDENTITY

Brand Name: SEEN ABAYAS

Primary slogan:

"Made to Be Seen."

Secondary slogan:

"Elegance that speaks for itself."

Additional brand statement:

"Timeless modesty. Effortless elegance."

Brand personality:
- Elegant
- Minimal
- Feminine
- Confident
- Refined
- Timeless
- Sophisticated
- Contemporary
- Modest
- Luxurious

Brand message:

SEEN ABAYAS believes modesty and style can coexist effortlessly.

Founded by sisters, the brand celebrates timeless elegance, individuality and confidence through thoughtfully selected modern modestwear.

The website must communicate these values visually through clean design, premium imagery and understated messaging.

Avoid exaggerated marketing language, unnecessary sales banners or aggressive promotional popups.

---

# 3. COMPLETE WEBSITE COLOR THEME

The primary background must be WHITE.

Use approximately 85–90% white and very light neutral surfaces across the website.

Recommended design tokens:

Primary White:
#FFFFFF

Soft Black:
#171717

Ivory:
#F7F5F1

Light Beige:
#F3F0EB

Stone:
#E8E3DB

Muted Taupe:
#A79D91

Secondary Grey:
#737373

Light Grey Borders:
#E9E7E3

Sale/Warning Red:
#B3262D

Success Green:
#357A52

Main text:
#171717

Secondary text:
#737373

Primary background:
#FFFFFF

Secondary section background:
#F7F5F1

Product image background:
#F8F8F7, unless actual photography has its own natural background.

Primary button:
Black background and white text.

Secondary button:
White background, black text, thin black border.

Hover primary button:
#333333

Focus states:
Visible and accessible dark outline.

Use muted beige and taupe only as supporting accents.

Do not use:
- Neon colors
- Strong purple gradients
- Excessive gold
- Large colored backgrounds throughout the site
- Glowing buttons
- Excessive drop shadows

Keep the overall interface clean, calm and premium.

---

# 4. TYPOGRAPHY

Typography must feel like a modern luxury fashion brand.

Recommended fonts:

Primary editorial heading font:
Cormorant Garamond

Body and navigation font:
Inter

Use serif typography sparingly for large campaign headings, brand storytelling and selected editorial headings.

Use clean sans-serif typography for product listings, navigation, forms, prices and buttons.

Recommended sizes:

Desktop Hero Heading:
56–72px

Mobile Hero Heading:
32–42px

Main Section Heading:
32–42px

Mobile Section Heading:
26–32px

Product Detail Title:
28–36px

Product Card Title:
14–16px

Body Text:
15–16px

Navigation:
12–13px

Buttons:
12–14px

Captions:
12–13px

Footer Links:
13–14px

Letter spacing:
Navigation and small labels should use subtle letter spacing.

Buttons should use semibold or medium uppercase text.

Avoid using bold typography everywhere.

The combination of elegant serif headings and clean sans-serif body text should create a premium fashion aesthetic.

---

# 5. GLOBAL LAYOUT AND SPACING

Maximum content width:
1360px

Desktop horizontal padding:
40–48px

Tablet horizontal padding:
24px

Mobile horizontal padding:
16px

Desktop section spacing:
72–96px

Mobile section spacing:
40–56px

Product card gaps:
16–24px

Button minimum height:
44–48px

Primary button border radius:
2–4px

Product card border radius:
0–4px

Avoid large rounded corners.

Product images should generally have a 3:4 or 4:5 portrait aspect ratio.

Use consistent alignment across every page.

Promotional banners may occupy full screen width.

Product grids and editorial text sections should use centered content containers.

The website must never have unwanted horizontal scrolling.

---

# 6. WEBSITE PAGE STRUCTURE

Create the following 15 core page types:

1. Home
2. Shop All
3. Individual Product Details
4. Our Story / About Us
5. Contact Us
6. Shipping & Delivery
7. Returns & Exchanges
8. Size Guide
9. FAQs
10. Shopping Bag
11. Checkout
12. Order Confirmation
13. Privacy Policy
14. Terms & Conditions
15. Cookie Policy

There must be eight individual product detail pages, one per abaya design.

This produces approximately 22 customer-facing page URLs, counting each product page separately.

An optional customer account feature can be added if appropriate.

Recommended URLs:

/
 
/shop

/products/[slug]

/our-story

/contact

/shipping-delivery

/returns-exchanges

/size-guide

/faqs

/cart

/checkout

/order-confirmation

/privacy-policy

/terms-conditions

/cookie-policy

Optional:
/account
/account/orders
/account/addresses

Keep URLs readable and SEO friendly.

---

# 7. TOP ANNOUNCEMENT BAR

The website must have a full-width promotional announcement banner running across the very top of every public page.

Exact announcement text:

"COMPLIMENTARY UK DELIVERY ON ORDERS OVER £80"

Requirements:
- Full width
- Black background
- White text
- Center aligned
- Small uppercase typography
- Approximately 36–40px height
- Consistent on desktop and mobile
- Visible across the store
- Links to the Shipping & Delivery page
- No intrusive animation

For mobile, the message may be slightly smaller, but must remain readable.

The free delivery threshold must also work in checkout logic.

IMPORTANT:

The offer says OVER £80, not £80 or more.

Therefore, free standard UK delivery applies when the eligible merchandise subtotal after discounts, before delivery charges, is strictly greater than £80.

Use Decimal or integer pence calculations to avoid floating-point errors.

The threshold must be configurable by the administrator.

Do not accidentally implement free shipping at exactly £80 unless the business changes the offer wording.

---

# 8. HEADER AND MAIN NAVIGATION

Create an elegant white header.

Desktop structure:

Top:
Announcement Bar

Below:
Logo + Navigation + Utility Icons

Main navigation links:

HOME
SHOP ALL
OUR STORY
CONTACT US

Do not create unnecessary mega menus because the store has only eight products.

Header elements:
- SEEN ABAYAS logo
- Home navigation
- Shop All navigation
- Our Story navigation
- Contact Us navigation
- Search icon
- Customer account icon if accounts exist
- Shopping bag icon
- Live shopping bag item count

Logo design:

Use a minimal wordmark.

Primary text:
SEEN

Secondary smaller text:
A B A Y A S

The wordmark should feel refined and editorial.

Use the actual SEEN brand logo when supplied.

Do not invent another logo if an official one already exists.

DESKTOP:
- Clean centered or appropriately balanced brand logo
- Evenly spaced navigation
- Icons aligned neatly
- Comfortable horizontal spacing

MOBILE:
- Hamburger menu on the left
- Centered brand logo
- Shopping bag on the right
- Search accessible through icon or menu
- Full-screen or side-drawer navigation
- Clear close icon
- Touch-friendly menu options

Suggested header behavior:
- Sticky after scrolling, if it does not obscure content
- Smooth subtle transitions
- No exaggerated animations
- Proper keyboard focus handling

Mobile menu must include:
- Home
- Shop All
- Our Story
- Contact Us
- Shipping & Delivery
- Returns & Exchanges
- Size Guide
- FAQs

---

# 9. SEARCH FUNCTIONALITY

Implement a clean product search interface.

When the search icon is clicked:
- Open an overlay or search drawer
- Focus the search field
- Allow search by product name
- Allow search by color
- Allow search by relevant product keywords
- Display matching product photos
- Display product names
- Display prices in GBP
- Allow direct navigation to matching products

Include:
- Clear search button
- No-results state
- Keyboard accessibility
- Escape-to-close behavior
- Mobile-friendly layout
- Debounced input where appropriate

Do not display products that do not exist in the database.

---

# 10. HOMEPAGE — COMPLETE DESIGN AND SECTION ORDER

Build the homepage with the following exact structure:

SECTION 1:
Free UK Delivery Announcement

SECTION 2:
White Header and Navigation

SECTION 3:
Luxury Hero Banner

SECTION 4:
The SEEN Collection / Featured Abayas

SECTION 5:
Our Story Preview

SECTION 6:
Designed For Every Occasion / Editorial Campaign

SECTION 7:
The SEEN Promise

SECTION 8:
Newsletter Signup

SECTION 9:
Footer

Keep this order unless a clear usability reason requires a small adjustment.

Avoid adding unrelated sections.

---

# 11. HERO BANNER

The first major visual on the homepage must be a beautiful full-width luxury fashion photograph.

Use professional photographs featuring models wearing real SEEN abayas.

Recommended visual style:
- White architectural backgrounds
- Minimalist studio
- Natural light
- Soft cream or stone walls
- Elegant model poses
- Flowing abaya silhouettes
- Subtle shadows
- Clean compositions
- Premium editorial photography

Do not use unrelated fashion products.

DESKTOP HERO:
- Full-width banner
- Large campaign image
- Carefully positioned text
- Prominent but minimalist CTA

Exact hero heading:

"Made to Be Seen."

Hero subheading:

"Timeless modesty. Effortless elegance."

Button:

"SHOP THE COLLECTION"

Button destination:
/shop

Recommended text:
Black on a light photographic area, or white if placed against a dark area with sufficient contrast.

Image cropping must preserve the outfit and model.

MOBILE HERO:
- Use a separately composed portrait image if available
- Keep the abaya fully visible
- Do not crop the main clothing details
- Keep heading and CTA readable
- Place text below the image if an overlay would obstruct the outfit

Avoid an automatic slideshow for the initial launch unless multiple genuine campaign images are provided.

One exceptional hero photograph is better than several low-quality banners.

---

# 12. THE SEEN COLLECTION — HOMEPAGE

Section title:

"THE SEEN COLLECTION"

Supporting line:

"Thoughtfully selected. Effortlessly elegant."

Show four featured abaya designs on the homepage.

Provide a button:

"VIEW ALL 8 DESIGNS"

Button destination:
/shop

Desktop:
Four product cards in one row.

Tablet:
Two or three cards per row depending on width.

Mobile:
Two cards per row where readable.

Each product card contains:
- Product image
- Product name
- Price in GBP
- Available color information if relevant
- New/Sold Out indicator where appropriate
- Clickable product link
- Quick Add only when variant requirements allow it

Do not add fake product names, prices or stock counts.

Featured products should be selected through product data or admin settings.

Product images should be the dominant visual element.

Use no heavy card borders or shadows.

---

# 13. SHOP ALL PAGE

URL:
/shop

Page heading:

"The Collection"

Subtitle:

"Timeless designs, thoughtfully selected for every occasion."

Display all eight abaya designs.

Desktop:
Four-column product grid.

Tablet:
Two- or three-column product grid.

Mobile:
Two-column grid where it remains usable.

All products must be loaded from the backend/database.

Each card should include:
- Main product photo
- Secondary hover image where available
- Name
- GBP price
- Availability
- Color swatches if applicable
- Link to details

Because the store only has eight designs, avoid a large sidebar.

Recommended simple filtering:
- Size
- Color
- Availability

Recommended sorting:
- Featured
- Price: Low to High
- Price: High to Low
- Newest

If all eight designs fit comfortably on one page, do not introduce unnecessary pagination.

Filters must update the actual product results and synchronize sensibly with the URL.

If filtering produces no matches, display:

"No pieces found for these selections."

Also show a Clear Filters action.

---

# 14. PRODUCT CARD DESIGN

Create one reusable ProductCard component.

Structure:

ProductCard:
- Image container
- Main product image
- Optional hover image
- Product badges
- Product name
- Price
- Optional color swatches

Image aspect ratio:
3:4

Card background:
White.

Card borders:
None or minimal.

Hover:
- Smooth image zoom, approximately scale(1.03)
- Optional secondary product image
- Subtle transition lasting 250–350ms

Text:
Left aligned.

Product name:
Medium-weight sans-serif.

Price:
Clear black text.

Discounted products:
Show current price, original crossed-out price and accurate discount.

Sold out products:
Display "SOLD OUT" badge and disable purchase actions.

No fake discount badges.

No fake scarcity messages.

No misleading "Only 2 left" labels without real stock data.

---

# 15. ALL EIGHT ABAYA DESIGNS

The store has exactly eight initial abaya designs.

Create eight product records with distinct slugs.

Until actual details are supplied, use internal identifiers:

Design 01
Design 02
Design 03
Design 04
Design 05
Design 06
Design 07
Design 08

These are development identifiers, not invented public product names.

Each product should support:

- Unique product name
- Unique URL slug
- Price in GBP
- Description
- Short description
- Available sizes
- Available colors
- Fabric
- Fit
- Length
- Sleeve details
- Included accessories
- Washing/care instructions
- Main photo
- Additional photos
- Inventory by variant
- Product status
- Featured status
- SEO title
- SEO description

Do not invent product prices, materials, or sizes.

A product must not be purchasable until its required actual data and inventory are configured.

---

# 16. PRODUCT DETAILS PAGE

URL:
/products/[slug]

This page is extremely important for conversion.

Recommended desktop layout:

LEFT:
Large product image gallery.

RIGHT:
Product name, price, options and purchase controls.

Desktop proportions:
55% gallery
45% product details

On mobile:
Gallery first, product details underneath.

PRODUCT IMAGE GALLERY:

Support:
- Main large image
- Image thumbnails
- Front photo
- Back photo
- Side photo
- Fabric close-up
- Styled/lifestyle photo
- Image zoom
- Lightbox
- Touch swipe on mobile

Recommended 4–6 photos per design.

With eight products, aim for approximately 32–48 actual product photographs.

PRODUCT DETAILS ORDER:

1. Brand name: SEEN ABAYAS
2. Product name
3. Price in GBP
4. Short elegant product description
5. Color selection if applicable
6. Size selection
7. Size Guide link
8. Stock availability
9. Quantity selector
10. ADD TO BAG button
11. Royal Mail delivery information
12. Complimentary UK delivery over £80
13. Secure payment information
14. Product description accordion
15. Fabric and care accordion
16. Size and fit accordion
17. Shipping and returns accordion
18. Related products

SIZE SELECTION:

Display actual available abaya sizes.

Possible examples:
52, 54, 56, 58

These sizes are examples only.

Do not assume these sizes are available until confirmed.

Use clear size buttons.

Selected size should have a visible border or selected state.

If a size is sold out:
- Disable it
- Display unavailable status

SIZE GUIDE:

Clicking the Size Guide must open an accessible modal/drawer or navigate to the Size Guide page.

QUANTITY CONTROL:

- Minus button
- Current quantity
- Plus button
- Minimum quantity of one
- Maximum quantity based on stock

ADD TO BAG:

Full-width black button.
White uppercase text.

Text:

"ADD TO BAG"

If no size is selected:
Prompt the customer to select a size.

If an item is out of stock:
Disable purchasing.

If added successfully:
- Update cart
- Update bag count
- Open cart drawer
- Display correct selected size/color

Do not allow invalid product variants to be added.

---

# 17. PRODUCT ACCORDIONS

Below the purchase options, include elegant expandable sections.

PRODUCT DETAILS

Display:
- Product description
- Design details
- Included pieces
- Special features

FABRIC & CARE

Display:
- Actual material
- Washing recommendations
- Ironing instructions
- Fabric care information

SIZE & FIT

Display:
- Garment measurements
- Length
- Sleeve measurements
- Fit characteristics
- Relevant model sizing information, if accurately provided

DELIVERY & RETURNS

Display:
- Royal Mail service information
- Free standard UK delivery over £80
- Link to Shipping & Delivery
- Link to Returns & Exchanges
- Statement that statutory rights are unaffected

Accordions must be keyboard accessible.

Use subtle chevron animations.

---

# 18. SIZE GUIDE PAGE

URL:
/size-guide

Page heading:

"Find Your Perfect Fit"

Create an elegant, easy-to-read abaya size guide.

Include:
- Brand-specific size table
- Abaya length
- Bust/chest measurements where applicable
- Sleeve measurements
- Fit guidance
- How to measure instructions
- Measurement illustration
- Advice for customers between sizes

Support centimetres and/or inches with accurate conversions.

Do not populate actual size measurements without confirmed garment data.

Include this text:

"Measurements are provided to help you find the best fit. Please refer to the specific product details, as styles and silhouettes may vary."

Show the size guide as a modal from product pages, with the full page available for reference.

---

# 19. OUR STORY / ABOUT US PAGE

URL:
/our-story

Page title:

"Our Story"

Hero heading:

"Made to Be Seen."

Use the following EXACT brand story as the official About Us page content.

Do not rewrite it unnecessarily.

Do not remove any paragraph.

Do not invent additional claims about the founders.

OFFICIAL CONTENT:

OUR STORY

SEEN ABAYAS

Made to Be Seen.

At SEEN ABAYAS, we believe modesty and style should exist effortlessly together.

Founded by sisters with a shared passion for modest fashion, SEEN was born from a vision to create a brand that celebrates timeless elegance, individuality and confidence.

Created with the modern woman in mind, our collections bring together refined silhouettes, beautiful details and contemporary designs, offering modestwear that feels as special as the woman wearing it.

From everyday sophistication to statement evening pieces, each design is thoughtfully selected to complement every occasion, allowing you to express your personal style without compromising on modesty.

We believe true elegance doesn't demand attention. It leaves an impression.

More than modestwear. A statement of elegance.

SEEN ABAYAS — Elegance that speaks for itself.

ABOUT PAGE DESIGN:

Use large white spaces and refined typography.

Recommended layout:

Section 1:
Large elegant brand/lifestyle photograph.

Section 2:
Centered "OUR STORY" heading and "Made to Be Seen."

Section 3:
Introductory brand paragraphs.

Section 4:
"Founded by Sisters" editorial section using the provided text.

Section 5:
Brand philosophy and thoughtful design paragraphs.

Section 6:
Large editorial statement:

"We believe true elegance doesn't demand attention. It leaves an impression."

Section 7:
Final brand statement:

"More than modestwear. A statement of elegance."

Section 8:
Shop the Collection button.

Make the page visually attractive without changing the meaning of the content.

Use actual brand photography if available.

Do not use fake photographs of the founders.

---

# 20. CONTACT US PAGE

URL:
/contact

Page heading:

"Get in Touch"

Introductory text:

"We'd love to hear from you. Whether you have a question about an order, sizing or our collection, our customer care team is here to help."

Create a clean and functional contact form.

REQUIRED FORM FIELDS:

1. Name
2. Email
3. Phone Number
4. Message

All four fields must be present and validated.

NAME:
Text input.

EMAIL:
Valid email input.

PHONE:
Telephone input supporting UK and international number formats.

MESSAGE:
Multiline text area.

BUTTON:

"SEND MESSAGE"

DESTINATION EMAIL:

info@seenabayas.co.uk

FUNCTIONAL REQUIREMENTS:

When a customer submits the form:
- Validate values on the client
- Validate values again on the server
- Prevent spam and abuse
- Send the message securely to info@seenabayas.co.uk
- Include customer name
- Include customer email
- Include customer phone
- Include message
- Include submission timestamp
- Set customer's address as Reply-To where supported
- Show loading state
- Show real success state after accepted email delivery
- Handle errors visibly
- Prevent duplicate submissions

Do not merely use a mailto link.

Use a service such as Resend or Postmark.

Never expose the email API key in frontend code.

Suggested success message:

"Thank you for contacting SEEN ABAYAS. Your message has been received."

Also display the customer support email on the page.

Email:
info@seenabayas.co.uk

Contact form submissions must be handled in accordance with the site's Privacy Policy.

---

# 21. ROYAL MAIL SHIPPING INTEGRATION

SEEN ABAYAS intends to use Royal Mail as its delivery partner.

Implement a real delivery workflow with Royal Mail services, based on the account and services activated for the business.

RECOMMENDED DELIVERY OPTIONS:

STANDARD UK DELIVERY:
Royal Mail Tracked 48

EXPRESS UK DELIVERY:
Royal Mail Tracked 24

FREE UK DELIVERY:
Standard UK delivery when the eligible merchandise subtotal is over £80.

Tracked 24 and Tracked 48 are service aims, not guaranteed delivery promises.

Do not invent fixed shipping prices.

Shipping prices, service eligibility, delivery destinations and dispatch cutoffs must come from actual business configuration.

SHIPPING SYSTEM REQUIREMENTS:

- Shipping address capture
- UK postcode validation
- Shipping option selection
- Delivery rate calculations
- Free shipping threshold
- Shipping method saved with order
- Royal Mail tracking number
- Tracking link
- Dispatch notification email
- Order fulfilment status
- Tracking information displayed to customer

ROYAL MAIL INTEGRATION:

Use Royal Mail Click & Drop or the appropriate Royal Mail API where available for the merchant's account.

Support:
- Order export/import
- Shipping label creation where supported
- Tracking number storage
- Shipping status updates
- Printable labels
- Order dispatch management

Create an integration adapter so the application can start with manual Royal Mail fulfilment if API access is not yet approved.

Do not pretend tracking is automated until a working integration exists.

IMPORTANT:

Royal Mail business account credentials, available services, collection arrangements and label generation features may vary.

Use actual documentation and account permissions for the chosen implementation.

---

# 22. SHIPPING & DELIVERY PAGE

URL:
/shipping-delivery

Page title:

"Shipping & Delivery"

Design:
- White background
- Centered heading
- Simple typography
- Clear sections
- Minimal borders
- Easy-to-read delivery information

Page structure:

SECTION 1:
Introduction

SECTION 2:
Order Processing

SECTION 3:
Standard UK Delivery

SECTION 4:
Express UK Delivery

SECTION 5:
Complimentary Delivery Over £80

SECTION 6:
Order Tracking

SECTION 7:
Delivery Delays

SECTION 8:
Incorrect Delivery Address

SECTION 9:
Contact Customer Care

Suggested introductory text:

"At SEEN ABAYAS, we want your shopping experience to be as seamless as possible. We aim to deliver your order safely and efficiently through our selected Royal Mail delivery services."

STANDARD DELIVERY:
Explain the configured Royal Mail Tracked 48 service, customer charge and delivery aim.

EXPRESS DELIVERY:
Explain Royal Mail Tracked 24 availability, customer charge and delivery aim.

FREE DELIVERY:
"Enjoy complimentary standard UK delivery on orders over £80."

TRACKING:
"Once your order has been dispatched, we will provide tracking information where available so you can follow your delivery."

CONTACT:
"For delivery enquiries, please contact info@seenabayas.co.uk."

Include a Royal Mail tracking link:
https://www.royalmail.com/track-your-item

Before publishing this page, configure:
- Actual dispatch processing time
- Accurate delivery estimates
- Shipping costs
- Any delivery restrictions
- Northern Ireland and other UK destination arrangements
- International availability, if any
- Business contact and return address

Do not present unconfirmed timeframes or shipping charges as established facts.

Shipping must be calculated and disclosed before the customer commits to payment.

---

# 23. RETURNS & EXCHANGES PAGE

URL:
/returns-exchanges

Page heading:

"Returns & Exchanges"

Use the following OFFICIAL policy supplied by SEEN ABAYAS.

Preserve the wording and substantive rights.

OFFICIAL POLICY:

RETURNS & EXCHANGES POLICY

At SEEN ABAYAS, we want you to feel confident and happy with every purchase. We kindly ask that you review our returns and exchanges policy before placing your order.

Exchanges

We are happy to offer exchanges within 14 days of receiving your order, subject to availability.

To qualify for an exchange:

Items must be unworn, unwashed and in their original condition, apart from reasonable inspection or trying on.

All original tags must remain attached.

Items must be free from perfume, makeup marks, stains and other signs of wear.

Proof of purchase must be provided.

Customers are responsible for exchange postage costs unless the item is faulty or incorrect.

All exchanges are subject to stock availability.

Refunds & Cancellations

We encourage customers to request an exchange where possible. However, your statutory consumer rights remain unaffected.

For eligible online purchases, you have the right to cancel your order within 14 days of receiving it, without providing a reason.

Once you notify us of your cancellation, you have a further 14 days to return your item.

Eligible refunds will be issued to your original payment method, including standard outbound delivery charges where required by law, within 14 days of receiving your return or evidence that it has been sent back, whichever is earlier.

Customers are responsible for return postage costs for change-of-mind returns.

Faulty or Incorrect Items

If you receive an item that is faulty, damaged or incorrect, please contact us with your order number and photographs of the issue.

We will assist you in accordance with your statutory consumer rights, including providing a refund, replacement or other appropriate remedy where required.

How to Request an Exchange or Return

Please contact our customer care team through the contact details provided on our website, including your order number and the item you wish to return or exchange.

We will provide you with the relevant return instructions.

We strongly recommend using a tracked postal service and retaining your proof of postage.

Important Information

Items returned with signs of wear, washing, damage or handling beyond what is necessary to inspect them may be subject to a reduction in refund value where legally permitted.

Personalised or made-to-measure items may be excluded from change-of-mind cancellation rights where the relevant legal exception applies.

This policy does not affect your statutory rights.

Thank you for shopping with SEEN ABAYAS.

Timeless modesty. Effortless elegance.

RETURNS PAGE DESIGN:

Use simple sections with clear headings.

Recommended:
- Introduction
- Exchanges
- Refunds & Cancellations
- Faulty or Incorrect Items
- How to Request an Exchange or Return
- Important Information

Use generous paragraph spacing and bullet formatting where appropriate.

Add a clear button:

"CONTACT CUSTOMER CARE"

Link to:
/contact

Include:
info@seenabayas.co.uk

Important implementation requirement:

Do not use the voluntary exchange conditions to incorrectly reject a customer's statutory online cancellation or faulty-goods rights.

Provide an accessible way for customers to communicate cancellation requests, and include legally required cancellation information/model form where applicable.

The final policy and checkout disclosures must be reviewed against UK consumer rules and actual business arrangements before launch.

---

# 24. SHOPPING BAG / CART

URL:
/cart

Also create a shopping bag drawer.

The shopping bag should feel sleek and minimal.

When a customer clicks ADD TO BAG:
- Add the product
- Save selected size
- Save selected color if applicable
- Save correct quantity
- Update cart count
- Open shopping bag drawer

CART DRAWER:

Right-side slide-in panel.

Display:
- Your Bag heading
- Close icon
- Product images
- Product names
- Selected variants
- Individual prices
- Quantity controls
- Remove option
- Subtotal
- Free shipping progress
- Continue Shopping
- Proceed to Checkout

FREE SHIPPING PROGRESS:

Example if eligible merchandise subtotal is £60:

"You're £20 away from complimentary UK delivery."

Display a slim progress bar.

Example when subtotal is strictly above £80:

"You've unlocked complimentary UK delivery."

Do not show the unlocked message at exactly £80 if the offer remains "over £80."

CART PAGE:

Display:
- Product image
- Product name
- Size
- Color
- Quantity
- Price
- Line total
- Remove option
- Basket subtotal
- Delivery estimate or calculated at checkout
- Checkout button

Cart must persist across refreshes and navigation.

Use secure server-side pricing validation.

Do not rely on client-supplied price values.

Do not allow checkout for inactive or out-of-stock items.

---

# 25. PAYMENT METHODS

The business is registered in the United Kingdom.

Required customer payment options:

1. Apple Pay
2. Klarna — Pay Later
3. Clearpay — Pay Later
4. Pay Now — Debit/Credit Card

RECOMMENDED PROVIDER:

Stripe, subject to activation and eligibility of each method.

PAY NOW:
- Visa
- Mastercard
- Other enabled credit/debit cards
- Apple Pay where supported

PAY LATER:
- Klarna
- Clearpay

IMPORTANT:

Do not assume that the account automatically qualifies for every payment method.

Payment method availability depends on:
- Merchant approval
- Merchant country
- Transaction amount
- Currency
- Customer eligibility
- Device/browser compatibility
- Product eligibility
- Provider-specific rules

Display only genuinely enabled methods in checkout.

Use Stripe Checkout or another compliant Stripe integration suited to the required methods.

Do not build your own card number storage system.

Stripe handles sensitive payment details.

---

# 26. CHECKOUT DESIGN

URL:
/checkout

Use a secure checkout process.

The checkout must feel consistent with the SEEN ABAYAS brand.

If using hosted Stripe Checkout, configure available logo, colors, payment methods and relevant customer fields to maintain a cohesive appearance.

If using embedded checkout, ensure the integration is secure and officially supported.

CHECKOUT INFORMATION:

CONTACT:
- Email
- Phone number if required for delivery

DELIVERY:
- First name
- Last name
- Address line 1
- Address line 2
- City
- County where relevant
- Postcode
- Country

SHIPPING:
- Standard Royal Mail delivery
- Express Royal Mail delivery if configured
- Complimentary standard UK delivery over £80

PAYMENT:
- Eligible card methods
- Apple Pay
- Klarna
- Clearpay

ORDER SUMMARY:
- Product thumbnail
- Product name
- Selected size/color
- Quantity
- Individual price
- Subtotal
- Discount
- Delivery charge
- Tax where applicable
- Total amount payable

CHECKOUT VALIDATION:
- Required fields
- Valid email
- Valid address
- Supported destination
- Actual inventory
- Correct totals
- Correct shipping rate
- Correct currency

Use GBP.

Do not let customers select shipping options unavailable for their destination.

Do not allow a purchase to be marked successful merely because the browser reaches a return URL.

PAYMENT CONFIRMATION:

Verify payment using server-side Stripe events/webhooks.

Support relevant payment-completed, asynchronous-payment, failed-payment and refund events as required by the chosen payment methods.

Use idempotency so webhook retries cannot create duplicate orders or duplicate fulfilment operations.

Update an order to paid only after reliable confirmation from the provider.

---

# 27. ORDER CONFIRMATION PAGE

URL:
/order-confirmation

Page heading:

"Thank You for Your Order"

Display a graceful, premium confirmation page.

Include:
- Confirmation icon
- Order number
- Confirmation message
- Purchased items
- Delivery address
- Payment status
- Shipping method
- Order total
- Contact email
- Continue Shopping button

Suggested message:

"Thank you for shopping with SEEN ABAYAS. Your order has been received, and we're delighted to be part of your wardrobe."

Display only verified order details retrieved securely from the backend.

For payment methods with pending confirmation, show a truthful pending status.

Also send an order confirmation email after the order is confirmed.

---

# 28. EMAIL NOTIFICATIONS

Use an email delivery service such as Resend or Postmark.

CUSTOMER EMAILS:

1. Order confirmation
2. Payment failure or pending update where needed
3. Order dispatched
4. Tracking information
5. Return request received
6. Refund confirmation
7. Customer support response

ADMIN EMAILS:

1. New paid order notification
2. New contact form submission
3. Low stock alert
4. Return/exchange request
5. Payment issue requiring attention

Use consistent SEEN branding in emails.

Email styles:
- White background
- Black typography
- Small brand logo
- Simple buttons
- Clear content
- No elaborate graphics

Store transaction and delivery statuses in the backend.

Do not promise a notification was sent if email delivery was not accepted by the configured service.

---

# 29. THE SEEN PROMISE SECTION

Homepage section heading:

"THE SEEN PROMISE"

Create three understated columns.

COLUMN 1:
Royal Mail Delivery

Supporting text:
"Reliable delivery options for your SEEN pieces."

COLUMN 2:
Secure Checkout

Supporting text:
"Shop with confidence using secure payment methods."

COLUMN 3:
Thoughtful Customer Care

Supporting text:
"Here to help with your order, sizing and shopping enquiries."

Alternatively, the third column may highlight 14-day exchanges, while linking clearly to the full Returns & Exchanges policy.

Use small monochrome Lucide icons.

Do not use colorful illustrations.

Keep this section compact.

---

# 30. EDITORIAL / DESIGNED FOR EVERY OCCASION SECTION

Create one beautiful editorial homepage section.

Heading:

"DESIGNED FOR EVERY OCCASION"

Supporting text:

"From everyday sophistication to statement evening pieces, discover modestwear created to complement your individual style."

Layout:
- Large lifestyle photograph
- Short brand statement
- Subtle button

Button text:
"EXPLORE THE COLLECTION"

Use actual SEEN campaign photographs.

Visual concept:
- Bright architectural setting
- Neutral tones
- Elegant model
- Flowing abaya
- Soft natural light
- Minimal decorative background

This should look like a fashion editorial, not an advertisement filled with text.

---

# 31. OUR STORY HOMEPAGE PREVIEW

Create a split editorial section.

LEFT:
Large beautiful SEEN campaign image.

RIGHT:
Text content.

Small label:
"OUR STORY"

Heading:
"Rooted in Modesty. Defined by Elegance."

Supporting text:

"Founded by sisters with a shared passion for modest fashion, SEEN was created to celebrate timeless elegance, individuality and confidence."

Button:
"DISCOVER OUR STORY"

Link:
/our-story

Use spacious padding.

On mobile:
Stack image and text vertically.

---

# 32. FAQ PAGE

URL:
/faqs

Page title:

"Frequently Asked Questions"

Use clean accordion sections.

Suggested FAQ topics:

ORDERING:
- How do I place an order?
- Can I change or cancel an order?
- How can I contact the team?

SIZING:
- How do I choose the correct abaya size?
- Where can I find garment measurements?
- What if my chosen size is unavailable?

SHIPPING:
- Which courier do you use?
- When will my order be dispatched?
- How can I track my order?
- Do you offer free delivery?

RETURNS:
- Can I exchange an abaya?
- How do I request a return?
- What happens if an item arrives faulty?

PAYMENTS:
- Which payment methods do you accept?
- Can I use Klarna or Clearpay?
- Is Apple Pay available?

Use accurate answers based on configured store policies and payment eligibility.

Do not invent dispatch estimates or product details.

---

# 33. FOOTER DESIGN

Use a warm ivory or very light grey footer background.

Recommended color:
#F7F5F1

The footer should have four main groups.

COLUMN 1:
SEEN ABAYAS

Brand statement:
"Elegance that speaks for itself."

COLUMN 2:
EXPLORE

Links:
- Shop All
- Our Story
- Size Guide

COLUMN 3:
CUSTOMER CARE

Links:
- Contact Us
- Shipping & Delivery
- Returns & Exchanges
- FAQs

COLUMN 4:
LEGAL

Links:
- Privacy Policy
- Terms & Conditions
- Cookie Policy

Add a social section:
- Instagram
- TikTok

Only use genuine brand social account links when provided.

Add contact details:

info@seenabayas.co.uk

Bottom footer:

"© SEEN ABAYAS. All rights reserved."

Use the current year dynamically.

Avoid a heavy, dark footer.

Maintain the predominantly white/neutral luxury aesthetic.

---

# 34. NEWSLETTER SECTION

Place a minimal newsletter section before the footer.

Heading:

"JOIN THE SEEN COMMUNITY"

Supporting text:

"Be the first to discover new collections, exclusive updates and more from SEEN ABAYAS."

Field:
Email Address

Button:
"SUBSCRIBE"

Use:
- Thin input borders
- Black subscribe button
- White or soft ivory background
- Generous white space

Newsletter subscriptions must:
- Validate the email
- Obtain appropriate marketing consent
- Save subscriptions securely
- Avoid duplicates
- Support unsubscribe requests
- Comply with applicable UK privacy and electronic marketing rules

Do not automatically subscribe customers solely because they purchased something or submitted the contact form.

---

# 35. LEGAL AND POLICY PAGES

Create:

Privacy Policy
Terms & Conditions
Cookie Policy

Each must have:
- Clear title
- Readable typography
- Consistent layout
- Current business information
- Accurate legal disclosures
- Contact information
- Links to related policies

PRIVACY POLICY:
Cover personal data collected from orders, contact messages, accounts, analytics and mailing lists, as actually applicable.

TERMS & CONDITIONS:
Include trading details, sale conditions, ordering, pricing, payment, delivery, cancellation rights and other legally required information.

COOKIE POLICY:
Explain essential and non-essential cookies, tracking technologies and customer choices.

Create a cookie consent interface if non-essential cookies or similar tracking tools are used.

Customers must be able to reject non-essential tracking where consent is required.

Do not assume a generic privacy template satisfies UK GDPR or other applicable obligations.

Do not fabricate the legal business name, registration number, VAT number or postal address.

Store the missing fields as administrator-configurable settings.

The store must not publish incomplete legal information as if it were final.

---

# 36. CUSTOMER ACCOUNT SYSTEM — OPTIONAL

Customer accounts are not required for the first version.

Guest checkout should be available.

If customer accounts are included, support:

- Registration
- Login
- Logout
- Password reset
- Order history
- Saved addresses
- Profile details

Do not require customers to create an account to purchase.

Secure sessions are essential.

Customers must only access their own orders and personal information.

---

# 37. ADMIN DASHBOARD

Create a secure admin system if the store is being developed as an independent Next.js commerce application.

The admin panel does not need to follow the luxury storefront theme exactly, but it should be clean and professional.

ADMIN FEATURES:

DASHBOARD:
- Total orders
- Paid orders
- Pending orders
- Revenue
- Low stock alerts

PRODUCT MANAGEMENT:
- Add products
- Edit products
- Upload photographs
- Update descriptions
- Set prices
- Manage variants
- Manage inventory
- Feature/unfeature products
- Publish/unpublish products

ORDER MANAGEMENT:
- View orders
- View customer details
- Payment status
- Shipping status
- Add tracking number
- Mark order dispatched
- Manage cancellations
- Manage refunds and exchanges

DELIVERY SETTINGS:
- Royal Mail service options
- Shipping prices
- Free delivery threshold
- Dispatch processing time
- Packaging settings
- Return address

WEBSITE SETTINGS:
- Homepage hero image
- Homepage editorial image
- Featured products
- Banner message
- Support email
- Store contact details
- Policy content
- Social links

NEWSLETTER:
- View subscribers
- Export consented subscribers where appropriate

Protect admin routes using strong role-based access control.

---

# 38. DATABASE STRUCTURE

Use PostgreSQL with Prisma or an existing suitable backend.

Create the following data models as needed.

PRODUCT:
- id
- slug
- name
- description
- shortDescription
- price
- compareAtPrice
- currency
- fabric
- fit
- careInstructions
- includedItems
- featured
- active
- createdAt
- updatedAt

PRODUCT VARIANT:
- id
- productId
- size
- color
- sku
- priceOverride
- stockQuantity
- active

PRODUCT IMAGE:
- id
- productId
- url
- altText
- sortOrder

SIZE GUIDE:
- id
- productId or shared guide association
- sizeLabel
- length
- bust
- sleeve
- measurementUnit

CUSTOMER:
- id
- name
- email
- phone
- authentication fields
- createdAt

ADDRESS:
- id
- customerId
- recipientName
- addressLine1
- addressLine2
- city
- county
- postalCode
- country

CART:
- id
- customerId or sessionId
- createdAt
- updatedAt

CART ITEM:
- id
- cartId
- productVariantId
- quantity

ORDER:
- id
- orderNumber
- customerId where applicable
- customerEmail
- paymentStatus
- fulfilmentStatus
- currency
- subtotal
- discountAmount
- shippingAmount
- taxAmount
- total
- paymentProvider
- paymentReference
- deliveryMethod
- trackingNumber
- trackingUrl
- shippingAddressSnapshot
- createdAt
- updatedAt

ORDER ITEM:
- id
- orderId
- productId
- variantId
- productNameSnapshot
- sizeSnapshot
- colorSnapshot
- quantity
- unitPrice
- totalPrice

CONTACT SUBMISSION:
- id
- name
- email
- phone
- message
- submissionStatus
- createdAt

NEWSLETTER SUBSCRIBER:
- id
- email
- consentTimestamp
- subscriptionStatus
- createdAt

STORE SETTINGS:
- id
- storeName
- supportEmail
- shippingThreshold
- shippingMethods
- senderAddress
- returnAddress
- socialLinks

PAYMENT EVENT:
- id
- provider
- providerEventId
- orderId
- eventType
- processedAt

Use a money-safe representation such as integer minor units/pence or fixed-precision decimals.

Avoid JavaScript floating-point errors when calculating payments.

Add suitable indexes and enforce unique constraints for slugs, order references, and payment event IDs.

Orders must retain accurate historical item/pricing snapshots even if a product changes later.

Do not store raw card information.

---

# 39. RECOMMENDED TECH STACK

Frontend:
Next.js App Router

Programming Language:
TypeScript

UI:
React

Styling:
Tailwind CSS

Fonts:
Cormorant Garamond
Inter

Icons:
Lucide React

Animations:
CSS transitions or Framer Motion only when justified

Backend:
Next.js server-side route handlers/server actions

Database:
PostgreSQL

ORM:
Prisma

Authentication:
Auth.js if accounts are included

Payments:
Stripe

Shipping:
Royal Mail Click & Drop integration or approved Royal Mail API

Email:
Resend or Postmark

Images:
Cloudinary or similar managed image storage

Hosting:
Vercel or another compatible hosting provider

Use configuration appropriate to the actual deployment environment.

If an existing project already has an appropriate database or commerce framework, integrate with it instead of forcing a complete migration.

---

# 40. FRONTEND COMPONENT ARCHITECTURE

Create reusable components.

GLOBAL:
- AnnouncementBar
- Header
- DesktopNavigation
- MobileNavigation
- MobileMenuDrawer
- Logo
- SearchOverlay
- Footer
- NewsletterSignup
- CookieConsent
- Breadcrumbs

HOMEPAGE:
- HeroSection
- FeaturedCollection
- OurStoryPreview
- EditorialCampaign
- SeenPromise

PRODUCTS:
- ProductCard
- ProductGrid
- ProductGallery
- ImageLightbox
- ProductInformation
- SizeSelector
- ColorSelector
- QuantitySelector
- AddToBagButton
- SizeGuideModal
- ProductAccordion
- RelatedProducts
- StockStatus
- PriceDisplay

SHOP:
- ShopHeader
- FilterControls
- SortControl
- EmptyResults

CART:
- CartDrawer
- CartItem
- CartSummary
- FreeShippingProgress
- EmptyCart

CHECKOUT:
- CheckoutInitiator
- CheckoutSummary
- OrderConfirmation

CONTENT:
- OurStoryPage
- ContactForm
- ShippingPage
- ReturnsPage
- SizeGuidePage
- FAQAccordion
- PolicyPage

ADMIN:
- AdminLayout
- ProductEditor
- VariantEditor
- ImageUploader
- OrderList
- OrderDetails
- ShippingSettings
- SiteSettings

All components must use a consistent design system.

Avoid duplicating styling rules or business logic.

---

# 41. RESPONSIVE DESIGN

The website must work beautifully on:

Small Mobile:
320–374px

Standard Mobile:
375–767px

Tablet:
768–1023px

Desktop:
1024–1439px

Large Desktop:
1440px+

DESKTOP:
- Wide hero
- Four-column product grid
- Horizontal navigation
- Large product gallery
- Editorial side-by-side sections
- Four-column footer

TABLET:
- Reduced product columns
- Adjusted spacing
- Accessible mobile navigation where appropriate

MOBILE:
- Compact header
- Hamburger navigation
- Centered SEEN wordmark
- Shopping bag icon
- Portrait hero image
- Two-column product grid
- Full-width product gallery
- Vertical product information
- Easy size selection
- Accessible cart drawer
- Full-width checkout CTA
- Stacked footer

Avoid:
- Tiny buttons
- Clipped text
- Horizontal overflow
- Cropped abaya photographs
- Unreadable menu items
- Excessive white space on small screens
- Overlapping floating controls

Test actual device widths.

---

# 42. ANIMATIONS AND INTERACTIONS

Keep animations restrained.

Recommended timings:

Button hover:
150–200ms

Product image hover:
250–350ms

Menu opening:
180–250ms

Cart drawer:
200–300ms

Accordion:
150–220ms

Search overlay:
150–220ms

Image gallery:
Subtle fade or immediate responsive switch

Optional page content reveal:
Small opacity/translation transitions only.

Respect prefers-reduced-motion.

Do not use:
- Dramatic entrance animations
- Neon effects
- Glowing text
- Constant moving backgrounds
- Auto-playing distracting videos
- Animated cursors
- Excessive scrolling effects

The website must feel fast and responsive.

---

# 43. IMAGE AND PHOTOGRAPHY STANDARDS

The real SEEN ABAYAS photographs will be the most important visual asset.

Image style:
- Luxury fashion editorial
- Minimalist backgrounds
- Natural lighting
- Full-length abaya photography
- Accurate garment colors
- Visible material texture
- Neutral studio environments

For each abaya:
1. Front view
2. Back view
3. Side view
4. Fabric/detail close-up
5. Styled full-length look
6. Optional lifestyle look

Homepage:
- One strong hero campaign photograph
- Four featured product images
- One Our Story image
- One editorial campaign image

PRODUCT PHOTO RULES:
- Consistent ratios
- High resolution
- Accurate colors
- No distorted body proportions
- No stretched clothing
- No overly aggressive retouching
- No accidental product cropping
- Correct descriptive alt text

Use Next.js image optimization.

Support WebP/AVIF where appropriate.

Preload the important hero visual.

Lazy-load below-the-fold photography.

If actual assets are missing, use clearly identified development placeholders.

Do not silently replace SEEN designs with unrelated abayas in the final live catalog.

---

# 44. SEO REQUIREMENTS

Implement proper SEO.

Each page should have:
- Unique title
- Meta description
- Canonical URL
- Correct headings
- Open Graph metadata
- Accessible images

Product pages:
- Structured product metadata
- Accurate prices
- Accurate availability
- Correct product descriptions
- Product URLs with meaningful slugs

Other:
- XML sitemap
- robots.txt
- Organization structured data using genuine business details
- Breadcrumbs
- Clean navigation
- Social sharing previews

Example homepage title:

"SEEN ABAYAS | Timeless Modest Fashion"

Example homepage description:

"Discover SEEN ABAYAS, a modern modest fashion brand celebrating timeless elegance, individuality and confidence. Made to Be Seen."

Avoid keyword stuffing.

---

# 45. PERFORMANCE

Optimize for a fast shopping experience.

Requirements:
- Server-rendered pages where appropriate
- Optimized images
- Font optimization
- Minimal unnecessary JavaScript
- Efficient database queries
- Cached public catalog data where suitable
- Good loading states
- No major layout shifts
- Efficient client-side interactions
- Fast navigation
- No unnecessary third-party scripts

Aim for strong Core Web Vitals.

Do not sacrifice image quality unnecessarily, but serve appropriately sized image assets.

---

# 46. ACCESSIBILITY

Follow WCAG 2.2 AA as the target.

Requirements:
- Semantic HTML
- Proper labels
- Keyboard navigation
- Visible focus states
- Accessible size selectors
- Accessible cart drawer
- Accessible accordions
- Screen-reader-friendly error messages
- Meaningful image alt text
- Sufficient text contrast
- Correct touch target sizes
- Focus trapping in dialogs
- Escape-to-close dialogs
- Reduced-motion support

Do not rely on color alone to communicate size availability or validation errors.

---

# 47. SECURITY REQUIREMENTS

Implement:

- Server-side input validation
- Authentication and authorization
- Secure sessions
- Rate limiting
- CSRF protections where required
- Spam protection
- Protected admin routes
- Verified Stripe webhooks
- Idempotent payment processing
- Server-side recalculation of cart totals
- Stock validation
- HTTPS
- Environment variables for credentials
- Secure password handling if local authentication exists
- Proper error logging
- Secure image upload handling
- Data minimization

Never:
- Store card numbers
- Store CVVs
- Expose Stripe secret keys in frontend code
- Expose email API keys
- Trust browser-supplied totals
- Mark orders paid without provider confirmation

---

# 48. ENVIRONMENT CONFIGURATION

Prepare an .env.example file.

Document required variables for:

DATABASE_URL

STRIPE_SECRET_KEY

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

STRIPE_WEBHOOK_SECRET

RESEND_API_KEY or other email service credentials

CONTACT_EMAIL

ROYAL_MAIL_API_CREDENTIALS where supported

ROYAL_MAIL_ACCOUNT_CONFIGURATION

NEXT_PUBLIC_SITE_URL

IMAGE_STORAGE_CREDENTIALS

AUTH_SECRET if accounts are used

Other necessary environment variables.

Do not put actual secrets in source control.

Use placeholders in the example file and document how each credential is obtained.

The application should report missing critical configuration clearly.

---

# 49. ORDER MANAGEMENT FLOW

Required customer and admin order lifecycle:

1. Customer selects abaya
2. Customer chooses valid size/color
3. Customer adds item to bag
4. Customer reviews cart
5. Customer chooses delivery address
6. Application validates stock and prices
7. Application creates a pending order/payment session
8. Customer completes eligible payment method
9. Payment provider confirms payment
10. Order is marked paid
11. Inventory is safely committed/adjusted
12. Customer receives confirmation
13. Admin prepares order
14. Shipping label is generated or manually purchased
15. Tracking number is saved
16. Admin marks order dispatched
17. Customer receives tracking information
18. Delivery and any return request are handled according to policy

Ensure payment retries, failed payments, refund events and duplicate webhook deliveries are handled correctly.

Avoid overselling by coordinating inventory reservation/decrement logic with the payment lifecycle.

---

# 50. TESTING REQUIREMENTS

Test every important shopping journey.

HOME:
- Header works
- Banner displays
- Hero loads
- Product links work
- Story links work
- Newsletter works

SHOP:
- Eight products render when configured
- Product cards display correctly
- Sorting works
- Filters work
- Mobile grid works

PRODUCT:
- Gallery works
- Size selection works
- Color selection works
- Quantity works
- Sold-out state works
- Add to Bag works
- Stock rules work

CART:
- Add product
- Remove product
- Update quantity
- Preserve chosen size
- Preserve chosen color
- Recalculate totals
- Persist cart
- Calculate free delivery threshold accurately

CHECKOUT:
- Correct customer details
- Correct delivery options
- Correct price
- Card payment flow
- Apple Pay on supported devices
- Klarna on eligible transactions
- Clearpay on eligible transactions
- Failed payment handling
- Successful verified order creation
- Payment webhook processing
- Duplicate payment event prevention

SHIPPING:
- Royal Mail configuration
- Tracking field
- Dispatch status
- Shipping confirmation email
- Free shipping calculation

CONTACT:
- Validation
- Email sending
- Spam protection
- Error state
- Success state

POLICIES:
- All pages accessible
- Correct links
- Full supplied returns policy present
- Official About Us story present

RESPONSIVENESS:
- Mobile
- Tablet
- Laptop
- Desktop

SECURITY:
- Admin access control
- Server-side validation
- Secure API endpoints
- No credentials in client bundle

Use automated tests where useful, including important integration and end-to-end tests.

---

# 51. QUALITY STANDARDS

The finished website must:

- Look like a professional modern fashion boutique
- Use a predominantly white minimalist theme
- Be visually consistent
- Be attractive on mobile
- Be accessible
- Load efficiently
- Use premium typography
- Make products easy to browse
- Offer clear sizing details
- Support genuine checkout functionality
- Support actual approved payment methods
- Support Royal Mail fulfilment
- Provide functioning customer contact
- Include required policy pages
- Avoid fake products, reviews and inventory
- Avoid broken links
- Avoid non-functional buttons
- Avoid generic placeholder marketing copy
- Avoid unnecessary visual clutter

Do not add unrelated features merely to make the website appear larger.

Eight thoughtfully presented abayas are better than hundreds of fake product listings.

---

# 52. DEVELOPMENT EXECUTION ORDER

Follow this order:

PHASE 1 — PROJECT INSPECTION
- Inspect existing application
- Review dependencies
- Identify reusable code
- Identify existing database and checkout integrations
- Confirm the project builds
- Preserve working functionality

PHASE 2 — DESIGN SYSTEM
- Configure brand colors
- Configure typography
- Configure spacing
- Build reusable buttons and inputs
- Build header and footer
- Establish responsive layout standards

PHASE 3 — HOMEPAGE
- Announcement bar
- Header
- Hero
- Featured collection
- Our Story preview
- Editorial section
- The SEEN Promise
- Newsletter
- Footer

PHASE 4 — CATALOG
- Database product models
- Eight product records
- Product images
- Shop All page
- Product details
- Variant selection
- Size guide

PHASE 5 — CART
- Cart storage
- Add to Bag
- Cart drawer
- Cart page
- Quantity changes
- Free shipping progress

PHASE 6 — CHECKOUT
- Customer details
- Address validation
- Shipping calculation
- Stripe Checkout
- Payment method activation
- Webhook verification
- Order confirmation

PHASE 7 — FULFILMENT
- Royal Mail workflow
- Tracking details
- Admin order updates
- Dispatch emails

PHASE 8 — BRAND AND POLICY PAGES
- Our Story using exact supplied content
- Contact Us
- Shipping & Delivery
- Returns & Exchanges using exact supplied content
- FAQs
- Privacy
- Terms
- Cookies

PHASE 9 — ADMIN
- Product management
- Order management
- Stock management
- Shipping configuration
- Site content configuration

PHASE 10 — TESTING AND DEPLOYMENT
- Responsive testing
- Checkout testing
- Email testing
- Database verification
- Security checks
- Performance optimization
- Production configuration
- Deployment

At the end of each phase, verify the application still builds and the previous functionality remains working.

---

# 53. FINAL ACCEPTANCE CRITERIA

The project is complete only when:

1. The SEEN branding is applied consistently.
2. The entire website uses the specified modern white minimalist theme.
3. All core page types exist.
4. All eight abaya product detail routes work with genuine configured product data.
5. Product photography is responsive.
6. Size and color selections work.
7. Cart functionality works.
8. Free UK delivery is correctly applied to eligible orders over £80.
9. Stripe checkout is integrated and verified.
10. Apple Pay, Klarna and Clearpay are displayed only when available and enabled.
11. Royal Mail shipping options and fulfilment workflow are correctly configured.
12. Contact messages reach info@seenabayas.co.uk through the configured service.
13. The complete official About Us content is present.
14. The complete supplied Returns & Exchanges policy is present.
15. Shipping details reflect real business arrangements.
16. The required legal pages have accurate, publishable information.
17. The website works correctly on mobile.
18. All navigation links work.
19. No secret credentials appear in the client bundle.
20. Tests pass, and the application builds successfully.

If a condition depends on credentials, photography, prices, merchant approval, or business information not yet provided, report that dependency explicitly.

Do not falsely mark external integrations as completed.

---

# 54. FINAL CREATIVE DIRECTION

The final SEEN ABAYAS website should feel like this:

Imagine a luxury fashion boutique with pure white walls, elegant typography, soft natural lighting, beautiful garment photography and carefully arranged clothing.

Translate that experience into a digital store.

The interface should be simple enough that customers can easily find the perfect abaya, but polished enough that the brand feels premium and memorable.

SEEN ABAYAS should not look like a crowded marketplace.

It should feel curated, refined and intentional.

White backgrounds.

Black typography.

Elegant headings.

Beautiful abaya photography.

Minimal navigation.

Clear product details.

Effortless shopping.

Secure checkout.

Thoughtful customer service.

The entire experience must reflect:

"Made to Be Seen."

"More than modestwear. A statement of elegance."

"SEEN ABAYAS — Elegance that speaks for itself."

## FINAL INSTRUCTION TO THE CODING AGENT

IMPLEMENT THIS WEBSITE AS A COMPLETE, RESPONSIVE, PRODUCTION-QUALITY NEXT.JS E-COMMERCE APPLICATION.

FOLLOW THE DESIGN SPECIFICATIONS CONSISTENTLY.

PRESERVE ALL OFFICIAL BRAND AND POLICY CONTENT.

USE REAL, CONFIGURABLE PRODUCT DATA.

CONNECT ALL POSSIBLE FUNCTIONALITY AND IDENTIFY ANY EXTERNAL SERVICES OR BUSINESS DETAILS THAT REQUIRE SETUP.

DO NOT OMIT THE CORE PAGES OR SHOPPING FEATURES.

DO NOT CREATE NON-FUNCTIONAL DEMO INTERACTIONS AND CALL THEM COMPLETE.

BUILD A BEAUTIFUL, CLEAN, MODERN, WHITE LUXURY FASHION STORE FOR SEEN ABAYAS.
