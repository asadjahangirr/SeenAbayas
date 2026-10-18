-- Known photography references only. No invented names, prices, sizes or stock.
-- This is safe to rerun and never overwrites client-confirmed product details.
insert into public.products (design_reference, sort_order) values
  ('design-01', 1), ('design-02', 2), ('design-03', 3), ('design-04', 4),
  ('design-05', 5), ('design-06', 6), ('design-07', 7)
on conflict (design_reference) do nothing;
