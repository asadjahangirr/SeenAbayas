-- Selected names and opening GBP prices, as delegated by the store developer.
-- These are creative pricing choices, not a valuation or market comparison.
-- Apply after the catalog migration and seed.sql in the Supabase SQL Editor.
-- Products stay private drafts. No sizes, stock, fabric or care claims are invented.
-- Existing names/prices are preserved, including on subsequent runs.
begin;

update public.products as p
set name = coalesce(p.name, chosen.name),
    price_pence = coalesce(p.price_pence, chosen.price_pence)
from (values
  ('design-01', 'Layla Burgundy Abaya', 7500),
  ('design-02', 'Zahra Botanical Abaya', 8500),
  ('design-03', 'Noor Lace Abaya', 8500),
  ('design-04', 'Haya Charcoal Abaya', 6900),
  ('design-05', 'Rima Textured Abaya', 7500),
  ('design-06', 'Luma Polka Dot Abaya', 6900),
  ('design-07', 'Amal Neutral Abaya', 7500)
) as chosen(design_reference, name, price_pence)
where p.design_reference = chosen.design_reference
  and p.status = 'draft'
  and not p.details_confirmed
  and (p.name is null or p.price_pence is null);

commit;

-- This owner-only SQL Editor query verifies the drafts after importing.
select design_reference, name, price_pence, currency, status
from public.products
where design_reference in (
  'design-01', 'design-02', 'design-03', 'design-04',
  'design-05', 'design-06', 'design-07'
)
order by sort_order, design_reference;
