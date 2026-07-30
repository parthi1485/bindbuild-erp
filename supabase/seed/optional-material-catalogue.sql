-- ============================================================
-- OPTIONAL starter data for Procurement & Inventory
--
-- This is master/reference data, not business data: stores and a material
-- catalogue with reorder levels. Nothing here is invented transactions.
-- Run it in the Supabase SQL editor, then adjust rates and reorder levels
-- to your actual site practice.
-- ============================================================

-- 1 · a central store, plus one store per active project
insert into public.stores (name, is_central, location)
values ('Central store — Studio Bind', true, 'Chennai')
on conflict do nothing;

insert into public.stores (name, project_id, location)
select p.name || ' — site store', p.id, p.location
from public.projects p
where p.status = 'active'
  and not exists (select 1 from public.stores s where s.project_id = p.id);

-- 2 · material catalogue with HSN codes and typical reorder levels
insert into public.materials (code, name, category, unit, reorder_level, last_rate, hsn_sac) values
  ('STL-12','TMT steel Fe500 · 12mm',        'Steel',             'T',    1.0,  75000, '7214'),
  ('STL-16','TMT steel Fe500 · 16mm',        'Steel',             'T',    1.0,  75000, '7214'),
  ('STL-BW','Binding wire',                  'Steel',             'kg',  40,       85, '7217'),
  ('CEM-53','OPC 53 grade cement',           'Cement & masonry',  'bags',100,      430, '2523'),
  ('CEM-AAC','AAC blocks 600x200x150',       'Cement & masonry',  'nos', 200,       52, '6810'),
  ('AGG-SND','River sand',                   'Aggregate',         'units',  3,   18000, '2505'),
  ('AGG-20','20mm blue metal',               'Aggregate',         'units',  3,   14000, '2517'),
  ('AGG-MSD','M-sand',                       'Aggregate',         'units',  3,   13000, '2505'),
  ('RMC-25','M25 ready-mix concrete',        'Concrete',          'cu.m',   0,    5600, '3824'),
  ('PLY-12','Shuttering plywood 12mm',       'Formwork',          'sheets', 40,   1100, '4412'),
  ('TIL-VT','Vitrified tiles 600x600',       'Finishes',          'sqft',  200,     85, '6907'),
  ('PNT-EM','Interior emulsion',             'Finishes',          'ltr',    50,    320, '3209'),
  ('ELE-WR','Electrical wire 2.5sqmm',       'Electrical',        'coils',  10,   2400, '8544'),
  ('ELE-CD','PVC conduit 25mm',              'Electrical',        'nos',    50,     95, '3917'),
  ('PLB-CP','CPVC pipe 25mm',                'Plumbing',          'nos',    40,    280, '3917'),
  ('PLB-SN','Sanitaryware set',              'Plumbing',          'sets',    2,  18000, '6910'),
  ('WPF-MB','Waterproofing membrane',        'Waterproofing',     'rolls',   6,   4200, '3921')
on conflict (code) do nothing;

-- 3 · opening stock — set real counted quantities here, then run.
--     Movements are the source of truth; there is no editable qty column.
-- insert into public.stock_ledger (material_id, store_id, movement_type, qty, rate, note)
-- select m.id, s.id, 'in', 0, m.last_rate, 'Opening stock'
-- from public.materials m
-- cross join public.stores s
-- where s.is_central;
