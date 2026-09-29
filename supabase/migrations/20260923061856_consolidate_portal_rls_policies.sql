-- Consolidate overlapping internal/client/vendor portal RLS policies while preserving access semantics.

drop policy if exists internal_access on public.approvals;
drop policy if exists approvals_client_portal_read on public.approvals;
drop policy if exists approvals_client_portal_update on public.approvals;
create policy approvals_access_select on public.approvals for select to authenticated using (
  (select public.is_internal_user()) or exists (
    select 1 from public.projects p where p.id=approvals.project_id and p.client_id is not null and public.has_client_portal_access(p.client_id)
  )
);
create policy approvals_access_insert on public.approvals for insert to authenticated with check ((select public.is_internal_user()));
create policy approvals_access_update on public.approvals for update to authenticated
using (
  (select public.is_internal_user()) or (
    status='pending' and exists (
      select 1 from public.projects p where p.id=approvals.project_id and p.client_id is not null and public.has_client_portal_access(p.client_id)
    )
  )
)
with check (
  (select public.is_internal_user()) or (
    status=any(array['approved'::text,'changes_requested'::text]) and exists (
      select 1 from public.projects p where p.id=approvals.project_id and p.client_id is not null and public.has_client_portal_access(p.client_id)
    )
  )
);
create policy approvals_access_delete on public.approvals for delete to authenticated using ((select public.is_internal_user()));

drop policy if exists internal_access on public.clients;
drop policy if exists clients_portal_read on public.clients;
create policy clients_access_select on public.clients for select to authenticated
using ((select public.is_internal_user()) or (deleted_at is null and public.has_client_portal_access(id)));
create policy clients_access_insert on public.clients for insert to authenticated with check ((select public.is_internal_user()));
create policy clients_access_update on public.clients for update to authenticated using ((select public.is_internal_user())) with check ((select public.is_internal_user()));
create policy clients_access_delete on public.clients for delete to authenticated using ((select public.is_internal_user()));

drop policy if exists internal_access on public.projects;
drop policy if exists projects_client_portal_read on public.projects;
drop policy if exists projects_vendor_portal_read on public.projects;
create policy projects_access_select on public.projects for select to authenticated
using (
  (select public.is_internal_user())
  or (deleted_at is null and client_id is not null and public.has_client_portal_access(client_id))
  or (
    deleted_at is null and (
      exists (
        select 1 from public.purchase_orders po
        where po.project_id=projects.id and po.vendor_id is not null and po.po_no is not null
          and public.has_vendor_portal_access(po.vendor_id)
      )
      or exists (
        select 1 from public.vendor_rfq_invites r
        where r.project_id=projects.id and r.status<>'cancelled'
          and public.has_vendor_portal_access(r.vendor_id)
      )
    )
  )
);
create policy projects_access_insert on public.projects for insert to authenticated with check ((select public.is_internal_user()));
create policy projects_access_update on public.projects for update to authenticated using ((select public.is_internal_user())) with check ((select public.is_internal_user()));
create policy projects_access_delete on public.projects for delete to authenticated using ((select public.is_internal_user()));

drop policy if exists construction_read on public.construction_stages;
drop policy if exists construction_stages_client_portal_read on public.construction_stages;
create policy construction_stages_access_select on public.construction_stages for select to authenticated using (
  (select public.is_internal_user()) or exists (
    select 1 from public.projects p
    where p.id=construction_stages.project_id and p.deleted_at is null and p.client_id is not null
      and public.has_client_portal_access(p.client_id)
  )
);

drop policy if exists document_revisions_read on public.document_revisions;
drop policy if exists document_revisions_client_portal_read on public.document_revisions;
create policy document_revisions_access_select on public.document_revisions for select to authenticated using (
  (select public.is_internal_user()) or (
    status='approved' and exists (
      select 1 from public.project_documents d
      join public.projects p on p.id=d.project_id
      where d.id=document_revisions.document_id
        and d.client_visible=true and d.status='approved'
        and d.current_revision_id=document_revisions.id
        and p.client_id is not null
        and public.has_client_portal_access(p.client_id)
    )
  )
);

drop policy if exists grn_items_read on public.goods_receipt_items;
drop policy if exists goods_receipt_items_vendor_portal_read on public.goods_receipt_items;
create policy goods_receipt_items_access_select on public.goods_receipt_items for select to authenticated using (
  (select public.is_internal_user()) or exists (
    select 1 from public.goods_receipts g
    where g.id=goods_receipt_items.grn_id and g.vendor_id is not null
      and public.has_vendor_portal_access(g.vendor_id)
  )
);

drop policy if exists grn_read on public.goods_receipts;
drop policy if exists goods_receipts_vendor_portal_read on public.goods_receipts;
create policy goods_receipts_access_select on public.goods_receipts for select to authenticated
using ((select public.is_internal_user()) or (vendor_id is not null and public.has_vendor_portal_access(vendor_id)));

drop policy if exists invoices_read on public.invoices;
drop policy if exists invoices_client_portal_read on public.invoices;
create policy invoices_access_select on public.invoices for select to authenticated using (
  (select public.is_internal_user()) or (
    deleted_at is null and invoice_no is not null and client_id is not null
    and public.has_client_portal_access(client_id)
  )
);

drop policy if exists po_items_read on public.po_items;
drop policy if exists po_items_vendor_portal_read on public.po_items;
create policy po_items_access_select on public.po_items for select to authenticated using (
  (select public.is_internal_user()) or exists (
    select 1 from public.purchase_orders p
    where p.id=po_items.po_id and p.po_no is not null
      and p.status=any(array['approved'::text,'ordered'::text,'partly_delivered'::text,'delivered'::text,'cancelled'::text])
      and p.vendor_id is not null and public.has_vendor_portal_access(p.vendor_id)
  )
);

drop policy if exists proformas_read on public.proforma_invoices;
drop policy if exists proformas_client_portal_read on public.proforma_invoices;
create policy proforma_invoices_access_select on public.proforma_invoices for select to authenticated using (
  (select public.is_internal_user()) or (
    deleted_at is null and proforma_no is not null and client_id is not null
    and public.has_client_portal_access(client_id)
  )
);

drop policy if exists project_documents_read on public.project_documents;
drop policy if exists project_documents_client_portal_read on public.project_documents;
create policy project_documents_access_select on public.project_documents for select to authenticated using (
  (select public.is_internal_user()) or (
    client_visible=true and status='approved' and exists (
      select 1 from public.projects p
      where p.id=project_documents.project_id and p.deleted_at is null and p.client_id is not null
        and public.has_client_portal_access(p.client_id)
    )
  )
);

drop policy if exists pos_read on public.purchase_orders;
drop policy if exists purchase_orders_vendor_portal_read on public.purchase_orders;
create policy purchase_orders_access_select on public.purchase_orders for select to authenticated using (
  (select public.is_internal_user()) or (
    po_no is not null
    and status=any(array['approved'::text,'ordered'::text,'partly_delivered'::text,'delivered'::text,'cancelled'::text])
    and vendor_id is not null and public.has_vendor_portal_access(vendor_id)
  )
);

drop policy if exists receipts_read on public.receipts;
drop policy if exists receipts_client_portal_read on public.receipts;
create policy receipts_access_select on public.receipts for select to authenticated
using ((select public.is_internal_user()) or (client_id is not null and public.has_client_portal_access(client_id)));

drop policy if exists vendor_bills_read on public.vendor_bills;
drop policy if exists vendor_bills_portal_read on public.vendor_bills;
create policy vendor_bills_access_select on public.vendor_bills for select to authenticated
using ((select public.is_internal_user()) or (vendor_id is not null and public.has_vendor_portal_access(vendor_id)));

drop policy if exists vendor_payments_read on public.vendor_payments;
drop policy if exists vendor_payments_portal_read on public.vendor_payments;
create policy vendor_payments_access_select on public.vendor_payments for select to authenticated
using ((select public.is_internal_user()) or (vendor_id is not null and public.has_vendor_portal_access(vendor_id)));

drop policy if exists quote_items_insert on public.vendor_quote_items;
drop policy if exists vendor_quote_items_portal_insert on public.vendor_quote_items;
drop policy if exists quote_items_read on public.vendor_quote_items;
drop policy if exists vendor_quote_items_portal_read on public.vendor_quote_items;
create policy vendor_quote_items_access_select on public.vendor_quote_items for select to authenticated using (
  (select public.is_internal_user()) or exists (
    select 1 from public.vendor_quotes q
    where q.id=vendor_quote_items.quote_id and public.has_vendor_portal_access(q.vendor_id)
  )
);
create policy vendor_quote_items_access_insert on public.vendor_quote_items for insert to authenticated with check (
  ((select public.current_app_role())=any(array['founder'::text,'admin'::text,'procurement'::text,'project_manager'::text]))
  or (
    public.current_app_role() is null and exists (
      select 1 from public.vendor_quotes q
      join public.vendor_rfq_invites r on r.requisition_id=q.requisition_id and r.vendor_id=q.vendor_id
      where q.id=vendor_quote_items.quote_id and q.status='received'
        and r.status=any(array['invited'::text,'viewed'::text])
        and public.has_vendor_portal_access(q.vendor_id)
    )
  )
);

drop policy if exists quotes_insert on public.vendor_quotes;
drop policy if exists vendor_quotes_portal_insert on public.vendor_quotes;
drop policy if exists quotes_read on public.vendor_quotes;
drop policy if exists vendor_quotes_portal_read on public.vendor_quotes;
drop policy if exists quotes_update on public.vendor_quotes;
drop policy if exists vendor_quotes_portal_update on public.vendor_quotes;
create policy vendor_quotes_access_select on public.vendor_quotes for select to authenticated
using ((select public.is_internal_user()) or public.has_vendor_portal_access(vendor_id));
create policy vendor_quotes_access_insert on public.vendor_quotes for insert to authenticated with check (
  ((select public.current_app_role())=any(array['founder'::text,'admin'::text,'procurement'::text,'project_manager'::text]))
  or (
    public.current_app_role() is null and created_by is null and status='received'
    and subtotal=0::numeric and tax_amount=0::numeric and total=0::numeric
    and public.has_vendor_portal_access(vendor_id)
    and exists (
      select 1 from public.vendor_rfq_invites r
      where r.requisition_id=vendor_quotes.requisition_id
        and r.vendor_id=vendor_quotes.vendor_id
        and r.status=any(array['invited'::text,'viewed'::text])
    )
  )
);
create policy vendor_quotes_access_update on public.vendor_quotes for update to authenticated
using (
  ((select public.current_app_role())=any(array['founder'::text,'admin'::text,'procurement'::text,'project_manager'::text]))
  or (public.current_app_role() is null and status='received' and public.has_vendor_portal_access(vendor_id))
)
with check (
  ((select public.current_app_role())=any(array['founder'::text,'admin'::text,'procurement'::text,'project_manager'::text]))
  or (public.current_app_role() is null and status='received' and public.has_vendor_portal_access(vendor_id))
);

drop policy if exists vendors_read on public.vendors;
drop policy if exists vendors_portal_read on public.vendors;
create policy vendors_access_select on public.vendors for select to authenticated
using ((select public.is_internal_user()) or public.has_vendor_portal_access(id));
