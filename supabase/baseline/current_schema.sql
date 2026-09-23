-- Bind Build ERP consolidated schema baseline
-- Generated from live project glywgbhuqrfxgowovylo on 2026-09-23.
-- Purpose: bootstrap a fresh Supabase project to the current ERP schema.
-- The timestamped files in supabase/migrations remain the authentic live migration history.
-- Run this baseline on an EMPTY project; do not layer it on top of live operational data.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create extension if not exists pg_cron;

-- Application tables

create table if not exists public."accounting_period_locks" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid not null,
  "period_key" text not null,
  "locked_at" timestamp with time zone default now() not null,
  "locked_by" uuid default auth.uid() not null,
  "note" text
);

create table if not exists public."application_backup_log" (
  "id" uuid default gen_random_uuid() not null,
  "operation" text not null,
  "format_version" integer default 1 not null,
  "table_count" integer default 0 not null,
  "row_count" bigint default 0 not null,
  "byte_estimate" bigint,
  "status" text not null,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."approvals" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid,
  "title" text not null,
  "entity_type" text default 'general'::text not null,
  "entity_id" uuid,
  "amount" numeric(18,2) default 0 not null,
  "status" text default 'pending'::text not null,
  "comment" text,
  "requested_by" uuid default auth.uid(),
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "portal_decided_by" uuid,
  "portal_decider_email" text
);

create table if not exists public."attendance" (
  "id" uuid default gen_random_uuid() not null,
  "employee_id" uuid not null,
  "project_id" uuid,
  "on_date" date default CURRENT_DATE not null,
  "status" text not null,
  "check_in" time without time zone,
  "check_out" time without time zone,
  "note" text,
  "marked_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."automation_runs" (
  "id" uuid default gen_random_uuid() not null,
  "job_name" text not null,
  "started_at" timestamp with time zone default now() not null,
  "finished_at" timestamp with time zone,
  "status" text default 'running'::text not null,
  "result" jsonb,
  "error" text
);

create table if not exists public."business_units" (
  "id" uuid default gen_random_uuid() not null,
  "code" text not null,
  "name" text not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."clients" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "lead_id" uuid,
  "name" text not null,
  "phone" text,
  "email" text,
  "city" text,
  "address" text,
  "gstin" text,
  "pan" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "state" text,
  "state_code" text
);

create table if not exists public."construction_stages" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "stage_key" text not null,
  "sort_order" integer not null,
  "title" text not null,
  "phase" text default 'Construction'::text not null,
  "weight_pct" numeric(5,2) default 0 not null,
  "planned_start" date,
  "planned_end" date,
  "actual_start" date,
  "actual_end" date,
  "progress_pct" numeric(5,2) default 0 not null,
  "status" text default 'not_started'::text not null,
  "requires_inspection" boolean default false not null,
  "notes" text,
  "completed_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."credit_notes" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "credit_no" text not null,
  "invoice_id" uuid not null,
  "client_id" uuid,
  "project_id" uuid,
  "reason" text not null,
  "narration" text,
  "subtotal" numeric not null,
  "tax_rate" numeric default 18 not null,
  "tax_amount" numeric default 0 not null,
  "total" numeric not null,
  "is_interstate" boolean default false not null,
  "issue_date" date default CURRENT_DATE not null,
  "status" text default 'issued'::text not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."design_deliverables" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "stage" text,
  "title" text not null,
  "due_date" date,
  "revision" text default 'R0'::text not null,
  "status" text default 'not_started'::text not null,
  "client_approval_required" boolean default false not null,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."document_approvals" (
  "id" uuid default gen_random_uuid() not null,
  "document_id" uuid not null,
  "revision_id" uuid not null,
  "reviewer_id" uuid,
  "status" text default 'pending'::text not null,
  "comment" text,
  "requested_by" uuid default auth.uid(),
  "requested_at" timestamp with time zone default now() not null,
  "reviewed_at" timestamp with time zone
);

create table if not exists public."document_register" (
  "id" uuid default gen_random_uuid() not null,
  "doc_type" text not null,
  "document_no" text not null,
  "lead_id" uuid,
  "project_id" uuid,
  "client_id" uuid,
  "amount" numeric(18,2) default 0 not null,
  "status" text default 'issued'::text not null,
  "issue_date" date default CURRENT_DATE not null,
  "issued_at" timestamp with time zone default now() not null,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "created_by" uuid default auth.uid(),
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."document_revisions" (
  "id" uuid default gen_random_uuid() not null,
  "document_id" uuid not null,
  "revision_no" integer not null,
  "revision_code" text not null,
  "file_name" text not null,
  "storage_path" text not null,
  "mime_type" text,
  "size_bytes" bigint,
  "issue_purpose" text default 'internal'::text not null,
  "status" text default 'draft'::text not null,
  "note" text,
  "uploaded_by" uuid default auth.uid(),
  "issued_by" uuid,
  "issued_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."document_sequences" (
  "doc_type" text not null,
  "period_key" text not null,
  "last_number" bigint default 0 not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."drawings" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "drawing_no" text not null,
  "title" text not null,
  "discipline" text,
  "revision" text default 'R0'::text not null,
  "status" text default 'draft'::text not null,
  "issue_date" date,
  "file_url" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."employee_compensation" (
  "id" uuid default gen_random_uuid() not null,
  "employee_id" uuid not null,
  "effective_from" date default CURRENT_DATE not null,
  "monthly_fixed_gross" numeric(14,2) default 0 not null,
  "currency" text default 'INR'::text not null,
  "pay_cycle" text default 'monthly'::text not null,
  "daily_rate" numeric(14,2) default 0 not null,
  "hourly_rate" numeric(14,2) default 0 not null,
  "notes" text,
  "updated_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."employees" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "employee_no" text,
  "profile_id" uuid,
  "full_name" text not null,
  "work_email" text,
  "phone" text,
  "designation" text,
  "department" text,
  "employment_type" text default 'full_time'::text not null,
  "work_location" text,
  "joining_date" date default CURRENT_DATE not null,
  "exit_date" date,
  "status" text default 'active'::text not null,
  "manager_employee_id" uuid,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."erp_notification_reads" (
  "notification_id" uuid not null,
  "user_id" uuid not null,
  "status" text default 'read'::text not null,
  "read_at" timestamp with time zone default now() not null
);

create table if not exists public."erp_notifications" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "fingerprint" text not null,
  "kind" text not null,
  "severity" text default 'info'::text not null,
  "title" text not null,
  "body" text,
  "entity_type" text,
  "entity_id" uuid,
  "target_role" text,
  "target_user_id" uuid,
  "status" text default 'unread'::text not null,
  "occurred_on" date default CURRENT_DATE not null,
  "created_at" timestamp with time zone default now() not null,
  "read_at" timestamp with time zone
);

create table if not exists public."estimate_items" (
  "id" uuid default gen_random_uuid() not null,
  "estimate_id" uuid not null,
  "sort_order" integer default 0 not null,
  "category" text,
  "description" text not null,
  "qty" numeric(14,3) default 1 not null,
  "unit" text default 'LS'::text not null,
  "rate" numeric(14,2) default 0 not null,
  "amount" numeric(14,2) generated always as (round(qty * rate, 2)) stored,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."estimates" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "estimate_no" text,
  "lead_id" uuid,
  "project_id" uuid,
  "client_id" uuid,
  "title" text default 'Construction Estimate'::text not null,
  "status" text default 'draft'::text not null,
  "subtotal" numeric(18,2) default 0 not null,
  "discount" numeric(18,2) default 0 not null,
  "tax_rate" numeric(8,2) default 0 not null,
  "tax_amount" numeric(18,2) default 0 not null,
  "total" numeric(18,2) default 0 not null,
  "issue_date" date default CURRENT_DATE not null,
  "valid_until" date,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "scope" text,
  "terms" text,
  "built_up_area" numeric(12,2)
);

create table if not exists public."expenses" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "project_id" uuid,
  "vendor_id" uuid,
  "title" text not null,
  "category" text,
  "amount" numeric(18,2) default 0 not null,
  "expense_date" date default CURRENT_DATE not null,
  "status" text default 'draft'::text not null,
  "reference_no" text,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."goods_receipt_items" (
  "id" uuid default gen_random_uuid() not null,
  "grn_id" uuid not null,
  "po_item_id" uuid not null,
  "material_id" uuid,
  "description" text not null,
  "ordered_qty" numeric(14,3) default 0 not null,
  "received_qty" numeric(14,3) not null,
  "accepted_qty" numeric(14,3) not null,
  "rejected_qty" numeric(14,3) generated always as ((received_qty - accepted_qty)) stored,
  "unit" text not null,
  "rate" numeric(14,2) default 0 not null,
  "remarks" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."goods_receipts" (
  "id" uuid default gen_random_uuid() not null,
  "grn_no" text not null,
  "business_unit_id" uuid,
  "project_id" uuid not null,
  "po_id" uuid not null,
  "vendor_id" uuid,
  "store_id" uuid not null,
  "receipt_date" date default CURRENT_DATE not null,
  "delivery_challan_no" text,
  "vehicle_no" text,
  "received_by" uuid default auth.uid(),
  "status" text default 'received'::text not null,
  "quality_note" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."invoice_items" (
  "id" uuid default gen_random_uuid() not null,
  "invoice_id" uuid not null,
  "sort_order" integer default 0 not null,
  "description" text not null,
  "sac_code" text,
  "qty" numeric(14,3) default 1 not null,
  "unit" text default 'LS'::text not null,
  "rate" numeric(14,2) default 0 not null,
  "amount" numeric(14,2) generated always as (round(qty * rate, 2)) stored,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."invoices" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "invoice_no" text,
  "lead_id" uuid,
  "project_id" uuid,
  "client_id" uuid,
  "proforma_id" uuid,
  "milestone_name" text,
  "milestone_pct" numeric(8,2),
  "status" text default 'draft'::text not null,
  "subtotal" numeric(18,2) default 0 not null,
  "discount" numeric(18,2) default 0 not null,
  "tax_rate" numeric(8,2) default 18 not null,
  "tax_amount" numeric(18,2) default 0 not null,
  "total" numeric(18,2) default 0 not null,
  "amount_paid" numeric(18,2) default 0 not null,
  "issue_date" date default CURRENT_DATE not null,
  "due_date" date,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "place_of_supply_state_code" text,
  "is_interstate" boolean default false not null,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "credited_amount" numeric default 0 not null,
  "credit_status" text default 'none'::text not null
);

create table if not exists public."kudos" (
  "id" uuid default gen_random_uuid() not null,
  "from_employee_id" uuid not null,
  "to_employee_id" uuid not null,
  "message" text not null,
  "value_tags" text[] default '{}'::text[] not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."leads" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "lead_no" text,
  "name" text not null,
  "phone" text,
  "email" text,
  "area" text,
  "city" text default 'Chennai'::text,
  "service" text,
  "source" text,
  "expected_value" numeric(18,2) default 0 not null,
  "stage" text default 'new'::text not null,
  "priority" text default 'warm'::text not null,
  "notes" text,
  "owner_id" uuid,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone
);

create table if not exists public."leave_requests" (
  "id" uuid default gen_random_uuid() not null,
  "employee_id" uuid not null,
  "leave_type_id" uuid not null,
  "from_date" date not null,
  "to_date" date not null,
  "days" numeric(6,2) not null,
  "reason" text,
  "status" text default 'submitted'::text not null,
  "submitted_at" timestamp with time zone,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "review_note" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."leave_types" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "code" text not null,
  "name" text not null,
  "annual_quota" numeric(6,2) default 0 not null,
  "paid" boolean default true not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."material_requisition_items" (
  "id" uuid default gen_random_uuid() not null,
  "requisition_id" uuid not null,
  "material_id" uuid,
  "description" text not null,
  "qty" numeric(14,3) not null,
  "unit" text default 'nos'::text not null,
  "estimated_rate" numeric(14,2) default 0 not null,
  "notes" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."material_requisitions" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "requisition_no" text,
  "project_id" uuid not null,
  "requested_by" uuid default auth.uid(),
  "required_by" date,
  "purpose" text,
  "priority" text default 'normal'::text not null,
  "status" text default 'draft'::text not null,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "rejection_reason" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."materials" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "code" text,
  "name" text not null,
  "category" text,
  "unit" text default 'nos'::text not null,
  "default_rate" numeric(14,2) default 0 not null,
  "reorder_level" numeric(14,3) default 0 not null,
  "hsn_code" text,
  "gst_rate" numeric(5,2) default 18 not null,
  "status" text default 'active'::text not null,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."meeting_action_items" (
  "id" uuid default gen_random_uuid() not null,
  "meeting_id" uuid not null,
  "project_id" uuid,
  "title" text not null,
  "description" text,
  "owner_profile_id" uuid,
  "due_date" date,
  "priority" text default 'medium'::text not null,
  "status" text default 'open'::text not null,
  "task_id" uuid,
  "created_by" uuid default auth.uid(),
  "completed_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."meeting_attendees" (
  "id" uuid default gen_random_uuid() not null,
  "meeting_id" uuid not null,
  "profile_id" uuid,
  "external_name" text,
  "external_email" text,
  "attendee_type" text default 'internal'::text not null,
  "attendance_status" text default 'invited'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."meeting_notes" (
  "id" uuid default gen_random_uuid() not null,
  "meeting_id" uuid not null,
  "kind" text not null,
  "body" text not null,
  "sort_order" integer default 0 not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."meetings" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "project_id" uuid,
  "meeting_no" text,
  "title" text not null,
  "meeting_type" text default 'project'::text not null,
  "scheduled_at" timestamp with time zone not null,
  "duration_minutes" integer default 60 not null,
  "location" text,
  "meeting_link" text,
  "agenda" text,
  "minutes_summary" text,
  "status" text default 'scheduled'::text not null,
  "created_by" uuid default auth.uid(),
  "completed_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."organisation_profiles" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid not null,
  "trade_name" text not null,
  "legal_name" text,
  "gstin" text,
  "pan" text,
  "address" text,
  "city" text,
  "state" text,
  "state_code" text,
  "pincode" text,
  "email" text,
  "phone" text,
  "bank_name" text,
  "account_name" text,
  "account_no" text,
  "ifsc" text,
  "upi" text,
  "updated_at" timestamp with time zone default now() not null,
  "updated_by" uuid default auth.uid()
);

create table if not exists public."payroll_entries" (
  "id" uuid default gen_random_uuid() not null,
  "payroll_run_id" uuid not null,
  "employee_id" uuid not null,
  "fixed_gross" numeric(14,2) default 0 not null,
  "variable_earnings" numeric(14,2) default 0 not null,
  "deductions" numeric(14,2) default 0 not null,
  "gross_pay" numeric(14,2) default 0 not null,
  "net_pay" numeric(14,2) default 0 not null,
  "note" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."payroll_inputs" (
  "id" uuid default gen_random_uuid() not null,
  "employee_id" uuid not null,
  "period_month" date not null,
  "input_type" text not null,
  "code" text,
  "label" text not null,
  "amount" numeric(14,2) not null,
  "notes" text,
  "status" text default 'approved'::text not null,
  "created_by" uuid default auth.uid(),
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."payroll_runs" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "run_no" text,
  "period_month" date not null,
  "status" text default 'draft'::text not null,
  "pay_date" date,
  "total_fixed" numeric(14,2) default 0 not null,
  "total_earnings" numeric(14,2) default 0 not null,
  "total_deductions" numeric(14,2) default 0 not null,
  "total_gross" numeric(14,2) default 0 not null,
  "total_net" numeric(14,2) default 0 not null,
  "prepared_by" uuid default auth.uid(),
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "paid_by" uuid,
  "paid_at" timestamp with time zone,
  "payment_reference" text,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."performance_cycles" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "code" text not null,
  "name" text not null,
  "start_date" date not null,
  "end_date" date not null,
  "status" text default 'planning'::text not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."performance_goals" (
  "id" uuid default gen_random_uuid() not null,
  "cycle_id" uuid not null,
  "employee_id" uuid not null,
  "project_id" uuid,
  "title" text not null,
  "metric" text,
  "target_value" text,
  "weight_pct" numeric(5,2) default 0 not null,
  "progress_pct" numeric(5,2) default 0 not null,
  "status" text default 'open'::text not null,
  "due_date" date,
  "manager_note" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."performance_reviews" (
  "id" uuid default gen_random_uuid() not null,
  "cycle_id" uuid not null,
  "employee_id" uuid not null,
  "reviewer_employee_id" uuid,
  "review_type" text default 'manager'::text not null,
  "rating" numeric(3,2),
  "strengths" text,
  "development" text,
  "summary" text,
  "due_date" date,
  "status" text default 'draft'::text not null,
  "completed_at" timestamp with time zone,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."po_items" (
  "id" uuid default gen_random_uuid() not null,
  "po_id" uuid not null,
  "material_id" uuid,
  "description" text not null,
  "qty" numeric(14,3) not null,
  "unit" text default 'nos'::text not null,
  "rate" numeric(14,2) default 0 not null,
  "gst_rate" numeric(5,2) default 18 not null,
  "amount" numeric generated always as (round(qty * rate, 2)) stored,
  "received_qty" numeric(14,3) default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."portal_memberships" (
  "id" uuid default gen_random_uuid() not null,
  "portal_type" text not null,
  "client_id" uuid,
  "vendor_id" uuid,
  "email" text not null,
  "display_name" text,
  "user_id" uuid,
  "access_level" text default 'member'::text not null,
  "status" text default 'invited'::text not null,
  "invited_by" uuid,
  "invited_at" timestamp with time zone default now() not null,
  "claimed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."portal_messages" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid,
  "vendor_id" uuid,
  "sender_user_id" uuid not null,
  "sender_name" text,
  "from_studio" boolean default false not null,
  "body" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."preconstruction_steps" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "step_key" text not null,
  "step_order" integer not null,
  "phase" text not null,
  "title" text not null,
  "output_label" text,
  "status" text default 'not_started'::text not null,
  "required" boolean default true not null,
  "due_date" date,
  "owner_id" uuid,
  "client_confirmation_at" timestamp with time zone,
  "external_reference" text,
  "notes" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."profiles" (
  "id" uuid not null,
  "full_name" text,
  "role" text default 'viewer'::text not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."proforma_invoices" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "proforma_no" text,
  "lead_id" uuid,
  "project_id" uuid,
  "client_id" uuid,
  "proposal_id" uuid,
  "title" text default 'Proforma Invoice'::text not null,
  "status" text default 'draft'::text not null,
  "subtotal" numeric(18,2) default 0 not null,
  "discount" numeric(18,2) default 0 not null,
  "tax_rate" numeric(8,2) default 18 not null,
  "tax_amount" numeric(18,2) default 0 not null,
  "total" numeric(18,2) default 0 not null,
  "amount_paid" numeric(18,2) default 0 not null,
  "issue_date" date default CURRENT_DATE not null,
  "due_date" date,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "milestone_name" text,
  "milestone_pct" numeric,
  "place_of_supply_state_code" text,
  "is_interstate" boolean default false not null,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text
);

create table if not exists public."proforma_items" (
  "id" uuid default gen_random_uuid() not null,
  "proforma_id" uuid not null,
  "sort_order" integer default 0 not null,
  "description" text not null,
  "sac_code" text,
  "qty" numeric(14,3) default 1 not null,
  "unit" text default 'LS'::text not null,
  "rate" numeric(14,2) default 0 not null,
  "amount" numeric(14,2) generated always as (round(qty * rate, 2)) stored,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."project_allocations" (
  "id" uuid default gen_random_uuid() not null,
  "employee_id" uuid not null,
  "project_id" uuid not null,
  "role_on_project" text,
  "allocation_pct" numeric(5,2) default 100 not null,
  "start_date" date default CURRENT_DATE not null,
  "end_date" date,
  "status" text default 'active'::text not null,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."project_documents" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "project_id" uuid,
  "document_no" text,
  "title" text not null,
  "document_type" text default 'drawing'::text not null,
  "discipline" text,
  "status" text default 'draft'::text not null,
  "current_revision" integer default '-1'::integer not null,
  "current_revision_id" uuid,
  "requires_approval" boolean default true not null,
  "client_visible" boolean default false not null,
  "tags" text[] default '{}'::text[] not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."project_progress_snapshots" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "snapshot_date" date default CURRENT_DATE not null,
  "planned_pct" numeric(5,2) default 0 not null,
  "actual_pct" numeric(5,2) default 0 not null,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."projects" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "project_no" text,
  "code" text,
  "name" text not null,
  "client_id" uuid,
  "lead_id" uuid,
  "proposal_id" uuid,
  "service_type" text,
  "location" text,
  "contract_value" numeric(18,2) default 0 not null,
  "status" text default 'planning'::text not null,
  "health" text default 'ontrack'::text not null,
  "progress_pct" numeric(5,2) default 0 not null,
  "start_date" date,
  "target_end_date" date,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone
);

create table if not exists public."proposal_items" (
  "id" uuid default gen_random_uuid() not null,
  "proposal_id" uuid not null,
  "sort_order" integer default 0 not null,
  "category" text,
  "description" text not null,
  "qty" numeric(14,3) default 1 not null,
  "unit" text default 'LS'::text not null,
  "rate" numeric(14,2) default 0 not null,
  "amount" numeric(14,2) generated always as (round(qty * rate, 2)) stored,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."proposals" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "proposal_no" text,
  "lead_id" uuid,
  "client_id" uuid,
  "estimate_id" uuid,
  "title" text default 'Project Proposal'::text not null,
  "service" text,
  "status" text default 'draft'::text not null,
  "subtotal" numeric(18,2) default 0 not null,
  "discount" numeric(18,2) default 0 not null,
  "tax_rate" numeric(8,2) default 18 not null,
  "tax_amount" numeric(18,2) default 0 not null,
  "grand_total" numeric(18,2) default 0 not null,
  "valid_until" date,
  "notes" text,
  "sent_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "scope" text,
  "terms" text,
  "payment_schedule" jsonb default '[]'::jsonb not null,
  "built_up_area" numeric(12,2)
);

create table if not exists public."purchase_orders" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "po_no" text,
  "project_id" uuid,
  "vendor_id" uuid,
  "status" text default 'draft'::text not null,
  "order_date" date,
  "expected_date" date,
  "subtotal" numeric(18,2) default 0 not null,
  "tax_amount" numeric(18,2) default 0 not null,
  "total" numeric(18,2) default 0 not null,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "requisition_id" uuid,
  "quote_id" uuid,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "ordered_at" timestamp with time zone,
  "delivered_date" date,
  "payment_terms" text,
  "delivery_address" text,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text
);

create table if not exists public."quality_checks" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "stage_id" uuid,
  "inspection_id" uuid,
  "check_item" text not null,
  "result" text default 'pending'::text not null,
  "status" text default 'open'::text not null,
  "notes" text,
  "checked_by" uuid,
  "checked_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."receipts" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "receipt_no" text not null,
  "invoice_id" uuid,
  "proforma_id" uuid,
  "client_id" uuid,
  "project_id" uuid,
  "receipt_date" date default CURRENT_DATE not null,
  "amount" numeric(18,2) not null,
  "payment_mode" text default 'bank_transfer'::text not null,
  "reference_no" text,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "status" text default 'issued'::text not null,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text
);

create table if not exists public."reimbursements" (
  "id" uuid default gen_random_uuid() not null,
  "reimbursement_no" text,
  "business_unit_id" uuid,
  "employee_id" uuid not null,
  "project_id" uuid,
  "category" text,
  "expense_date" date default CURRENT_DATE not null,
  "amount" numeric(14,2) not null,
  "description" text not null,
  "receipt_ref" text,
  "status" text default 'draft'::text not null,
  "submitted_at" timestamp with time zone,
  "verified_by" uuid,
  "verified_at" timestamp with time zone,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "paid_by" uuid,
  "paid_at" timestamp with time zone,
  "payment_reference" text,
  "rejection_reason" text,
  "expense_id" uuid,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."site_inspections" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "stage_id" uuid,
  "report_id" uuid,
  "title" text not null,
  "inspection_type" text default 'quality'::text not null,
  "scheduled_on" date,
  "inspected_on" date,
  "status" text default 'planned'::text not null,
  "outcome" text default 'pending'::text not null,
  "inspector_id" uuid,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."site_issues" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "report_id" uuid,
  "stage_id" uuid,
  "category" text default 'site'::text not null,
  "severity" text default 'medium'::text not null,
  "status" text default 'open'::text not null,
  "title" text not null,
  "description" text,
  "owner_id" uuid,
  "due_date" date,
  "resolution" text,
  "resolved_at" timestamp with time zone,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."site_report_activities" (
  "id" uuid default gen_random_uuid() not null,
  "report_id" uuid not null,
  "stage_id" uuid,
  "sort_order" integer default 0 not null,
  "description" text not null,
  "qty" numeric(14,3),
  "unit" text,
  "reported_progress_pct" numeric(5,2),
  "remarks" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."site_report_equipment" (
  "id" uuid default gen_random_uuid() not null,
  "report_id" uuid not null,
  "sort_order" integer default 0 not null,
  "name" text not null,
  "hours" numeric(8,2) default 0 not null,
  "remarks" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."site_report_labour" (
  "id" uuid default gen_random_uuid() not null,
  "report_id" uuid not null,
  "sort_order" integer default 0 not null,
  "trade" text not null,
  "planned" integer default 0 not null,
  "present" integer default 0 not null,
  "remarks" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."site_report_materials" (
  "id" uuid default gen_random_uuid() not null,
  "report_id" uuid not null,
  "sort_order" integer default 0 not null,
  "material" text not null,
  "qty" numeric(14,3) default 0 not null,
  "unit" text,
  "supplier" text,
  "challan_no" text,
  "accepted" boolean default true not null,
  "remarks" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."site_reports" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "report_date" date default CURRENT_DATE not null,
  "labour_count" integer default 0 not null,
  "work_completed" text,
  "issues" text,
  "weather" text,
  "status" text default 'draft'::text not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "report_no" text,
  "start_time" time without time zone,
  "close_time" time without time zone,
  "ground_condition" text,
  "plan_note" text,
  "actual_note" text,
  "submitted_by" uuid,
  "submitted_at" timestamp with time zone,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "rejection_reason" text,
  "architect_instruction" text,
  "review_note" text
);

create table if not exists public."stock_ledger" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "project_id" uuid,
  "store_id" uuid not null,
  "material_id" uuid not null,
  "movement_type" text not null,
  "qty" numeric(14,3) not null,
  "rate" numeric(14,2) default 0 not null,
  "reference_type" text,
  "reference_id" uuid,
  "reference_no" text,
  "purpose" text,
  "moved_on" date default CURRENT_DATE not null,
  "recorded_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."stores" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "project_id" uuid,
  "code" text,
  "name" text not null,
  "location" text,
  "status" text default 'active'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."tasks" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid,
  "title" text not null,
  "description" text,
  "priority" text default 'medium'::text not null,
  "status" text default 'todo'::text not null,
  "assigned_to" uuid,
  "due_at" timestamp with time zone,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."vendor_bills" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "bill_no" text not null,
  "internal_no" text,
  "vendor_id" uuid not null,
  "project_id" uuid,
  "po_id" uuid,
  "grn_id" uuid,
  "bill_date" date default CURRENT_DATE not null,
  "due_date" date,
  "subtotal" numeric(14,2) default 0 not null,
  "tax_amount" numeric(14,2) default 0 not null,
  "total" numeric(14,2) not null,
  "amount_paid" numeric(14,2) default 0 not null,
  "status" text default 'draft'::text not null,
  "expense_id" uuid,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."vendor_payments" (
  "id" uuid default gen_random_uuid() not null,
  "vendor_bill_id" uuid not null,
  "vendor_id" uuid not null,
  "project_id" uuid,
  "payment_date" date default CURRENT_DATE not null,
  "amount" numeric(14,2) not null,
  "payment_mode" text default 'bank_transfer'::text not null,
  "reference_no" text,
  "notes" text,
  "recorded_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."vendor_quote_items" (
  "id" uuid default gen_random_uuid() not null,
  "quote_id" uuid not null,
  "requisition_item_id" uuid,
  "material_id" uuid,
  "description" text not null,
  "qty" numeric(14,3) not null,
  "unit" text default 'nos'::text not null,
  "rate" numeric(14,2) default 0 not null,
  "gst_rate" numeric(5,2) default 18 not null,
  "amount" numeric generated always as (round(qty * rate, 2)) stored,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."vendor_quotes" (
  "id" uuid default gen_random_uuid() not null,
  "requisition_id" uuid not null,
  "vendor_id" uuid not null,
  "quote_ref" text,
  "quote_date" date default CURRENT_DATE not null,
  "valid_until" date,
  "delivery_days" integer,
  "payment_terms" text,
  "subtotal" numeric(14,2) default 0 not null,
  "tax_amount" numeric(14,2) default 0 not null,
  "total" numeric(14,2) default 0 not null,
  "status" text default 'received'::text not null,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."vendor_rfq_invites" (
  "id" uuid default gen_random_uuid() not null,
  "requisition_id" uuid not null,
  "vendor_id" uuid not null,
  "status" text default 'invited'::text not null,
  "due_date" date,
  "note" text,
  "quote_id" uuid,
  "invited_by" uuid,
  "invited_at" timestamp with time zone default now() not null,
  "viewed_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "project_id" uuid,
  "requisition_no" text,
  "required_by" date,
  "purpose" text,
  "priority" text
);

create table if not exists public."vendor_rfq_items" (
  "id" uuid default gen_random_uuid() not null,
  "invite_id" uuid not null,
  "requisition_item_id" uuid not null,
  "material_id" uuid,
  "description" text not null,
  "qty" numeric not null,
  "unit" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."vendors" (
  "id" uuid default gen_random_uuid() not null,
  "business_unit_id" uuid,
  "code" text,
  "name" text not null,
  "category" text,
  "contact_person" text,
  "phone" text,
  "email" text,
  "gstin" text,
  "city" text,
  "payment_terms" text,
  "rating" numeric(3,2) default 0 not null,
  "status" text default 'active'::text not null,
  "notes" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

-- Constraints
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='accounting_period_locks' and con.conname='accounting_period_locks_business_unit_id_fkey'
  ) then
    alter table public."accounting_period_locks" add constraint "accounting_period_locks_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='accounting_period_locks' and con.conname='accounting_period_locks_pkey'
  ) then
    alter table public."accounting_period_locks" add constraint "accounting_period_locks_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='accounting_period_locks' and con.conname='accounting_period_locks_business_unit_id_period_key_key'
  ) then
    alter table public."accounting_period_locks" add constraint "accounting_period_locks_business_unit_id_period_key_key" UNIQUE (business_unit_id, period_key);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='application_backup_log' and con.conname='application_backup_log_operation_check'
  ) then
    alter table public."application_backup_log" add constraint "application_backup_log_operation_check" CHECK (operation = ANY (ARRAY['export'::text, 'validate'::text, 'restore'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='application_backup_log' and con.conname='application_backup_log_status_check'
  ) then
    alter table public."application_backup_log" add constraint "application_backup_log_status_check" CHECK (status = ANY (ARRAY['success'::text, 'failed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='application_backup_log' and con.conname='application_backup_log_created_by_fkey'
  ) then
    alter table public."application_backup_log" add constraint "application_backup_log_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='application_backup_log' and con.conname='application_backup_log_pkey'
  ) then
    alter table public."application_backup_log" add constraint "application_backup_log_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='approvals' and con.conname='approvals_decided_by_fkey'
  ) then
    alter table public."approvals" add constraint "approvals_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='approvals' and con.conname='approvals_project_id_fkey'
  ) then
    alter table public."approvals" add constraint "approvals_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='approvals' and con.conname='approvals_pkey'
  ) then
    alter table public."approvals" add constraint "approvals_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='attendance' and con.conname='attendance_status_check'
  ) then
    alter table public."attendance" add constraint "attendance_status_check" CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'leave'::text, 'half_day'::text, 'wfh'::text, 'holiday'::text, 'week_off'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='attendance' and con.conname='attendance_employee_id_fkey'
  ) then
    alter table public."attendance" add constraint "attendance_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='attendance' and con.conname='attendance_marked_by_fkey'
  ) then
    alter table public."attendance" add constraint "attendance_marked_by_fkey" FOREIGN KEY (marked_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='attendance' and con.conname='attendance_project_id_fkey'
  ) then
    alter table public."attendance" add constraint "attendance_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='attendance' and con.conname='attendance_pkey'
  ) then
    alter table public."attendance" add constraint "attendance_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='attendance' and con.conname='attendance_employee_id_on_date_key'
  ) then
    alter table public."attendance" add constraint "attendance_employee_id_on_date_key" UNIQUE (employee_id, on_date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='automation_runs' and con.conname='automation_runs_status_check'
  ) then
    alter table public."automation_runs" add constraint "automation_runs_status_check" CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='automation_runs' and con.conname='automation_runs_pkey'
  ) then
    alter table public."automation_runs" add constraint "automation_runs_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='business_units' and con.conname='business_units_pkey'
  ) then
    alter table public."business_units" add constraint "business_units_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='business_units' and con.conname='business_units_code_key'
  ) then
    alter table public."business_units" add constraint "business_units_code_key" UNIQUE (code);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='clients' and con.conname='clients_business_unit_id_fkey'
  ) then
    alter table public."clients" add constraint "clients_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='clients' and con.conname='clients_lead_id_fkey'
  ) then
    alter table public."clients" add constraint "clients_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='clients' and con.conname='clients_pkey'
  ) then
    alter table public."clients" add constraint "clients_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_progress_pct_check'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_progress_pct_check" CHECK (progress_pct >= 0::numeric AND progress_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_sort_order_check'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_sort_order_check" CHECK (sort_order > 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_status_check'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_status_check" CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'hold'::text, 'completed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_weight_pct_check'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_weight_pct_check" CHECK (weight_pct >= 0::numeric AND weight_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_completed_by_fkey'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_project_id_fkey'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_pkey'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_project_id_sort_order_key'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_project_id_sort_order_key" UNIQUE (project_id, sort_order);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='construction_stages' and con.conname='construction_stages_project_id_stage_key_key'
  ) then
    alter table public."construction_stages" add constraint "construction_stages_project_id_stage_key_key" UNIQUE (project_id, stage_key);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_subtotal_check'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_subtotal_check" CHECK (subtotal > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_tax_amount_check'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_tax_amount_check" CHECK (tax_amount >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_tax_rate_check'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_tax_rate_check" CHECK (tax_rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_total_check'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_total_check" CHECK (total > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_business_unit_id_fkey'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_client_id_fkey'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_invoice_id_fkey'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_project_id_fkey'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_pkey'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='credit_notes' and con.conname='credit_notes_credit_no_key'
  ) then
    alter table public."credit_notes" add constraint "credit_notes_credit_no_key" UNIQUE (credit_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='design_deliverables' and con.conname='design_deliverables_project_id_fkey'
  ) then
    alter table public."design_deliverables" add constraint "design_deliverables_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='design_deliverables' and con.conname='design_deliverables_pkey'
  ) then
    alter table public."design_deliverables" add constraint "design_deliverables_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_approvals' and con.conname='document_approvals_status_check'
  ) then
    alter table public."document_approvals" add constraint "document_approvals_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_approvals' and con.conname='document_approvals_document_id_fkey'
  ) then
    alter table public."document_approvals" add constraint "document_approvals_document_id_fkey" FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_approvals' and con.conname='document_approvals_requested_by_fkey'
  ) then
    alter table public."document_approvals" add constraint "document_approvals_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_approvals' and con.conname='document_approvals_reviewer_id_fkey'
  ) then
    alter table public."document_approvals" add constraint "document_approvals_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_approvals' and con.conname='document_approvals_revision_id_fkey'
  ) then
    alter table public."document_approvals" add constraint "document_approvals_revision_id_fkey" FOREIGN KEY (revision_id) REFERENCES document_revisions(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_approvals' and con.conname='document_approvals_pkey'
  ) then
    alter table public."document_approvals" add constraint "document_approvals_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_approvals' and con.conname='document_approvals_revision_id_reviewer_id_key'
  ) then
    alter table public."document_approvals" add constraint "document_approvals_revision_id_reviewer_id_key" UNIQUE (revision_id, reviewer_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_register' and con.conname='document_register_amount_check'
  ) then
    alter table public."document_register" add constraint "document_register_amount_check" CHECK (amount >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_register' and con.conname='document_register_doc_type_check'
  ) then
    alter table public."document_register" add constraint "document_register_doc_type_check" CHECK (doc_type = ANY (ARRAY['estimate'::text, 'proposal'::text, 'proforma'::text, 'receipt'::text, 'invoice'::text, 'credit_note'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_register' and con.conname='document_register_client_id_fkey'
  ) then
    alter table public."document_register" add constraint "document_register_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_register' and con.conname='document_register_lead_id_fkey'
  ) then
    alter table public."document_register" add constraint "document_register_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_register' and con.conname='document_register_project_id_fkey'
  ) then
    alter table public."document_register" add constraint "document_register_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_register' and con.conname='document_register_pkey'
  ) then
    alter table public."document_register" add constraint "document_register_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_register' and con.conname='document_register_document_no_key'
  ) then
    alter table public."document_register" add constraint "document_register_document_no_key" UNIQUE (document_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_issue_purpose_check'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_issue_purpose_check" CHECK (issue_purpose = ANY (ARRAY['internal'::text, 'review'::text, 'approval'::text, 'construction'::text, 'tender'::text, 'as_built'::text, 'record'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_revision_no_check'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_revision_no_check" CHECK (revision_no >= 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_size_bytes_check'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_size_bytes_check" CHECK (size_bytes IS NULL OR size_bytes >= 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_status_check'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'issued'::text, 'approved'::text, 'rejected'::text, 'superseded'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_document_id_fkey'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_document_id_fkey" FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_issued_by_fkey'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_issued_by_fkey" FOREIGN KEY (issued_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_uploaded_by_fkey'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_pkey'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_document_id_revision_code_key'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_document_id_revision_code_key" UNIQUE (document_id, revision_code);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_document_id_revision_no_key'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_document_id_revision_no_key" UNIQUE (document_id, revision_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_revisions' and con.conname='document_revisions_storage_path_key'
  ) then
    alter table public."document_revisions" add constraint "document_revisions_storage_path_key" UNIQUE (storage_path);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_sequences' and con.conname='document_sequences_last_number_check'
  ) then
    alter table public."document_sequences" add constraint "document_sequences_last_number_check" CHECK (last_number >= 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='document_sequences' and con.conname='document_sequences_pkey'
  ) then
    alter table public."document_sequences" add constraint "document_sequences_pkey" PRIMARY KEY (doc_type, period_key);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='drawings' and con.conname='drawings_project_id_fkey'
  ) then
    alter table public."drawings" add constraint "drawings_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='drawings' and con.conname='drawings_pkey'
  ) then
    alter table public."drawings" add constraint "drawings_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='drawings' and con.conname='drawings_project_id_drawing_no_revision_key'
  ) then
    alter table public."drawings" add constraint "drawings_project_id_drawing_no_revision_key" UNIQUE (project_id, drawing_no, revision);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_daily_rate_check'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_daily_rate_check" CHECK (daily_rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_hourly_rate_check'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_hourly_rate_check" CHECK (hourly_rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_monthly_fixed_gross_check'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_monthly_fixed_gross_check" CHECK (monthly_fixed_gross >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_pay_cycle_check'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_pay_cycle_check" CHECK (pay_cycle = ANY (ARRAY['monthly'::text, 'daily'::text, 'hourly'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_employee_id_fkey'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_updated_by_fkey'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_pkey'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employee_compensation' and con.conname='employee_compensation_employee_id_effective_from_key'
  ) then
    alter table public."employee_compensation" add constraint "employee_compensation_employee_id_effective_from_key" UNIQUE (employee_id, effective_from);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_check'
  ) then
    alter table public."employees" add constraint "employees_check" CHECK (exit_date IS NULL OR exit_date >= joining_date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_employment_type_check'
  ) then
    alter table public."employees" add constraint "employees_employment_type_check" CHECK (employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'contract'::text, 'intern'::text, 'consultant'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_status_check'
  ) then
    alter table public."employees" add constraint "employees_status_check" CHECK (status = ANY (ARRAY['active'::text, 'on_leave'::text, 'inactive'::text, 'exited'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_business_unit_id_fkey'
  ) then
    alter table public."employees" add constraint "employees_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_created_by_fkey'
  ) then
    alter table public."employees" add constraint "employees_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_manager_employee_id_fkey'
  ) then
    alter table public."employees" add constraint "employees_manager_employee_id_fkey" FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_profile_id_fkey'
  ) then
    alter table public."employees" add constraint "employees_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_pkey'
  ) then
    alter table public."employees" add constraint "employees_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_employee_no_key'
  ) then
    alter table public."employees" add constraint "employees_employee_no_key" UNIQUE (employee_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='employees' and con.conname='employees_profile_id_key'
  ) then
    alter table public."employees" add constraint "employees_profile_id_key" UNIQUE (profile_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notification_reads' and con.conname='erp_notification_reads_status_check'
  ) then
    alter table public."erp_notification_reads" add constraint "erp_notification_reads_status_check" CHECK (status = ANY (ARRAY['read'::text, 'dismissed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notification_reads' and con.conname='erp_notification_reads_notification_id_fkey'
  ) then
    alter table public."erp_notification_reads" add constraint "erp_notification_reads_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES erp_notifications(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notification_reads' and con.conname='erp_notification_reads_user_id_fkey'
  ) then
    alter table public."erp_notification_reads" add constraint "erp_notification_reads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notification_reads' and con.conname='erp_notification_reads_pkey'
  ) then
    alter table public."erp_notification_reads" add constraint "erp_notification_reads_pkey" PRIMARY KEY (notification_id, user_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notifications' and con.conname='erp_notifications_severity_check'
  ) then
    alter table public."erp_notifications" add constraint "erp_notifications_severity_check" CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notifications' and con.conname='erp_notifications_status_check'
  ) then
    alter table public."erp_notifications" add constraint "erp_notifications_status_check" CHECK (status = ANY (ARRAY['unread'::text, 'read'::text, 'dismissed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notifications' and con.conname='erp_notifications_business_unit_id_fkey'
  ) then
    alter table public."erp_notifications" add constraint "erp_notifications_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notifications' and con.conname='erp_notifications_target_user_id_fkey'
  ) then
    alter table public."erp_notifications" add constraint "erp_notifications_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='erp_notifications' and con.conname='erp_notifications_pkey'
  ) then
    alter table public."erp_notifications" add constraint "erp_notifications_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimate_items' and con.conname='estimate_items_qty_check'
  ) then
    alter table public."estimate_items" add constraint "estimate_items_qty_check" CHECK (qty >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimate_items' and con.conname='estimate_items_rate_check'
  ) then
    alter table public."estimate_items" add constraint "estimate_items_rate_check" CHECK (rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimate_items' and con.conname='estimate_items_estimate_id_fkey'
  ) then
    alter table public."estimate_items" add constraint "estimate_items_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimate_items' and con.conname='estimate_items_pkey'
  ) then
    alter table public."estimate_items" add constraint "estimate_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimates' and con.conname='estimates_business_unit_id_fkey'
  ) then
    alter table public."estimates" add constraint "estimates_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimates' and con.conname='estimates_client_id_fkey'
  ) then
    alter table public."estimates" add constraint "estimates_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimates' and con.conname='estimates_lead_id_fkey'
  ) then
    alter table public."estimates" add constraint "estimates_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimates' and con.conname='estimates_project_id_fkey'
  ) then
    alter table public."estimates" add constraint "estimates_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimates' and con.conname='estimates_pkey'
  ) then
    alter table public."estimates" add constraint "estimates_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='estimates' and con.conname='estimates_estimate_no_key'
  ) then
    alter table public."estimates" add constraint "estimates_estimate_no_key" UNIQUE (estimate_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='expenses' and con.conname='expenses_business_unit_id_fkey'
  ) then
    alter table public."expenses" add constraint "expenses_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='expenses' and con.conname='expenses_project_id_fkey'
  ) then
    alter table public."expenses" add constraint "expenses_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='expenses' and con.conname='expenses_vendor_id_fkey'
  ) then
    alter table public."expenses" add constraint "expenses_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='expenses' and con.conname='expenses_pkey'
  ) then
    alter table public."expenses" add constraint "expenses_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipt_items' and con.conname='goods_receipt_items_accepted_qty_check'
  ) then
    alter table public."goods_receipt_items" add constraint "goods_receipt_items_accepted_qty_check" CHECK (accepted_qty >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipt_items' and con.conname='goods_receipt_items_check'
  ) then
    alter table public."goods_receipt_items" add constraint "goods_receipt_items_check" CHECK (accepted_qty <= received_qty);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipt_items' and con.conname='goods_receipt_items_received_qty_check'
  ) then
    alter table public."goods_receipt_items" add constraint "goods_receipt_items_received_qty_check" CHECK (received_qty > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipt_items' and con.conname='goods_receipt_items_grn_id_fkey'
  ) then
    alter table public."goods_receipt_items" add constraint "goods_receipt_items_grn_id_fkey" FOREIGN KEY (grn_id) REFERENCES goods_receipts(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipt_items' and con.conname='goods_receipt_items_material_id_fkey'
  ) then
    alter table public."goods_receipt_items" add constraint "goods_receipt_items_material_id_fkey" FOREIGN KEY (material_id) REFERENCES materials(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipt_items' and con.conname='goods_receipt_items_po_item_id_fkey'
  ) then
    alter table public."goods_receipt_items" add constraint "goods_receipt_items_po_item_id_fkey" FOREIGN KEY (po_item_id) REFERENCES po_items(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipt_items' and con.conname='goods_receipt_items_pkey'
  ) then
    alter table public."goods_receipt_items" add constraint "goods_receipt_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_status_check'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_status_check" CHECK (status = ANY (ARRAY['received'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_business_unit_id_fkey'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_po_id_fkey'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_po_id_fkey" FOREIGN KEY (po_id) REFERENCES purchase_orders(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_project_id_fkey'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_received_by_fkey'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_received_by_fkey" FOREIGN KEY (received_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_store_id_fkey'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_vendor_id_fkey'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_pkey'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='goods_receipts' and con.conname='goods_receipts_grn_no_key'
  ) then
    alter table public."goods_receipts" add constraint "goods_receipts_grn_no_key" UNIQUE (grn_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoice_items' and con.conname='invoice_items_qty_check'
  ) then
    alter table public."invoice_items" add constraint "invoice_items_qty_check" CHECK (qty >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoice_items' and con.conname='invoice_items_rate_check'
  ) then
    alter table public."invoice_items" add constraint "invoice_items_rate_check" CHECK (rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoice_items' and con.conname='invoice_items_invoice_id_fkey'
  ) then
    alter table public."invoice_items" add constraint "invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoice_items' and con.conname='invoice_items_pkey'
  ) then
    alter table public."invoice_items" add constraint "invoice_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_credited_amount_check'
  ) then
    alter table public."invoices" add constraint "invoices_credited_amount_check" CHECK (credited_amount >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_business_unit_id_fkey'
  ) then
    alter table public."invoices" add constraint "invoices_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_client_id_fkey'
  ) then
    alter table public."invoices" add constraint "invoices_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_lead_id_fkey'
  ) then
    alter table public."invoices" add constraint "invoices_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_proforma_id_fkey'
  ) then
    alter table public."invoices" add constraint "invoices_proforma_id_fkey" FOREIGN KEY (proforma_id) REFERENCES proforma_invoices(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_project_id_fkey'
  ) then
    alter table public."invoices" add constraint "invoices_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_pkey'
  ) then
    alter table public."invoices" add constraint "invoices_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='invoices' and con.conname='invoices_invoice_no_key'
  ) then
    alter table public."invoices" add constraint "invoices_invoice_no_key" UNIQUE (invoice_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='kudos' and con.conname='kudos_check'
  ) then
    alter table public."kudos" add constraint "kudos_check" CHECK (from_employee_id <> to_employee_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='kudos' and con.conname='kudos_from_employee_id_fkey'
  ) then
    alter table public."kudos" add constraint "kudos_from_employee_id_fkey" FOREIGN KEY (from_employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='kudos' and con.conname='kudos_to_employee_id_fkey'
  ) then
    alter table public."kudos" add constraint "kudos_to_employee_id_fkey" FOREIGN KEY (to_employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='kudos' and con.conname='kudos_pkey'
  ) then
    alter table public."kudos" add constraint "kudos_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leads' and con.conname='leads_business_unit_id_fkey'
  ) then
    alter table public."leads" add constraint "leads_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leads' and con.conname='leads_owner_id_fkey'
  ) then
    alter table public."leads" add constraint "leads_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leads' and con.conname='leads_pkey'
  ) then
    alter table public."leads" add constraint "leads_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leads' and con.conname='leads_lead_no_key'
  ) then
    alter table public."leads" add constraint "leads_lead_no_key" UNIQUE (lead_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_check'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_check" CHECK (to_date >= from_date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_days_check'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_days_check" CHECK (days > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_status_check'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_created_by_fkey'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_employee_id_fkey'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_leave_type_id_fkey'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_leave_type_id_fkey" FOREIGN KEY (leave_type_id) REFERENCES leave_types(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_reviewed_by_fkey'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_requests' and con.conname='leave_requests_pkey'
  ) then
    alter table public."leave_requests" add constraint "leave_requests_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_types' and con.conname='leave_types_annual_quota_check'
  ) then
    alter table public."leave_types" add constraint "leave_types_annual_quota_check" CHECK (annual_quota >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_types' and con.conname='leave_types_business_unit_id_fkey'
  ) then
    alter table public."leave_types" add constraint "leave_types_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_types' and con.conname='leave_types_pkey'
  ) then
    alter table public."leave_types" add constraint "leave_types_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='leave_types' and con.conname='leave_types_business_unit_id_code_key'
  ) then
    alter table public."leave_types" add constraint "leave_types_business_unit_id_code_key" UNIQUE (business_unit_id, code);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisition_items' and con.conname='material_requisition_items_estimated_rate_check'
  ) then
    alter table public."material_requisition_items" add constraint "material_requisition_items_estimated_rate_check" CHECK (estimated_rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisition_items' and con.conname='material_requisition_items_qty_check'
  ) then
    alter table public."material_requisition_items" add constraint "material_requisition_items_qty_check" CHECK (qty > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisition_items' and con.conname='material_requisition_items_material_id_fkey'
  ) then
    alter table public."material_requisition_items" add constraint "material_requisition_items_material_id_fkey" FOREIGN KEY (material_id) REFERENCES materials(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisition_items' and con.conname='material_requisition_items_requisition_id_fkey'
  ) then
    alter table public."material_requisition_items" add constraint "material_requisition_items_requisition_id_fkey" FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisition_items' and con.conname='material_requisition_items_pkey'
  ) then
    alter table public."material_requisition_items" add constraint "material_requisition_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_priority_check'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_status_check'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'sourcing'::text, 'ordered'::text, 'closed'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_approved_by_fkey'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_business_unit_id_fkey'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_project_id_fkey'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_requested_by_fkey'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_pkey'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='material_requisitions' and con.conname='material_requisitions_requisition_no_key'
  ) then
    alter table public."material_requisitions" add constraint "material_requisitions_requisition_no_key" UNIQUE (requisition_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='materials' and con.conname='materials_default_rate_check'
  ) then
    alter table public."materials" add constraint "materials_default_rate_check" CHECK (default_rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='materials' and con.conname='materials_gst_rate_check'
  ) then
    alter table public."materials" add constraint "materials_gst_rate_check" CHECK (gst_rate >= 0::numeric AND gst_rate <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='materials' and con.conname='materials_reorder_level_check'
  ) then
    alter table public."materials" add constraint "materials_reorder_level_check" CHECK (reorder_level >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='materials' and con.conname='materials_status_check'
  ) then
    alter table public."materials" add constraint "materials_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='materials' and con.conname='materials_business_unit_id_fkey'
  ) then
    alter table public."materials" add constraint "materials_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='materials' and con.conname='materials_created_by_fkey'
  ) then
    alter table public."materials" add constraint "materials_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='materials' and con.conname='materials_pkey'
  ) then
    alter table public."materials" add constraint "materials_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_priority_check'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_status_check'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_status_check" CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_completed_by_fkey'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_created_by_fkey'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_meeting_id_fkey'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_owner_profile_id_fkey'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_owner_profile_id_fkey" FOREIGN KEY (owner_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_project_id_fkey'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_task_id_fkey'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_action_items' and con.conname='meeting_action_items_pkey'
  ) then
    alter table public."meeting_action_items" add constraint "meeting_action_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_attendees' and con.conname='meeting_attendees_attendance_status_check'
  ) then
    alter table public."meeting_attendees" add constraint "meeting_attendees_attendance_status_check" CHECK (attendance_status = ANY (ARRAY['invited'::text, 'present'::text, 'absent'::text, 'declined'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_attendees' and con.conname='meeting_attendees_attendee_type_check'
  ) then
    alter table public."meeting_attendees" add constraint "meeting_attendees_attendee_type_check" CHECK (attendee_type = ANY (ARRAY['internal'::text, 'client'::text, 'vendor'::text, 'consultant'::text, 'other'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_attendees' and con.conname='meeting_attendees_check'
  ) then
    alter table public."meeting_attendees" add constraint "meeting_attendees_check" CHECK (profile_id IS NOT NULL OR external_name IS NOT NULL);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_attendees' and con.conname='meeting_attendees_meeting_id_fkey'
  ) then
    alter table public."meeting_attendees" add constraint "meeting_attendees_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_attendees' and con.conname='meeting_attendees_profile_id_fkey'
  ) then
    alter table public."meeting_attendees" add constraint "meeting_attendees_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_attendees' and con.conname='meeting_attendees_pkey'
  ) then
    alter table public."meeting_attendees" add constraint "meeting_attendees_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_notes' and con.conname='meeting_notes_kind_check'
  ) then
    alter table public."meeting_notes" add constraint "meeting_notes_kind_check" CHECK (kind = ANY (ARRAY['agenda'::text, 'minute'::text, 'decision'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_notes' and con.conname='meeting_notes_created_by_fkey'
  ) then
    alter table public."meeting_notes" add constraint "meeting_notes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_notes' and con.conname='meeting_notes_meeting_id_fkey'
  ) then
    alter table public."meeting_notes" add constraint "meeting_notes_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meeting_notes' and con.conname='meeting_notes_pkey'
  ) then
    alter table public."meeting_notes" add constraint "meeting_notes_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_duration_minutes_check'
  ) then
    alter table public."meetings" add constraint "meetings_duration_minutes_check" CHECK (duration_minutes > 0 AND duration_minutes <= 720);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_meeting_type_check'
  ) then
    alter table public."meetings" add constraint "meetings_meeting_type_check" CHECK (meeting_type = ANY (ARRAY['client'::text, 'project'::text, 'design'::text, 'site'::text, 'vendor'::text, 'internal'::text, 'review'::text, 'other'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_status_check'
  ) then
    alter table public."meetings" add constraint "meetings_status_check" CHECK (status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_business_unit_id_fkey'
  ) then
    alter table public."meetings" add constraint "meetings_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_completed_by_fkey'
  ) then
    alter table public."meetings" add constraint "meetings_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_created_by_fkey'
  ) then
    alter table public."meetings" add constraint "meetings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_project_id_fkey'
  ) then
    alter table public."meetings" add constraint "meetings_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_pkey'
  ) then
    alter table public."meetings" add constraint "meetings_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='meetings' and con.conname='meetings_meeting_no_key'
  ) then
    alter table public."meetings" add constraint "meetings_meeting_no_key" UNIQUE (meeting_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='organisation_profiles' and con.conname='organisation_profiles_business_unit_id_fkey'
  ) then
    alter table public."organisation_profiles" add constraint "organisation_profiles_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='organisation_profiles' and con.conname='organisation_profiles_pkey'
  ) then
    alter table public."organisation_profiles" add constraint "organisation_profiles_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='organisation_profiles' and con.conname='organisation_profiles_business_unit_id_key'
  ) then
    alter table public."organisation_profiles" add constraint "organisation_profiles_business_unit_id_key" UNIQUE (business_unit_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_entries' and con.conname='payroll_entries_employee_id_fkey'
  ) then
    alter table public."payroll_entries" add constraint "payroll_entries_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_entries' and con.conname='payroll_entries_payroll_run_id_fkey'
  ) then
    alter table public."payroll_entries" add constraint "payroll_entries_payroll_run_id_fkey" FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_entries' and con.conname='payroll_entries_pkey'
  ) then
    alter table public."payroll_entries" add constraint "payroll_entries_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_entries' and con.conname='payroll_entries_payroll_run_id_employee_id_key'
  ) then
    alter table public."payroll_entries" add constraint "payroll_entries_payroll_run_id_employee_id_key" UNIQUE (payroll_run_id, employee_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_amount_check'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_amount_check" CHECK (amount >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_input_type_check'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_input_type_check" CHECK (input_type = ANY (ARRAY['earning'::text, 'deduction'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_period_month_check'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_period_month_check" CHECK (period_month = date_trunc('month'::text, period_month::timestamp with time zone)::date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_status_check'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_approved_by_fkey'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_created_by_fkey'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_employee_id_fkey'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_inputs' and con.conname='payroll_inputs_pkey'
  ) then
    alter table public."payroll_inputs" add constraint "payroll_inputs_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_period_month_check'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_period_month_check" CHECK (period_month = date_trunc('month'::text, period_month::timestamp with time zone)::date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_status_check'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'paid'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_approved_by_fkey'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_business_unit_id_fkey'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_paid_by_fkey'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_paid_by_fkey" FOREIGN KEY (paid_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_prepared_by_fkey'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_prepared_by_fkey" FOREIGN KEY (prepared_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_pkey'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='payroll_runs' and con.conname='payroll_runs_run_no_key'
  ) then
    alter table public."payroll_runs" add constraint "payroll_runs_run_no_key" UNIQUE (run_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_cycles' and con.conname='performance_cycles_check'
  ) then
    alter table public."performance_cycles" add constraint "performance_cycles_check" CHECK (end_date >= start_date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_cycles' and con.conname='performance_cycles_status_check'
  ) then
    alter table public."performance_cycles" add constraint "performance_cycles_status_check" CHECK (status = ANY (ARRAY['planning'::text, 'active'::text, 'review'::text, 'closed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_cycles' and con.conname='performance_cycles_business_unit_id_fkey'
  ) then
    alter table public."performance_cycles" add constraint "performance_cycles_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_cycles' and con.conname='performance_cycles_created_by_fkey'
  ) then
    alter table public."performance_cycles" add constraint "performance_cycles_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_cycles' and con.conname='performance_cycles_pkey'
  ) then
    alter table public."performance_cycles" add constraint "performance_cycles_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_cycles' and con.conname='performance_cycles_business_unit_id_code_key'
  ) then
    alter table public."performance_cycles" add constraint "performance_cycles_business_unit_id_code_key" UNIQUE (business_unit_id, code);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_progress_pct_check'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_progress_pct_check" CHECK (progress_pct >= 0::numeric AND progress_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_status_check'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_status_check" CHECK (status = ANY (ARRAY['open'::text, 'on_track'::text, 'at_risk'::text, 'completed'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_weight_pct_check'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_weight_pct_check" CHECK (weight_pct >= 0::numeric AND weight_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_created_by_fkey'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_cycle_id_fkey'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_cycle_id_fkey" FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_employee_id_fkey'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_project_id_fkey'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_goals' and con.conname='performance_goals_pkey'
  ) then
    alter table public."performance_goals" add constraint "performance_goals_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_rating_check'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_rating_check" CHECK (rating IS NULL OR rating >= 1::numeric AND rating <= 5::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_review_type_check'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_review_type_check" CHECK (review_type = ANY (ARRAY['manager'::text, 'self'::text, 'founder'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_status_check'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'final'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_created_by_fkey'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_cycle_id_fkey'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_cycle_id_fkey" FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_employee_id_fkey'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_reviewer_employee_id_fkey'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_reviewer_employee_id_fkey" FOREIGN KEY (reviewer_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='performance_reviews' and con.conname='performance_reviews_pkey'
  ) then
    alter table public."performance_reviews" add constraint "performance_reviews_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='po_items' and con.conname='po_items_gst_rate_check'
  ) then
    alter table public."po_items" add constraint "po_items_gst_rate_check" CHECK (gst_rate >= 0::numeric AND gst_rate <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='po_items' and con.conname='po_items_qty_check'
  ) then
    alter table public."po_items" add constraint "po_items_qty_check" CHECK (qty > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='po_items' and con.conname='po_items_rate_check'
  ) then
    alter table public."po_items" add constraint "po_items_rate_check" CHECK (rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='po_items' and con.conname='po_items_received_qty_check'
  ) then
    alter table public."po_items" add constraint "po_items_received_qty_check" CHECK (received_qty >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='po_items' and con.conname='po_items_material_id_fkey'
  ) then
    alter table public."po_items" add constraint "po_items_material_id_fkey" FOREIGN KEY (material_id) REFERENCES materials(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='po_items' and con.conname='po_items_po_id_fkey'
  ) then
    alter table public."po_items" add constraint "po_items_po_id_fkey" FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='po_items' and con.conname='po_items_pkey'
  ) then
    alter table public."po_items" add constraint "po_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_access_level_check'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_access_level_check" CHECK (access_level = ANY (ARRAY['owner'::text, 'member'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_check'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_check" CHECK (portal_type = 'client'::text AND client_id IS NOT NULL AND vendor_id IS NULL OR portal_type = 'vendor'::text AND vendor_id IS NOT NULL AND client_id IS NULL);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_portal_type_check'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_portal_type_check" CHECK (portal_type = ANY (ARRAY['client'::text, 'vendor'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_status_check'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_status_check" CHECK (status = ANY (ARRAY['invited'::text, 'active'::text, 'revoked'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_client_id_fkey'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_invited_by_fkey'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_vendor_id_fkey'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_memberships' and con.conname='portal_memberships_pkey'
  ) then
    alter table public."portal_memberships" add constraint "portal_memberships_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_messages' and con.conname='portal_messages_body_check'
  ) then
    alter table public."portal_messages" add constraint "portal_messages_body_check" CHECK (length(TRIM(BOTH FROM body)) >= 1 AND length(TRIM(BOTH FROM body)) <= 4000);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_messages' and con.conname='portal_messages_check'
  ) then
    alter table public."portal_messages" add constraint "portal_messages_check" CHECK (client_id IS NOT NULL AND vendor_id IS NULL OR vendor_id IS NOT NULL AND client_id IS NULL);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_messages' and con.conname='portal_messages_client_id_fkey'
  ) then
    alter table public."portal_messages" add constraint "portal_messages_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_messages' and con.conname='portal_messages_vendor_id_fkey'
  ) then
    alter table public."portal_messages" add constraint "portal_messages_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='portal_messages' and con.conname='portal_messages_pkey'
  ) then
    alter table public."portal_messages" add constraint "portal_messages_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_status_check'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_status_check" CHECK (status = ANY (ARRAY['not_started'::text, 'active'::text, 'waiting_client'::text, 'waiting_external'::text, 'blocked'::text, 'completed'::text, 'skipped'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_step_order_check'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_step_order_check" CHECK (step_order > 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_completed_by_fkey'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_owner_id_fkey'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_project_id_fkey'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_pkey'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_project_id_step_key_key'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_project_id_step_key_key" UNIQUE (project_id, step_key);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='preconstruction_steps' and con.conname='preconstruction_steps_project_id_step_order_key'
  ) then
    alter table public."preconstruction_steps" add constraint "preconstruction_steps_project_id_step_order_key" UNIQUE (project_id, step_order);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='profiles' and con.conname='profiles_role_check'
  ) then
    alter table public."profiles" add constraint "profiles_role_check" CHECK (role = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text, 'viewer'::text, 'client'::text, 'vendor'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='profiles' and con.conname='profiles_id_fkey'
  ) then
    alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='profiles' and con.conname='profiles_pkey'
  ) then
    alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_invoices' and con.conname='proforma_invoices_business_unit_id_fkey'
  ) then
    alter table public."proforma_invoices" add constraint "proforma_invoices_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_invoices' and con.conname='proforma_invoices_client_id_fkey'
  ) then
    alter table public."proforma_invoices" add constraint "proforma_invoices_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_invoices' and con.conname='proforma_invoices_lead_id_fkey'
  ) then
    alter table public."proforma_invoices" add constraint "proforma_invoices_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_invoices' and con.conname='proforma_invoices_project_id_fkey'
  ) then
    alter table public."proforma_invoices" add constraint "proforma_invoices_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_invoices' and con.conname='proforma_invoices_proposal_id_fkey'
  ) then
    alter table public."proforma_invoices" add constraint "proforma_invoices_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_invoices' and con.conname='proforma_invoices_pkey'
  ) then
    alter table public."proforma_invoices" add constraint "proforma_invoices_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_invoices' and con.conname='proforma_invoices_proforma_no_key'
  ) then
    alter table public."proforma_invoices" add constraint "proforma_invoices_proforma_no_key" UNIQUE (proforma_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_items' and con.conname='proforma_items_qty_check'
  ) then
    alter table public."proforma_items" add constraint "proforma_items_qty_check" CHECK (qty >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_items' and con.conname='proforma_items_rate_check'
  ) then
    alter table public."proforma_items" add constraint "proforma_items_rate_check" CHECK (rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_items' and con.conname='proforma_items_proforma_id_fkey'
  ) then
    alter table public."proforma_items" add constraint "proforma_items_proforma_id_fkey" FOREIGN KEY (proforma_id) REFERENCES proforma_invoices(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proforma_items' and con.conname='proforma_items_pkey'
  ) then
    alter table public."proforma_items" add constraint "proforma_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_allocations' and con.conname='project_allocations_allocation_pct_check'
  ) then
    alter table public."project_allocations" add constraint "project_allocations_allocation_pct_check" CHECK (allocation_pct > 0::numeric AND allocation_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_allocations' and con.conname='project_allocations_check'
  ) then
    alter table public."project_allocations" add constraint "project_allocations_check" CHECK (end_date IS NULL OR end_date >= start_date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_allocations' and con.conname='project_allocations_status_check'
  ) then
    alter table public."project_allocations" add constraint "project_allocations_status_check" CHECK (status = ANY (ARRAY['planned'::text, 'active'::text, 'completed'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_allocations' and con.conname='project_allocations_created_by_fkey'
  ) then
    alter table public."project_allocations" add constraint "project_allocations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_allocations' and con.conname='project_allocations_employee_id_fkey'
  ) then
    alter table public."project_allocations" add constraint "project_allocations_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_allocations' and con.conname='project_allocations_project_id_fkey'
  ) then
    alter table public."project_allocations" add constraint "project_allocations_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_allocations' and con.conname='project_allocations_pkey'
  ) then
    alter table public."project_allocations" add constraint "project_allocations_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_document_type_check'
  ) then
    alter table public."project_documents" add constraint "project_documents_document_type_check" CHECK (document_type = ANY (ARRAY['drawing'::text, 'specification'::text, 'contract'::text, 'approval'::text, 'report'::text, 'boq'::text, 'schedule'::text, 'photo'::text, 'vendor'::text, 'other'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_status_check'
  ) then
    alter table public."project_documents" add constraint "project_documents_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'superseded'::text, 'archived'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_business_unit_id_fkey'
  ) then
    alter table public."project_documents" add constraint "project_documents_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_created_by_fkey'
  ) then
    alter table public."project_documents" add constraint "project_documents_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_current_revision_id_fkey'
  ) then
    alter table public."project_documents" add constraint "project_documents_current_revision_id_fkey" FOREIGN KEY (current_revision_id) REFERENCES document_revisions(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_project_id_fkey'
  ) then
    alter table public."project_documents" add constraint "project_documents_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_pkey'
  ) then
    alter table public."project_documents" add constraint "project_documents_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_documents' and con.conname='project_documents_document_no_key'
  ) then
    alter table public."project_documents" add constraint "project_documents_document_no_key" UNIQUE (document_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_progress_snapshots' and con.conname='project_progress_snapshots_actual_pct_check'
  ) then
    alter table public."project_progress_snapshots" add constraint "project_progress_snapshots_actual_pct_check" CHECK (actual_pct >= 0::numeric AND actual_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_progress_snapshots' and con.conname='project_progress_snapshots_planned_pct_check'
  ) then
    alter table public."project_progress_snapshots" add constraint "project_progress_snapshots_planned_pct_check" CHECK (planned_pct >= 0::numeric AND planned_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_progress_snapshots' and con.conname='project_progress_snapshots_created_by_fkey'
  ) then
    alter table public."project_progress_snapshots" add constraint "project_progress_snapshots_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_progress_snapshots' and con.conname='project_progress_snapshots_project_id_fkey'
  ) then
    alter table public."project_progress_snapshots" add constraint "project_progress_snapshots_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_progress_snapshots' and con.conname='project_progress_snapshots_pkey'
  ) then
    alter table public."project_progress_snapshots" add constraint "project_progress_snapshots_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='project_progress_snapshots' and con.conname='project_progress_snapshots_project_id_snapshot_date_key'
  ) then
    alter table public."project_progress_snapshots" add constraint "project_progress_snapshots_project_id_snapshot_date_key" UNIQUE (project_id, snapshot_date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='projects' and con.conname='projects_business_unit_id_fkey'
  ) then
    alter table public."projects" add constraint "projects_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='projects' and con.conname='projects_client_id_fkey'
  ) then
    alter table public."projects" add constraint "projects_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='projects' and con.conname='projects_lead_id_fkey'
  ) then
    alter table public."projects" add constraint "projects_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='projects' and con.conname='projects_proposal_id_fkey'
  ) then
    alter table public."projects" add constraint "projects_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='projects' and con.conname='projects_pkey'
  ) then
    alter table public."projects" add constraint "projects_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='projects' and con.conname='projects_code_key'
  ) then
    alter table public."projects" add constraint "projects_code_key" UNIQUE (code);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='projects' and con.conname='projects_project_no_key'
  ) then
    alter table public."projects" add constraint "projects_project_no_key" UNIQUE (project_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposal_items' and con.conname='proposal_items_qty_check'
  ) then
    alter table public."proposal_items" add constraint "proposal_items_qty_check" CHECK (qty >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposal_items' and con.conname='proposal_items_rate_check'
  ) then
    alter table public."proposal_items" add constraint "proposal_items_rate_check" CHECK (rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposal_items' and con.conname='proposal_items_proposal_id_fkey'
  ) then
    alter table public."proposal_items" add constraint "proposal_items_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposal_items' and con.conname='proposal_items_pkey'
  ) then
    alter table public."proposal_items" add constraint "proposal_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposals' and con.conname='proposals_business_unit_id_fkey'
  ) then
    alter table public."proposals" add constraint "proposals_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposals' and con.conname='proposals_client_id_fkey'
  ) then
    alter table public."proposals" add constraint "proposals_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposals' and con.conname='proposals_estimate_id_fkey'
  ) then
    alter table public."proposals" add constraint "proposals_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposals' and con.conname='proposals_lead_id_fkey'
  ) then
    alter table public."proposals" add constraint "proposals_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposals' and con.conname='proposals_pkey'
  ) then
    alter table public."proposals" add constraint "proposals_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='proposals' and con.conname='proposals_proposal_no_key'
  ) then
    alter table public."proposals" add constraint "proposals_proposal_no_key" UNIQUE (proposal_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_approved_by_fkey'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_business_unit_id_fkey'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_project_id_fkey'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_quote_id_fkey'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_quote_id_fkey" FOREIGN KEY (quote_id) REFERENCES vendor_quotes(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_requisition_id_fkey'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_requisition_id_fkey" FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_vendor_id_fkey'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_pkey'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='purchase_orders' and con.conname='purchase_orders_po_no_key'
  ) then
    alter table public."purchase_orders" add constraint "purchase_orders_po_no_key" UNIQUE (po_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='quality_checks' and con.conname='quality_checks_result_check'
  ) then
    alter table public."quality_checks" add constraint "quality_checks_result_check" CHECK (result = ANY (ARRAY['pending'::text, 'pass'::text, 'fail'::text, 'na'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='quality_checks' and con.conname='quality_checks_status_check'
  ) then
    alter table public."quality_checks" add constraint "quality_checks_status_check" CHECK (status = ANY (ARRAY['open'::text, 'closed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='quality_checks' and con.conname='quality_checks_checked_by_fkey'
  ) then
    alter table public."quality_checks" add constraint "quality_checks_checked_by_fkey" FOREIGN KEY (checked_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='quality_checks' and con.conname='quality_checks_inspection_id_fkey'
  ) then
    alter table public."quality_checks" add constraint "quality_checks_inspection_id_fkey" FOREIGN KEY (inspection_id) REFERENCES site_inspections(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='quality_checks' and con.conname='quality_checks_project_id_fkey'
  ) then
    alter table public."quality_checks" add constraint "quality_checks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='quality_checks' and con.conname='quality_checks_stage_id_fkey'
  ) then
    alter table public."quality_checks" add constraint "quality_checks_stage_id_fkey" FOREIGN KEY (stage_id) REFERENCES construction_stages(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='quality_checks' and con.conname='quality_checks_pkey'
  ) then
    alter table public."quality_checks" add constraint "quality_checks_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_amount_check'
  ) then
    alter table public."receipts" add constraint "receipts_amount_check" CHECK (amount > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_business_unit_id_fkey'
  ) then
    alter table public."receipts" add constraint "receipts_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_client_id_fkey'
  ) then
    alter table public."receipts" add constraint "receipts_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_invoice_id_fkey'
  ) then
    alter table public."receipts" add constraint "receipts_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_proforma_id_fkey'
  ) then
    alter table public."receipts" add constraint "receipts_proforma_id_fkey" FOREIGN KEY (proforma_id) REFERENCES proforma_invoices(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_project_id_fkey'
  ) then
    alter table public."receipts" add constraint "receipts_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_pkey'
  ) then
    alter table public."receipts" add constraint "receipts_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='receipts' and con.conname='receipts_receipt_no_key'
  ) then
    alter table public."receipts" add constraint "receipts_receipt_no_key" UNIQUE (receipt_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_amount_check'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_amount_check" CHECK (amount > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_status_check'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'hr_verified'::text, 'approved'::text, 'paid'::text, 'rejected'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_approved_by_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_business_unit_id_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_created_by_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_employee_id_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_expense_id_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_expense_id_fkey" FOREIGN KEY (expense_id) REFERENCES expenses(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_paid_by_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_paid_by_fkey" FOREIGN KEY (paid_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_project_id_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_verified_by_fkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_pkey'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='reimbursements' and con.conname='reimbursements_reimbursement_no_key'
  ) then
    alter table public."reimbursements" add constraint "reimbursements_reimbursement_no_key" UNIQUE (reimbursement_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_outcome_check'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_outcome_check" CHECK (outcome = ANY (ARRAY['pending'::text, 'pass'::text, 'fail'::text, 'conditional'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_status_check'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_status_check" CHECK (status = ANY (ARRAY['planned'::text, 'completed'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_created_by_fkey'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_inspector_id_fkey'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_inspector_id_fkey" FOREIGN KEY (inspector_id) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_project_id_fkey'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_report_id_fkey'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_report_id_fkey" FOREIGN KEY (report_id) REFERENCES site_reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_stage_id_fkey'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_stage_id_fkey" FOREIGN KEY (stage_id) REFERENCES construction_stages(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_inspections' and con.conname='site_inspections_pkey'
  ) then
    alter table public."site_inspections" add constraint "site_inspections_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_category_check'
  ) then
    alter table public."site_issues" add constraint "site_issues_category_check" CHECK (category = ANY (ARRAY['site'::text, 'material'::text, 'quality'::text, 'safety'::text, 'delay'::text, 'design'::text, 'client'::text, 'vendor'::text, 'other'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_severity_check'
  ) then
    alter table public."site_issues" add constraint "site_issues_severity_check" CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_status_check'
  ) then
    alter table public."site_issues" add constraint "site_issues_status_check" CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_created_by_fkey'
  ) then
    alter table public."site_issues" add constraint "site_issues_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_owner_id_fkey'
  ) then
    alter table public."site_issues" add constraint "site_issues_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_project_id_fkey'
  ) then
    alter table public."site_issues" add constraint "site_issues_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_report_id_fkey'
  ) then
    alter table public."site_issues" add constraint "site_issues_report_id_fkey" FOREIGN KEY (report_id) REFERENCES site_reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_stage_id_fkey'
  ) then
    alter table public."site_issues" add constraint "site_issues_stage_id_fkey" FOREIGN KEY (stage_id) REFERENCES construction_stages(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_issues' and con.conname='site_issues_pkey'
  ) then
    alter table public."site_issues" add constraint "site_issues_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_activities' and con.conname='site_report_activities_reported_progress_pct_check'
  ) then
    alter table public."site_report_activities" add constraint "site_report_activities_reported_progress_pct_check" CHECK (reported_progress_pct IS NULL OR reported_progress_pct >= 0::numeric AND reported_progress_pct <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_activities' and con.conname='site_report_activities_report_id_fkey'
  ) then
    alter table public."site_report_activities" add constraint "site_report_activities_report_id_fkey" FOREIGN KEY (report_id) REFERENCES site_reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_activities' and con.conname='site_report_activities_stage_id_fkey'
  ) then
    alter table public."site_report_activities" add constraint "site_report_activities_stage_id_fkey" FOREIGN KEY (stage_id) REFERENCES construction_stages(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_activities' and con.conname='site_report_activities_pkey'
  ) then
    alter table public."site_report_activities" add constraint "site_report_activities_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_equipment' and con.conname='site_report_equipment_hours_check'
  ) then
    alter table public."site_report_equipment" add constraint "site_report_equipment_hours_check" CHECK (hours >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_equipment' and con.conname='site_report_equipment_report_id_fkey'
  ) then
    alter table public."site_report_equipment" add constraint "site_report_equipment_report_id_fkey" FOREIGN KEY (report_id) REFERENCES site_reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_equipment' and con.conname='site_report_equipment_pkey'
  ) then
    alter table public."site_report_equipment" add constraint "site_report_equipment_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_labour' and con.conname='site_report_labour_planned_check'
  ) then
    alter table public."site_report_labour" add constraint "site_report_labour_planned_check" CHECK (planned >= 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_labour' and con.conname='site_report_labour_present_check'
  ) then
    alter table public."site_report_labour" add constraint "site_report_labour_present_check" CHECK (present >= 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_labour' and con.conname='site_report_labour_report_id_fkey'
  ) then
    alter table public."site_report_labour" add constraint "site_report_labour_report_id_fkey" FOREIGN KEY (report_id) REFERENCES site_reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_labour' and con.conname='site_report_labour_pkey'
  ) then
    alter table public."site_report_labour" add constraint "site_report_labour_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_materials' and con.conname='site_report_materials_qty_check'
  ) then
    alter table public."site_report_materials" add constraint "site_report_materials_qty_check" CHECK (qty >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_materials' and con.conname='site_report_materials_report_id_fkey'
  ) then
    alter table public."site_report_materials" add constraint "site_report_materials_report_id_fkey" FOREIGN KEY (report_id) REFERENCES site_reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_report_materials' and con.conname='site_report_materials_pkey'
  ) then
    alter table public."site_report_materials" add constraint "site_report_materials_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_reports' and con.conname='site_reports_approved_by_fkey'
  ) then
    alter table public."site_reports" add constraint "site_reports_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_reports' and con.conname='site_reports_project_id_fkey'
  ) then
    alter table public."site_reports" add constraint "site_reports_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_reports' and con.conname='site_reports_submitted_by_fkey'
  ) then
    alter table public."site_reports" add constraint "site_reports_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_reports' and con.conname='site_reports_pkey'
  ) then
    alter table public."site_reports" add constraint "site_reports_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='site_reports' and con.conname='site_reports_project_id_report_date_key'
  ) then
    alter table public."site_reports" add constraint "site_reports_project_id_report_date_key" UNIQUE (project_id, report_date);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_movement_type_check'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_movement_type_check" CHECK (movement_type = ANY (ARRAY['grn_in'::text, 'issue_out'::text, 'return_in'::text, 'transfer_out'::text, 'transfer_in'::text, 'adjust_in'::text, 'adjust_out'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_qty_check'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_qty_check" CHECK (qty > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_rate_check'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_rate_check" CHECK (rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_business_unit_id_fkey'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_material_id_fkey'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_material_id_fkey" FOREIGN KEY (material_id) REFERENCES materials(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_project_id_fkey'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_recorded_by_fkey'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_store_id_fkey'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stock_ledger' and con.conname='stock_ledger_pkey'
  ) then
    alter table public."stock_ledger" add constraint "stock_ledger_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stores' and con.conname='stores_status_check'
  ) then
    alter table public."stores" add constraint "stores_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stores' and con.conname='stores_business_unit_id_fkey'
  ) then
    alter table public."stores" add constraint "stores_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stores' and con.conname='stores_project_id_fkey'
  ) then
    alter table public."stores" add constraint "stores_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stores' and con.conname='stores_pkey'
  ) then
    alter table public."stores" add constraint "stores_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='stores' and con.conname='stores_project_id_name_key'
  ) then
    alter table public."stores" add constraint "stores_project_id_name_key" UNIQUE (project_id, name);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='tasks' and con.conname='tasks_assigned_to_fkey'
  ) then
    alter table public."tasks" add constraint "tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='tasks' and con.conname='tasks_project_id_fkey'
  ) then
    alter table public."tasks" add constraint "tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='tasks' and con.conname='tasks_pkey'
  ) then
    alter table public."tasks" add constraint "tasks_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_amount_paid_check'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_amount_paid_check" CHECK (amount_paid >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_status_check'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'verified'::text, 'approved'::text, 'part_paid'::text, 'paid'::text, 'disputed'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_total_check'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_total_check" CHECK (total >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_approved_by_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_business_unit_id_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_created_by_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_expense_id_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_expense_id_fkey" FOREIGN KEY (expense_id) REFERENCES expenses(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_grn_id_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_grn_id_fkey" FOREIGN KEY (grn_id) REFERENCES goods_receipts(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_po_id_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_po_id_fkey" FOREIGN KEY (po_id) REFERENCES purchase_orders(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_project_id_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_vendor_id_fkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_pkey'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_internal_no_key'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_internal_no_key" UNIQUE (internal_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_bills' and con.conname='vendor_bills_vendor_id_bill_no_key'
  ) then
    alter table public."vendor_bills" add constraint "vendor_bills_vendor_id_bill_no_key" UNIQUE (vendor_id, bill_no);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_payments' and con.conname='vendor_payments_amount_check'
  ) then
    alter table public."vendor_payments" add constraint "vendor_payments_amount_check" CHECK (amount > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_payments' and con.conname='vendor_payments_project_id_fkey'
  ) then
    alter table public."vendor_payments" add constraint "vendor_payments_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_payments' and con.conname='vendor_payments_recorded_by_fkey'
  ) then
    alter table public."vendor_payments" add constraint "vendor_payments_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_payments' and con.conname='vendor_payments_vendor_bill_id_fkey'
  ) then
    alter table public."vendor_payments" add constraint "vendor_payments_vendor_bill_id_fkey" FOREIGN KEY (vendor_bill_id) REFERENCES vendor_bills(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_payments' and con.conname='vendor_payments_vendor_id_fkey'
  ) then
    alter table public."vendor_payments" add constraint "vendor_payments_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_payments' and con.conname='vendor_payments_pkey'
  ) then
    alter table public."vendor_payments" add constraint "vendor_payments_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quote_items' and con.conname='vendor_quote_items_gst_rate_check'
  ) then
    alter table public."vendor_quote_items" add constraint "vendor_quote_items_gst_rate_check" CHECK (gst_rate >= 0::numeric AND gst_rate <= 100::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quote_items' and con.conname='vendor_quote_items_qty_check'
  ) then
    alter table public."vendor_quote_items" add constraint "vendor_quote_items_qty_check" CHECK (qty > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quote_items' and con.conname='vendor_quote_items_rate_check'
  ) then
    alter table public."vendor_quote_items" add constraint "vendor_quote_items_rate_check" CHECK (rate >= 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quote_items' and con.conname='vendor_quote_items_material_id_fkey'
  ) then
    alter table public."vendor_quote_items" add constraint "vendor_quote_items_material_id_fkey" FOREIGN KEY (material_id) REFERENCES materials(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quote_items' and con.conname='vendor_quote_items_quote_id_fkey'
  ) then
    alter table public."vendor_quote_items" add constraint "vendor_quote_items_quote_id_fkey" FOREIGN KEY (quote_id) REFERENCES vendor_quotes(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quote_items' and con.conname='vendor_quote_items_requisition_item_id_fkey'
  ) then
    alter table public."vendor_quote_items" add constraint "vendor_quote_items_requisition_item_id_fkey" FOREIGN KEY (requisition_item_id) REFERENCES material_requisition_items(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quote_items' and con.conname='vendor_quote_items_pkey'
  ) then
    alter table public."vendor_quote_items" add constraint "vendor_quote_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quotes' and con.conname='vendor_quotes_delivery_days_check'
  ) then
    alter table public."vendor_quotes" add constraint "vendor_quotes_delivery_days_check" CHECK (delivery_days IS NULL OR delivery_days >= 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quotes' and con.conname='vendor_quotes_status_check'
  ) then
    alter table public."vendor_quotes" add constraint "vendor_quotes_status_check" CHECK (status = ANY (ARRAY['received'::text, 'shortlisted'::text, 'selected'::text, 'rejected'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quotes' and con.conname='vendor_quotes_created_by_fkey'
  ) then
    alter table public."vendor_quotes" add constraint "vendor_quotes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quotes' and con.conname='vendor_quotes_requisition_id_fkey'
  ) then
    alter table public."vendor_quotes" add constraint "vendor_quotes_requisition_id_fkey" FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quotes' and con.conname='vendor_quotes_vendor_id_fkey'
  ) then
    alter table public."vendor_quotes" add constraint "vendor_quotes_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quotes' and con.conname='vendor_quotes_pkey'
  ) then
    alter table public."vendor_quotes" add constraint "vendor_quotes_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_quotes' and con.conname='vendor_quotes_requisition_id_vendor_id_quote_ref_key'
  ) then
    alter table public."vendor_quotes" add constraint "vendor_quotes_requisition_id_vendor_id_quote_ref_key" UNIQUE (requisition_id, vendor_id, quote_ref);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_status_check'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_status_check" CHECK (status = ANY (ARRAY['invited'::text, 'viewed'::text, 'responded'::text, 'closed'::text, 'cancelled'::text]));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_invited_by_fkey'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_project_id_fkey'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_quote_id_fkey'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_quote_id_fkey" FOREIGN KEY (quote_id) REFERENCES vendor_quotes(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_requisition_id_fkey'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_requisition_id_fkey" FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_vendor_id_fkey'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_pkey'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_invites' and con.conname='vendor_rfq_invites_requisition_id_vendor_id_key'
  ) then
    alter table public."vendor_rfq_invites" add constraint "vendor_rfq_invites_requisition_id_vendor_id_key" UNIQUE (requisition_id, vendor_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_items' and con.conname='vendor_rfq_items_qty_check'
  ) then
    alter table public."vendor_rfq_items" add constraint "vendor_rfq_items_qty_check" CHECK (qty > 0::numeric);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_items' and con.conname='vendor_rfq_items_invite_id_fkey'
  ) then
    alter table public."vendor_rfq_items" add constraint "vendor_rfq_items_invite_id_fkey" FOREIGN KEY (invite_id) REFERENCES vendor_rfq_invites(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_items' and con.conname='vendor_rfq_items_material_id_fkey'
  ) then
    alter table public."vendor_rfq_items" add constraint "vendor_rfq_items_material_id_fkey" FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_items' and con.conname='vendor_rfq_items_requisition_item_id_fkey'
  ) then
    alter table public."vendor_rfq_items" add constraint "vendor_rfq_items_requisition_item_id_fkey" FOREIGN KEY (requisition_item_id) REFERENCES material_requisition_items(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_items' and con.conname='vendor_rfq_items_pkey'
  ) then
    alter table public."vendor_rfq_items" add constraint "vendor_rfq_items_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendor_rfq_items' and con.conname='vendor_rfq_items_invite_id_requisition_item_id_key'
  ) then
    alter table public."vendor_rfq_items" add constraint "vendor_rfq_items_invite_id_requisition_item_id_key" UNIQUE (invite_id, requisition_item_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendors' and con.conname='vendors_business_unit_id_fkey'
  ) then
    alter table public."vendors" add constraint "vendors_business_unit_id_fkey" FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendors' and con.conname='vendors_pkey'
  ) then
    alter table public."vendors" add constraint "vendors_pkey" PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    where ns.nspname='public' and rel.relname='vendors' and con.conname='vendors_code_key'
  ) then
    alter table public."vendors" add constraint "vendors_code_key" UNIQUE (code);
  end if;
end $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS accounting_period_locks_business_unit_id_period_key_key ON public.accounting_period_locks USING btree (business_unit_id, period_key);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_period_locks_pkey ON public.accounting_period_locks USING btree (id);
CREATE INDEX IF NOT EXISTS application_backup_log_created_by_idx ON public.application_backup_log USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS application_backup_log_created_idx ON public.application_backup_log USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS application_backup_log_pkey ON public.application_backup_log USING btree (id);
CREATE INDEX IF NOT EXISTS approvals_entity_idx ON public.approvals USING btree (entity_type, entity_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS approvals_pkey ON public.approvals USING btree (id);
CREATE INDEX IF NOT EXISTS approvals_project_id_idx ON public.approvals USING btree (project_id) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON public.approvals USING btree (status);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON public.attendance USING btree (on_date, status);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_employee_id_on_date_key ON public.attendance USING btree (employee_id, on_date);
CREATE INDEX IF NOT EXISTS attendance_marked_by_idx ON public.attendance USING btree (marked_by) WHERE (marked_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_pkey ON public.attendance USING btree (id);
CREATE INDEX IF NOT EXISTS attendance_project_idx ON public.attendance USING btree (project_id, on_date) WHERE (project_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_pkey ON public.automation_runs USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS business_units_code_key ON public.business_units USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS business_units_pkey ON public.business_units USING btree (id);
CREATE INDEX IF NOT EXISTS clients_lead_id_idx ON public.clients USING btree (lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS clients_pkey ON public.clients USING btree (id);
CREATE INDEX IF NOT EXISTS construction_stages_completed_by_idx ON public.construction_stages USING btree (completed_by) WHERE (completed_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS construction_stages_pkey ON public.construction_stages USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS construction_stages_project_id_sort_order_key ON public.construction_stages USING btree (project_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS construction_stages_project_id_stage_key_key ON public.construction_stages USING btree (project_id, stage_key);
CREATE INDEX IF NOT EXISTS construction_stages_project_idx ON public.construction_stages USING btree (project_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_credit_no_key ON public.credit_notes USING btree (credit_no);
CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx ON public.credit_notes USING btree (invoice_id, issue_date);
CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_pkey ON public.credit_notes USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS design_deliverables_pkey ON public.design_deliverables USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS design_deliverables_project_stage_title_uq ON public.design_deliverables USING btree (project_id, COALESCE(stage, ''::text), title);
CREATE INDEX IF NOT EXISTS design_project_id_idx ON public.design_deliverables USING btree (project_id);
CREATE INDEX IF NOT EXISTS document_approvals_document_idx ON public.document_approvals USING btree (document_id);
CREATE INDEX IF NOT EXISTS document_approvals_pending_idx ON public.document_approvals USING btree (status, reviewer_id, requested_at);
CREATE UNIQUE INDEX IF NOT EXISTS document_approvals_pkey ON public.document_approvals USING btree (id);
CREATE INDEX IF NOT EXISTS document_approvals_requested_by_idx ON public.document_approvals USING btree (requested_by);
CREATE INDEX IF NOT EXISTS document_approvals_reviewer_idx ON public.document_approvals USING btree (reviewer_id) WHERE (reviewer_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS document_approvals_revision_id_reviewer_id_key ON public.document_approvals USING btree (revision_id, reviewer_id);
CREATE INDEX IF NOT EXISTS document_register_client_idx ON public.document_register USING btree (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS document_register_document_no_key ON public.document_register USING btree (document_no);
CREATE INDEX IF NOT EXISTS document_register_lead_idx ON public.document_register USING btree (lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS document_register_pkey ON public.document_register USING btree (id);
CREATE INDEX IF NOT EXISTS document_register_project_idx ON public.document_register USING btree (project_id);
CREATE INDEX IF NOT EXISTS document_register_type_date_idx ON public.document_register USING btree (doc_type, issue_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS document_revisions_document_id_revision_code_key ON public.document_revisions USING btree (document_id, revision_code);
CREATE UNIQUE INDEX IF NOT EXISTS document_revisions_document_id_revision_no_key ON public.document_revisions USING btree (document_id, revision_no);
CREATE INDEX IF NOT EXISTS document_revisions_document_idx ON public.document_revisions USING btree (document_id, revision_no DESC);
CREATE INDEX IF NOT EXISTS document_revisions_issued_by_idx ON public.document_revisions USING btree (issued_by) WHERE (issued_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS document_revisions_pkey ON public.document_revisions USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS document_revisions_storage_path_key ON public.document_revisions USING btree (storage_path);
CREATE INDEX IF NOT EXISTS document_revisions_uploaded_by_idx ON public.document_revisions USING btree (uploaded_by);
CREATE UNIQUE INDEX IF NOT EXISTS document_sequences_pkey ON public.document_sequences USING btree (doc_type, period_key);
CREATE UNIQUE INDEX IF NOT EXISTS drawings_pkey ON public.drawings USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS drawings_project_id_drawing_no_revision_key ON public.drawings USING btree (project_id, drawing_no, revision);
CREATE INDEX IF NOT EXISTS drawings_project_id_idx ON public.drawings USING btree (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS employee_compensation_employee_id_effective_from_key ON public.employee_compensation USING btree (employee_id, effective_from);
CREATE INDEX IF NOT EXISTS employee_compensation_employee_idx ON public.employee_compensation USING btree (employee_id, effective_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS employee_compensation_pkey ON public.employee_compensation USING btree (id);
CREATE INDEX IF NOT EXISTS employee_compensation_updated_by_idx ON public.employee_compensation USING btree (updated_by) WHERE (updated_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS employees_bu_idx ON public.employees USING btree (business_unit_id, status);
CREATE INDEX IF NOT EXISTS employees_created_by_idx ON public.employees USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS employees_department_idx ON public.employees USING btree (department, status);
CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_no_key ON public.employees USING btree (employee_no);
CREATE INDEX IF NOT EXISTS employees_manager_idx ON public.employees USING btree (manager_employee_id) WHERE (manager_employee_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS employees_pkey ON public.employees USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS employees_profile_id_key ON public.employees USING btree (profile_id);
CREATE INDEX IF NOT EXISTS employees_profile_idx ON public.employees USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS erp_notification_reads_pkey ON public.erp_notification_reads USING btree (notification_id, user_id);
CREATE INDEX IF NOT EXISTS erp_notification_reads_user_idx ON public.erp_notification_reads USING btree (user_id, status, read_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS erp_notifications_dedupe_idx ON public.erp_notifications USING btree (fingerprint, occurred_on, COALESCE(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX IF NOT EXISTS erp_notifications_pkey ON public.erp_notifications USING btree (id);
CREATE INDEX IF NOT EXISTS erp_notifications_role_idx ON public.erp_notifications USING btree (target_role, status, created_at DESC);
CREATE INDEX IF NOT EXISTS erp_notifications_unit_idx ON public.erp_notifications USING btree (business_unit_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS erp_notifications_user_idx ON public.erp_notifications USING btree (target_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS estimate_items_estimate_idx ON public.estimate_items USING btree (estimate_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS estimate_items_pkey ON public.estimate_items USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS estimates_estimate_no_key ON public.estimates USING btree (estimate_no);
CREATE UNIQUE INDEX IF NOT EXISTS estimates_estimate_no_uq ON public.estimates USING btree (estimate_no) WHERE (estimate_no IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS estimates_pkey ON public.estimates USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS expenses_pkey ON public.expenses USING btree (id);
CREATE INDEX IF NOT EXISTS expenses_project_idx ON public.expenses USING btree (project_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS goods_receipt_items_material_idx ON public.goods_receipt_items USING btree (material_id) WHERE (material_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS goods_receipt_items_parent_idx ON public.goods_receipt_items USING btree (grn_id);
CREATE UNIQUE INDEX IF NOT EXISTS goods_receipt_items_pkey ON public.goods_receipt_items USING btree (id);
CREATE INDEX IF NOT EXISTS goods_receipt_items_po_item_idx ON public.goods_receipt_items USING btree (po_item_id);
CREATE INDEX IF NOT EXISTS goods_receipts_business_unit_idx ON public.goods_receipts USING btree (business_unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS goods_receipts_grn_no_key ON public.goods_receipts USING btree (grn_no);
CREATE UNIQUE INDEX IF NOT EXISTS goods_receipts_pkey ON public.goods_receipts USING btree (id);
CREATE INDEX IF NOT EXISTS goods_receipts_po_idx ON public.goods_receipts USING btree (po_id, receipt_date);
CREATE INDEX IF NOT EXISTS goods_receipts_project_idx ON public.goods_receipts USING btree (project_id, receipt_date);
CREATE INDEX IF NOT EXISTS goods_receipts_received_by_idx ON public.goods_receipts USING btree (received_by) WHERE (received_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS goods_receipts_store_idx ON public.goods_receipts USING btree (store_id);
CREATE INDEX IF NOT EXISTS goods_receipts_vendor_idx ON public.goods_receipts USING btree (vendor_id) WHERE (vendor_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS invoice_items_parent_idx ON public.invoice_items USING btree (invoice_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_items_pkey ON public.invoice_items USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_no_uq ON public.invoices USING btree (invoice_no) WHERE (invoice_no IS NOT NULL);
CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON public.invoices USING btree (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_no_key ON public.invoices USING btree (invoice_no);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_pkey ON public.invoices USING btree (id);
CREATE INDEX IF NOT EXISTS invoices_project_id_idx ON public.invoices USING btree (project_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices USING btree (status);
CREATE INDEX IF NOT EXISTS kudos_created_idx ON public.kudos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS kudos_from_idx ON public.kudos USING btree (from_employee_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS kudos_pkey ON public.kudos USING btree (id);
CREATE INDEX IF NOT EXISTS kudos_to_idx ON public.kudos USING btree (to_employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_created_idx ON public.leads USING btree (created_at DESC) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS leads_lead_no_key ON public.leads USING btree (lead_no);
CREATE UNIQUE INDEX IF NOT EXISTS leads_pkey ON public.leads USING btree (id);
CREATE INDEX IF NOT EXISTS leads_stage_idx ON public.leads USING btree (stage) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS leave_requests_created_by_idx ON public.leave_requests USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS leave_requests_employee_idx ON public.leave_requests USING btree (employee_id, from_date, to_date);
CREATE INDEX IF NOT EXISTS leave_requests_leave_type_idx ON public.leave_requests USING btree (leave_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS leave_requests_pkey ON public.leave_requests USING btree (id);
CREATE INDEX IF NOT EXISTS leave_requests_reviewed_by_idx ON public.leave_requests USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON public.leave_requests USING btree (status, from_date);
CREATE UNIQUE INDEX IF NOT EXISTS leave_types_business_unit_id_code_key ON public.leave_types USING btree (business_unit_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS leave_types_pkey ON public.leave_types USING btree (id);
CREATE INDEX IF NOT EXISTS material_requisition_items_material_idx ON public.material_requisition_items USING btree (material_id) WHERE (material_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS material_requisition_items_parent_idx ON public.material_requisition_items USING btree (requisition_id);
CREATE UNIQUE INDEX IF NOT EXISTS material_requisition_items_pkey ON public.material_requisition_items USING btree (id);
CREATE INDEX IF NOT EXISTS material_requisitions_approved_by_idx ON public.material_requisitions USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS material_requisitions_business_unit_idx ON public.material_requisitions USING btree (business_unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS material_requisitions_pkey ON public.material_requisitions USING btree (id);
CREATE INDEX IF NOT EXISTS material_requisitions_project_idx ON public.material_requisitions USING btree (project_id, status);
CREATE INDEX IF NOT EXISTS material_requisitions_requester_idx ON public.material_requisitions USING btree (requested_by, status);
CREATE UNIQUE INDEX IF NOT EXISTS material_requisitions_requisition_no_key ON public.material_requisitions USING btree (requisition_no);
CREATE UNIQUE INDEX IF NOT EXISTS materials_bu_code_uq ON public.materials USING btree (business_unit_id, code) WHERE (code IS NOT NULL);
CREATE INDEX IF NOT EXISTS materials_business_unit_idx ON public.materials USING btree (business_unit_id);
CREATE INDEX IF NOT EXISTS materials_category_idx ON public.materials USING btree (category);
CREATE INDEX IF NOT EXISTS materials_created_by_idx ON public.materials USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS materials_name_idx ON public.materials USING btree (name);
CREATE UNIQUE INDEX IF NOT EXISTS materials_pkey ON public.materials USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS meeting_action_items_pkey ON public.meeting_action_items USING btree (id);
CREATE INDEX IF NOT EXISTS meeting_actions_completed_by_idx ON public.meeting_action_items USING btree (completed_by) WHERE (completed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS meeting_actions_created_by_idx ON public.meeting_action_items USING btree (created_by);
CREATE INDEX IF NOT EXISTS meeting_actions_meeting_idx ON public.meeting_action_items USING btree (meeting_id, status);
CREATE INDEX IF NOT EXISTS meeting_actions_owner_idx ON public.meeting_action_items USING btree (owner_profile_id, status, due_date);
CREATE INDEX IF NOT EXISTS meeting_actions_project_idx ON public.meeting_action_items USING btree (project_id, status) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS meeting_actions_task_idx ON public.meeting_action_items USING btree (task_id) WHERE (task_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS meeting_attendees_pkey ON public.meeting_attendees USING btree (id);
CREATE INDEX IF NOT EXISTS meeting_attendees_profile_idx ON public.meeting_attendees USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS meeting_attendees_profile_uq ON public.meeting_attendees USING btree (meeting_id, profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS meeting_notes_created_by_idx ON public.meeting_notes USING btree (created_by);
CREATE INDEX IF NOT EXISTS meeting_notes_parent_idx ON public.meeting_notes USING btree (meeting_id, kind, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS meeting_notes_pkey ON public.meeting_notes USING btree (id);
CREATE INDEX IF NOT EXISTS meetings_business_unit_idx ON public.meetings USING btree (business_unit_id);
CREATE INDEX IF NOT EXISTS meetings_completed_by_idx ON public.meetings USING btree (completed_by) WHERE (completed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS meetings_created_by_idx ON public.meetings USING btree (created_by);
CREATE UNIQUE INDEX IF NOT EXISTS meetings_meeting_no_key ON public.meetings USING btree (meeting_no);
CREATE UNIQUE INDEX IF NOT EXISTS meetings_pkey ON public.meetings USING btree (id);
CREATE INDEX IF NOT EXISTS meetings_project_idx ON public.meetings USING btree (project_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS meetings_schedule_idx ON public.meetings USING btree (status, scheduled_at);
CREATE UNIQUE INDEX IF NOT EXISTS organisation_profiles_business_unit_id_key ON public.organisation_profiles USING btree (business_unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS organisation_profiles_pkey ON public.organisation_profiles USING btree (id);
CREATE INDEX IF NOT EXISTS payroll_entries_employee_idx ON public.payroll_entries USING btree (employee_id, payroll_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_entries_payroll_run_id_employee_id_key ON public.payroll_entries USING btree (payroll_run_id, employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_entries_pkey ON public.payroll_entries USING btree (id);
CREATE INDEX IF NOT EXISTS payroll_inputs_approved_by_idx ON public.payroll_inputs USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS payroll_inputs_created_by_idx ON public.payroll_inputs USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS payroll_inputs_employee_period_idx ON public.payroll_inputs USING btree (employee_id, period_month, status);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_inputs_pkey ON public.payroll_inputs USING btree (id);
CREATE INDEX IF NOT EXISTS payroll_runs_approved_by_idx ON public.payroll_runs USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS payroll_runs_bu_idx ON public.payroll_runs USING btree (business_unit_id, period_month);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_bu_period_active_uq ON public.payroll_runs USING btree (business_unit_id, period_month) WHERE (status <> 'cancelled'::text);
CREATE INDEX IF NOT EXISTS payroll_runs_paid_by_idx ON public.payroll_runs USING btree (paid_by) WHERE (paid_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_pkey ON public.payroll_runs USING btree (id);
CREATE INDEX IF NOT EXISTS payroll_runs_prepared_by_idx ON public.payroll_runs USING btree (prepared_by) WHERE (prepared_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_run_no_key ON public.payroll_runs USING btree (run_no);
CREATE UNIQUE INDEX IF NOT EXISTS performance_cycles_business_unit_id_code_key ON public.performance_cycles USING btree (business_unit_id, code);
CREATE INDEX IF NOT EXISTS performance_cycles_created_by_idx ON public.performance_cycles USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS performance_cycles_pkey ON public.performance_cycles USING btree (id);
CREATE INDEX IF NOT EXISTS performance_goals_created_by_idx ON public.performance_goals USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS performance_goals_cycle_idx ON public.performance_goals USING btree (cycle_id);
CREATE INDEX IF NOT EXISTS performance_goals_employee_idx ON public.performance_goals USING btree (employee_id, cycle_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS performance_goals_pkey ON public.performance_goals USING btree (id);
CREATE INDEX IF NOT EXISTS performance_goals_project_idx ON public.performance_goals USING btree (project_id, status) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS performance_reviews_created_by_idx ON public.performance_reviews USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS performance_reviews_cycle_idx ON public.performance_reviews USING btree (cycle_id);
CREATE INDEX IF NOT EXISTS performance_reviews_employee_idx ON public.performance_reviews USING btree (employee_id, cycle_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS performance_reviews_pkey ON public.performance_reviews USING btree (id);
CREATE INDEX IF NOT EXISTS performance_reviews_reviewer_idx ON public.performance_reviews USING btree (reviewer_employee_id) WHERE (reviewer_employee_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS performance_reviews_unique_idx ON public.performance_reviews USING btree (cycle_id, employee_id, COALESCE(reviewer_employee_id, '00000000-0000-0000-0000-000000000000'::uuid), review_type);
CREATE INDEX IF NOT EXISTS po_items_material_idx ON public.po_items USING btree (material_id) WHERE (material_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS po_items_parent_idx ON public.po_items USING btree (po_id);
CREATE UNIQUE INDEX IF NOT EXISTS po_items_pkey ON public.po_items USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS portal_client_email_uq ON public.portal_memberships USING btree (client_id, lower(email)) WHERE ((portal_type = 'client'::text) AND (status <> 'revoked'::text));
CREATE INDEX IF NOT EXISTS portal_memberships_client_idx ON public.portal_memberships USING btree (client_id, status) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS portal_memberships_email_idx ON public.portal_memberships USING btree (lower(email), status);
CREATE INDEX IF NOT EXISTS portal_memberships_invited_by_idx ON public.portal_memberships USING btree (invited_by) WHERE (invited_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS portal_memberships_pkey ON public.portal_memberships USING btree (id);
CREATE INDEX IF NOT EXISTS portal_memberships_user_idx ON public.portal_memberships USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS portal_memberships_vendor_idx ON public.portal_memberships USING btree (vendor_id, status) WHERE (vendor_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS portal_vendor_email_uq ON public.portal_memberships USING btree (vendor_id, lower(email)) WHERE ((portal_type = 'vendor'::text) AND (status <> 'revoked'::text));
CREATE INDEX IF NOT EXISTS portal_messages_client_idx ON public.portal_messages USING btree (client_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS portal_messages_pkey ON public.portal_messages USING btree (id);
CREATE INDEX IF NOT EXISTS portal_messages_vendor_idx ON public.portal_messages USING btree (vendor_id, created_at);
CREATE INDEX IF NOT EXISTS preconstruction_steps_completed_by_idx ON public.preconstruction_steps USING btree (completed_by) WHERE (completed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS preconstruction_steps_owner_idx ON public.preconstruction_steps USING btree (owner_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS preconstruction_steps_pkey ON public.preconstruction_steps USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS preconstruction_steps_project_id_step_key_key ON public.preconstruction_steps USING btree (project_id, step_key);
CREATE UNIQUE INDEX IF NOT EXISTS preconstruction_steps_project_id_step_order_key ON public.preconstruction_steps USING btree (project_id, step_order);
CREATE INDEX IF NOT EXISTS preconstruction_steps_project_idx ON public.preconstruction_steps USING btree (project_id, step_order);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS proforma_invoices_pkey ON public.proforma_invoices USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS proforma_invoices_proforma_no_key ON public.proforma_invoices USING btree (proforma_no);
CREATE UNIQUE INDEX IF NOT EXISTS proforma_no_uq ON public.proforma_invoices USING btree (proforma_no) WHERE (proforma_no IS NOT NULL);
CREATE INDEX IF NOT EXISTS proforma_project_id_idx ON public.proforma_invoices USING btree (project_id);
CREATE INDEX IF NOT EXISTS proforma_items_parent_idx ON public.proforma_items USING btree (proforma_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS proforma_items_pkey ON public.proforma_items USING btree (id);
CREATE INDEX IF NOT EXISTS project_allocations_created_by_idx ON public.project_allocations USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS project_allocations_employee_idx ON public.project_allocations USING btree (employee_id, start_date, end_date, status);
CREATE UNIQUE INDEX IF NOT EXISTS project_allocations_pkey ON public.project_allocations USING btree (id);
CREATE INDEX IF NOT EXISTS project_allocations_project_idx ON public.project_allocations USING btree (project_id, status, start_date);
CREATE INDEX IF NOT EXISTS project_documents_business_unit_idx ON public.project_documents USING btree (business_unit_id);
CREATE INDEX IF NOT EXISTS project_documents_created_by_idx ON public.project_documents USING btree (created_by);
CREATE INDEX IF NOT EXISTS project_documents_current_revision_idx ON public.project_documents USING btree (current_revision_id) WHERE (current_revision_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS project_documents_document_no_key ON public.project_documents USING btree (document_no);
CREATE UNIQUE INDEX IF NOT EXISTS project_documents_pkey ON public.project_documents USING btree (id);
CREATE INDEX IF NOT EXISTS project_documents_project_idx ON public.project_documents USING btree (project_id, status);
CREATE INDEX IF NOT EXISTS project_documents_type_idx ON public.project_documents USING btree (document_type, discipline);
CREATE INDEX IF NOT EXISTS project_progress_snapshots_created_by_idx ON public.project_progress_snapshots USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS project_progress_snapshots_pkey ON public.project_progress_snapshots USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS project_progress_snapshots_project_id_snapshot_date_key ON public.project_progress_snapshots USING btree (project_id, snapshot_date);
CREATE INDEX IF NOT EXISTS project_progress_snapshots_project_idx ON public.project_progress_snapshots USING btree (project_id, snapshot_date);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects USING btree (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS projects_code_key ON public.projects USING btree (code);
CREATE INDEX IF NOT EXISTS projects_lead_id_idx ON public.projects USING btree (lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS projects_pkey ON public.projects USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS projects_project_no_key ON public.projects USING btree (project_no);
CREATE UNIQUE INDEX IF NOT EXISTS projects_project_no_uq ON public.projects USING btree (project_no) WHERE (project_no IS NOT NULL);
CREATE INDEX IF NOT EXISTS projects_proposal_id_idx ON public.projects USING btree (proposal_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects USING btree (status) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS proposal_items_pkey ON public.proposal_items USING btree (id);
CREATE INDEX IF NOT EXISTS proposal_items_proposal_idx ON public.proposal_items USING btree (proposal_id, sort_order);
CREATE INDEX IF NOT EXISTS proposals_client_id_idx ON public.proposals USING btree (client_id);
CREATE INDEX IF NOT EXISTS proposals_lead_id_idx ON public.proposals USING btree (lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS proposals_pkey ON public.proposals USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS proposals_proposal_no_key ON public.proposals USING btree (proposal_no);
CREATE UNIQUE INDEX IF NOT EXISTS proposals_proposal_no_uq ON public.proposals USING btree (proposal_no) WHERE (proposal_no IS NOT NULL);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals USING btree (status) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS purchase_orders_approved_by_idx ON public.purchase_orders USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS purchase_orders_business_unit_idx ON public.purchase_orders USING btree (business_unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_pkey ON public.purchase_orders USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_po_no_key ON public.purchase_orders USING btree (po_no);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_po_no_uq ON public.purchase_orders USING btree (po_no) WHERE (po_no IS NOT NULL);
CREATE INDEX IF NOT EXISTS purchase_orders_project_idx ON public.purchase_orders USING btree (project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_quote_uq ON public.purchase_orders USING btree (quote_id) WHERE (quote_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS purchase_orders_req_idx ON public.purchase_orders USING btree (requisition_id) WHERE (requisition_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS purchase_orders_vendor_id_idx ON public.purchase_orders USING btree (vendor_id);
CREATE INDEX IF NOT EXISTS quality_checks_checked_by_idx ON public.quality_checks USING btree (checked_by) WHERE (checked_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS quality_checks_inspection_idx ON public.quality_checks USING btree (inspection_id) WHERE (inspection_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS quality_checks_pkey ON public.quality_checks USING btree (id);
CREATE INDEX IF NOT EXISTS quality_checks_project_idx ON public.quality_checks USING btree (project_id, status);
CREATE INDEX IF NOT EXISTS quality_checks_stage_idx ON public.quality_checks USING btree (stage_id) WHERE (stage_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS receipts_invoice_id_idx ON public.receipts USING btree (invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_pkey ON public.receipts USING btree (id);
CREATE INDEX IF NOT EXISTS receipts_project_idx ON public.receipts USING btree (project_id, receipt_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_receipt_no_key ON public.receipts USING btree (receipt_no);
CREATE INDEX IF NOT EXISTS reimbursements_approved_by_idx ON public.reimbursements USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS reimbursements_bu_idx ON public.reimbursements USING btree (business_unit_id, status);
CREATE INDEX IF NOT EXISTS reimbursements_created_by_idx ON public.reimbursements USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS reimbursements_employee_idx ON public.reimbursements USING btree (employee_id, status, expense_date);
CREATE INDEX IF NOT EXISTS reimbursements_expense_idx ON public.reimbursements USING btree (expense_id) WHERE (expense_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS reimbursements_paid_by_idx ON public.reimbursements USING btree (paid_by) WHERE (paid_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS reimbursements_pkey ON public.reimbursements USING btree (id);
CREATE INDEX IF NOT EXISTS reimbursements_project_idx ON public.reimbursements USING btree (project_id, status) WHERE (project_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS reimbursements_reimbursement_no_key ON public.reimbursements USING btree (reimbursement_no);
CREATE INDEX IF NOT EXISTS reimbursements_verified_by_idx ON public.reimbursements USING btree (verified_by) WHERE (verified_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS site_inspections_created_by_idx ON public.site_inspections USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS site_inspections_inspector_idx ON public.site_inspections USING btree (inspector_id) WHERE (inspector_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS site_inspections_pkey ON public.site_inspections USING btree (id);
CREATE INDEX IF NOT EXISTS site_inspections_project_idx ON public.site_inspections USING btree (project_id, scheduled_on);
CREATE INDEX IF NOT EXISTS site_inspections_report_idx ON public.site_inspections USING btree (report_id) WHERE (report_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS site_inspections_stage_idx ON public.site_inspections USING btree (stage_id) WHERE (stage_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS site_issues_created_by_idx ON public.site_issues USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS site_issues_owner_idx ON public.site_issues USING btree (owner_id, status) WHERE (owner_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS site_issues_pkey ON public.site_issues USING btree (id);
CREATE INDEX IF NOT EXISTS site_issues_project_idx ON public.site_issues USING btree (project_id, status, severity);
CREATE INDEX IF NOT EXISTS site_issues_report_idx ON public.site_issues USING btree (report_id) WHERE (report_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS site_issues_stage_idx ON public.site_issues USING btree (stage_id) WHERE (stage_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS site_report_activities_pkey ON public.site_report_activities USING btree (id);
CREATE INDEX IF NOT EXISTS site_report_activities_report_idx ON public.site_report_activities USING btree (report_id, sort_order);
CREATE INDEX IF NOT EXISTS site_report_activities_stage_idx ON public.site_report_activities USING btree (stage_id) WHERE (stage_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS site_report_equipment_pkey ON public.site_report_equipment USING btree (id);
CREATE INDEX IF NOT EXISTS site_report_equipment_report_idx ON public.site_report_equipment USING btree (report_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS site_report_labour_pkey ON public.site_report_labour USING btree (id);
CREATE INDEX IF NOT EXISTS site_report_labour_report_idx ON public.site_report_labour USING btree (report_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS site_report_materials_pkey ON public.site_report_materials USING btree (id);
CREATE INDEX IF NOT EXISTS site_report_materials_report_idx ON public.site_report_materials USING btree (report_id, sort_order);
CREATE INDEX IF NOT EXISTS site_reports_approved_by_idx ON public.site_reports USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS site_reports_pkey ON public.site_reports USING btree (id);
CREATE INDEX IF NOT EXISTS site_reports_project_date_idx ON public.site_reports USING btree (project_id, report_date DESC);
CREATE INDEX IF NOT EXISTS site_reports_project_id_idx ON public.site_reports USING btree (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS site_reports_project_id_report_date_key ON public.site_reports USING btree (project_id, report_date);
CREATE UNIQUE INDEX IF NOT EXISTS site_reports_report_no_uq ON public.site_reports USING btree (report_no) WHERE (report_no IS NOT NULL);
CREATE INDEX IF NOT EXISTS site_reports_submitted_by_idx ON public.site_reports USING btree (submitted_by) WHERE (submitted_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS stock_ledger_business_unit_idx ON public.stock_ledger USING btree (business_unit_id);
CREATE INDEX IF NOT EXISTS stock_ledger_material_idx ON public.stock_ledger USING btree (material_id);
CREATE UNIQUE INDEX IF NOT EXISTS stock_ledger_pkey ON public.stock_ledger USING btree (id);
CREATE INDEX IF NOT EXISTS stock_ledger_project_idx ON public.stock_ledger USING btree (project_id, moved_on);
CREATE INDEX IF NOT EXISTS stock_ledger_recorded_by_idx ON public.stock_ledger USING btree (recorded_by) WHERE (recorded_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS stock_ledger_reference_idx ON public.stock_ledger USING btree (reference_type, reference_id) WHERE (reference_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS stock_ledger_store_material_idx ON public.stock_ledger USING btree (store_id, material_id, moved_on);
CREATE INDEX IF NOT EXISTS stores_business_unit_idx ON public.stores USING btree (business_unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS stores_pkey ON public.stores USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS stores_project_id_name_key ON public.stores USING btree (project_id, name);
CREATE INDEX IF NOT EXISTS stores_project_idx ON public.stores USING btree (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_pkey ON public.tasks USING btree (id);
CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON public.tasks USING btree (project_id, status);
CREATE INDEX IF NOT EXISTS vendor_bills_approved_by_idx ON public.vendor_bills USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_bills_business_unit_idx ON public.vendor_bills USING btree (business_unit_id);
CREATE INDEX IF NOT EXISTS vendor_bills_created_by_idx ON public.vendor_bills USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_bills_expense_idx ON public.vendor_bills USING btree (expense_id) WHERE (expense_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_bills_grn_idx ON public.vendor_bills USING btree (grn_id) WHERE (grn_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_bills_internal_no_key ON public.vendor_bills USING btree (internal_no);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_bills_pkey ON public.vendor_bills USING btree (id);
CREATE INDEX IF NOT EXISTS vendor_bills_po_idx ON public.vendor_bills USING btree (po_id) WHERE (po_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_bills_project_idx ON public.vendor_bills USING btree (project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_bills_vendor_id_bill_no_key ON public.vendor_bills USING btree (vendor_id, bill_no);
CREATE INDEX IF NOT EXISTS vendor_bills_vendor_idx ON public.vendor_bills USING btree (vendor_id, status);
CREATE INDEX IF NOT EXISTS vendor_payments_bill_idx ON public.vendor_payments USING btree (vendor_bill_id, payment_date);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_payments_pkey ON public.vendor_payments USING btree (id);
CREATE INDEX IF NOT EXISTS vendor_payments_project_idx ON public.vendor_payments USING btree (project_id) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_payments_recorded_by_idx ON public.vendor_payments USING btree (recorded_by) WHERE (recorded_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_payments_vendor_idx ON public.vendor_payments USING btree (vendor_id, payment_date);
CREATE INDEX IF NOT EXISTS vendor_quote_items_material_idx ON public.vendor_quote_items USING btree (material_id) WHERE (material_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_quote_items_parent_idx ON public.vendor_quote_items USING btree (quote_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_quote_items_pkey ON public.vendor_quote_items USING btree (id);
CREATE INDEX IF NOT EXISTS vendor_quote_items_req_item_idx ON public.vendor_quote_items USING btree (requisition_item_id) WHERE (requisition_item_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_quote_items_req_uq ON public.vendor_quote_items USING btree (quote_id, requisition_item_id) WHERE (requisition_item_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_quotes_created_by_idx ON public.vendor_quotes USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_quotes_pkey ON public.vendor_quotes USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_quotes_requisition_id_vendor_id_quote_ref_key ON public.vendor_quotes USING btree (requisition_id, vendor_id, quote_ref);
CREATE INDEX IF NOT EXISTS vendor_quotes_requisition_idx ON public.vendor_quotes USING btree (requisition_id, status);
CREATE INDEX IF NOT EXISTS vendor_quotes_vendor_idx ON public.vendor_quotes USING btree (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_rfq_invites_invited_by_idx ON public.vendor_rfq_invites USING btree (invited_by) WHERE (invited_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_rfq_invites_pkey ON public.vendor_rfq_invites USING btree (id);
CREATE INDEX IF NOT EXISTS vendor_rfq_invites_project_idx ON public.vendor_rfq_invites USING btree (project_id) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS vendor_rfq_invites_quote_idx ON public.vendor_rfq_invites USING btree (quote_id) WHERE (quote_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_rfq_invites_requisition_id_vendor_id_key ON public.vendor_rfq_invites USING btree (requisition_id, vendor_id);
CREATE INDEX IF NOT EXISTS vendor_rfq_req_idx ON public.vendor_rfq_invites USING btree (requisition_id, status);
CREATE INDEX IF NOT EXISTS vendor_rfq_vendor_idx ON public.vendor_rfq_invites USING btree (vendor_id, status, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_rfq_items_invite_id_requisition_item_id_key ON public.vendor_rfq_items USING btree (invite_id, requisition_item_id);
CREATE INDEX IF NOT EXISTS vendor_rfq_items_invite_idx ON public.vendor_rfq_items USING btree (invite_id);
CREATE INDEX IF NOT EXISTS vendor_rfq_items_material_idx ON public.vendor_rfq_items USING btree (material_id) WHERE (material_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_rfq_items_pkey ON public.vendor_rfq_items USING btree (id);
CREATE INDEX IF NOT EXISTS vendor_rfq_items_req_item_idx ON public.vendor_rfq_items USING btree (requisition_item_id);
CREATE INDEX IF NOT EXISTS vendors_business_unit_idx ON public.vendors USING btree (business_unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendors_code_key ON public.vendors USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS vendors_pkey ON public.vendors USING btree (id);

-- Security-invoker views
create or replace view public."leave_balances" with (security_invoker=true) as
 SELECT e.id AS employee_id,
    lt.id AS leave_type_id,
    lt.code,
    lt.name,
    lt.annual_quota,
    lt.paid,
    COALESCE(sum(l.days) FILTER (WHERE l.status = 'approved'::text AND EXTRACT(year FROM l.from_date) = EXTRACT(year FROM CURRENT_DATE)), 0::numeric)::numeric(6,2) AS used,
    GREATEST(lt.annual_quota - COALESCE(sum(l.days) FILTER (WHERE l.status = 'approved'::text AND EXTRACT(year FROM l.from_date) = EXTRACT(year FROM CURRENT_DATE)), 0::numeric), 0::numeric)::numeric(6,2) AS available
   FROM employees e
     JOIN leave_types lt ON NOT lt.business_unit_id IS DISTINCT FROM e.business_unit_id AND lt.active = true
     LEFT JOIN leave_requests l ON l.employee_id = e.id AND l.leave_type_id = lt.id
  GROUP BY e.id, lt.id, lt.code, lt.name, lt.annual_quota, lt.paid;
create or replace view public."stock_balances" with (security_invoker=true) as
 SELECT l.business_unit_id,
    l.project_id,
    l.store_id,
    s.name AS store_name,
    l.material_id,
    m.code,
    m.name,
    m.category,
    m.unit,
    m.reorder_level,
    COALESCE(sum(
        CASE
            WHEN l.movement_type = ANY (ARRAY['grn_in'::text, 'return_in'::text, 'transfer_in'::text, 'adjust_in'::text]) THEN l.qty
            ELSE - l.qty
        END), 0::numeric)::numeric(14,3) AS qty,
    COALESCE(( SELECT sl.rate
           FROM stock_ledger sl
          WHERE sl.store_id = l.store_id AND sl.material_id = l.material_id
          ORDER BY sl.moved_on DESC, sl.created_at DESC
         LIMIT 1), m.default_rate) AS last_rate,
    round(COALESCE(sum(
        CASE
            WHEN l.movement_type = ANY (ARRAY['grn_in'::text, 'return_in'::text, 'transfer_in'::text, 'adjust_in'::text]) THEN l.qty
            ELSE - l.qty
        END), 0::numeric) * COALESCE(( SELECT sl2.rate
           FROM stock_ledger sl2
          WHERE sl2.store_id = l.store_id AND sl2.material_id = l.material_id
          ORDER BY sl2.moved_on DESC, sl2.created_at DESC
         LIMIT 1), m.default_rate), 2) AS value,
        CASE
            WHEN COALESCE(sum(
            CASE
                WHEN l.movement_type = ANY (ARRAY['grn_in'::text, 'return_in'::text, 'transfer_in'::text, 'adjust_in'::text]) THEN l.qty
                ELSE - l.qty
            END), 0::numeric) <= 0::numeric THEN 'out'::text
            WHEN COALESCE(sum(
            CASE
                WHEN l.movement_type = ANY (ARRAY['grn_in'::text, 'return_in'::text, 'transfer_in'::text, 'adjust_in'::text]) THEN l.qty
                ELSE - l.qty
            END), 0::numeric) <= m.reorder_level THEN 'low'::text
            ELSE 'ok'::text
        END AS stock_status
   FROM stock_ledger l
     JOIN materials m ON m.id = l.material_id
     JOIN stores s ON s.id = l.store_id
  GROUP BY l.business_unit_id, l.project_id, l.store_id, s.name, l.material_id, m.code, m.name, m.category, m.unit, m.reorder_level, m.default_rate;

-- Current functions

CREATE OR REPLACE FUNCTION private.backup_auth_mismatches(p_payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog', 'auth'
AS $function$
declare caller uuid:=(select auth.uid()); caller_role text; missing_count integer;
begin
  select role into caller_role from public.profiles where id=caller and is_active=true;
  if caller is null or caller_role not in ('founder','admin') then raise exception 'Backup validation denied'; end if;
  with ids as (
    select nullif(x->>'id','')::uuid id
    from jsonb_array_elements(coalesce(p_payload->'data'->'profiles','[]'::jsonb)) x
    union
    select nullif(x->>'user_id','')::uuid
    from jsonb_array_elements(coalesce(p_payload->'data'->'portal_memberships','[]'::jsonb)) x
    where nullif(x->>'user_id','') is not null and coalesce(x->>'status','')='active'
  )
  select count(*) into missing_count
  from ids i
  where i.id is not null and not exists(select 1 from auth.users u where u.id=i.id);
  return missing_count;
end $function$;

CREATE OR REPLACE FUNCTION private.restore_application_backup(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog', 'auth'
AS $function$
declare
  caller uuid:=(select auth.uid()); caller_role text; live_rows bigint;
  tables text[]:=array[
    'business_units','profiles','organisation_profiles','accounting_period_locks',
    'leads','clients','estimates','estimate_items','proposals','proposal_items',
    'projects','preconstruction_steps','construction_stages','project_progress_snapshots',
    'design_deliverables','drawings','approvals','tasks',
    'project_documents','document_revisions','document_approvals','document_register',
    'meetings','meeting_attendees','meeting_notes','meeting_action_items',
    'site_reports','site_report_activities','site_report_labour','site_report_materials','site_report_equipment',
    'site_inspections','site_issues','quality_checks',
    'proforma_invoices','proforma_items','invoices','invoice_items','credit_notes','receipts','expenses',
    'materials','stores','material_requisitions','material_requisition_items',
    'vendor_quotes','vendor_quote_items','purchase_orders','po_items','goods_receipts','goods_receipt_items',
    'stock_ledger','vendors','vendor_bills','vendor_payments','vendor_rfq_invites','vendor_rfq_items',
    'employees','employee_compensation','attendance','leave_types','leave_requests','project_allocations',
    'payroll_inputs','payroll_runs','payroll_entries','reimbursements',
    'performance_cycles','performance_goals','performance_reviews','kudos',
    'portal_memberships','portal_messages','document_sequences'
  ];
  t text; cols text; stmt text; inserted bigint:=0; n bigint; payload_rows jsonb; fk record;
begin
  select role into caller_role from public.profiles where id=caller and is_active=true;
  if caller is null or caller_role not in ('founder','admin') then raise exception 'Backup restore denied'; end if;
  if coalesce(p_payload->>'format','')<>'bindbuild-erp-application-backup'
     or coalesce((p_payload->>'format_version')::int,0)<>1 then raise exception 'Invalid or unsupported backup'; end if;

  select
    (select count(*) from public.leads where deleted_at is null)+
    (select count(*) from public.projects where deleted_at is null)+
    (select count(*) from public.invoices where deleted_at is null)+
    (select count(*) from public.receipts)+
    (select count(*) from public.expenses)+
    (select count(*) from public.purchase_orders)+
    (select count(*) from public.employees)+
    (select count(*) from public.project_documents)
  into live_rows;
  if live_rows>0 then raise exception 'Restore requires an empty operational system; % live rows found',live_rows; end if;

  create temp table if not exists tmp_bindbuild_restore_fks(
    table_name text, constraint_name text, definition text
  ) on commit drop;
  truncate tmp_bindbuild_restore_fks;

  foreach t in array tables loop
    execute format('alter table public.%I disable trigger user',t);
  end loop;

  for fk in
    select c.relname table_name,con.conname constraint_name,pg_get_constraintdef(con.oid) definition
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace ns on ns.oid=c.relnamespace
    join pg_class rc on rc.oid=con.confrelid
    join pg_namespace rns on rns.oid=rc.relnamespace
    where con.contype='f' and ns.nspname='public' and rns.nspname='public'
      and c.relname=any(tables) and rc.relname=any(tables)
  loop
    insert into tmp_bindbuild_restore_fks values(fk.table_name,fk.constraint_name,fk.definition);
    execute format('alter table public.%I drop constraint %I',fk.table_name,fk.constraint_name);
  end loop;

  foreach t in array tables loop
    payload_rows:=p_payload->'data'->t;
    if payload_rows is null or jsonb_typeof(payload_rows)<>'array' or jsonb_array_length(payload_rows)=0 then continue; end if;

    select string_agg(quote_ident(a.attname),',' order by a.attnum)
    into cols
    from pg_attribute a
    where a.attrelid=format('public.%I',t)::regclass
      and a.attnum>0 and not a.attisdropped and a.attgenerated='' and a.attidentity='';

    if cols is null then continue; end if;
    stmt:=format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I,$1) on conflict do nothing',
      t,cols
    );
    execute stmt using payload_rows;
    get diagnostics n=row_count; inserted:=inserted+n;
  end loop;

  for fk in select * from tmp_bindbuild_restore_fks loop
    execute format('alter table public.%I add constraint %I %s',fk.table_name,fk.constraint_name,fk.definition);
  end loop;

  foreach t in array tables loop
    execute format('alter table public.%I enable trigger user',t);
  end loop;

  insert into public.application_backup_log(operation,format_version,table_count,row_count,byte_estimate,status,created_by,note)
  values('restore',1,array_length(tables,1),inserted,octet_length(p_payload::text),'success',caller,'Application JSON backup restored and constraints revalidated');

  return jsonb_build_object('restored',true,'rows_inserted',inserted,'tables_considered',array_length(tables,1),'constraints_revalidated',true);
end $function$;

CREATE OR REPLACE FUNCTION private.run_daily_erp_automations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_uid uuid:=(select auth.uid()); v_role text; v_run uuid; inserted_count int:=0; n int;
begin
  if v_uid is not null then
    select role into v_role from public.profiles where id=v_uid and is_active=true;
    if v_role not in ('founder','admin') then raise exception 'Automation run denied'; end if;
  end if;

  insert into public.automation_runs(job_name) values('daily-ops-scan') returning id into v_run;
  delete from public.erp_notifications where created_at<now()-interval '180 days';

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select p.business_unit_id,'task-overdue:'||t.id,'task_overdue',
    case when t.due_at<now()-interval '3 days' then 'critical' else 'warning' end,
    'Overdue task',t.title||' · due '||to_char(t.due_at at time zone 'Asia/Kolkata','DD Mon'),
    'task',t.id,case when t.assigned_to is null then 'project_manager' else null end,current_date
  from public.tasks t
  left join public.projects p on p.id=t.project_id
  where t.status not in ('done','cancelled') and t.due_at<now()
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_user_id,occurred_on)
  select p.business_unit_id,'task-owner-overdue:'||t.id,'task_overdue','warning',
    'Task needs attention',t.title||' · overdue since '||to_char(t.due_at at time zone 'Asia/Kolkata','DD Mon'),
    'task',t.id,t.assigned_to,current_date
  from public.tasks t left join public.projects p on p.id=t.project_id
  where t.status not in ('done','cancelled') and t.due_at<now() and t.assigned_to is not null
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select i.business_unit_id,'invoice-overdue:'||i.id,'invoice_overdue',
    case when current_date-i.due_date>=7 then 'critical' else 'warning' end,
    'Client payment overdue',coalesce(i.invoice_no,'Invoice')||' · balance ₹'||to_char(greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0),'FM999G999G999G990'),
    'invoice',i.id,'finance',current_date
  from public.invoices i
  where i.deleted_at is null and i.status<>'cancelled' and i.due_date<current_date
    and greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0)>0
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select v.business_unit_id,'vendor-bill-due:'||v.id,'vendor_bill_due',
    case when current_date-v.due_date>=7 then 'critical' else 'warning' end,
    'Vendor bill overdue',coalesce(v.internal_no,v.bill_no)||' · balance ₹'||to_char(greatest(v.total-v.amount_paid,0),'FM999G999G999G990'),
    'vendor_bill',v.id,'finance',current_date
  from public.vendor_bills v
  where v.status in ('approved','part_paid') and v.due_date<current_date and greatest(v.total-v.amount_paid,0)>0
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select p.business_unit_id,'approval-waiting:'||a.id,'approval_pending','warning',
    'Approval waiting over 48h',a.title||' · requested '||to_char(a.created_at at time zone 'Asia/Kolkata','DD Mon'),
    'approval',a.id,'project_manager',current_date
  from public.approvals a join public.projects p on p.id=a.project_id
  where a.status='pending' and a.created_at<now()-interval '48 hours'
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select s.business_unit_id,'low-stock:'||s.store_id||':'||s.material_id,'low_stock',
    case when s.qty<=0 then 'critical' else 'warning' end,
    'Site stock '||case when s.qty<=0 then 'out' else 'low' end,
    coalesce(s.name,s.code,'Material')||' · '||coalesce(s.qty,0)||' '||coalesce(s.unit,''),
    'material',s.material_id,'procurement',current_date
  from public.stock_balances s
  where s.reorder_level is not null and s.qty<=s.reorder_level
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  update public.automation_runs
  set status='success',finished_at=now(),result=jsonb_build_object('notifications_created',inserted_count)
  where id=v_run;
  return jsonb_build_object('run_id',v_run,'notifications_created',inserted_count);
exception when others then
  if v_run is not null then
    update public.automation_runs set status='failed',finished_at=now(),error=sqlerrm where id=v_run;
  end if;
  raise;
end $function$;

CREATE OR REPLACE FUNCTION public.accept_proposal_to_project(p_proposal_id uuid)
 RETURNS TABLE(client_id uuid, project_id uuid, project_no text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_prop public.proposals%rowtype;
  v_lead public.leads%rowtype;
  v_client_id uuid;
  v_project_id uuid;
  v_project_no text;
begin
  if public.current_app_role() is null then
    raise exception 'ERP access denied';
  end if;

  select * into v_prop
  from public.proposals pr
  where pr.id=p_proposal_id and pr.deleted_at is null
  for update;

  if not found then raise exception 'Proposal not found'; end if;
  if v_prop.proposal_no is null then raise exception 'Issue/send proposal before accepting it'; end if;

  if v_prop.lead_id is not null then
    select * into v_lead
    from public.leads l
    where l.id=v_prop.lead_id and l.deleted_at is null;
  end if;

  v_client_id:=v_prop.client_id;

  if v_client_id is null and v_prop.lead_id is not null then
    select c.id into v_client_id
    from public.clients c
    where c.lead_id=v_prop.lead_id and c.deleted_at is null
    order by c.created_at limit 1;

    if v_client_id is null then
      insert into public.clients(
        business_unit_id,lead_id,name,phone,email,city,address,state,state_code
      ) values (
        v_prop.business_unit_id,v_prop.lead_id,
        coalesce(v_lead.name,'Client'),v_lead.phone,v_lead.email,
        v_lead.city,v_lead.area,
        case when lower(coalesce(v_lead.city,''))='chennai' then 'Tamil Nadu' end,
        case when lower(coalesce(v_lead.city,''))='chennai' then '33' end
      ) returning id into v_client_id;
    end if;
  end if;

  if v_client_id is null then
    raise exception 'Proposal must be linked to a lead or client';
  end if;

  select p.id,coalesce(p.project_no,p.code)
  into v_project_id,v_project_no
  from public.projects p
  where p.proposal_id=p_proposal_id and p.deleted_at is null
  order by p.created_at limit 1;

  if v_project_id is null then
    v_project_no:=public.next_erp_number('project',current_date);

    insert into public.projects(
      business_unit_id,project_no,code,name,client_id,lead_id,proposal_id,
      service_type,location,contract_value,status,health,progress_pct,start_date
    ) values (
      v_prop.business_unit_id,v_project_no,v_project_no,
      coalesce(nullif(v_prop.title,''),coalesce(v_lead.name,'Project')),
      v_client_id,v_prop.lead_id,v_prop.id,
      coalesce(v_prop.service,v_lead.service),
      coalesce(v_lead.area,v_lead.city),
      v_prop.grand_total,'planning','ontrack',0,null
    ) returning id into v_project_id;
  end if;

  update public.proposals pr
  set client_id=v_client_id,status='accepted',
      accepted_at=coalesce(pr.accepted_at,now()),updated_at=now()
  where pr.id=p_proposal_id;

  if v_prop.lead_id is not null then
    update public.leads l
    set stage='won',updated_at=now()
    where l.id=v_prop.lead_id;
  end if;

  return query select v_client_id,v_project_id,v_project_no;
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_meeting_action(p_meeting_id uuid, p_title text, p_owner_profile_id uuid DEFAULT NULL::uuid, p_due_date date DEFAULT NULL::date, p_priority text DEFAULT 'medium'::text, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare m public.meetings%rowtype; aid uuid; tid uuid;
begin
  if public.current_app_role() not in ('founder','admin','sales','project_manager','designer','site_engineer','finance','procurement','hr') then
    raise exception 'Meeting action access denied';
  end if;
  select * into m from public.meetings where id=p_meeting_id;
  if m.id is null or m.status='cancelled' then raise exception 'Meeting not found'; end if;

  if p_owner_profile_id is not null then
    insert into public.tasks(project_id,title,description,priority,status,assigned_to,due_at,created_by)
    values(
      m.project_id,p_title,p_description,p_priority,'todo',p_owner_profile_id,
      case when p_due_date is null then null else (p_due_date::text||' 18:00:00+05:30')::timestamptz end,
      (select auth.uid())
    ) returning id into tid;
  end if;

  insert into public.meeting_action_items(
    meeting_id,project_id,title,description,owner_profile_id,due_date,priority,status,task_id,created_by
  ) values(m.id,m.project_id,p_title,p_description,p_owner_profile_id,p_due_date,p_priority,'open',tid,(select auth.uid()))
  returning id into aid;
  return aid;
end $function$;

CREATE OR REPLACE FUNCTION public.after_construction_stage_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  perform public.recompute_project_construction_progress(new.project_id);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.approve_payroll_run(p_run_id uuid)
 RETURNS payroll_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.payroll_runs%rowtype;
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Payroll approval denied'; end if;
  update public.payroll_runs set status='approved',approved_by=(select auth.uid()),approved_at=now(),updated_at=now()
  where id=p_run_id and status='review' returning * into v;
  if v.id is null then raise exception 'Payroll run awaiting review not found'; end if;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.approve_purchase_order(p_po_id uuid)
 RETURNS purchase_orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.purchase_orders%rowtype; n int; missing_material int;
begin
  if public.current_app_role() not in ('founder','admin','project_manager') then raise exception 'PO approval denied'; end if;
  select * into v from public.purchase_orders where id=p_po_id for update;
  if v.id is null or v.status<>'approval' then raise exception 'PO must be submitted for approval first'; end if;
  select count(*),count(*) filter(where material_id is null) into n,missing_material
  from public.po_items where po_id=v.id;
  if n=0 then raise exception 'PO has no items'; end if;
  if missing_material>0 then raise exception 'Link every PO item to the material master before approval'; end if;
  if v.po_no is null then v.po_no:=public.next_erp_number('purchase_order',current_date); end if;
  update public.purchase_orders
  set po_no=v.po_no,status='approved',approved_by=(select auth.uid()),approved_at=now(),
      order_date=current_date,updated_at=now()
  where id=v.id returning * into v;
  update public.material_requisitions set status='ordered',updated_at=now() where id=v.requisition_id;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.approve_reimbursement(p_reimbursement_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS reimbursements
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.reimbursements%rowtype; eid uuid; emp text;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Reimbursement approval denied'; end if;
  select * into v from public.reimbursements where id=p_reimbursement_id for update;
  if v.id is null or v.status<>'hr_verified' then raise exception 'HR-verified reimbursement not found'; end if;
  if not p_approve then
    update public.reimbursements set status='rejected',rejection_reason=nullif(trim(p_reason),''),updated_at=now()
    where id=v.id returning * into v; return v;
  end if;
  perform public.assert_accounting_period_open(v.business_unit_id,v.expense_date);
  select full_name into emp from public.employees where id=v.employee_id;
  insert into public.expenses(business_unit_id,project_id,title,category,amount,expense_date,status,reference_no,notes,created_by)
  values(v.business_unit_id,v.project_id,'Employee reimbursement · '||coalesce(emp,'Employee'),coalesce(v.category,'reimbursement'),
         v.amount,v.expense_date,'approved',v.reimbursement_no,v.description,(select auth.uid()))
  returning id into eid;
  update public.reimbursements set status='approved',approved_by=(select auth.uid()),approved_at=now(),expense_id=eid,updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.approve_vendor_bill(p_bill_id uuid)
 RETURNS vendor_bills
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  b public.vendor_bills%rowtype; eid uuid; vname text;
  po public.purchase_orders%rowtype; accepted_value numeric; already_billed numeric;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Vendor bill approval denied'; end if;
  select * into b from public.vendor_bills where id=p_bill_id for update;
  if b.id is null or b.status not in ('draft','verified') then raise exception 'Draft/verified vendor bill not found'; end if;
  perform public.assert_accounting_period_open(b.business_unit_id,b.bill_date);

  if b.po_id is not null then
    select * into po from public.purchase_orders where id=b.po_id;
    if po.id is null then raise exception 'Linked purchase order not found'; end if;
    if b.vendor_id is distinct from po.vendor_id or b.project_id is distinct from po.project_id then
      raise exception 'Vendor bill does not match the linked PO vendor/project';
    end if;
    if b.grn_id is not null and not exists(select 1 from public.goods_receipts g where g.id=b.grn_id and g.po_id=po.id and g.status='accepted') then
      raise exception 'Vendor bill GRN does not match the linked PO';
    end if;

    select coalesce(sum(gri.accepted_qty*gri.rate*(1+pi.gst_rate/100)),0)
    into accepted_value
    from public.goods_receipt_items gri
    join public.goods_receipts g on g.id=gri.grn_id and g.status='accepted'
    join public.po_items pi on pi.id=gri.po_item_id
    where g.po_id=po.id;

    select coalesce(sum(vb.total),0) into already_billed
    from public.vendor_bills vb
    where vb.po_id=po.id and vb.id<>b.id and vb.status not in ('draft','disputed','cancelled');

    if already_billed+b.total>accepted_value+1 then
      raise exception 'Vendor bill exceeds accepted GRN value. Accepted %, already billed %',round(accepted_value,2),round(already_billed,2);
    end if;
  end if;

  select name into vname from public.vendors where id=b.vendor_id;
  if b.internal_no is null then b.internal_no:=public.next_erp_number('vendor_bill',b.bill_date); end if;

  if b.expense_id is null then
    insert into public.expenses(business_unit_id,project_id,vendor_id,title,category,amount,expense_date,status,reference_no,notes)
    values(b.business_unit_id,b.project_id,b.vendor_id,'Vendor bill · '||coalesce(vname,'Vendor'),'procurement',b.total,b.bill_date,'approved',b.bill_no,b.notes)
    returning id into eid;
  else
    eid:=b.expense_id;
  end if;

  update public.vendor_bills
  set internal_no=b.internal_no,status='approved',expense_id=eid,
      approved_by=(select auth.uid()),approved_at=now(),updated_at=now()
  where id=b.id returning * into b;
  return b;
end $function$;

CREATE OR REPLACE FUNCTION public.assert_accounting_period_open(p_business_unit_id uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_period text:=public.erp_period_key('invoice',p_date);
begin
  if exists(
    select 1 from public.accounting_period_locks l
    where l.business_unit_id=p_business_unit_id and l.period_key=v_period
  ) then
    raise exception 'Accounting period % is locked',v_period;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.assert_dsr_child_draft()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_report uuid; v_status text;
begin
  v_report:=coalesce(new.report_id,old.report_id);
  select status into v_status from public.site_reports where id=v_report;
  if v_status is distinct from 'draft' then
    raise exception 'Submitted/approved site reports are locked. Reopen the report before editing.';
  end if;
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id uuid, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_i public.invoices%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Finance access denied'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Cancellation reason is required'; end if;

  select * into v_i from public.invoices i where i.id=p_invoice_id and i.deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_i.status='cancelled' then raise exception 'Invoice already cancelled'; end if;
  if coalesce(v_i.amount_paid,0)>0 then raise exception 'Paid invoices cannot be cancelled. Use a credit note.'; end if;
  if coalesce(v_i.credited_amount,0)>0 then raise exception 'Credited invoices cannot be cancelled.'; end if;
  if exists(select 1 from public.receipts r where r.invoice_id=p_invoice_id and r.status='issued') then
    raise exception 'Invoice has an active receipt. Cancel the receipt first.';
  end if;

  perform public.assert_accounting_period_open(v_i.business_unit_id,v_i.issue_date);

  update public.invoices
  set status='cancelled',cancelled_at=now(),cancellation_reason=trim(p_reason),updated_at=now()
  where id=p_invoice_id;

  update public.document_register
  set status='cancelled',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('cancellation_reason',trim(p_reason),'cancelled_at',now())
  where doc_type='invoice' and document_no=v_i.invoice_no;

  return v_i.invoice_no;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_proforma(p_proforma_id uuid, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_p public.proforma_invoices%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Finance access denied'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Cancellation reason is required'; end if;

  select * into v_p from public.proforma_invoices p where p.id=p_proforma_id and p.deleted_at is null for update;
  if not found then raise exception 'Proforma not found'; end if;
  if v_p.status='cancelled' then raise exception 'Proforma already cancelled'; end if;
  if coalesce(v_p.amount_paid,0)>0 then raise exception 'Paid proformas cannot be cancelled. Cancel linked receipts first.'; end if;
  if exists(select 1 from public.invoices i where i.proforma_id=p_proforma_id and i.deleted_at is null and i.status<>'cancelled') then
    raise exception 'A GST invoice already exists for this proforma.';
  end if;

  perform public.assert_accounting_period_open(v_p.business_unit_id,v_p.issue_date);

  update public.proforma_invoices
  set status='cancelled',cancelled_at=now(),cancellation_reason=trim(p_reason),updated_at=now()
  where id=p_proforma_id;

  if v_p.proforma_no is not null then
    update public.document_register
    set status='cancelled',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('cancellation_reason',trim(p_reason),'cancelled_at',now())
    where doc_type='proforma' and document_no=v_p.proforma_no;
  end if;

  return coalesce(v_p.proforma_no,'DRAFT');
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_receipt(p_receipt_id uuid, p_reason text)
 RETURNS TABLE(receipt_no text, target_balance numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_r public.receipts%rowtype;
  v_new_paid numeric;
  v_total numeric;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Finance access denied'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Cancellation reason is required'; end if;

  select * into v_r from public.receipts r where r.id=p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if v_r.status='cancelled' then raise exception 'Receipt already cancelled'; end if;

  perform public.assert_accounting_period_open(v_r.business_unit_id,v_r.receipt_date);

  update public.receipts
  set status='cancelled',cancelled_at=now(),cancellation_reason=trim(p_reason)
  where id=p_receipt_id;

  if v_r.proforma_id is not null then
    select total,amount_paid into v_total,v_new_paid
    from public.proforma_invoices where id=v_r.proforma_id for update;
    v_new_paid:=greatest(coalesce(v_new_paid,0)-v_r.amount,0);
    update public.proforma_invoices
    set amount_paid=v_new_paid,
        status=case when v_new_paid<=0 then 'issued' when v_new_paid+0.01>=total then 'paid' else 'part_paid' end,
        updated_at=now()
    where id=v_r.proforma_id;
  end if;

  if v_r.invoice_id is not null then
    select total,amount_paid into v_total,v_new_paid
    from public.invoices where id=v_r.invoice_id for update;
    v_new_paid:=greatest(coalesce(v_new_paid,0)-v_r.amount,0);
    update public.invoices
    set amount_paid=v_new_paid,
        status=case when v_new_paid<=0 then 'issued' when v_new_paid+0.01>=total then 'paid' else 'part_paid' end,
        updated_at=now()
    where id=v_r.invoice_id;
  end if;

  return query select v_r.receipt_no,greatest(coalesce(v_total,0)-coalesce(v_new_paid,0),0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_portal_access(p_portal_type text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_email text; n integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_portal_type not in ('client','vendor') then raise exception 'Invalid portal type'; end if;
  v_email:=lower(coalesce((select auth.jwt()->>'email'),''));
  if v_email='' then raise exception 'Verified email required'; end if;

  update public.portal_memberships
  set user_id=(select auth.uid()),status='active',claimed_at=coalesce(claimed_at,now()),updated_at=now()
  where portal_type=p_portal_type and status='invited' and user_id is null and lower(email)=v_email;
  get diagnostics n=row_count;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.client_decide_approval(p_approval_id uuid, p_decision text, p_comment text DEFAULT NULL::text)
 RETURNS approvals
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare a public.approvals%rowtype;
begin
  if p_decision not in ('approved','changes_requested') then raise exception 'Invalid decision'; end if;
  select a0.* into a
  from public.approvals a0
  join public.projects p on p.id=a0.project_id
  where a0.id=p_approval_id and a0.status='pending'
    and p.client_id is not null and public.has_client_portal_access(p.client_id)
  for update of a0;
  if a.id is null then raise exception 'Pending client approval not found'; end if;

  update public.approvals
  set status=p_decision,
      comment=nullif(trim(p_comment),''),
      decided_by=null,
      portal_decided_by=(select auth.uid()),
      portal_decider_email=(select auth.jwt()->>'email'),
      decided_at=now(),
      updated_at=now()
  where id=a.id
  returning * into a;
  return a;
end $function$;

CREATE OR REPLACE FUNCTION public.complete_construction_stage(p_stage_id uuid)
 RETURNS construction_stages
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.construction_stages%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','project_manager') then
    raise exception 'Stage completion approval denied';
  end if;
  update public.construction_stages set status='completed',progress_pct=100
  where id=p_stage_id returning * into v;
  if v.id is null then raise exception 'Construction stage not found'; end if;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.complete_meeting_action(p_action_id uuid)
 RETURNS meeting_action_items
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare a public.meeting_action_items%rowtype;
begin
  select * into a from public.meeting_action_items where id=p_action_id for update;
  if a.id is null or a.status in ('done','cancelled') then raise exception 'Open action not found'; end if;
  if public.current_app_role() not in ('founder','admin','project_manager')
     and a.owner_profile_id is distinct from (select auth.uid()) then
    raise exception 'Only the action owner or management can close this action';
  end if;
  update public.meeting_action_items
  set status='done',completed_by=(select auth.uid()),completed_at=now(),updated_at=now()
  where id=a.id returning * into a;
  if a.task_id is not null then
    update public.tasks set status='done',updated_at=now() where id=a.task_id;
  end if;
  return a;
end $function$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_proforma(p_proforma_id uuid)
 RETURNS TABLE(invoice_id uuid, invoice_no text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_pi public.proforma_invoices%rowtype;
  v_existing uuid;
  v_no text;
  v_id uuid;
  v_org public.organisation_profiles%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Finance access denied'; end if;

  select * into v_pi
  from public.proforma_invoices
  where id=p_proforma_id and deleted_at is null and status<>'cancelled'
  for update;

  if not found then raise exception 'Proforma invoice not found'; end if;
  if v_pi.proforma_no is null then raise exception 'Issue the proforma invoice first'; end if;
  if coalesce(v_pi.amount_paid,0)<=0 then raise exception 'Record payment before creating the GST invoice'; end if;

  select * into v_org
  from public.organisation_profiles o
  where o.business_unit_id=v_pi.business_unit_id;

  if v_org.id is null
     or nullif(trim(v_org.legal_name),'') is null
     or nullif(trim(v_org.gstin),'') is null
     or nullif(trim(v_org.pan),'') is null
     or nullif(trim(v_org.address),'') is null
     or nullif(trim(v_org.state_code),'') is null then
    raise exception 'Complete Organisation GST profile in Settings before creating a GST invoice';
  end if;

  perform public.assert_accounting_period_open(v_pi.business_unit_id,current_date);

  select i.id into v_existing
  from public.invoices i
  where i.proforma_id=p_proforma_id and i.deleted_at is null
  order by i.created_at limit 1;

  if v_existing is not null then
    return query select v_existing,(select i.invoice_no from public.invoices i where i.id=v_existing);
    return;
  end if;

  v_no:=public.issue_document_number(
    'invoice',current_date,v_pi.lead_id,v_pi.project_id,v_pi.client_id,v_pi.total,'issued',
    jsonb_build_object('proforma_id',p_proforma_id)
  );

  insert into public.invoices(
    business_unit_id,invoice_no,lead_id,project_id,client_id,proforma_id,
    milestone_name,milestone_pct,status,subtotal,discount,tax_rate,tax_amount,total,
    amount_paid,issue_date,due_date,notes,place_of_supply_state_code,is_interstate
  ) values (
    v_pi.business_unit_id,v_no,v_pi.lead_id,v_pi.project_id,v_pi.client_id,v_pi.id,
    v_pi.milestone_name,v_pi.milestone_pct,
    case when v_pi.amount_paid+0.01>=v_pi.total then 'paid' else 'part_paid' end,
    v_pi.subtotal,v_pi.discount,v_pi.tax_rate,v_pi.tax_amount,v_pi.total,
    v_pi.amount_paid,current_date,v_pi.due_date,v_pi.notes,
    v_pi.place_of_supply_state_code,v_pi.is_interstate
  ) returning id into v_id;

  insert into public.invoice_items(invoice_id,sort_order,description,sac_code,qty,unit,rate)
  select v_id,p.sort_order,p.description,p.sac_code,p.qty,p.unit,p.rate
  from public.proforma_items p
  where p.proforma_id=p_proforma_id
  order by p.sort_order;

  update public.receipts r
  set invoice_id=v_id
  where r.proforma_id=p_proforma_id and r.status='issued' and r.invoice_id is null;

  return query select v_id,v_no;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_po_from_quote(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare q public.vendor_quotes%rowtype; r public.material_requisitions%rowtype; po uuid;
begin
  if public.current_app_role() not in ('founder','admin','procurement','project_manager') then raise exception 'Procurement access denied'; end if;
  select * into q from public.vendor_quotes where id=p_quote_id for update;
  if q.id is null then raise exception 'Quote not found'; end if;
  select * into r from public.material_requisitions where id=q.requisition_id for update;
  if r.status not in ('approved','sourcing') then raise exception 'Requisition must be approved before PO creation'; end if;
  select id into po from public.purchase_orders where quote_id=q.id limit 1;
  if po is not null then return po; end if;

  insert into public.purchase_orders(
    business_unit_id,project_id,vendor_id,requisition_id,quote_id,status,
    subtotal,tax_amount,total,expected_date,payment_terms,notes
  ) values (
    r.business_unit_id,r.project_id,q.vendor_id,r.id,q.id,'draft',
    q.subtotal,q.tax_amount,q.total,
    case when q.delivery_days is not null then current_date+q.delivery_days else null end,
    q.payment_terms,q.notes
  ) returning id into po;

  insert into public.po_items(po_id,material_id,description,qty,unit,rate,gst_rate)
  select po,qi.material_id,qi.description,qi.qty,qi.unit,qi.rate,qi.gst_rate
  from public.vendor_quote_items qi where qi.quote_id=q.id;

  update public.vendor_quotes set status='selected',updated_at=now() where id=q.id;
  update public.vendor_quotes set status='rejected',updated_at=now()
  where requisition_id=q.requisition_id and id<>q.id and status in ('received','shortlisted');
  update public.material_requisitions set status='sourcing',updated_at=now() where id=r.id;
  return po;
end $function$;

CREATE OR REPLACE FUNCTION public.current_app_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_project_store(p_project_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v public.projects%rowtype;
begin
  if public.current_app_role() is null then raise exception 'ERP access denied'; end if;
  select * into v from public.projects where id=p_project_id and deleted_at is null;
  if v.id is null then raise exception 'Project not found'; end if;
  select id into v_id from public.stores where project_id=p_project_id and status='active' order by created_at limit 1;
  if v_id is null then
    insert into public.stores(business_unit_id,project_id,code,name,location)
    values(v.business_unit_id,v.id,coalesce(v.project_no,v.code)||'-STORE','Site Store',v.location)
    returning id into v_id;
  end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.erp_period_key(p_doc_type text, p_date date DEFAULT CURRENT_DATE)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare y integer:=extract(year from p_date)::integer; m integer:=extract(month from p_date)::integer; fy_start integer;
begin
  if lower(p_doc_type) in ('proforma','receipt','invoice','credit_note','vendor_bill','payroll','reimbursement') then
    fy_start:=case when m>=4 then y else y-1 end;
    return right(fy_start::text,2)||'-'||right((fy_start+1)::text,2);
  end if;
  return to_char(p_date,'YY');
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_prefix(p_doc_type text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
begin
  return case lower(p_doc_type)
    when 'lead' then 'BB'
    when 'project' then 'BB-P'
    when 'estimate' then 'EST'
    when 'proposal' then 'PRO'
    when 'proforma' then 'PI'
    when 'receipt' then 'REC'
    when 'invoice' then 'INV'
    when 'credit_note' then 'CN'
    when 'material_requisition' then 'MR'
    when 'purchase_order' then 'PO'
    when 'goods_receipt' then 'GRN'
    when 'vendor_bill' then 'VB'
    when 'employee' then 'EMP'
    when 'payroll' then 'PAY'
    when 'reimbursement' then 'REIMB'
    when 'project_document' then 'DOC'
    when 'meeting' then 'MOM'
    else null
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.export_application_backup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  tables text[]:=array[
    'business_units','profiles','organisation_profiles','accounting_period_locks',
    'leads','clients','estimates','estimate_items','proposals','proposal_items',
    'projects','preconstruction_steps','construction_stages','project_progress_snapshots',
    'design_deliverables','drawings','approvals','tasks',
    'project_documents','document_revisions','document_approvals','document_register',
    'meetings','meeting_attendees','meeting_notes','meeting_action_items',
    'site_reports','site_report_activities','site_report_labour','site_report_materials','site_report_equipment',
    'site_inspections','site_issues','quality_checks',
    'proforma_invoices','proforma_items','invoices','invoice_items','credit_notes','receipts','expenses',
    'materials','stores','material_requisitions','material_requisition_items',
    'vendor_quotes','vendor_quote_items','purchase_orders','po_items','goods_receipts','goods_receipt_items',
    'stock_ledger','vendors','vendor_bills','vendor_payments','vendor_rfq_invites','vendor_rfq_items',
    'employees','employee_compensation','attendance','leave_types','leave_requests','project_allocations',
    'payroll_inputs','payroll_runs','payroll_entries','reimbursements',
    'performance_cycles','performance_goals','performance_reviews','kudos',
    'portal_memberships','portal_messages','document_sequences'
  ];
  t text; rows jsonb; data jsonb:='{}'::jsonb; total_rows bigint:=0; result jsonb;
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Backup export denied'; end if;
  foreach t in array tables loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x',t) into rows;
    data:=data||jsonb_build_object(t,rows);
    total_rows:=total_rows+jsonb_array_length(rows);
  end loop;
  result:=jsonb_build_object(
    'format','bindbuild-erp-application-backup',
    'format_version',1,
    'created_at',now(),
    'created_by',(select auth.uid()),
    'table_count',array_length(tables,1),
    'row_count',total_rows,
    'exclusions',jsonb_build_array(
      'Supabase Auth user credentials/sessions',
      'Storage file bytes (document metadata and storage paths are included)',
      'Platform configuration, secrets, Vercel configuration, cron execution history'
    ),
    'data',data
  );
  insert into public.application_backup_log(operation,format_version,table_count,row_count,byte_estimate,status,created_by,note)
  values('export',1,array_length(tables,1),total_rows,octet_length(result::text),'success',(select auth.uid()),'Application JSON backup generated');
  return result;
end $function$;

CREATE OR REPLACE FUNCTION public.finalize_meeting(p_meeting_id uuid, p_summary text DEFAULT NULL::text)
 RETURNS meetings
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare m public.meetings%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','sales','project_manager','designer','site_engineer','finance','procurement','hr') then
    raise exception 'Meeting finalisation denied';
  end if;
  select * into m from public.meetings where id=p_meeting_id for update;
  if m.id is null or m.status not in ('scheduled','in_progress') then raise exception 'Meeting is not open'; end if;
  update public.meetings set status='completed',minutes_summary=coalesce(nullif(trim(p_summary),''),minutes_summary),
    completed_by=(select auth.uid()),completed_at=now(),updated_at=now()
  where id=m.id returning * into m;
  return m;
end $function$;

CREATE OR REPLACE FUNCTION public.generate_payroll_run(p_business_unit_id uuid, p_period_month date)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare run_id uuid; period_start date; period_end date; no text;
begin
  if public.current_app_role() not in ('founder','admin','hr') then raise exception 'Payroll generation denied'; end if;
  period_start:=date_trunc('month',p_period_month)::date;
  period_end:=(period_start + interval '1 month' - interval '1 day')::date;

  select id into run_id from public.payroll_runs
  where business_unit_id is not distinct from p_business_unit_id and period_month=period_start and status<>'cancelled'
  limit 1;
  if run_id is not null then return run_id; end if;

  no:=public.next_erp_number('payroll',period_start);
  insert into public.payroll_runs(business_unit_id,run_no,period_month,status,prepared_by)
  values(p_business_unit_id,no,period_start,'draft',(select auth.uid()))
  returning id into run_id;

  insert into public.payroll_entries(
    payroll_run_id,employee_id,fixed_gross,variable_earnings,deductions,gross_pay,net_pay
  )
  select
    run_id,e.id,
    coalesce(comp.monthly_fixed_gross,0),
    coalesce(inp.earnings,0),
    coalesce(inp.deductions,0),
    coalesce(comp.monthly_fixed_gross,0)+coalesce(inp.earnings,0),
    greatest(0,coalesce(comp.monthly_fixed_gross,0)+coalesce(inp.earnings,0)-coalesce(inp.deductions,0))
  from public.employees e
  left join lateral (
    select c.monthly_fixed_gross from public.employee_compensation c
    where c.employee_id=e.id and c.effective_from<=period_end
    order by c.effective_from desc limit 1
  ) comp on true
  left join lateral (
    select
      sum(amount) filter(where input_type='earning' and status='approved') earnings,
      sum(amount) filter(where input_type='deduction' and status='approved') deductions
    from public.payroll_inputs i
    where i.employee_id=e.id and i.period_month=period_start
  ) inp on true
  where e.business_unit_id is not distinct from p_business_unit_id
    and e.joining_date<=period_end
    and (e.exit_date is null or e.exit_date>=period_start)
    and e.status in ('active','on_leave');

  update public.payroll_runs r set
    total_fixed=x.fixed,total_earnings=x.earn,total_deductions=x.ded,
    total_gross=x.gross,total_net=x.net,updated_at=now()
  from (
    select payroll_run_id,
      coalesce(sum(fixed_gross),0) fixed,coalesce(sum(variable_earnings),0) earn,
      coalesce(sum(deductions),0) ded,coalesce(sum(gross_pay),0) gross,coalesce(sum(net_pay),0) net
    from public.payroll_entries where payroll_run_id=run_id group by payroll_run_id
  ) x where r.id=x.payroll_run_id;

  return run_id;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_attendance_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role();
begin
  new.updated_at:=now();
  if v_role not in ('founder','admin','hr','project_manager','site_engineer') then
    raise exception 'Attendance access denied';
  end if;

  if v_role in ('project_manager','site_engineer') then
    if new.project_id is null or not exists(
      select 1 from public.project_allocations a
      where a.employee_id=new.employee_id and a.project_id=new.project_id
        and a.status='active' and a.start_date<=new.on_date
        and coalesce(a.end_date,'9999-12-31'::date)>=new.on_date
    ) then raise exception 'Employee is not actively allocated to this project'; end if;
  end if;

  if new.status in ('present','wfh','half_day') and exists(
    select 1 from public.leave_requests l
    where l.employee_id=new.employee_id and l.status='approved'
      and new.on_date between l.from_date and l.to_date
  ) then raise exception 'Employee has approved leave on this date'; end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_construction_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); v_bad int;
begin
  new.updated_at:=now();

  if new.progress_pct<old.progress_pct and v_role not in ('founder','admin','project_manager') then
    raise exception 'Only Founder/Admin/Project Manager can reduce recorded progress';
  end if;

  if (new.status='completed' or new.progress_pct>=100)
     and (old.status is distinct from 'completed' or old.progress_pct<100) then
    if v_role not in ('founder','admin','project_manager') then
      raise exception 'Founder/Admin/Project Manager must approve stage completion';
    end if;

    if new.requires_inspection and not exists(
      select 1 from public.site_inspections i
      where i.stage_id=new.id and i.status='completed' and i.outcome='pass'
    ) then
      raise exception 'A passed inspection is required before completing this stage';
    end if;

    select count(*) into v_bad from public.quality_checks q
    where q.stage_id=new.id and q.result='fail' and q.status='open';
    if v_bad>0 then raise exception 'Close failed quality checks before completing this stage'; end if;

    select count(*) into v_bad from public.site_issues s
    where s.stage_id=new.id and s.severity='critical' and s.status in ('open','in_progress');
    if v_bad>0 then raise exception 'Resolve critical site issues before completing this stage'; end if;

    new.status:='completed';
    new.progress_pct:=100;
    new.actual_start:=coalesce(new.actual_start,current_date);
    new.actual_end:=coalesce(new.actual_end,current_date);
    new.completed_by:=coalesce(new.completed_by,(select auth.uid()));
  elsif new.progress_pct>0 and new.status='not_started' then
    new.status:='in_progress';
    new.actual_start:=coalesce(new.actual_start,current_date);
  elsif old.status='completed' and new.status<>'completed' then
    if v_role not in ('founder','admin','project_manager') then
      raise exception 'Only Founder/Admin/Project Manager can reopen a completed stage';
    end if;
    new.actual_end:=null; new.completed_by:=null;
    if new.progress_pct>=100 then new.progress_pct:=99; end if;
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_document_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); next_no integer; approval_required boolean;
begin
  if tg_op='INSERT' then
    if new.status<>'draft' then raise exception 'New revision must start as draft'; end if;
    select coalesce(max(r.revision_no),-1)+1 into next_no
    from public.document_revisions r where r.document_id=new.document_id;
    if new.revision_no<>next_no or new.revision_code<>('R'||next_no) then
      raise exception 'Revision sequence must be R%',next_no;
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Issued document revisions cannot be deleted'; end if;
    return old;
  end if;

  if old.status<>'draft' and (
    new.document_id is distinct from old.document_id or new.revision_no is distinct from old.revision_no
    or new.revision_code is distinct from old.revision_code or new.file_name is distinct from old.file_name
    or new.storage_path is distinct from old.storage_path or new.mime_type is distinct from old.mime_type
    or new.size_bytes is distinct from old.size_bytes or new.issue_purpose is distinct from old.issue_purpose
    or new.note is distinct from old.note or new.uploaded_by is distinct from old.uploaded_by
  ) then raise exception 'Issued document revision content is immutable'; end if;

  if new.status is distinct from old.status then
    select requires_approval into approval_required
    from public.project_documents where id=old.document_id;

    if old.status='draft' and new.status='issued' then
      if v_role not in ('founder','admin','project_manager','designer','site_engineer','procurement') then raise exception 'Document issue denied'; end if;
      if new.issued_by is null or new.issued_at is null then raise exception 'Use document issue workflow'; end if;
    elsif old.status='issued' and new.status='approved' then
      if approval_required and v_role not in ('founder','admin','project_manager') then
        raise exception 'Document approval denied';
      end if;
    elsif old.status='issued' and new.status='rejected' then
      if v_role not in ('founder','admin','project_manager') then raise exception 'Document review denied'; end if;
    elsif old.status='approved' and new.status='superseded' then
      if v_role not in ('founder','admin','project_manager') then raise exception 'Document supersede denied'; end if;
    else
      raise exception 'Invalid revision transition % → %',old.status,new.status;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_erp_notification_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.business_unit_id is distinct from old.business_unit_id
     or new.fingerprint is distinct from old.fingerprint
     or new.kind is distinct from old.kind
     or new.severity is distinct from old.severity
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id
     or new.target_role is distinct from old.target_role
     or new.target_user_id is distinct from old.target_user_id
     or new.occurred_on is distinct from old.occurred_on
     or new.created_at is distinct from old.created_at then
    raise exception 'Notification content and routing are immutable';
  end if;

  if new.status is distinct from old.status then
    if old.status='unread' and new.status='read' then
      new.read_at:=coalesce(new.read_at,now());
    elsif new.status='dismissed' then
      new.read_at:=coalesce(new.read_at,now());
    elsif old.status='read' and new.status='unread' then
      new.read_at:=null;
    else
      raise exception 'Invalid notification status transition';
    end if;
  elsif new.read_at is distinct from old.read_at then
    raise exception 'Notification read timestamp is managed by status';
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_goal_weight()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare total_w numeric;
begin
  new.updated_at:=now();
  if new.status<>'cancelled' then
    select coalesce(sum(g.weight_pct),0) into total_w
    from public.performance_goals g
    where g.cycle_id=new.cycle_id and g.employee_id=new.employee_id
      and g.id<>new.id and g.status<>'cancelled';
    if total_w+new.weight_pct>100.001 then raise exception 'KPI weights exceed 100%% for this employee/cycle'; end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_issued_invoice_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_receipts numeric;
begin
  if old.invoice_no is not null then
    if new.invoice_no is distinct from old.invoice_no
       or new.business_unit_id is distinct from old.business_unit_id
       or new.lead_id is distinct from old.lead_id
       or new.project_id is distinct from old.project_id
       or new.client_id is distinct from old.client_id
       or new.proforma_id is distinct from old.proforma_id
       or new.milestone_name is distinct from old.milestone_name
       or new.milestone_pct is distinct from old.milestone_pct
       or new.subtotal is distinct from old.subtotal
       or new.discount is distinct from old.discount
       or new.tax_rate is distinct from old.tax_rate
       or new.tax_amount is distinct from old.tax_amount
       or new.total is distinct from old.total
       or new.issue_date is distinct from old.issue_date
       or new.place_of_supply_state_code is distinct from old.place_of_supply_state_code
       or new.is_interstate is distinct from old.is_interstate then
      raise exception 'Issued invoice financial fields are immutable. Use cancellation or a credit note.';
    end if;
  end if;

  if new.status='cancelled' then
    if coalesce(new.cancellation_reason,'')='' or new.cancelled_at is null then
      raise exception 'Invoice cancellation requires reason and timestamp';
    end if;
    if coalesce(old.amount_paid,0)>0 or coalesce(old.credited_amount,0)>0 then
      raise exception 'Paid or credited invoices cannot be cancelled directly';
    end if;
  else
    select coalesce(sum(r.amount),0) into v_receipts
    from public.receipts r
    where r.invoice_id=old.id and r.status='issued';

    if new.amount_paid is distinct from old.amount_paid
       and abs(coalesce(new.amount_paid,0)-v_receipts)>0.01 then
      raise exception 'Invoice paid amount must reconcile to issued receipts';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_issued_proforma_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_receipts numeric;
begin
  if old.proforma_no is not null then
    if new.proforma_no is distinct from old.proforma_no
       or new.business_unit_id is distinct from old.business_unit_id
       or new.lead_id is distinct from old.lead_id
       or new.project_id is distinct from old.project_id
       or new.client_id is distinct from old.client_id
       or new.proposal_id is distinct from old.proposal_id
       or new.subtotal is distinct from old.subtotal
       or new.discount is distinct from old.discount
       or new.tax_rate is distinct from old.tax_rate
       or new.tax_amount is distinct from old.tax_amount
       or new.total is distinct from old.total
       or new.issue_date is distinct from old.issue_date
       or new.milestone_name is distinct from old.milestone_name
       or new.milestone_pct is distinct from old.milestone_pct
       or new.place_of_supply_state_code is distinct from old.place_of_supply_state_code
       or new.is_interstate is distinct from old.is_interstate then
      raise exception 'Issued proforma financial fields are immutable. Cancel and reissue if required.';
    end if;
  end if;

  if new.status='cancelled' then
    if coalesce(new.cancellation_reason,'')='' or new.cancelled_at is null then
      raise exception 'Proforma cancellation requires reason and timestamp';
    end if;
    if coalesce(old.amount_paid,0)>0 then
      raise exception 'Paid proformas cannot be cancelled directly';
    end if;
  else
    select coalesce(sum(r.amount),0) into v_receipts
    from public.receipts r
    where r.proforma_id=old.id and r.status='issued';

    if new.amount_paid is distinct from old.amount_paid
       and abs(coalesce(new.amount_paid,0)-v_receipts)>0.01 then
      raise exception 'Proforma paid amount must reconcile to issued receipts';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_leave_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role();
begin
  new.updated_at:=now();
  if new.to_date<new.from_date then raise exception 'Leave end date cannot be before start date'; end if;

  if tg_op='INSERT' and new.status not in ('draft','submitted') and v_role not in ('founder','admin','hr') then
    raise exception 'Employees cannot self-approve leave';
  end if;

  if new.status in ('submitted','approved') and exists(
    select 1 from public.leave_requests l
    where l.employee_id=new.employee_id and l.id<>new.id
      and l.status in ('submitted','approved')
      and daterange(l.from_date,l.to_date,'[]') && daterange(new.from_date,new.to_date,'[]')
  ) then raise exception 'Overlapping leave request exists'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_leave_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); own boolean;
begin
  new.updated_at:=now();
  select exists(select 1 from public.employees e where e.id=old.employee_id and e.profile_id=(select auth.uid())) into own;

  if old.status in ('approved','rejected','cancelled') and new is distinct from old then
    if v_role not in ('founder','admin','hr') then raise exception 'Final leave decision is locked'; end if;
  end if;

  if new.status is distinct from old.status then
    if old.status='draft' and new.status='submitted' then
      if v_role not in ('founder','admin','hr') and not own then raise exception 'Leave submission denied'; end if;
    elsif old.status='submitted' and new.status in ('approved','rejected') then
      if v_role not in ('founder','admin','hr') then raise exception 'Leave approval denied'; end if;
    elsif old.status in ('draft','submitted') and new.status='cancelled' then
      if v_role not in ('founder','admin','hr') and not own then raise exception 'Leave cancellation denied'; end if;
    elsif new.status is distinct from old.status then
      raise exception 'Invalid leave status transition % → %',old.status,new.status;
    end if;
  end if;

  if old.status<>'draft' and (
    new.employee_id is distinct from old.employee_id or
    new.leave_type_id is distinct from old.leave_type_id or
    new.from_date is distinct from old.from_date or new.to_date is distinct from old.to_date or
    new.days is distinct from old.days or new.reason is distinct from old.reason
  ) then
    raise exception 'Submitted leave details are locked';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_material_requisition_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role();
begin
  new.updated_at:=now();

  if old.status<>'draft' then
    if new.project_id is distinct from old.project_id
       or new.business_unit_id is distinct from old.business_unit_id
       or new.requested_by is distinct from old.requested_by
       or new.required_by is distinct from old.required_by
       or new.purpose is distinct from old.purpose
       or new.priority is distinct from old.priority
       or new.requisition_no is distinct from old.requisition_no then
      raise exception 'Submitted requisition core fields are locked';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status='draft' and new.status='submitted' then
      if new.requisition_no is null then raise exception 'Submit requisition through ERP workflow'; end if;

    elsif old.status='submitted' and new.status in ('approved','rejected') then
      if v_role not in ('founder','admin','project_manager') then raise exception 'Management approval required'; end if;

    elsif old.status in ('approved','sourcing') and new.status in ('sourcing','ordered') then
      if v_role not in ('founder','admin','procurement','project_manager') then raise exception 'Procurement status change denied'; end if;

    elsif old.status='ordered' and new.status='closed' then
      if v_role not in ('founder','admin','procurement','project_manager','site_engineer') then
        raise exception 'Requisition close denied';
      end if;
      if not exists(
        select 1 from public.purchase_orders p
        where p.requisition_id=old.id and p.status='delivered'
      ) then raise exception 'Requisition can close only after linked PO delivery'; end if;

    elsif new.status='cancelled' then
      if v_role not in ('founder','admin','project_manager') then raise exception 'Cancellation denied'; end if;

    else
      raise exception 'Invalid requisition status transition % → %',old.status,new.status;
    end if;
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_meeting_action_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role();
begin
  new.updated_at:=now();
  if old.status in ('done','cancelled') and new is distinct from old then
    raise exception 'Closed meeting action is immutable';
  end if;

  if new.status is distinct from old.status then
    if new.status='done' then
      if v_role not in ('founder','admin','project_manager') and old.owner_profile_id is distinct from (select auth.uid()) then
        raise exception 'Only action owner or management can close action';
      end if;
      new.completed_by:=(select auth.uid()); new.completed_at:=now();
    elsif new.status='in_progress' then
      if v_role not in ('founder','admin','project_manager') and old.owner_profile_id is distinct from (select auth.uid()) then
        raise exception 'Only action owner or management can update action';
      end if;
    elsif new.status='cancelled' then
      if v_role not in ('founder','admin','project_manager') then raise exception 'Action cancellation denied'; end if;
    else
      raise exception 'Invalid action status transition';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_meeting_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare st text; mid uuid;
begin
  mid:=coalesce(new.meeting_id,old.meeting_id);
  select status into st from public.meetings where id=mid;
  if st='completed' then raise exception 'Completed meeting minutes are locked'; end if;
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.guard_meeting_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role();
begin
  new.updated_at:=now();
  if old.status='completed' and (
    new.title is distinct from old.title or new.project_id is distinct from old.project_id
    or new.scheduled_at is distinct from old.scheduled_at or new.meeting_type is distinct from old.meeting_type
    or new.agenda is distinct from old.agenda or new.minutes_summary is distinct from old.minutes_summary
  ) then raise exception 'Completed MOM header is locked'; end if;

  if new.meeting_no is distinct from old.meeting_no then raise exception 'Meeting number is immutable'; end if;

  if new.status is distinct from old.status then
    if old.status in ('scheduled','in_progress') and new.status='completed' then
      if new.completed_by is null or new.completed_at is null then raise exception 'Use MOM finalisation workflow'; end if;
    elsif old.status='scheduled' and new.status='in_progress' then
      if v_role is null then raise exception 'Meeting access denied'; end if;
    elsif new.status='cancelled' then
      if v_role not in ('founder','admin','project_manager','sales') then raise exception 'Meeting cancellation denied'; end if;
    else
      raise exception 'Invalid meeting status transition % → %',old.status,new.status;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_payroll_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare rid uuid; st text;
begin
  rid:=coalesce(new.payroll_run_id,old.payroll_run_id);
  select status into st from public.payroll_runs where id=rid;
  if st<>'draft' then raise exception 'Payroll entries are locked after submission'; end if;
  if public.current_app_role() not in ('founder','admin','hr') then raise exception 'Payroll entry access denied'; end if;
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.guard_payroll_run()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role();
begin
  new.updated_at:=now();
  if old.status<>'draft' and (
    new.business_unit_id is distinct from old.business_unit_id or
    new.period_month is distinct from old.period_month or
    new.total_fixed is distinct from old.total_fixed or new.total_earnings is distinct from old.total_earnings or
    new.total_deductions is distinct from old.total_deductions or new.total_gross is distinct from old.total_gross or
    new.total_net is distinct from old.total_net
  ) then raise exception 'Payroll totals are locked after submission'; end if;

  if new.status is distinct from old.status then
    if old.status='draft' and new.status='review' then
      if v_role not in ('founder','admin','hr') then raise exception 'Payroll submission denied'; end if;
    elsif old.status='review' and new.status='approved' then
      if v_role not in ('founder','admin') then raise exception 'Payroll approval denied'; end if;
    elsif old.status='approved' and new.status='paid' then
      if v_role not in ('founder','admin','finance') then raise exception 'Payroll payment denied'; end if;
    elsif new.status='cancelled' then
      if v_role not in ('founder','admin') then raise exception 'Payroll cancellation denied'; end if;
    else
      raise exception 'Invalid payroll status transition % → %',old.status,new.status;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_payroll_run_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.current_app_role() not in ('founder','admin','hr') then raise exception 'Payroll creation denied'; end if;
  if new.status<>'draft' then raise exception 'New payroll run must start as draft'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_po_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare st text; poid uuid;
begin
  poid:=coalesce(new.po_id,old.po_id);
  select status into st from public.purchase_orders where id=poid;
  if st in ('approved','ordered','partly_delivered','delivered','cancelled') then
    if tg_op='UPDATE'
       and new.received_qty is distinct from old.received_qty
       and new.material_id is not distinct from old.material_id
       and new.description is not distinct from old.description
       and new.qty is not distinct from old.qty
       and new.unit is not distinct from old.unit
       and new.rate is not distinct from old.rate
       and new.gst_rate is not distinct from old.gst_rate then
      return new;
    end if;
    raise exception 'Approved purchase-order commercial lines are locked';
  end if;
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.guard_portal_approval_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.current_app_role() is null and exists(
    select 1 from public.projects p
    where p.id=old.project_id and p.client_id is not null
      and public.has_client_portal_access(p.client_id)
  ) then
    if old.status<>'pending' or new.status not in ('approved','changes_requested') then
      raise exception 'Invalid client approval transition';
    end if;
    if new.project_id is distinct from old.project_id
       or new.title is distinct from old.title
       or new.entity_type is distinct from old.entity_type
       or new.entity_id is distinct from old.entity_id
       or new.amount is distinct from old.amount
       or new.requested_by is distinct from old.requested_by then
      raise exception 'Client cannot alter approval request details';
    end if;
    if new.decided_by is not null then raise exception 'Portal decision must not impersonate an internal profile'; end if;
    if new.portal_decided_by is distinct from (select auth.uid()) then raise exception 'Portal decision identity mismatch'; end if;
    if new.decided_at is null then raise exception 'Decision timestamp required'; end if;
  end if;
  new.updated_at:=now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_project_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare total_pct numeric;
begin
  new.updated_at:=now();
  if new.status in ('planned','active') then
    select coalesce(sum(a.allocation_pct),0) into total_pct
    from public.project_allocations a
    where a.employee_id=new.employee_id and a.id<>new.id
      and a.status in ('planned','active')
      and daterange(a.start_date,coalesce(a.end_date,'9999-12-31'::date),'[]')
          && daterange(new.start_date,coalesce(new.end_date,'9999-12-31'::date),'[]');
    if total_pct+new.allocation_pct>100.001 then
      raise exception 'Employee allocation exceeds 100%% for the overlapping period';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_project_document_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); rev_status text;
begin
  new.updated_at:=now();

  if new.document_no is distinct from old.document_no then raise exception 'Document number is immutable'; end if;

  if old.status<>'draft' and (
    new.project_id is distinct from old.project_id or new.document_type is distinct from old.document_type
    or new.discipline is distinct from old.discipline or new.requires_approval is distinct from old.requires_approval
  ) then raise exception 'Issued document control fields are locked'; end if;

  if new.client_visible is distinct from old.client_visible
     and v_role not in ('founder','admin','project_manager') then
    raise exception 'Client visibility control is management-only';
  end if;

  if new.status is distinct from old.status then
    if new.current_revision_id is not null then
      select status into rev_status from public.document_revisions where id=new.current_revision_id and document_id=old.id;
    end if;

    if new.status='under_review' then
      if not exists(select 1 from public.document_revisions r where r.document_id=old.id and r.status='issued') then
        raise exception 'Under-review document requires an issued revision';
      end if;
    elsif new.status='approved' then
      if new.current_revision_id is null or rev_status<>'approved' then
        -- no-approval issue function sets revision approved before header and supplies current id
        if not exists(select 1 from public.document_revisions r where r.document_id=old.id and r.status='approved') then
          raise exception 'Approved document requires an approved revision';
        end if;
      end if;
    elsif new.status='rejected' then
      if not exists(select 1 from public.document_revisions r where r.document_id=old.id and r.status='rejected') then
        raise exception 'Rejected document requires a rejected revision';
      end if;
    elsif new.status='archived' then
      if v_role not in ('founder','admin','project_manager') then raise exception 'Document archive denied'; end if;
    elsif new.status not in ('draft','superseded') then
      raise exception 'Invalid document status';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_purchase_order_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_role text:=public.current_app_role();
  v_ordered_qty numeric;
  v_received_qty numeric;
begin
  new.updated_at:=now();

  if old.status<>'draft' then
    if new.business_unit_id is distinct from old.business_unit_id
       or new.project_id is distinct from old.project_id
       or new.vendor_id is distinct from old.vendor_id
       or new.requisition_id is distinct from old.requisition_id
       or new.quote_id is distinct from old.quote_id
       or new.subtotal is distinct from old.subtotal
       or new.tax_amount is distinct from old.tax_amount
       or new.total is distinct from old.total
       or new.payment_terms is distinct from old.payment_terms then
      raise exception 'Submitted purchase-order commercial fields are locked';
    end if;
  end if;

  if old.status not in ('draft','approval') then
    if new.po_no is distinct from old.po_no
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at then
      raise exception 'Issued PO approval metadata is immutable';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status='draft' and new.status='approval' then
      if v_role not in ('founder','admin','procurement','project_manager') then raise exception 'PO submission denied'; end if;

    elsif old.status='approval' and new.status='approved' then
      if v_role not in ('founder','admin','project_manager') then raise exception 'PO approval denied'; end if;
      if new.po_no is null or new.approved_by is null or new.approved_at is null then raise exception 'Use PO approval workflow'; end if;

    elsif old.status='approved' and new.status='ordered' then
      if v_role not in ('founder','admin','procurement','project_manager') then raise exception 'PO ordering denied'; end if;

    elsif old.status in ('approved','ordered','partly_delivered') and new.status in ('partly_delivered','delivered') then
      if v_role not in ('founder','admin','procurement','project_manager','site_engineer') then raise exception 'Delivery update denied'; end if;
      select coalesce(sum(pi.qty),0),coalesce(sum(pi.received_qty),0)
        into v_ordered_qty,v_received_qty from public.po_items pi where pi.po_id=old.id;
      if new.status='delivered' and v_received_qty+0.001<v_ordered_qty then raise exception 'PO cannot be delivered before all quantities are received'; end if;
      if new.status='partly_delivered' and (v_received_qty<=0 or v_received_qty+0.001>=v_ordered_qty) then raise exception 'PO partial-delivery status does not match received quantities'; end if;

    elsif new.status='cancelled' then
      if v_role not in ('founder','admin','project_manager') then raise exception 'PO cancellation denied'; end if;

    else
      raise exception 'Invalid PO status transition % → %',old.status,new.status;
    end if;
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_quote_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare st text; qid uuid; q public.vendor_quotes%rowtype; snap public.vendor_rfq_items%rowtype;
begin
  qid:=coalesce(new.quote_id,old.quote_id);
  select * into q from public.vendor_quotes where id=qid;
  st:=q.status;
  if st in ('selected','rejected') then raise exception 'Selected/rejected quotation items are locked'; end if;

  if public.current_app_role() is null then
    if tg_op<>'INSERT' then raise exception 'Vendor portal quote lines are append-only'; end if;
    if q.id is null or not public.has_vendor_portal_access(q.vendor_id) then raise exception 'Vendor quote access denied'; end if;
    select i.* into snap
    from public.vendor_rfq_items i
    join public.vendor_rfq_invites r on r.id=i.invite_id
    where r.requisition_id=q.requisition_id and r.vendor_id=q.vendor_id
      and r.status in ('invited','viewed')
      and i.requisition_item_id=new.requisition_item_id;
    if snap.id is null then raise exception 'Quote line must match an invited RFQ item'; end if;
    if new.rate<0 or new.gst_rate<0 or new.gst_rate>100 then raise exception 'Invalid quote rate or GST rate'; end if;
    new.material_id:=snap.material_id;
    new.description:=snap.description;
    new.qty:=snap.qty;
    new.unit:=snap.unit;
  end if;
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.guard_receipt_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_pi uuid;
begin
  if new.receipt_no is distinct from old.receipt_no
     or new.business_unit_id is distinct from old.business_unit_id
     or new.proforma_id is distinct from old.proforma_id
     or new.client_id is distinct from old.client_id
     or new.project_id is distinct from old.project_id
     or new.receipt_date is distinct from old.receipt_date
     or new.amount is distinct from old.amount
     or new.payment_mode is distinct from old.payment_mode
     or new.reference_no is distinct from old.reference_no then
    raise exception 'Issued receipt details are immutable. Cancel the receipt and issue a new one.';
  end if;

  if new.invoice_id is distinct from old.invoice_id then
    if old.invoice_id is not null or new.invoice_id is null or old.proforma_id is null then
      raise exception 'Receipt invoice linkage cannot be changed';
    end if;
    select i.proforma_id into v_pi from public.invoices i where i.id=new.invoice_id;
    if v_pi is distinct from old.proforma_id then
      raise exception 'Receipt can only link to the GST invoice created from its proforma';
    end if;
  end if;

  if old.status<>'cancelled' and new.status='cancelled' then
    if coalesce(new.cancellation_reason,'')='' or new.cancelled_at is null then
      raise exception 'Receipt cancellation requires reason and timestamp';
    end if;
  elsif old.status='cancelled' and new.status<>'cancelled' then
    raise exception 'Cancelled receipts cannot be reactivated';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_reimbursement_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); own boolean;
begin
  select exists(select 1 from public.employees e where e.id=new.employee_id and e.profile_id=(select auth.uid())) into own;
  if v_role not in ('founder','admin','hr','finance') and not own then
    raise exception 'Reimbursement access denied';
  end if;
  if new.status<>'draft' then raise exception 'New reimbursement must start as draft'; end if;
  new.updated_at:=now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_reimbursement_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); own boolean;
begin
  new.updated_at:=now();
  select exists(select 1 from public.employees e where e.id=old.employee_id and e.profile_id=(select auth.uid())) into own;

  if old.status='paid' and new is distinct from old then raise exception 'Paid reimbursement is immutable'; end if;

  if old.status<>'draft' and (
    new.employee_id is distinct from old.employee_id or new.project_id is distinct from old.project_id or
    new.expense_date is distinct from old.expense_date or new.amount is distinct from old.amount or
    new.description is distinct from old.description or new.category is distinct from old.category or
    new.receipt_ref is distinct from old.receipt_ref
  ) then raise exception 'Submitted reimbursement details are locked'; end if;

  if new.status is distinct from old.status then
    if old.status='draft' and new.status='submitted' then
      if v_role not in ('founder','admin','hr','finance') and not own then raise exception 'Reimbursement submission denied'; end if;
    elsif old.status='submitted' and new.status in ('hr_verified','rejected') then
      if v_role not in ('founder','admin','hr') then raise exception 'HR verification required'; end if;
    elsif old.status='hr_verified' and new.status in ('approved','rejected') then
      if v_role not in ('founder','admin','finance') then raise exception 'Finance approval required'; end if;
    elsif old.status='approved' and new.status='paid' then
      if v_role not in ('founder','admin','finance') then raise exception 'Finance payment access required'; end if;
    elsif old.status in ('draft','submitted') and new.status='cancelled' then
      if v_role not in ('founder','admin','hr','finance') and not own then raise exception 'Reimbursement cancellation denied'; end if;
    else
      raise exception 'Invalid reimbursement status transition % → %',old.status,new.status;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_requisition_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare st text; rid uuid;
begin
  rid:=coalesce(new.requisition_id,old.requisition_id);
  select status into st from public.material_requisitions where id=rid;
  if st<>'draft' then raise exception 'Requisition items are locked after submission'; end if;
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.guard_site_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role();
begin
  new.updated_at:=now();
  if old.status='approved' and new is distinct from old then
    raise exception 'Approved site reports are immutable';
  end if;
  if old.status='submitted' then
    if new.status='approved' and v_role not in ('founder','admin','project_manager') then
      raise exception 'Project Manager approval required';
    elsif new.status='rejected' and v_role not in ('founder','admin','project_manager') then
      raise exception 'Project Manager review required';
    elsif new.status not in ('submitted','approved','rejected') then
      raise exception 'Submitted report must be approved or rejected';
    elsif new.status='submitted' and new is distinct from old then
      raise exception 'Submitted site reports are locked';
    end if;
  end if;
  if old.status='rejected' and new.status='draft' and v_role not in ('founder','admin','project_manager') then
    raise exception 'Only management can reopen a rejected report';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_stock_ledger_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  raise exception 'Stock ledger rows are immutable. Post a reversing movement instead.';
end $function$;

CREATE OR REPLACE FUNCTION public.guard_stock_ledger_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare bal numeric; v_role text:=public.current_app_role();
begin
  if new.movement_type in ('issue_out','adjust_out','transfer_out') then
    select qty into bal from public.stock_balances where store_id=new.store_id and material_id=new.material_id;
    bal:=coalesce(bal,0);
    if new.qty>bal+0.001 then raise exception 'Insufficient stock. Available %',bal; end if;
  end if;

  if new.movement_type='grn_in' then
    if new.reference_type<>'grn' or new.reference_id is null or not exists(
      select 1 from public.goods_receipts g
      where g.id=new.reference_id and g.store_id=new.store_id and g.project_id is not distinct from new.project_id
    ) then raise exception 'GRN stock inward requires a valid goods receipt'; end if;
  end if;

  if new.movement_type='issue_out' and nullif(trim(new.purpose),'') is null then
    raise exception 'Stock issue purpose is required';
  end if;

  if new.movement_type in ('adjust_in','adjust_out') then
    if v_role not in ('founder','admin','procurement','project_manager') then raise exception 'Stock adjustment access denied'; end if;
    if nullif(trim(new.purpose),'') is null then raise exception 'Adjustment reason is required'; end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_vendor_bill_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); paid numeric;
begin
  new.updated_at:=now();

  if old.status in ('approved','part_paid','paid') then
    if new.vendor_id is distinct from old.vendor_id
       or new.project_id is distinct from old.project_id
       or new.po_id is distinct from old.po_id
       or new.grn_id is distinct from old.grn_id
       or new.bill_no is distinct from old.bill_no
       or new.bill_date is distinct from old.bill_date
       or new.subtotal is distinct from old.subtotal
       or new.tax_amount is distinct from old.tax_amount
       or new.total is distinct from old.total then
      raise exception 'Approved vendor bill commercial fields are locked';
    end if;
  end if;

  if new.amount_paid is distinct from old.amount_paid then
    select coalesce(sum(p.amount),0) into paid from public.vendor_payments p where p.vendor_bill_id=old.id;
    if abs(new.amount_paid-paid)>0.01 then raise exception 'Vendor bill paid amount must reconcile to payments'; end if;
  end if;

  if new.status is distinct from old.status then
    if old.status='draft' and new.status='verified' then
      if v_role not in ('founder','admin','procurement','finance') then raise exception 'Bill verification denied'; end if;
    elsif old.status in ('draft','verified') and new.status='approved' then
      if v_role not in ('founder','admin','finance') then raise exception 'Bill approval denied'; end if;
      if new.internal_no is null or new.expense_id is null or new.approved_by is null or new.approved_at is null then raise exception 'Use vendor-bill approval workflow'; end if;
    elsif old.status in ('approved','part_paid') and new.status in ('part_paid','paid') then
      if v_role not in ('founder','admin','finance') then raise exception 'Payment status update denied'; end if;
    elsif new.status in ('disputed','cancelled') then
      if v_role not in ('founder','admin','finance') then raise exception 'Bill status change denied'; end if;
    else
      raise exception 'Invalid vendor-bill status transition % → %',old.status,new.status;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_vendor_payment_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  raise exception 'Vendor payment rows are immutable. Post a correction/reversal instead.';
end $function$;

CREATE OR REPLACE FUNCTION public.guard_vendor_payment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare b public.vendor_bills%rowtype; paid numeric;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Vendor payment access denied'; end if;
  select * into b from public.vendor_bills where id=new.vendor_bill_id for update;
  if b.id is null or b.status not in ('approved','part_paid') then raise exception 'Payments require an approved vendor bill'; end if;
  perform public.assert_accounting_period_open(b.business_unit_id,new.payment_date);
  select coalesce(sum(amount),0) into paid from public.vendor_payments where vendor_bill_id=b.id;
  if paid+new.amount>b.total+0.01 then raise exception 'Vendor payment exceeds bill balance'; end if;
  if new.vendor_id is distinct from b.vendor_id or new.project_id is distinct from b.project_id then
    raise exception 'Vendor payment does not match bill vendor/project';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_vendor_quote_portal_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare s numeric:=0; t numeric:=0;
begin
  if public.current_app_role() is null and public.has_vendor_portal_access(old.vendor_id) then
    if new.requisition_id is distinct from old.requisition_id
       or new.vendor_id is distinct from old.vendor_id
       or new.quote_ref is distinct from old.quote_ref
       or new.quote_date is distinct from old.quote_date
       or new.valid_until is distinct from old.valid_until
       or new.delivery_days is distinct from old.delivery_days
       or new.payment_terms is distinct from old.payment_terms
       or new.status is distinct from old.status
       or new.notes is distinct from old.notes
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Submitted vendor quote header is locked';
    end if;
    select coalesce(sum(i.qty*i.rate),0),
           coalesce(sum((i.qty*i.rate)*(i.gst_rate/100.0)),0)
      into s,t from public.vendor_quote_items i where i.quote_id=old.id;
    new.subtotal:=round(s,2);
    new.tax_amount:=round(t,2);
    new.total:=round(s+t,2);
    new.updated_at:=now();
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_vendor_rfq_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare q public.vendor_quotes%rowtype; req_count int; quote_count int;
begin
  new.updated_at:=now();
  if public.current_app_role() is null and public.has_vendor_portal_access(old.vendor_id) then
    if new.requisition_id is distinct from old.requisition_id
       or new.vendor_id is distinct from old.vendor_id
       or new.project_id is distinct from old.project_id
       or new.requisition_no is distinct from old.requisition_no
       or new.required_by is distinct from old.required_by
       or new.purpose is distinct from old.purpose
       or new.priority is distinct from old.priority
       or new.due_date is distinct from old.due_date
       or new.note is distinct from old.note
       or new.invited_by is distinct from old.invited_by
       or new.invited_at is distinct from old.invited_at then
      raise exception 'RFQ request details are locked';
    end if;
    if old.status='invited' and new.status='viewed' then
      if new.viewed_at is null then new.viewed_at:=now(); end if;
    elsif old.status in ('invited','viewed') and new.status='responded' then
      if new.quote_id is null then raise exception 'Submitted quote required'; end if;
      select * into q from public.vendor_quotes where id=new.quote_id
        and requisition_id=old.requisition_id and vendor_id=old.vendor_id;
      if q.id is null then raise exception 'Quote does not belong to this RFQ'; end if;
      select count(*) into req_count from public.vendor_rfq_items where invite_id=old.id;
      select count(*) into quote_count from public.vendor_quote_items where quote_id=new.quote_id;
      if req_count=0 or quote_count<>req_count then raise exception 'Every RFQ line must be quoted'; end if;
      new.responded_at:=coalesce(new.responded_at,now());
    else
      raise exception 'Invalid vendor RFQ transition';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)),
    'viewer',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.has_client_portal_access(p_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.portal_memberships m
    where m.portal_type='client' and m.client_id=p_client_id
      and m.user_id=(select auth.uid()) and m.status='active'
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_vendor_portal_access(p_vendor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.portal_memberships m
    where m.portal_type='vendor' and m.vendor_id=p_vendor_id
      and m.user_id=(select auth.uid()) and m.status='active'
  )
$function$;

CREATE OR REPLACE FUNCTION public.invite_portal_member(p_portal_type text, p_entity_id uuid, p_email text, p_display_name text DEFAULT NULL::text)
 RETURNS portal_memberships
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); v_email text; r public.portal_memberships%rowtype;
begin
  v_email:=lower(trim(coalesce(p_email,'')));
  if v_email='' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Valid email required';
  end if;

  if p_portal_type='client' then
    if v_role not in ('founder','admin','sales','project_manager') then raise exception 'Client portal invite denied'; end if;
    if not exists(select 1 from public.clients where id=p_entity_id and deleted_at is null) then raise exception 'Client not found'; end if;
    select * into r from public.portal_memberships
      where portal_type='client' and client_id=p_entity_id and lower(email)=v_email and status<>'revoked'
      limit 1 for update;
    if r.id is null then
      insert into public.portal_memberships(portal_type,client_id,email,display_name,status,invited_by)
      values('client',p_entity_id,v_email,nullif(trim(p_display_name),''),'invited',(select auth.uid()))
      returning * into r;
    end if;
  elsif p_portal_type='vendor' then
    if v_role not in ('founder','admin','procurement') then raise exception 'Vendor portal invite denied'; end if;
    if not exists(select 1 from public.vendors where id=p_entity_id and status='active') then raise exception 'Vendor not found'; end if;
    select * into r from public.portal_memberships
      where portal_type='vendor' and vendor_id=p_entity_id and lower(email)=v_email and status<>'revoked'
      limit 1 for update;
    if r.id is null then
      insert into public.portal_memberships(portal_type,vendor_id,email,display_name,status,invited_by)
      values('vendor',p_entity_id,v_email,nullif(trim(p_display_name),''),'invited',(select auth.uid()))
      returning * into r;
    end if;
  else
    raise exception 'Invalid portal type';
  end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.invite_vendor_rfq(p_requisition_id uuid, p_vendor_id uuid, p_due_date date DEFAULT NULL::date, p_note text DEFAULT NULL::text)
 RETURNS vendor_rfq_invites
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); mr public.material_requisitions%rowtype; r public.vendor_rfq_invites%rowtype;
begin
  if v_role not in ('founder','admin','procurement','project_manager') then raise exception 'RFQ invite denied'; end if;
  select * into mr from public.material_requisitions where id=p_requisition_id for update;
  if mr.id is null or mr.status not in ('approved','sourcing') then raise exception 'Approved requisition required'; end if;
  if not exists(select 1 from public.vendors where id=p_vendor_id and status='active') then raise exception 'Active vendor required'; end if;

  select * into r from public.vendor_rfq_invites
  where requisition_id=p_requisition_id and vendor_id=p_vendor_id
  for update;
  if r.id is null then
    insert into public.vendor_rfq_invites(
      requisition_id,vendor_id,project_id,requisition_no,required_by,purpose,priority,due_date,note,status,invited_by
    ) values(
      mr.id,p_vendor_id,mr.project_id,mr.requisition_no,mr.required_by,mr.purpose,mr.priority,
      p_due_date,nullif(trim(p_note),''),'invited',(select auth.uid())
    ) returning * into r;

    insert into public.vendor_rfq_items(invite_id,requisition_item_id,material_id,description,qty,unit)
    select r.id,i.id,i.material_id,i.description,i.qty,i.unit
    from public.material_requisition_items i where i.requisition_id=mr.id;
  elsif r.status in ('invited','viewed') then
    update public.vendor_rfq_invites
    set due_date=p_due_date,note=nullif(trim(p_note),''),required_by=mr.required_by,
        purpose=mr.purpose,priority=mr.priority,project_id=mr.project_id,requisition_no=mr.requisition_no,updated_at=now()
    where id=r.id returning * into r;
  else
    raise exception 'RFQ already responded or closed';
  end if;

  if not exists(select 1 from public.vendor_rfq_items where invite_id=r.id) then
    insert into public.vendor_rfq_items(invite_id,requisition_item_id,material_id,description,qty,unit)
    select r.id,i.id,i.material_id,i.description,i.qty,i.unit
    from public.material_requisition_items i where i.requisition_id=mr.id;
  end if;

  if mr.status='approved' then
    update public.material_requisitions set status='sourcing',updated_at=now() where id=mr.id;
  end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.is_internal_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.current_app_role() in (
    'founder','admin','sales','project_manager','designer',
    'site_engineer','finance','procurement','hr','viewer'
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.issue_document_number(p_doc_type text, p_issue_date date DEFAULT CURRENT_DATE, p_lead_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid, p_client_id uuid DEFAULT NULL::uuid, p_amount numeric DEFAULT 0, p_status text DEFAULT 'issued'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_type text:=lower(trim(p_doc_type));
  v_no text;
  v_bu uuid;
begin
  if v_type not in ('estimate','proposal','proforma','receipt','invoice','credit_note') then
    raise exception 'Unsupported document type: %',p_doc_type;
  end if;
  if public.current_app_role() is null then raise exception 'ERP access denied'; end if;

  if v_type in ('proforma','receipt','invoice','credit_note') then
    if p_project_id is not null then
      select business_unit_id into v_bu from public.projects where id=p_project_id;
    end if;
    if v_bu is null and p_client_id is not null then
      select business_unit_id into v_bu from public.clients where id=p_client_id;
    end if;
    if v_bu is not null then perform public.assert_accounting_period_open(v_bu,p_issue_date); end if;
  end if;

  v_no:=public.next_erp_number(v_type,p_issue_date);

  insert into public.document_register(
    doc_type,document_no,lead_id,project_id,client_id,amount,status,issue_date,metadata
  ) values (
    v_type,v_no,p_lead_id,p_project_id,p_client_id,
    greatest(coalesce(p_amount,0),0),coalesce(nullif(p_status,''),'issued'),
    p_issue_date,coalesce(p_metadata,'{}'::jsonb)
  );

  return v_no;
end;
$function$;

CREATE OR REPLACE FUNCTION public.issue_document_revision(p_revision_id uuid, p_reviewer_id uuid DEFAULT NULL::uuid)
 RETURNS document_revisions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.document_revisions%rowtype; d public.project_documents%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','project_manager','designer','site_engineer','procurement') then
    raise exception 'Document issue access denied';
  end if;
  select * into r from public.document_revisions where id=p_revision_id for update;
  if r.id is null or r.status<>'draft' then raise exception 'Draft revision not found'; end if;
  select * into d from public.project_documents where id=r.document_id for update;

  update public.document_revisions
  set status='issued',issued_by=(select auth.uid()),issued_at=now()
  where id=r.id returning * into r;

  if d.requires_approval then
    update public.project_documents set status='under_review',updated_at=now() where id=d.id;
    insert into public.document_approvals(document_id,revision_id,reviewer_id,status,requested_by)
    values(d.id,r.id,p_reviewer_id,'pending',(select auth.uid()))
    on conflict(revision_id,reviewer_id) do nothing;
  else
    update public.document_revisions
    set status='approved' where id=r.id returning * into r;
    update public.document_revisions set status='superseded'
      where document_id=d.id and id<>r.id and status='approved';
    update public.project_documents
    set status='approved',current_revision=r.revision_no,current_revision_id=r.id,updated_at=now()
    where id=d.id;
  end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.issue_site_stock(p_store_id uuid, p_material_id uuid, p_qty numeric, p_purpose text, p_moved_on date DEFAULT CURRENT_DATE)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare s public.stores%rowtype; bal numeric; idv uuid; ratev numeric;
begin
  if public.current_app_role() not in ('founder','admin','procurement','project_manager','site_engineer') then raise exception 'Inventory access denied'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Issue quantity must be positive'; end if;
  select * into s from public.stores where id=p_store_id and status='active';
  if s.id is null then raise exception 'Store not found'; end if;
  select qty,last_rate into bal,ratev from public.stock_balances where store_id=p_store_id and material_id=p_material_id;
  bal:=coalesce(bal,0);
  if p_qty>bal+0.001 then raise exception 'Insufficient stock. Available %',bal; end if;

  insert into public.stock_ledger(
    business_unit_id,project_id,store_id,material_id,movement_type,qty,rate,purpose,moved_on
  ) values(s.business_unit_id,s.project_id,s.id,p_material_id,'issue_out',p_qty,coalesce(ratev,0),nullif(trim(p_purpose),''),p_moved_on)
  returning id into idv;
  return idv;
end $function$;

CREATE OR REPLACE FUNCTION public.management_dashboard(p_business_unit_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare out jsonb;
begin
  if public.current_app_role() is null then raise exception 'Internal ERP access required'; end if;
  if p_from is null or p_to is null or p_to<p_from then raise exception 'Invalid analytics range'; end if;

  with
  scoped_leads as (
    select * from public.leads l
    where l.deleted_at is null
      and (p_business_unit_id is null or l.business_unit_id is null or l.business_unit_id=p_business_unit_id)
  ),
  scoped_projects as (
    select * from public.projects p
    where p.deleted_at is null
      and (p_business_unit_id is null or p.business_unit_id is null or p.business_unit_id=p_business_unit_id)
  ),
  scoped_receipts as (
    select * from public.receipts r
    where r.status='issued'
      and r.receipt_date between p_from and p_to
      and (p_business_unit_id is null or r.business_unit_id is null or r.business_unit_id=p_business_unit_id)
  ),
  scoped_invoices as (
    select * from public.invoices i
    where i.deleted_at is null and i.status<>'cancelled'
      and (p_business_unit_id is null or i.business_unit_id is null or i.business_unit_id=p_business_unit_id)
  ),
  scoped_expenses as (
    select * from public.expenses e
    where e.status in ('approved','paid')
      and e.expense_date between p_from and p_to
      and (p_business_unit_id is null or e.business_unit_id is null or e.business_unit_id=p_business_unit_id)
  ),
  scoped_vendor_bills as (
    select * from public.vendor_bills v
    where v.status in ('approved','part_paid')
      and (p_business_unit_id is null or v.business_unit_id is null or v.business_unit_id=p_business_unit_id)
  ),
  scoped_pos as (
    select * from public.purchase_orders po
    where po.status in ('approval','approved','ordered','partly_delivered')
      and (p_business_unit_id is null or po.business_unit_id is null or po.business_unit_id=p_business_unit_id)
  ),
  scoped_employees as (
    select * from public.employees e
    where e.status in ('active','on_leave')
      and (p_business_unit_id is null or e.business_unit_id is null or e.business_unit_id=p_business_unit_id)
  ),
  month_series as (
    select gs::date month_start
    from generate_series(date_trunc('month',p_from)::date,date_trunc('month',p_to)::date,interval '1 month') gs
  ),
  monthly as (
    select m.month_start,
      coalesce((select sum(r.amount) from scoped_receipts r where date_trunc('month',r.receipt_date)::date=m.month_start),0) collections,
      coalesce((select sum(e.amount) from scoped_expenses e where date_trunc('month',e.expense_date)::date=m.month_start),0) booked_cost
    from month_series m
  ),
  project_cost as (
    select project_id,sum(amount) booked_cost
    from scoped_expenses where project_id is not null group by project_id
  ),
  project_receipts as (
    select project_id,sum(amount) collected
    from public.receipts r
    where r.status='issued' and project_id is not null
      and (p_business_unit_id is null or r.business_unit_id is null or r.business_unit_id=p_business_unit_id)
    group by project_id
  ),
  project_invoices as (
    select project_id,
      sum(greatest(total-coalesce(credited_amount,0),0)) billed,
      sum(greatest(total-coalesce(credited_amount,0)-amount_paid,0)) receivable
    from scoped_invoices where project_id is not null group by project_id
  )
  select jsonb_build_object(
    'range',jsonb_build_object('from',p_from,'to',p_to),
    'kpis',jsonb_build_object(
      'collections',coalesce((select sum(amount) from scoped_receipts),0),
      'booked_cost',coalesce((select sum(amount) from scoped_expenses),0),
      'invoiced',coalesce((select sum(greatest(total-coalesce(credited_amount,0),0)) from scoped_invoices where issue_date between p_from and p_to),0),
      'receivables',coalesce((select sum(greatest(total-coalesce(credited_amount,0)-amount_paid,0)) from scoped_invoices),0),
      'vendor_payables',coalesce((select sum(greatest(total-amount_paid,0)) from scoped_vendor_bills),0),
      'open_po_commitment',coalesce((select sum(total) from scoped_pos),0),
      'active_projects',(select count(*) from scoped_projects where status not in ('completed','cancelled')),
      'at_risk_projects',(select count(*) from scoped_projects where status not in ('completed','cancelled') and health in ('atrisk','at_risk','critical')),
      'overdue_projects',(select count(*) from scoped_projects where status not in ('completed','cancelled') and target_end_date is not null and target_end_date<current_date),
      'new_leads',(select count(*) from scoped_leads where created_at::date between p_from and p_to),
      'won_leads',(select count(*) from scoped_leads where stage='won' and updated_at::date between p_from and p_to),
      'lost_leads',(select count(*) from scoped_leads where stage='lost' and updated_at::date between p_from and p_to),
      'win_rate',coalesce(round(100.0*(select count(*) from scoped_leads where stage='won' and updated_at::date between p_from and p_to)
        / nullif((select count(*) from scoped_leads where stage in ('won','lost') and updated_at::date between p_from and p_to),0),1),0),
      'open_pipeline',coalesce((select sum(expected_value) from scoped_leads where stage not in ('won','lost')),0),
      'open_tasks',(select count(*) from public.tasks t where t.status not in ('done','cancelled')
        and (t.project_id is null or exists(select 1 from scoped_projects p where p.id=t.project_id))),
      'overdue_tasks',(select count(*) from public.tasks t where t.status not in ('done','cancelled') and t.due_at<now()
        and (t.project_id is null or exists(select 1 from scoped_projects p where p.id=t.project_id))),
      'pending_approvals',(select count(*) from public.approvals a where a.status='pending'
        and exists(select 1 from scoped_projects p where p.id=a.project_id)),
      'headcount',(select count(*) from scoped_employees),
      'avg_capacity',coalesce((select round(avg(x.pct),1) from (
        select e.id,coalesce(sum(a.allocation_pct),0) pct
        from scoped_employees e
        left join public.project_allocations a on a.employee_id=e.id and a.status='active'
          and a.start_date<=current_date and coalesce(a.end_date,'9999-12-31'::date)>=current_date
        group by e.id
      ) x),0)
    ),
    'monthly',coalesce((select jsonb_agg(jsonb_build_object(
      'month',to_char(month_start,'YYYY-MM'),'label',to_char(month_start,'Mon'),
      'collections',collections,'booked_cost',booked_cost
    ) order by month_start) from monthly),'[]'::jsonb),
    'pipeline',coalesce((select jsonb_agg(jsonb_build_object('stage',stage,'count',n,'value',value) order by n desc)
      from (select stage,count(*) n,coalesce(sum(expected_value),0) value from scoped_leads where stage not in ('won','lost') group by stage) s),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('source',source,'count',n,'value',value) order by n desc)
      from (select coalesce(nullif(trim(source),''),'Unknown') source,count(*) n,coalesce(sum(expected_value),0) value
            from scoped_leads where created_at::date between p_from and p_to group by 1) s),'[]'::jsonb),
    'expense_categories',coalesce((select jsonb_agg(jsonb_build_object('category',category,'amount',amount) order by amount desc)
      from (select coalesce(nullif(trim(category),''),'Other') category,sum(amount) amount from scoped_expenses group by 1) e),'[]'::jsonb),
    'project_health',coalesce((select jsonb_agg(jsonb_build_object('health',health,'count',n) order by n desc)
      from (select coalesce(nullif(trim(health),''),'unknown') health,count(*) n from scoped_projects
            where status not in ('completed','cancelled') group by 1) h),'[]'::jsonb),
    'top_projects',coalesce((select jsonb_agg(to_jsonb(x) order by x.contract_value desc)
      from (
        select p.id,p.project_no,p.code,p.name,p.status,p.health,p.progress_pct,p.contract_value,
          coalesce(pi.billed,0) billed,coalesce(pr.collected,0) collected,coalesce(pi.receivable,0) receivable,
          coalesce(pc.booked_cost,0) booked_cost
        from scoped_projects p
        left join project_invoices pi on pi.project_id=p.id
        left join project_receipts pr on pr.project_id=p.id
        left join project_cost pc on pc.project_id=p.id
        order by p.contract_value desc nulls last limit 10
      ) x),'[]'::jsonb),
    'risks',jsonb_build_object(
      'overdue_invoices',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'invoice_no',i.invoice_no,'project_id',i.project_id,'due_date',i.due_date,
        'balance',greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0)
      ) order by i.due_date) from scoped_invoices i
      where i.due_date<current_date and greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0)>0),'[]'::jsonb),
      'overdue_vendor_bills',coalesce((select jsonb_agg(jsonb_build_object(
        'id',v.id,'bill_no',coalesce(v.internal_no,v.bill_no),'project_id',v.project_id,'due_date',v.due_date,
        'balance',greatest(v.total-v.amount_paid,0)
      ) order by v.due_date) from scoped_vendor_bills v
      where v.due_date<current_date and greatest(v.total-v.amount_paid,0)>0),'[]'::jsonb)
    )
  ) into out;
  return out;
end $function$;

CREATE OR REPLACE FUNCTION public.mark_employee_attendance(p_employee_id uuid, p_on_date date, p_status text, p_project_id uuid DEFAULT NULL::uuid, p_check_in time without time zone DEFAULT NULL::time without time zone, p_check_out time without time zone DEFAULT NULL::time without time zone, p_note text DEFAULT NULL::text)
 RETURNS attendance
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); v public.attendance%rowtype;
begin
  if v_role not in ('founder','admin','hr','project_manager','site_engineer') then raise exception 'Attendance access denied'; end if;
  if p_status not in ('present','absent','leave','half_day','wfh','holiday','week_off') then raise exception 'Invalid attendance status'; end if;

  if v_role in ('project_manager','site_engineer') then
    if p_project_id is null or not exists(
      select 1 from public.project_allocations a
      where a.employee_id=p_employee_id and a.project_id=p_project_id and a.status='active'
        and a.start_date<=p_on_date and coalesce(a.end_date,'9999-12-31'::date)>=p_on_date
    ) then raise exception 'Employee is not actively allocated to this project'; end if;
  end if;

  if p_status in ('present','wfh','half_day') and exists(
    select 1 from public.leave_requests l
    where l.employee_id=p_employee_id and l.status='approved'
      and p_on_date between l.from_date and l.to_date
  ) then raise exception 'Employee has approved leave on this date'; end if;

  insert into public.attendance(employee_id,project_id,on_date,status,check_in,check_out,note,marked_by)
  values(p_employee_id,p_project_id,p_on_date,p_status,p_check_in,p_check_out,p_note,(select auth.uid()))
  on conflict(employee_id,on_date) do update set
    project_id=excluded.project_id,status=excluded.status,check_in=excluded.check_in,
    check_out=excluded.check_out,note=excluded.note,marked_by=excluded.marked_by,updated_at=now()
  returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.mark_payroll_paid(p_run_id uuid, p_pay_date date, p_reference text DEFAULT NULL::text)
 RETURNS payroll_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.payroll_runs%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Payroll payment access denied'; end if;
  select * into v from public.payroll_runs where id=p_run_id for update;
  if v.id is null or v.status<>'approved' then raise exception 'Approved payroll run not found'; end if;
  perform public.assert_accounting_period_open(v.business_unit_id,p_pay_date);
  update public.payroll_runs set status='paid',pay_date=p_pay_date,paid_by=(select auth.uid()),paid_at=now(),
    payment_reference=nullif(trim(p_reference),''),updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.mark_purchase_order_ordered(p_po_id uuid)
 RETURNS purchase_orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.purchase_orders%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','procurement','project_manager') then raise exception 'PO access denied'; end if;
  update public.purchase_orders set status='ordered',ordered_at=now(),updated_at=now()
  where id=p_po_id and status='approved' returning * into v;
  if v.id is null then raise exception 'Approved PO not found'; end if;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.mark_vendor_rfq_viewed(p_invite_id uuid)
 RETURNS vendor_rfq_invites
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.vendor_rfq_invites%rowtype;
begin
  select * into r from public.vendor_rfq_invites where id=p_invite_id for update;
  if r.id is null or not public.has_vendor_portal_access(r.vendor_id) then raise exception 'RFQ not found'; end if;
  if r.status='invited' then
    update public.vendor_rfq_invites set status='viewed',viewed_at=now(),updated_at=now()
    where id=r.id returning * into r;
  end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.next_erp_number(p_doc_type text, p_date date DEFAULT CURRENT_DATE)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_type text := lower(trim(p_doc_type));
  v_prefix text;
  v_period text;
  v_next bigint;
begin
  if public.current_app_role() not in (
    'founder','admin','sales','project_manager','designer',
    'site_engineer','finance','procurement','hr'
  ) then
    raise exception 'ERP numbering access denied';
  end if;

  v_prefix := public.erp_prefix(v_type);
  if v_prefix is null then
    raise exception 'Unsupported ERP number type: %', p_doc_type;
  end if;

  v_period := public.erp_period_key(v_type, p_date);

  insert into public.document_sequences (doc_type, period_key, last_number, updated_at)
  values (v_type, v_period, 1, now())
  on conflict (doc_type, period_key)
  do update
    set last_number = public.document_sequences.last_number + 1,
        updated_at = now()
  returning last_number into v_next;

  return v_prefix || '-' || v_period || '-' || lpad(v_next::text, 4, '0');
end;
$function$;

CREATE OR REPLACE FUNCTION public.pay_reimbursement(p_reimbursement_id uuid, p_pay_date date, p_reference text DEFAULT NULL::text)
 RETURNS reimbursements
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.reimbursements%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Reimbursement payment denied'; end if;
  select * into v from public.reimbursements where id=p_reimbursement_id for update;
  if v.id is null or v.status<>'approved' then raise exception 'Approved reimbursement not found'; end if;
  perform public.assert_accounting_period_open(v.business_unit_id,p_pay_date);
  update public.reimbursements set status='paid',paid_by=(select auth.uid()),paid_at=now(),
    payment_reference=nullif(trim(p_reference),''),updated_at=now()
  where id=v.id returning * into v;
  if v.expense_id is not null then update public.expenses set status='paid',updated_at=now() where id=v.expense_id; end if;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.post_goods_receipt(p_po_id uuid, p_store_id uuid, p_items jsonb, p_receipt_date date DEFAULT CURRENT_DATE, p_delivery_challan_no text DEFAULT NULL::text, p_vehicle_no text DEFAULT NULL::text, p_quality_note text DEFAULT NULL::text)
 RETURNS TABLE(grn_id uuid, grn_no text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  po public.purchase_orders%rowtype; st public.stores%rowtype;
  g uuid; gno text; x jsonb; pit public.po_items%rowtype;
  rq numeric; aq numeric; total_ordered numeric; total_accepted numeric;
begin
  if public.current_app_role() not in ('founder','admin','procurement','project_manager','site_engineer') then raise exception 'GRN access denied'; end if;
  select * into po from public.purchase_orders where id=p_po_id for update;
  if po.id is null or po.status not in ('approved','ordered','partly_delivered') then raise exception 'PO is not open for receipt'; end if;
  select * into st from public.stores where id=p_store_id and status='active';
  if st.id is null or st.project_id is distinct from po.project_id then raise exception 'Choose the project site store'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'No receipt items supplied'; end if;

  gno:=public.next_erp_number('goods_receipt',p_receipt_date);
  insert into public.goods_receipts(
    grn_no,business_unit_id,project_id,po_id,vendor_id,store_id,receipt_date,
    delivery_challan_no,vehicle_no,quality_note,status
  ) values(gno,po.business_unit_id,po.project_id,po.id,po.vendor_id,st.id,p_receipt_date,p_delivery_challan_no,p_vehicle_no,p_quality_note,'accepted')
  returning id into g;

  for x in select * from jsonb_array_elements(p_items)
  loop
    select * into pit from public.po_items where id=(x->>'po_item_id')::uuid and po_id=po.id for update;
    if pit.id is null then raise exception 'Invalid PO item'; end if;
    rq:=coalesce((x->>'received_qty')::numeric,0);
    aq:=coalesce((x->>'accepted_qty')::numeric,rq);
    if rq<=0 or aq<0 or aq>rq then raise exception 'Invalid received/accepted quantity'; end if;
    if pit.received_qty+aq>pit.qty+0.001 then raise exception 'Accepted receipt exceeds PO quantity for %',pit.description; end if;
    if pit.material_id is null then raise exception 'Link PO item % to material master before stock receipt',pit.description; end if;

    insert into public.goods_receipt_items(
      grn_id,po_item_id,material_id,description,ordered_qty,received_qty,accepted_qty,unit,rate,remarks
    ) values(g,pit.id,pit.material_id,pit.description,pit.qty,rq,aq,pit.unit,pit.rate,x->>'remarks');

    update public.po_items set received_qty=received_qty+aq where id=pit.id;

    if aq>0 then
      insert into public.stock_ledger(
        business_unit_id,project_id,store_id,material_id,movement_type,qty,rate,
        reference_type,reference_id,reference_no,purpose,moved_on
      ) values(po.business_unit_id,po.project_id,st.id,pit.material_id,'grn_in',aq,pit.rate,'grn',g,gno,'PO receipt',p_receipt_date);
    end if;
  end loop;

  select coalesce(sum(qty),0),coalesce(sum(received_qty),0)
  into total_ordered,total_accepted
  from public.po_items where po_id=po.id;

  update public.purchase_orders
  set status=case when total_accepted+0.001>=total_ordered then 'delivered' else 'partly_delivered' end,
      delivered_date=case when total_accepted+0.001>=total_ordered then p_receipt_date else delivered_date end,
      updated_at=now()
  where id=po.id;

  if total_accepted+0.001>=total_ordered then
    update public.material_requisitions set status='closed',updated_at=now() where id=po.requisition_id;
  end if;

  return query select g,gno;
end $function$;

CREATE OR REPLACE FUNCTION public.preconstruction_project_release()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.step_key='bhoomi_pooja' and new.status='completed' and old.status is distinct from 'completed' then
    update public.projects p
    set status='active',start_date=coalesce(p.start_date,current_date),updated_at=now()
    where p.id=new.project_id;
    perform public.seed_project_construction(new.project_id);
    perform public.recompute_project_construction_progress(new.project_id);
  elsif new.step_key='bhoomi_pooja' and old.status='completed' and new.status<>'completed' then
    update public.projects p set status='planning',start_date=null,updated_at=now()
    where p.id=new.project_id and p.progress_pct=0;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.preconstruction_step_state_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_open integer;
  v_role text:=public.current_app_role();
begin
  new.updated_at:=now();

  if new.status='active' and old.status='not_started' and new.started_at is null then
    new.started_at:=now();
  end if;

  if new.status='completed' and old.status is distinct from 'completed' then
    if new.step_key in ('final_design_signoff','construction_agreement','bhoomi_pooja')
       and v_role not in ('founder','admin','project_manager') then
      raise exception 'Founder, Admin or Project Manager approval is required to complete %',new.title;
    end if;

    if new.step_key='final_design_signoff' and not exists(
      select 1 from public.design_deliverables d
      where d.project_id=new.project_id
        and d.stage='final_design'
        and d.status in ('approved','completed','issued')
    ) then
      raise exception 'Approve the Final Floor Plan + Facade deliverable before completing design sign-off';
    end if;

    if new.step_key='gfc_drawing_set' and exists(
      select 1 from public.design_deliverables d
      where d.project_id=new.project_id
        and d.stage='gfc'
        and d.status not in ('completed','issued')
    ) then
      raise exception 'All GFC architectural, structural and MEP deliverables must be completed/issued first';
    end if;

    if new.step_key='bhoomi_pooja' then
      select count(*) into v_open
      from public.preconstruction_steps s
      where s.project_id=new.project_id
        and s.step_order<new.step_order
        and s.required=true
        and s.status not in ('completed','skipped');
      if v_open>0 then
        raise exception 'Complete all required pre-construction steps before construction release';
      end if;
    end if;

    new.started_at:=coalesce(new.started_at,now());
    new.completed_at:=coalesce(new.completed_at,now());
    new.completed_by:=coalesce(new.completed_by,(select auth.uid()));

    if new.step_key='final_design_signoff' and new.client_confirmation_at is null then
      new.client_confirmation_at:=now();
    end if;
  elsif new.status<>'completed' and old.status='completed' then
    if old.step_key in ('final_design_signoff','construction_agreement','bhoomi_pooja')
       and v_role not in ('founder','admin','project_manager') then
      raise exception 'Founder, Admin or Project Manager approval is required to reopen %',old.title;
    end if;
    new.completed_at:=null;
    new.completed_by:=null;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.project_insert_seed_preconstruction()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  perform public.seed_project_preconstruction(new.id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_document_register()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Document register rows cannot be deleted. Cancel the document instead.';
  end if;

  if old.document_no is distinct from new.document_no then
    raise exception 'Document numbers are immutable and can never be reused.';
  end if;

  if old.doc_type is distinct from new.doc_type then
    raise exception 'Document type cannot be changed after issuance.';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_receipt_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Receipts cannot be deleted. Cancel the receipt instead.';
  end if;

  if old.receipt_no is distinct from new.receipt_no then
    raise exception 'Receipt number is immutable.';
  end if;

  if old.amount is distinct from new.amount and old.status <> 'draft' then
    raise exception 'Issued receipt amount cannot be changed.';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    if coalesce(nullif(trim(new.cancellation_reason),''),'') = '' then
      raise exception 'Cancellation reason is required.';
    end if;
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.raise_credit_note(p_invoice_id uuid, p_subtotal numeric, p_reason text, p_narration text DEFAULT NULL::text, p_issue_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(credit_note_id uuid, credit_no text, total numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_i public.invoices%rowtype;
  v_taxable numeric;
  v_prev_subtotal numeric;
  v_remaining numeric;
  v_tax numeric;
  v_total numeric;
  v_no text;
  v_id uuid;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Finance access denied'; end if;
  if p_subtotal is null or p_subtotal<=0 then raise exception 'Credit subtotal must be greater than zero'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Credit note reason is required'; end if;

  select * into v_i
  from public.invoices i
  where i.id=p_invoice_id and i.deleted_at is null
  for update;

  if not found then raise exception 'Invoice not found'; end if;
  if v_i.status='cancelled' then raise exception 'Cannot credit a cancelled invoice'; end if;

  perform public.assert_accounting_period_open(v_i.business_unit_id,p_issue_date);

  v_taxable:=greatest(v_i.subtotal-v_i.discount,0);

  select coalesce(sum(c.subtotal),0) into v_prev_subtotal
  from public.credit_notes c
  where c.invoice_id=p_invoice_id and c.status='issued';

  v_remaining:=greatest(v_taxable-v_prev_subtotal,0);

  if p_subtotal>v_remaining+0.01 then
    raise exception 'Credit exceeds remaining taxable value %',v_remaining;
  end if;

  v_tax:=round(p_subtotal*v_i.tax_rate/100,2);
  v_total:=round(p_subtotal+v_tax,2);

  v_no:=public.issue_document_number(
    'credit_note',p_issue_date,v_i.lead_id,v_i.project_id,v_i.client_id,v_total,'issued',
    jsonb_build_object('invoice_id',v_i.id,'invoice_no',v_i.invoice_no,'reason',trim(p_reason))
  );

  insert into public.credit_notes(
    business_unit_id,credit_no,invoice_id,client_id,project_id,reason,narration,
    subtotal,tax_rate,tax_amount,total,is_interstate,issue_date,status
  ) values (
    v_i.business_unit_id,v_no,v_i.id,v_i.client_id,v_i.project_id,trim(p_reason),p_narration,
    p_subtotal,v_i.tax_rate,v_tax,v_total,v_i.is_interstate,p_issue_date,'issued'
  ) returning id into v_id;

  update public.invoices inv
  set credited_amount=inv.credited_amount+v_total,
      credit_status=case
        when inv.credited_amount+v_total+0.01>=inv.total then 'full'
        else 'partial'
      end,
      updated_at=now()
  where inv.id=v_i.id;

  return query select v_id,v_no,v_total;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_vendor_quote_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare qid uuid; s numeric:=0; t numeric:=0;
begin
  qid:=coalesce(new.quote_id,old.quote_id);
  select coalesce(sum(i.qty*i.rate),0),
         coalesce(sum((i.qty*i.rate)*(i.gst_rate/100.0)),0)
    into s,t from public.vendor_quote_items i where i.quote_id=qid;
  update public.vendor_quotes
  set subtotal=round(s,2),tax_amount=round(t,2),total=round(s+t,2),updated_at=now()
  where id=qid;
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.recompute_project_construction_progress(p_project_id uuid)
 RETURNS TABLE(actual_pct numeric, planned_pct numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_actual numeric; v_planned numeric; v_weight numeric;
begin
  if public.current_app_role() is null then raise exception 'ERP access denied'; end if;

  select coalesce(sum(weight_pct),0),
         coalesce(sum(weight_pct*progress_pct/100),0)
    into v_weight,v_actual
  from public.construction_stages where project_id=p_project_id;

  if v_weight>0 then v_actual:=round(v_actual/v_weight*100,2); else v_actual:=0; end if;

  select coalesce(sum(
    weight_pct * (
      case
        when planned_start is null or planned_end is null then 0
        when current_date < planned_start then 0
        when current_date >= planned_end then 100
        when planned_end <= planned_start then 100
        else least(100,greatest(0,100.0*(current_date-planned_start)/greatest(1,(planned_end-planned_start))))
      end
    )/100
  ),0)
  into v_planned
  from public.construction_stages where project_id=p_project_id;

  if v_weight>0 then v_planned:=round(v_planned/v_weight*100,2); else v_planned:=0; end if;

  update public.projects set progress_pct=v_actual,updated_at=now() where id=p_project_id;

  insert into public.project_progress_snapshots(project_id,snapshot_date,planned_pct,actual_pct,created_by)
  values(p_project_id,current_date,v_planned,v_actual,(select auth.uid()))
  on conflict(project_id,snapshot_date)
  do update set planned_pct=excluded.planned_pct,actual_pct=excluded.actual_pct;

  return query select v_actual,v_planned;
end $function$;

CREATE OR REPLACE FUNCTION public.record_erp_payment(p_target_type text, p_target_id uuid, p_amount numeric, p_receipt_date date DEFAULT CURRENT_DATE, p_payment_mode text DEFAULT 'bank_transfer'::text, p_reference_no text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(receipt_id uuid, receipt_no text, balance numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_type text:=lower(trim(p_target_type));
  v_total numeric;
  v_paid numeric;
  v_client uuid;
  v_project uuid;
  v_lead uuid;
  v_bu uuid;
  v_receipt_no text;
  v_receipt_id uuid;
  v_new_paid numeric;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Finance access denied'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;

  if v_type='proforma' then
    select total,amount_paid,client_id,project_id,lead_id,business_unit_id
    into v_total,v_paid,v_client,v_project,v_lead,v_bu
    from public.proforma_invoices
    where id=p_target_id and deleted_at is null and status<>'cancelled'
    for update;
  elsif v_type='invoice' then
    select total,amount_paid,client_id,project_id,lead_id,business_unit_id
    into v_total,v_paid,v_client,v_project,v_lead,v_bu
    from public.invoices
    where id=p_target_id and deleted_at is null and status<>'cancelled'
    for update;
  else
    raise exception 'Target type must be proforma or invoice';
  end if;

  if v_total is null then raise exception 'Billing document not found'; end if;
  perform public.assert_accounting_period_open(v_bu,p_receipt_date);

  if coalesce(v_paid,0)+p_amount>v_total+0.01 then raise exception 'Payment exceeds outstanding balance'; end if;

  v_receipt_no:=public.issue_document_number(
    'receipt',p_receipt_date,v_lead,v_project,v_client,p_amount,'issued',
    jsonb_build_object('target_type',v_type,'target_id',p_target_id)
  );

  insert into public.receipts(
    business_unit_id,receipt_no,invoice_id,proforma_id,client_id,project_id,
    receipt_date,amount,payment_mode,reference_no,notes,status
  ) values (
    v_bu,v_receipt_no,
    case when v_type='invoice' then p_target_id end,
    case when v_type='proforma' then p_target_id end,
    v_client,v_project,p_receipt_date,p_amount,
    coalesce(nullif(p_payment_mode,''),'bank_transfer'),p_reference_no,p_notes,'issued'
  ) returning id into v_receipt_id;

  v_new_paid:=coalesce(v_paid,0)+p_amount;

  if v_type='proforma' then
    update public.proforma_invoices
    set amount_paid=v_new_paid,
        status=case when v_new_paid+0.01>=total then 'paid' else 'part_paid' end,
        updated_at=now()
    where id=p_target_id;
  else
    update public.invoices
    set amount_paid=v_new_paid,
        status=case when v_new_paid+0.01>=total then 'paid' else 'part_paid' end,
        updated_at=now()
    where id=p_target_id;
  end if;

  return query select v_receipt_id,v_receipt_no,greatest(v_total-v_new_paid,0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_vendor_payment(p_bill_id uuid, p_amount numeric, p_payment_date date DEFAULT CURRENT_DATE, p_payment_mode text DEFAULT 'bank_transfer'::text, p_reference_no text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare b public.vendor_bills%rowtype; idv uuid;
begin
  if public.current_app_role() not in ('founder','admin','finance') then raise exception 'Vendor payment access denied'; end if;
  select * into b from public.vendor_bills where id=p_bill_id for update;
  if b.id is null or b.status not in ('approved','part_paid') then raise exception 'Approved vendor bill not found'; end if;
  perform public.assert_accounting_period_open(b.business_unit_id,p_payment_date);
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
  if b.amount_paid+p_amount>b.total+0.01 then raise exception 'Payment exceeds vendor bill balance'; end if;

  insert into public.vendor_payments(vendor_bill_id,vendor_id,project_id,payment_date,amount,payment_mode,reference_no,notes)
  values(b.id,b.vendor_id,b.project_id,p_payment_date,p_amount,p_payment_mode,p_reference_no,p_notes)
  returning id into idv;
  return idv;
end $function$;

CREATE OR REPLACE FUNCTION public.register_document_revision(p_document_id uuid, p_file_name text, p_storage_path text, p_mime_type text, p_size_bytes bigint, p_issue_purpose text DEFAULT 'internal'::text, p_note text DEFAULT NULL::text)
 RETURNS document_revisions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare d public.project_documents%rowtype; r public.document_revisions%rowtype; n integer;
begin
  if public.current_app_role() not in ('founder','admin','project_manager','designer','site_engineer','procurement') then
    raise exception 'Document revision access denied';
  end if;
  select * into d from public.project_documents where id=p_document_id for update;
  if d.id is null or d.status='archived' then raise exception 'Active document not found'; end if;
  select coalesce(max(revision_no),-1)+1 into n from public.document_revisions where document_id=d.id;
  insert into public.document_revisions(
    document_id,revision_no,revision_code,file_name,storage_path,mime_type,size_bytes,issue_purpose,status,note,uploaded_by
  ) values(
    d.id,n,'R'||n,p_file_name,p_storage_path,p_mime_type,p_size_bytes,p_issue_purpose,'draft',p_note,(select auth.uid())
  ) returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.restore_application_backup(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
declare check_result jsonb;
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Backup restore denied'; end if;
  check_result:=public.validate_application_backup(p_payload);
  if coalesce((check_result->>'restore_allowed')::boolean,false)=false then
    raise exception 'Restore blocked: %',check_result->>'note';
  end if;
  return private.restore_application_backup(p_payload);
end $function$;

CREATE OR REPLACE FUNCTION public.review_document_revision(p_revision_id uuid, p_approve boolean, p_comment text DEFAULT NULL::text)
 RETURNS document_revisions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.document_revisions%rowtype; d public.project_documents%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','project_manager') then
    raise exception 'Document approval denied';
  end if;
  select * into r from public.document_revisions where id=p_revision_id for update;
  if r.id is null or r.status<>'issued' then raise exception 'Issued revision awaiting review not found'; end if;
  select * into d from public.project_documents where id=r.document_id for update;

  update public.document_approvals
  set status=case when p_approve then 'approved' else 'rejected' end,
      comment=nullif(trim(p_comment),''),reviewer_id=coalesce(reviewer_id,(select auth.uid())),reviewed_at=now()
  where revision_id=r.id and status='pending';

  if p_approve then
    update public.document_revisions set status='superseded'
    where document_id=d.id and id<>r.id and status='approved';
    update public.document_revisions set status='approved' where id=r.id returning * into r;
    update public.project_documents
    set status='approved',current_revision=r.revision_no,current_revision_id=r.id,updated_at=now()
    where id=d.id;
  else
    update public.document_revisions set status='rejected' where id=r.id returning * into r;
    update public.project_documents set status='rejected',updated_at=now() where id=d.id;
  end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.review_leave_request(p_leave_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.leave_requests%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','hr') then raise exception 'Leave approval denied'; end if;
  select * into v from public.leave_requests where id=p_leave_id for update;
  if v.id is null or v.status<>'submitted' then raise exception 'Submitted leave request not found'; end if;

  if p_approve and exists(
    select 1 from public.attendance a
    where a.employee_id=v.employee_id and a.on_date between v.from_date and v.to_date
      and a.status in ('present','wfh','half_day')
  ) then raise exception 'Attendance already records work during this leave period. Correct attendance before approval'; end if;

  update public.leave_requests set
    status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(trim(p_note),''),updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.review_material_requisition(p_requisition_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS material_requisitions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.material_requisitions%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','project_manager') then raise exception 'Requisition approval denied'; end if;
  select * into v from public.material_requisitions where id=p_requisition_id for update;
  if v.id is null or v.status<>'submitted' then raise exception 'Submitted requisition not found'; end if;
  update public.material_requisitions set
    status=case when p_approve then 'approved' else 'rejected' end,
    approved_by=case when p_approve then (select auth.uid()) else null end,
    approved_at=case when p_approve then now() else null end,
    rejection_reason=case when p_approve then null else nullif(trim(p_reason),'') end,
    updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.review_site_report(p_report_id uuid, p_approve boolean, p_comment text DEFAULT NULL::text)
 RETURNS site_reports
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.site_reports%rowtype; rec record; v_cap numeric;
begin
  if public.current_app_role() not in ('founder','admin','project_manager') then
    raise exception 'Site report review denied';
  end if;

  select * into v from public.site_reports where id=p_report_id for update;
  if v.id is null then raise exception 'Site report not found'; end if;
  if v.status<>'submitted' then raise exception 'Only submitted reports can be reviewed'; end if;

  if not p_approve then
    update public.site_reports
    set status='rejected',rejection_reason=nullif(trim(p_comment),''),review_note=nullif(trim(p_comment),'')
    where id=p_report_id returning * into v;
    return v;
  end if;

  for rec in
    select stage_id,max(reported_progress_pct) reported
    from public.site_report_activities
    where report_id=p_report_id and stage_id is not null and reported_progress_pct is not null
    group by stage_id
  loop
    v_cap:=least(rec.reported,99);
    update public.construction_stages s
    set progress_pct=greatest(s.progress_pct,v_cap),
        status=case when s.status='not_started' and v_cap>0 then 'in_progress' else s.status end
    where s.id=rec.stage_id and s.status<>'completed';
  end loop;

  update public.site_reports
  set status='approved',approved_by=(select auth.uid()),approved_at=now(),
      review_note=nullif(trim(p_comment),'')
  where id=p_report_id returning * into v;

  perform public.recompute_project_construction_progress(v.project_id);
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_erp_automations_now()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Automation run denied'; end if;
  return private.run_daily_erp_automations();
end $function$;

CREATE OR REPLACE FUNCTION public.seed_project_construction(p_project_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_count integer;
begin
  if public.current_app_role() is null then raise exception 'ERP access denied'; end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.deleted_at is null) then
    raise exception 'Project not found';
  end if;

  insert into public.construction_stages(
    project_id,stage_key,sort_order,title,phase,weight_pct,requires_inspection
  ) values
    (p_project_id,'site_setup',1,'Site setup & setting out','Mobilisation',2,false),
    (p_project_id,'excavation_pcc',2,'Excavation & PCC','Substructure',4,true),
    (p_project_id,'foundation',3,'Foundation & footings','Substructure',8,true),
    (p_project_id,'plinth',4,'Plinth beam & backfilling','Substructure',6,true),
    (p_project_id,'ground_structure',5,'Ground-floor RCC structure','Superstructure',10,true),
    (p_project_id,'upper_structure',6,'Upper-floor RCC structure','Superstructure',12,true),
    (p_project_id,'roof_terrace',7,'Roof slab & terrace works','Superstructure',8,true),
    (p_project_id,'masonry',8,'Masonry / block work','Envelope',9,false),
    (p_project_id,'plastering',9,'Internal & external plastering','Envelope',8,false),
    (p_project_id,'waterproofing',10,'Waterproofing','Finishes',5,true),
    (p_project_id,'mep_roughin',11,'MEP rough-in','Services',7,true),
    (p_project_id,'flooring_finishes',12,'Flooring & finishes','Finishes',7,false),
    (p_project_id,'doors_windows',13,'Doors, windows & joinery','Finishes',4,false),
    (p_project_id,'painting_fixtures',14,'Painting, sanitary & electrical fixtures','Finishes',4,false),
    (p_project_id,'external_works',15,'External works & landscape','External',3,false),
    (p_project_id,'testing_handover',16,'Testing, snagging & handover','Close-out',3,true)
  on conflict(project_id,stage_key) do nothing;

  select count(*) into v_count from public.construction_stages where project_id=p_project_id;
  return v_count;
end $function$;

CREATE OR REPLACE FUNCTION public.seed_project_preconstruction(p_project_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  if public.current_app_role() is null then raise exception 'ERP access denied'; end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.deleted_at is null) then
    raise exception 'Project not found';
  end if;

  insert into public.preconstruction_steps(project_id,step_key,step_order,phase,title,output_label,required)
  values
    (p_project_id,'discovery_meeting',1,'Design','Discovery meeting','Approved project brief + user requirements',true),
    (p_project_id,'schematic_floor_plan',2,'Design','Schematic floor plan','1–2 shortlisted floor-plan options',true),
    (p_project_id,'revised_plan_3d',3,'Design','Revised floor plan + 3D first cut','Revised plan + first-cut 3D facade',true),
    (p_project_id,'final_design_signoff',4,'Design','Final floor plan + facade sign-off','Signed final floor plan + 3D facade',true),
    (p_project_id,'construction_agreement',5,'Commercial','Construction agreement','Signed agreement based on final floor area',true),
    (p_project_id,'demolition',6,'Site readiness','Existing structure demolition','Site cleared / mark N.A. if not required',false),
    (p_project_id,'soil_test',7,'Consultants','Soil test','Soil investigation report',true),
    (p_project_id,'statutory_approval',8,'Approvals','Statutory approval drawings','Application submitted + approval reference',true),
    (p_project_id,'structural_design',9,'Consultants','Structural design','Foundation + structural consultant drawings',true),
    (p_project_id,'mep_coordination',10,'Coordination','MEP coordination','Electrical + plumbing coordinated drawings',true),
    (p_project_id,'gfc_drawing_set',11,'GFC','Construction GFC drawing set','Architectural + structural + MEP GFC issued',true),
    (p_project_id,'bhoomi_pooja',12,'Kick-off','Bhoomi Pooja + construction release','Bhoomi Pooja complete · site execution released',true)
  on conflict(project_id,step_key) do nothing;

  insert into public.design_deliverables(project_id,stage,title,status,client_approval_required)
  values
    (p_project_id,'schematic','Schematic Floor Plan','not_started',true),
    (p_project_id,'design_development','Revised Floor Plan','not_started',true),
    (p_project_id,'design_development','3D Facade · First Cut','not_started',true),
    (p_project_id,'final_design','Final Floor Plan + Facade Sign-off','not_started',true),
    (p_project_id,'consultant','Structural Drawing Set','not_started',false),
    (p_project_id,'coordination','MEP Coordination Drawings','not_started',false),
    (p_project_id,'gfc','GFC · Architectural','not_started',false),
    (p_project_id,'gfc','GFC · Structural','not_started',false),
    (p_project_id,'gfc','GFC · MEP','not_started',false)
  on conflict(project_id,coalesce(stage,''),title) do nothing;

  select count(*) into v_count from public.preconstruction_steps s where s.project_id=p_project_id;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_employee_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at:=now();
  if tg_op='INSERT' and new.employee_no is null then
    new.employee_no:=public.next_erp_number('employee',current_date);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.set_meeting_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at:=now();
  if tg_op='INSERT' and new.meeting_no is null then
    new.meeting_no:=public.next_erp_number('meeting',new.scheduled_at::date);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.set_project_document_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at:=now();
  if tg_op='INSERT' and new.document_no is null then
    new.document_no:=public.next_erp_number('project_document',current_date);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.set_site_report_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_no text;
begin
  if new.report_no is null then
    select coalesce(p.project_no,p.code,'PROJECT')||'-DSR-'||to_char(new.report_date,'YYYYMMDD')
      into v_no from public.projects p where p.id=new.project_id;
    new.report_no:=v_no;
  end if;
  new.updated_at:=now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_leave_request(p_employee_id uuid, p_leave_type_id uuid, p_from_date date, p_to_date date, p_days numeric DEFAULT NULL::numeric, p_reason text DEFAULT NULL::text)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_role text:=public.current_app_role(); v public.leave_requests%rowtype; calc_days numeric;
begin
  if p_to_date<p_from_date then raise exception 'Leave end date cannot be before start date'; end if;
  if v_role not in ('founder','admin','hr') and not exists(
    select 1 from public.employees e where e.id=p_employee_id and e.profile_id=(select auth.uid())
  ) then raise exception 'Leave request access denied'; end if;
  calc_days:=coalesce(p_days,(p_to_date-p_from_date+1)::numeric);
  insert into public.leave_requests(employee_id,leave_type_id,from_date,to_date,days,reason,status,submitted_at,created_by)
  values(p_employee_id,p_leave_type_id,p_from_date,p_to_date,calc_days,p_reason,'submitted',now(),(select auth.uid()))
  returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_material_requisition(p_requisition_id uuid)
 RETURNS material_requisitions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.material_requisitions%rowtype; n int;
begin
  if public.current_app_role() not in ('founder','admin','procurement','project_manager','site_engineer') then raise exception 'Requisition access denied'; end if;
  select * into v from public.material_requisitions where id=p_requisition_id for update;
  if v.id is null then raise exception 'Requisition not found'; end if;
  if v.status<>'draft' then raise exception 'Only draft requisitions can be submitted'; end if;
  select count(*) into n from public.material_requisition_items where requisition_id=v.id;
  if n=0 then raise exception 'Add at least one material item'; end if;
  if v.requisition_no is null then
    v.requisition_no:=public.next_erp_number('material_requisition',current_date);
  end if;
  update public.material_requisitions
  set requisition_no=v.requisition_no,status='submitted',updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_payroll_run(p_run_id uuid)
 RETURNS payroll_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.payroll_runs%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','hr') then raise exception 'Payroll submission denied'; end if;
  update public.payroll_runs set status='review',updated_at=now()
  where id=p_run_id and status='draft' returning * into v;
  if v.id is null then raise exception 'Draft payroll run not found'; end if;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_purchase_order(p_po_id uuid)
 RETURNS purchase_orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.purchase_orders%rowtype; n int;
begin
  if public.current_app_role() not in ('founder','admin','procurement','project_manager') then
    raise exception 'PO submission denied';
  end if;
  select * into v from public.purchase_orders where id=p_po_id for update;
  if v.id is null or v.status<>'draft' then raise exception 'Draft PO not found'; end if;
  select count(*) into n from public.po_items where po_id=v.id;
  if n=0 then raise exception 'PO has no items'; end if;
  update public.purchase_orders set status='approval',updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_reimbursement(p_reimbursement_id uuid)
 RETURNS reimbursements
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.reimbursements%rowtype;
begin
  select * into v from public.reimbursements where id=p_reimbursement_id for update;
  if v.id is null or v.status<>'draft' then raise exception 'Draft reimbursement not found'; end if;
  if public.current_app_role() not in ('founder','admin','hr','finance') and not exists(
    select 1 from public.employees e where e.id=v.employee_id and e.profile_id=(select auth.uid())
  ) then raise exception 'Reimbursement access denied'; end if;
  if v.reimbursement_no is null then v.reimbursement_no:=public.next_erp_number('reimbursement',v.expense_date); end if;
  update public.reimbursements set reimbursement_no=v.reimbursement_no,status='submitted',submitted_at=now(),updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_site_report(p_report_id uuid)
 RETURNS site_reports
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.site_reports%rowtype; v_lab int; v_act int; v_work text; v_issues text;
begin
  if public.current_app_role() not in ('founder','admin','project_manager','site_engineer') then
    raise exception 'Site report submission denied';
  end if;

  select * into v from public.site_reports where id=p_report_id for update;
  if v.id is null then raise exception 'Site report not found'; end if;
  if v.status<>'draft' then raise exception 'Only draft reports can be submitted'; end if;

  select coalesce(sum(present),0) into v_lab from public.site_report_labour where report_id=p_report_id;
  select count(*) into v_act from public.site_report_activities where report_id=p_report_id;
  if v_lab=0 and v_act=0 then raise exception 'Add manpower or executed work before submitting'; end if;

  select string_agg(description,'; ' order by sort_order) into v_work
  from public.site_report_activities where report_id=p_report_id;
  select string_agg(title||coalesce(': '||description,''),'; ' order by created_at) into v_issues
  from public.site_issues where report_id=p_report_id and status in ('open','in_progress');

  update public.site_reports
  set labour_count=v_lab,work_completed=v_work,issues=v_issues,
      status='submitted',submitted_by=(select auth.uid()),submitted_at=now()
  where id=p_report_id returning * into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_vendor_rfq_quote(p_invite_id uuid, p_quote_ref text, p_valid_until date, p_delivery_days integer, p_payment_terms text, p_items jsonb, p_notes text DEFAULT NULL::text)
 RETURNS vendor_quotes
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.vendor_rfq_invites%rowtype; q public.vendor_quotes%rowtype; req_count int; json_count int;
begin
  select * into r from public.vendor_rfq_invites where id=p_invite_id for update;
  if r.id is null or r.status not in ('invited','viewed') or not public.has_vendor_portal_access(r.vendor_id) then
    raise exception 'Open RFQ invite not found';
  end if;
  if p_delivery_days is not null and p_delivery_days<0 then raise exception 'Delivery days cannot be negative'; end if;
  if jsonb_typeof(p_items)<>'array' then raise exception 'Quote items must be an array'; end if;
  select count(*) into req_count from public.vendor_rfq_items where invite_id=r.id;
  select count(distinct (x->>'requisition_item_id')) into json_count from jsonb_array_elements(p_items) x;
  if req_count=0 or json_count<>req_count then raise exception 'Every RFQ line must be quoted once'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) x
    left join public.vendor_rfq_items i
      on i.invite_id=r.id and i.requisition_item_id::text=x->>'requisition_item_id'
    where i.id is null
      or coalesce((x->>'rate')::numeric,-1)<0
      or coalesce((x->>'gst_rate')::numeric,-1)<0
      or coalesce((x->>'gst_rate')::numeric,101)>100
  ) then raise exception 'Invalid RFQ line response'; end if;

  insert into public.vendor_quotes(
    requisition_id,vendor_id,quote_ref,quote_date,valid_until,delivery_days,payment_terms,
    subtotal,tax_amount,total,status,notes,created_by
  ) values(
    r.requisition_id,r.vendor_id,nullif(trim(p_quote_ref),''),current_date,p_valid_until,p_delivery_days,
    nullif(trim(p_payment_terms),''),0,0,0,'received',nullif(trim(p_notes),''),null
  ) returning * into q;

  insert into public.vendor_quote_items(
    quote_id,requisition_item_id,material_id,description,qty,unit,rate,gst_rate
  )
  select q.id,i.requisition_item_id,i.material_id,i.description,i.qty,i.unit,
         (x->>'rate')::numeric,(x->>'gst_rate')::numeric
  from public.vendor_rfq_items i
  join lateral (
    select value as x from jsonb_array_elements(p_items)
    where value->>'requisition_item_id'=i.requisition_item_id::text limit 1
  ) j on true
  where i.invite_id=r.id;

  update public.vendor_rfq_invites
  set status='responded',quote_id=q.id,responded_at=now(),viewed_at=coalesce(viewed_at,now()),updated_at=now()
  where id=r.id;

  select * into q from public.vendor_quotes where id=q.id;
  return q;
end $function$;

CREATE OR REPLACE FUNCTION public.sync_invoice_collection()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invoice_id uuid;
  v_total numeric(18,2);
  v_paid numeric(18,2);
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  if v_invoice_id is null then
    return coalesce(new, old);
  end if;

  select i.total into v_total
  from public.invoices i
  where i.id = v_invoice_id;

  select coalesce(sum(r.amount), 0) into v_paid
  from public.receipts r
  where r.invoice_id = v_invoice_id
    and r.status <> 'cancelled';

  update public.invoices
  set amount_paid = least(v_paid, coalesce(v_total, 0)),
      status = case
        when coalesce(v_total,0) > 0 and v_paid >= v_total then 'paid'
        when v_paid > 0 then 'part_paid'
        when status in ('paid','part_paid') then 'issued'
        else status
      end,
      updated_at = now()
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_meeting_action_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.task_id is not null and new.status is distinct from old.status then
    update public.tasks
    set status=case when new.status='done' then 'done' when new.status='cancelled' then 'cancelled' else status end,
        updated_at=now()
    where id=new.task_id;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.sync_vendor_bill_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare b public.vendor_bills%rowtype; paid numeric;
begin
  select * into b from public.vendor_bills where id=new.vendor_bill_id for update;
  if b.id is null or b.status not in ('approved','part_paid') then
    raise exception 'Payments require an approved vendor bill';
  end if;
  select coalesce(sum(amount),0) into paid from public.vendor_payments where vendor_bill_id=b.id;
  if paid>b.total+0.01 then raise exception 'Vendor payments exceed bill total'; end if;
  update public.vendor_bills
  set amount_paid=paid,
      status=case when paid+0.01>=total then 'paid' when paid>0 then 'part_paid' else 'approved' end,
      updated_at=now()
  where id=b.id;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.validate_application_backup(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare
  data jsonb; k text; table_count int:=0; row_count bigint:=0; live_rows bigint:=0;
  auth_mismatches integer:=0; result jsonb;
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Backup validation denied'; end if;
  if coalesce(p_payload->>'format','')<>'bindbuild-erp-application-backup' then raise exception 'Not a Bind Build ERP application backup'; end if;
  if coalesce((p_payload->>'format_version')::int,0)<>1 then raise exception 'Unsupported backup format version'; end if;
  data:=p_payload->'data';
  if data is null or jsonb_typeof(data)<>'object' then raise exception 'Backup data object is missing'; end if;
  if not (data ? 'business_units') or not (data ? 'profiles') then raise exception 'Backup is missing required system tables'; end if;

  for k in select jsonb_object_keys(data) loop
    if jsonb_typeof(data->k)<>'array' then raise exception 'Backup table % is not an array',k; end if;
    table_count:=table_count+1;
    row_count:=row_count+jsonb_array_length(data->k);
  end loop;

  select
    (select count(*) from public.leads where deleted_at is null)+
    (select count(*) from public.projects where deleted_at is null)+
    (select count(*) from public.invoices where deleted_at is null)+
    (select count(*) from public.receipts)+
    (select count(*) from public.expenses)+
    (select count(*) from public.purchase_orders)+
    (select count(*) from public.employees)+
    (select count(*) from public.project_documents)
  into live_rows;

  auth_mismatches:=private.backup_auth_mismatches(p_payload);

  result:=jsonb_build_object(
    'valid',true,
    'format_version',1,
    'table_count',table_count,
    'row_count',row_count,
    'created_at',p_payload->>'created_at',
    'restore_allowed',live_rows=0 and auth_mismatches=0,
    'live_operational_rows',live_rows,
    'auth_id_mismatches',auth_mismatches,
    'note',case
      when live_rows>0 then 'Restore is blocked because live operational records exist'
      when auth_mismatches>0 then 'Restore is blocked because matching Supabase Auth user IDs are missing'
      else 'Restore target is operationally empty and Auth IDs are compatible'
    end
  );

  insert into public.application_backup_log(operation,format_version,table_count,row_count,byte_estimate,status,created_by,note)
  values('validate',1,table_count,row_count,octet_length(p_payload::text),'success',(select auth.uid()),result->>'note');

  return result;
end $function$;

CREATE OR REPLACE FUNCTION public.verify_reimbursement(p_reimbursement_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS reimbursements
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.reimbursements%rowtype;
begin
  if public.current_app_role() not in ('founder','admin','hr') then raise exception 'Reimbursement verification denied'; end if;
  select * into v from public.reimbursements where id=p_reimbursement_id for update;
  if v.id is null or v.status<>'submitted' then raise exception 'Submitted reimbursement not found'; end if;
  update public.reimbursements set
    status=case when p_approve then 'hr_verified' else 'rejected' end,
    verified_by=(select auth.uid()),verified_at=now(),
    rejection_reason=case when p_approve then null else nullif(trim(p_reason),'') end,updated_at=now()
  where id=v.id returning * into v;
  return v;
end $function$;

-- RLS
alter table public."accounting_period_locks" enable row level security;
alter table public."application_backup_log" enable row level security;
alter table public."approvals" enable row level security;
alter table public."attendance" enable row level security;
alter table public."automation_runs" enable row level security;
alter table public."business_units" enable row level security;
alter table public."clients" enable row level security;
alter table public."construction_stages" enable row level security;
alter table public."credit_notes" enable row level security;
alter table public."design_deliverables" enable row level security;
alter table public."document_approvals" enable row level security;
alter table public."document_register" enable row level security;
alter table public."document_revisions" enable row level security;
alter table public."document_sequences" enable row level security;
alter table public."drawings" enable row level security;
alter table public."employee_compensation" enable row level security;
alter table public."employees" enable row level security;
alter table public."erp_notification_reads" enable row level security;
alter table public."erp_notifications" enable row level security;
alter table public."estimate_items" enable row level security;
alter table public."estimates" enable row level security;
alter table public."expenses" enable row level security;
alter table public."goods_receipt_items" enable row level security;
alter table public."goods_receipts" enable row level security;
alter table public."invoice_items" enable row level security;
alter table public."invoices" enable row level security;
alter table public."kudos" enable row level security;
alter table public."leads" enable row level security;
alter table public."leave_requests" enable row level security;
alter table public."leave_types" enable row level security;
alter table public."material_requisition_items" enable row level security;
alter table public."material_requisitions" enable row level security;
alter table public."materials" enable row level security;
alter table public."meeting_action_items" enable row level security;
alter table public."meeting_attendees" enable row level security;
alter table public."meeting_notes" enable row level security;
alter table public."meetings" enable row level security;
alter table public."organisation_profiles" enable row level security;
alter table public."payroll_entries" enable row level security;
alter table public."payroll_inputs" enable row level security;
alter table public."payroll_runs" enable row level security;
alter table public."performance_cycles" enable row level security;
alter table public."performance_goals" enable row level security;
alter table public."performance_reviews" enable row level security;
alter table public."po_items" enable row level security;
alter table public."portal_memberships" enable row level security;
alter table public."portal_messages" enable row level security;
alter table public."preconstruction_steps" enable row level security;
alter table public."profiles" enable row level security;
alter table public."proforma_invoices" enable row level security;
alter table public."proforma_items" enable row level security;
alter table public."project_allocations" enable row level security;
alter table public."project_documents" enable row level security;
alter table public."project_progress_snapshots" enable row level security;
alter table public."projects" enable row level security;
alter table public."proposal_items" enable row level security;
alter table public."proposals" enable row level security;
alter table public."purchase_orders" enable row level security;
alter table public."quality_checks" enable row level security;
alter table public."receipts" enable row level security;
alter table public."reimbursements" enable row level security;
alter table public."site_inspections" enable row level security;
alter table public."site_issues" enable row level security;
alter table public."site_report_activities" enable row level security;
alter table public."site_report_equipment" enable row level security;
alter table public."site_report_labour" enable row level security;
alter table public."site_report_materials" enable row level security;
alter table public."site_reports" enable row level security;
alter table public."stock_ledger" enable row level security;
alter table public."stores" enable row level security;
alter table public."tasks" enable row level security;
alter table public."vendor_bills" enable row level security;
alter table public."vendor_payments" enable row level security;
alter table public."vendor_quote_items" enable row level security;
alter table public."vendor_quotes" enable row level security;
alter table public."vendor_rfq_invites" enable row level security;
alter table public."vendor_rfq_items" enable row level security;
alter table public."vendors" enable row level security;

-- Policies
drop policy if exists "accounting_locks_delete" on public."accounting_period_locks";
create policy "accounting_locks_delete" on public."accounting_period_locks" as permissive for delete to public using ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "accounting_locks_insert" on public."accounting_period_locks";
create policy "accounting_locks_insert" on public."accounting_period_locks" as permissive for insert to public with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "accounting_locks_read" on public."accounting_period_locks";
create policy "accounting_locks_read" on public."accounting_period_locks" as permissive for select to public using (is_internal_user());
drop policy if exists "application_backup_log_insert" on public."application_backup_log";
create policy "application_backup_log_insert" on public."application_backup_log" as permissive for insert to public with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])) AND (created_by = ( SELECT auth.uid() AS uid))));
drop policy if exists "application_backup_log_read" on public."application_backup_log";
create policy "application_backup_log_read" on public."application_backup_log" as permissive for select to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "approvals_client_portal_read" on public."approvals";
create policy "approvals_client_portal_read" on public."approvals" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = approvals.project_id) AND (p.client_id IS NOT NULL) AND has_client_portal_access(p.client_id)))));
drop policy if exists "approvals_client_portal_update" on public."approvals";
create policy "approvals_client_portal_update" on public."approvals" as permissive for update to public using (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = approvals.project_id) AND (p.client_id IS NOT NULL) AND has_client_portal_access(p.client_id)))))) with check (((status = ANY (ARRAY['approved'::text, 'changes_requested'::text])) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = approvals.project_id) AND (p.client_id IS NOT NULL) AND has_client_portal_access(p.client_id))))));
drop policy if exists "internal_access" on public."approvals";
create policy "internal_access" on public."approvals" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "attendance_delete" on public."attendance";
create policy "attendance_delete" on public."attendance" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "attendance_insert" on public."attendance";
create policy "attendance_insert" on public."attendance" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "attendance_read" on public."attendance";
create policy "attendance_read" on public."attendance" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "attendance_update" on public."attendance";
create policy "attendance_update" on public."attendance" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "automation_runs_read" on public."automation_runs";
create policy "automation_runs_read" on public."automation_runs" as permissive for select to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "internal_access" on public."business_units";
create policy "internal_access" on public."business_units" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "clients_portal_read" on public."clients";
create policy "clients_portal_read" on public."clients" as permissive for select to public using (((deleted_at IS NULL) AND has_client_portal_access(id)));
drop policy if exists "internal_access" on public."clients";
create policy "internal_access" on public."clients" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "construction_delete" on public."construction_stages";
create policy "construction_delete" on public."construction_stages" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "construction_insert" on public."construction_stages";
create policy "construction_insert" on public."construction_stages" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "construction_read" on public."construction_stages";
create policy "construction_read" on public."construction_stages" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "construction_stages_client_portal_read" on public."construction_stages";
create policy "construction_stages_client_portal_read" on public."construction_stages" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = construction_stages.project_id) AND (p.deleted_at IS NULL) AND (p.client_id IS NOT NULL) AND has_client_portal_access(p.client_id)))));
drop policy if exists "construction_update" on public."construction_stages";
create policy "construction_update" on public."construction_stages" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "credit_notes_insert" on public."credit_notes";
create policy "credit_notes_insert" on public."credit_notes" as permissive for insert to public with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "credit_notes_read" on public."credit_notes";
create policy "credit_notes_read" on public."credit_notes" as permissive for select to public using (is_internal_user());
drop policy if exists "internal_access" on public."design_deliverables";
create policy "internal_access" on public."design_deliverables" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "document_approvals_delete" on public."document_approvals";
create policy "document_approvals_delete" on public."document_approvals" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])));
drop policy if exists "document_approvals_insert" on public."document_approvals";
create policy "document_approvals_insert" on public."document_approvals" as permissive for insert to public with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text])) AND (status = 'pending'::text) AND (requested_by = ( SELECT auth.uid() AS uid))));
drop policy if exists "document_approvals_read" on public."document_approvals";
create policy "document_approvals_read" on public."document_approvals" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "document_approvals_update" on public."document_approvals";
create policy "document_approvals_update" on public."document_approvals" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])));
drop policy if exists "document_register_insert" on public."document_register";
create policy "document_register_insert" on public."document_register" as permissive for insert to public with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text, 'sales'::text, 'project_manager'::text])));
drop policy if exists "document_register_read" on public."document_register";
create policy "document_register_read" on public."document_register" as permissive for select to public using ((current_app_role() IS NOT NULL));
drop policy if exists "document_register_update" on public."document_register";
create policy "document_register_update" on public."document_register" as permissive for update to public using ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text, 'sales'::text]))) with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text, 'sales'::text])));
drop policy if exists "document_revisions_client_portal_read" on public."document_revisions";
create policy "document_revisions_client_portal_read" on public."document_revisions" as permissive for select to public using (((status = 'approved'::text) AND (EXISTS ( SELECT 1
   FROM (project_documents d
     JOIN projects p ON ((p.id = d.project_id)))
  WHERE ((d.id = document_revisions.document_id) AND (d.client_visible = true) AND (d.status = 'approved'::text) AND (d.current_revision_id = document_revisions.id) AND (p.client_id IS NOT NULL) AND has_client_portal_access(p.client_id))))));
drop policy if exists "document_revisions_delete" on public."document_revisions";
create policy "document_revisions_delete" on public."document_revisions" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "document_revisions_insert" on public."document_revisions";
create policy "document_revisions_insert" on public."document_revisions" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "document_revisions_read" on public."document_revisions";
create policy "document_revisions_read" on public."document_revisions" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "document_revisions_update" on public."document_revisions";
create policy "document_revisions_update" on public."document_revisions" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "document_sequences_internal" on public."document_sequences";
create policy "document_sequences_internal" on public."document_sequences" as permissive for all to public using ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text]))) with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "internal_access" on public."drawings";
create policy "internal_access" on public."drawings" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "compensation_delete" on public."employee_compensation";
create policy "compensation_delete" on public."employee_compensation" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "compensation_insert" on public."employee_compensation";
create policy "compensation_insert" on public."employee_compensation" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "compensation_read" on public."employee_compensation";
create policy "compensation_read" on public."employee_compensation" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = employee_compensation.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "compensation_update" on public."employee_compensation";
create policy "compensation_update" on public."employee_compensation" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "employees_delete" on public."employees";
create policy "employees_delete" on public."employees" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "employees_insert" on public."employees";
create policy "employees_insert" on public."employees" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "employees_read" on public."employees";
create policy "employees_read" on public."employees" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "employees_update" on public."employees";
create policy "employees_update" on public."employees" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "erp_notification_reads_delete" on public."erp_notification_reads";
create policy "erp_notification_reads_delete" on public."erp_notification_reads" as permissive for delete to public using ((user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists "erp_notification_reads_insert" on public."erp_notification_reads";
create policy "erp_notification_reads_insert" on public."erp_notification_reads" as permissive for insert to public with check ((user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists "erp_notification_reads_select" on public."erp_notification_reads";
create policy "erp_notification_reads_select" on public."erp_notification_reads" as permissive for select to public using ((user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists "erp_notification_reads_update" on public."erp_notification_reads";
create policy "erp_notification_reads_update" on public."erp_notification_reads" as permissive for update to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists "erp_notifications_read" on public."erp_notifications";
create policy "erp_notifications_read" on public."erp_notifications" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])) OR (target_user_id = ( SELECT auth.uid() AS uid)) OR ((target_user_id IS NULL) AND ((target_role IS NULL) OR (target_role = ( SELECT current_app_role() AS current_app_role))))));
drop policy if exists "internal_access" on public."estimate_items";
create policy "internal_access" on public."estimate_items" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "internal_access" on public."estimates";
create policy "internal_access" on public."estimates" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "internal_access" on public."expenses";
create policy "internal_access" on public."expenses" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "goods_receipt_items_vendor_portal_read" on public."goods_receipt_items";
create policy "goods_receipt_items_vendor_portal_read" on public."goods_receipt_items" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM goods_receipts g
  WHERE ((g.id = goods_receipt_items.grn_id) AND (g.vendor_id IS NOT NULL) AND has_vendor_portal_access(g.vendor_id)))));
drop policy if exists "grn_items_delete" on public."goods_receipt_items";
create policy "grn_items_delete" on public."goods_receipt_items" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "grn_items_insert" on public."goods_receipt_items";
create policy "grn_items_insert" on public."goods_receipt_items" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "grn_items_read" on public."goods_receipt_items";
create policy "grn_items_read" on public."goods_receipt_items" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "grn_items_update" on public."goods_receipt_items";
create policy "grn_items_update" on public."goods_receipt_items" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "goods_receipts_vendor_portal_read" on public."goods_receipts";
create policy "goods_receipts_vendor_portal_read" on public."goods_receipts" as permissive for select to public using (((vendor_id IS NOT NULL) AND has_vendor_portal_access(vendor_id)));
drop policy if exists "grn_delete" on public."goods_receipts";
create policy "grn_delete" on public."goods_receipts" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "grn_insert" on public."goods_receipts";
create policy "grn_insert" on public."goods_receipts" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "grn_read" on public."goods_receipts";
create policy "grn_read" on public."goods_receipts" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "grn_update" on public."goods_receipts";
create policy "grn_update" on public."goods_receipts" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "internal_access" on public."invoice_items";
create policy "internal_access" on public."invoice_items" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "invoices_client_portal_read" on public."invoices";
create policy "invoices_client_portal_read" on public."invoices" as permissive for select to public using (((deleted_at IS NULL) AND (invoice_no IS NOT NULL) AND (client_id IS NOT NULL) AND has_client_portal_access(client_id)));
drop policy if exists "invoices_insert" on public."invoices";
create policy "invoices_insert" on public."invoices" as permissive for insert to public with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "invoices_read" on public."invoices";
create policy "invoices_read" on public."invoices" as permissive for select to public using (is_internal_user());
drop policy if exists "invoices_update" on public."invoices";
create policy "invoices_update" on public."invoices" as permissive for update to public using ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text]))) with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "kudos_delete" on public."kudos";
create policy "kudos_delete" on public."kudos" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "kudos_insert" on public."kudos";
create policy "kudos_insert" on public."kudos" as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = kudos.from_employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists "kudos_manage" on public."kudos";
create policy "kudos_manage" on public."kudos" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "kudos_read" on public."kudos";
create policy "kudos_read" on public."kudos" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "internal_access" on public."leads";
create policy "internal_access" on public."leads" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "leave_requests_delete" on public."leave_requests";
create policy "leave_requests_delete" on public."leave_requests" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "leave_requests_insert" on public."leave_requests";
create policy "leave_requests_insert" on public."leave_requests" as permissive for insert to public with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = leave_requests.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "leave_requests_read" on public."leave_requests";
create policy "leave_requests_read" on public."leave_requests" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = leave_requests.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "leave_requests_update" on public."leave_requests";
create policy "leave_requests_update" on public."leave_requests" as permissive for update to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = leave_requests.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid))))))) with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = leave_requests.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "leave_types_delete" on public."leave_types";
create policy "leave_types_delete" on public."leave_types" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "leave_types_insert" on public."leave_types";
create policy "leave_types_insert" on public."leave_types" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "leave_types_read" on public."leave_types";
create policy "leave_types_read" on public."leave_types" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "leave_types_update" on public."leave_types";
create policy "leave_types_update" on public."leave_types" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "req_items_delete" on public."material_requisition_items";
create policy "req_items_delete" on public."material_requisition_items" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "req_items_insert" on public."material_requisition_items";
create policy "req_items_insert" on public."material_requisition_items" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "req_items_read" on public."material_requisition_items";
create policy "req_items_read" on public."material_requisition_items" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "req_items_update" on public."material_requisition_items";
create policy "req_items_update" on public."material_requisition_items" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "req_delete" on public."material_requisitions";
create policy "req_delete" on public."material_requisitions" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "req_insert" on public."material_requisitions";
create policy "req_insert" on public."material_requisitions" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "req_read" on public."material_requisitions";
create policy "req_read" on public."material_requisitions" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "req_update" on public."material_requisitions";
create policy "req_update" on public."material_requisitions" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "materials_delete" on public."materials";
create policy "materials_delete" on public."materials" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text])));
drop policy if exists "materials_insert" on public."materials";
create policy "materials_insert" on public."materials" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "materials_read" on public."materials";
create policy "materials_read" on public."materials" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "materials_update" on public."materials";
create policy "materials_update" on public."materials" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "meeting_actions_delete" on public."meeting_action_items";
create policy "meeting_actions_delete" on public."meeting_action_items" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])));
drop policy if exists "meeting_actions_insert" on public."meeting_action_items";
create policy "meeting_actions_insert" on public."meeting_action_items" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meeting_actions_read" on public."meeting_action_items";
create policy "meeting_actions_read" on public."meeting_action_items" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "meeting_actions_update" on public."meeting_action_items";
create policy "meeting_actions_update" on public."meeting_action_items" as permissive for update to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])) OR (owner_profile_id = ( SELECT auth.uid() AS uid)))) with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])) OR (owner_profile_id = ( SELECT auth.uid() AS uid))));
drop policy if exists "meeting_attendees_delete" on public."meeting_attendees";
create policy "meeting_attendees_delete" on public."meeting_attendees" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meeting_attendees_insert" on public."meeting_attendees";
create policy "meeting_attendees_insert" on public."meeting_attendees" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meeting_attendees_read" on public."meeting_attendees";
create policy "meeting_attendees_read" on public."meeting_attendees" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "meeting_attendees_update" on public."meeting_attendees";
create policy "meeting_attendees_update" on public."meeting_attendees" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meeting_notes_delete" on public."meeting_notes";
create policy "meeting_notes_delete" on public."meeting_notes" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meeting_notes_insert" on public."meeting_notes";
create policy "meeting_notes_insert" on public."meeting_notes" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meeting_notes_read" on public."meeting_notes";
create policy "meeting_notes_read" on public."meeting_notes" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "meeting_notes_update" on public."meeting_notes";
create policy "meeting_notes_update" on public."meeting_notes" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meetings_delete" on public."meetings";
create policy "meetings_delete" on public."meetings" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])));
drop policy if exists "meetings_insert" on public."meetings";
create policy "meetings_insert" on public."meetings" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "meetings_read" on public."meetings";
create policy "meetings_read" on public."meetings" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "meetings_update" on public."meetings";
create policy "meetings_update" on public."meetings" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'finance'::text, 'procurement'::text, 'hr'::text])));
drop policy if exists "organisation_profiles_delete" on public."organisation_profiles";
create policy "organisation_profiles_delete" on public."organisation_profiles" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "organisation_profiles_insert" on public."organisation_profiles";
create policy "organisation_profiles_insert" on public."organisation_profiles" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "organisation_profiles_read" on public."organisation_profiles";
create policy "organisation_profiles_read" on public."organisation_profiles" as permissive for select to public using (is_internal_user());
drop policy if exists "organisation_profiles_update" on public."organisation_profiles";
create policy "organisation_profiles_update" on public."organisation_profiles" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "payroll_entries_delete" on public."payroll_entries";
create policy "payroll_entries_delete" on public."payroll_entries" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "payroll_entries_insert" on public."payroll_entries";
create policy "payroll_entries_insert" on public."payroll_entries" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "payroll_entries_read" on public."payroll_entries";
create policy "payroll_entries_read" on public."payroll_entries" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = payroll_entries.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "payroll_entries_update" on public."payroll_entries";
create policy "payroll_entries_update" on public."payroll_entries" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "payroll_inputs_delete" on public."payroll_inputs";
create policy "payroll_inputs_delete" on public."payroll_inputs" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "payroll_inputs_insert" on public."payroll_inputs";
create policy "payroll_inputs_insert" on public."payroll_inputs" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "payroll_inputs_read" on public."payroll_inputs";
create policy "payroll_inputs_read" on public."payroll_inputs" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = payroll_inputs.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "payroll_inputs_update" on public."payroll_inputs";
create policy "payroll_inputs_update" on public."payroll_inputs" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "payroll_runs_delete" on public."payroll_runs";
create policy "payroll_runs_delete" on public."payroll_runs" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "payroll_runs_insert" on public."payroll_runs";
create policy "payroll_runs_insert" on public."payroll_runs" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "payroll_runs_read" on public."payroll_runs";
create policy "payroll_runs_read" on public."payroll_runs" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM (payroll_entries pe
     JOIN employees e ON ((e.id = pe.employee_id)))
  WHERE ((pe.payroll_run_id = payroll_runs.id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "payroll_runs_update" on public."payroll_runs";
create policy "payroll_runs_update" on public."payroll_runs" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])));
drop policy if exists "cycles_delete" on public."performance_cycles";
create policy "cycles_delete" on public."performance_cycles" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "cycles_insert" on public."performance_cycles";
create policy "cycles_insert" on public."performance_cycles" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "cycles_read" on public."performance_cycles";
create policy "cycles_read" on public."performance_cycles" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "cycles_update" on public."performance_cycles";
create policy "cycles_update" on public."performance_cycles" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "goals_delete" on public."performance_goals";
create policy "goals_delete" on public."performance_goals" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "goals_insert" on public."performance_goals";
create policy "goals_insert" on public."performance_goals" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])));
drop policy if exists "goals_read" on public."performance_goals";
create policy "goals_read" on public."performance_goals" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = performance_goals.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "goals_update" on public."performance_goals";
create policy "goals_update" on public."performance_goals" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])));
drop policy if exists "reviews_delete" on public."performance_reviews";
create policy "reviews_delete" on public."performance_reviews" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "reviews_insert" on public."performance_reviews";
create policy "reviews_insert" on public."performance_reviews" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])));
drop policy if exists "reviews_read" on public."performance_reviews";
create policy "reviews_read" on public."performance_reviews" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = performance_reviews.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "reviews_update" on public."performance_reviews";
create policy "reviews_update" on public."performance_reviews" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])));
drop policy if exists "po_items_delete" on public."po_items";
create policy "po_items_delete" on public."po_items" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text])));
drop policy if exists "po_items_insert" on public."po_items";
create policy "po_items_insert" on public."po_items" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "po_items_read" on public."po_items";
create policy "po_items_read" on public."po_items" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "po_items_update" on public."po_items";
create policy "po_items_update" on public."po_items" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "po_items_vendor_portal_read" on public."po_items";
create policy "po_items_vendor_portal_read" on public."po_items" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM purchase_orders p
  WHERE ((p.id = po_items.po_id) AND (p.po_no IS NOT NULL) AND (p.status = ANY (ARRAY['approved'::text, 'ordered'::text, 'partly_delivered'::text, 'delivered'::text, 'cancelled'::text])) AND (p.vendor_id IS NOT NULL) AND has_vendor_portal_access(p.vendor_id)))));
drop policy if exists "portal_memberships_insert" on public."portal_memberships";
create policy "portal_memberships_insert" on public."portal_memberships" as permissive for insert to public with check ((((portal_type = 'client'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text]))) OR ((portal_type = 'vendor'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text])))));
drop policy if exists "portal_memberships_read" on public."portal_memberships";
create policy "portal_memberships_read" on public."portal_memberships" as permissive for select to public using ((((portal_type = 'client'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text]))) OR ((portal_type = 'vendor'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text]))) OR (user_id = ( SELECT auth.uid() AS uid)) OR ((status = 'invited'::text) AND (lower(email) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text))))));
drop policy if exists "portal_memberships_update" on public."portal_memberships";
create policy "portal_memberships_update" on public."portal_memberships" as permissive for update to public using ((((portal_type = 'client'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text]))) OR ((portal_type = 'vendor'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text]))) OR ((status = 'invited'::text) AND (user_id IS NULL) AND (lower(email) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))))) with check ((((portal_type = 'client'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'sales'::text, 'project_manager'::text]))) OR ((portal_type = 'vendor'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text]))) OR ((status = 'active'::text) AND (user_id = ( SELECT auth.uid() AS uid)) AND (lower(email) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text))))));
drop policy if exists "portal_messages_insert" on public."portal_messages";
create policy "portal_messages_insert" on public."portal_messages" as permissive for insert to public with check (((sender_user_id = ( SELECT auth.uid() AS uid)) AND ((( SELECT is_internal_user() AS is_internal_user) AND (from_studio = true)) OR ((client_id IS NOT NULL) AND has_client_portal_access(client_id) AND (from_studio = false)) OR ((vendor_id IS NOT NULL) AND has_vendor_portal_access(vendor_id) AND (from_studio = false)))));
drop policy if exists "portal_messages_read" on public."portal_messages";
create policy "portal_messages_read" on public."portal_messages" as permissive for select to public using ((( SELECT is_internal_user() AS is_internal_user) OR ((client_id IS NOT NULL) AND has_client_portal_access(client_id)) OR ((vendor_id IS NOT NULL) AND has_vendor_portal_access(vendor_id))));
drop policy if exists "preconstruction_delete" on public."preconstruction_steps";
create policy "preconstruction_delete" on public."preconstruction_steps" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "preconstruction_insert" on public."preconstruction_steps";
create policy "preconstruction_insert" on public."preconstruction_steps" as permissive for insert to public with check (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "preconstruction_read" on public."preconstruction_steps";
create policy "preconstruction_read" on public."preconstruction_steps" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "preconstruction_update" on public."preconstruction_steps";
create policy "preconstruction_update" on public."preconstruction_steps" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text])));
drop policy if exists "profiles_read_self_or_admin" on public."profiles";
create policy "profiles_read_self_or_admin" on public."profiles" as permissive for select to public using (((id = ( SELECT auth.uid() AS uid)) OR (current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text]))));
drop policy if exists "proformas_client_portal_read" on public."proforma_invoices";
create policy "proformas_client_portal_read" on public."proforma_invoices" as permissive for select to public using (((deleted_at IS NULL) AND (proforma_no IS NOT NULL) AND (client_id IS NOT NULL) AND has_client_portal_access(client_id)));
drop policy if exists "proformas_insert" on public."proforma_invoices";
create policy "proformas_insert" on public."proforma_invoices" as permissive for insert to public with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text, 'project_manager'::text])));
drop policy if exists "proformas_read" on public."proforma_invoices";
create policy "proformas_read" on public."proforma_invoices" as permissive for select to public using (is_internal_user());
drop policy if exists "proformas_update" on public."proforma_invoices";
create policy "proformas_update" on public."proforma_invoices" as permissive for update to public using ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text, 'project_manager'::text]))) with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text, 'project_manager'::text])));
drop policy if exists "internal_access" on public."proforma_items";
create policy "internal_access" on public."proforma_items" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "allocations_delete" on public."project_allocations";
create policy "allocations_delete" on public."project_allocations" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text])));
drop policy if exists "allocations_insert" on public."project_allocations";
create policy "allocations_insert" on public."project_allocations" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])));
drop policy if exists "allocations_read" on public."project_allocations";
create policy "allocations_read" on public."project_allocations" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "allocations_update" on public."project_allocations";
create policy "allocations_update" on public."project_allocations" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'project_manager'::text])));
drop policy if exists "project_documents_client_portal_read" on public."project_documents";
create policy "project_documents_client_portal_read" on public."project_documents" as permissive for select to public using (((client_visible = true) AND (status = 'approved'::text) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_documents.project_id) AND (p.deleted_at IS NULL) AND (p.client_id IS NOT NULL) AND has_client_portal_access(p.client_id))))));
drop policy if exists "project_documents_delete" on public."project_documents";
create policy "project_documents_delete" on public."project_documents" as permissive for delete to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])) AND (status = 'draft'::text)));
drop policy if exists "project_documents_insert" on public."project_documents";
create policy "project_documents_insert" on public."project_documents" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "project_documents_read" on public."project_documents";
create policy "project_documents_read" on public."project_documents" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "project_documents_update" on public."project_documents";
create policy "project_documents_update" on public."project_documents" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "progress_delete" on public."project_progress_snapshots";
create policy "progress_delete" on public."project_progress_snapshots" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "progress_insert" on public."project_progress_snapshots";
create policy "progress_insert" on public."project_progress_snapshots" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "progress_read" on public."project_progress_snapshots";
create policy "progress_read" on public."project_progress_snapshots" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "progress_update" on public."project_progress_snapshots";
create policy "progress_update" on public."project_progress_snapshots" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "internal_access" on public."projects";
create policy "internal_access" on public."projects" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "projects_client_portal_read" on public."projects";
create policy "projects_client_portal_read" on public."projects" as permissive for select to public using (((deleted_at IS NULL) AND (client_id IS NOT NULL) AND has_client_portal_access(client_id)));
drop policy if exists "projects_vendor_portal_read" on public."projects";
create policy "projects_vendor_portal_read" on public."projects" as permissive for select to public using (((deleted_at IS NULL) AND ((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.project_id = projects.id) AND (po.vendor_id IS NOT NULL) AND (po.po_no IS NOT NULL) AND has_vendor_portal_access(po.vendor_id)))) OR (EXISTS ( SELECT 1
   FROM vendor_rfq_invites r
  WHERE ((r.project_id = projects.id) AND (r.status <> 'cancelled'::text) AND has_vendor_portal_access(r.vendor_id)))))));
drop policy if exists "internal_access" on public."proposal_items";
create policy "internal_access" on public."proposal_items" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "internal_access" on public."proposals";
create policy "internal_access" on public."proposals" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "pos_delete" on public."purchase_orders";
create policy "pos_delete" on public."purchase_orders" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "pos_insert" on public."purchase_orders";
create policy "pos_insert" on public."purchase_orders" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "pos_read" on public."purchase_orders";
create policy "pos_read" on public."purchase_orders" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "pos_update" on public."purchase_orders";
create policy "pos_update" on public."purchase_orders" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "purchase_orders_vendor_portal_read" on public."purchase_orders";
create policy "purchase_orders_vendor_portal_read" on public."purchase_orders" as permissive for select to public using (((po_no IS NOT NULL) AND (status = ANY (ARRAY['approved'::text, 'ordered'::text, 'partly_delivered'::text, 'delivered'::text, 'cancelled'::text])) AND (vendor_id IS NOT NULL) AND has_vendor_portal_access(vendor_id)));
drop policy if exists "quality_delete" on public."quality_checks";
create policy "quality_delete" on public."quality_checks" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])));
drop policy if exists "quality_insert" on public."quality_checks";
create policy "quality_insert" on public."quality_checks" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "quality_read" on public."quality_checks";
create policy "quality_read" on public."quality_checks" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "quality_update" on public."quality_checks";
create policy "quality_update" on public."quality_checks" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "receipts_client_portal_read" on public."receipts";
create policy "receipts_client_portal_read" on public."receipts" as permissive for select to public using (((client_id IS NOT NULL) AND has_client_portal_access(client_id)));
drop policy if exists "receipts_insert" on public."receipts";
create policy "receipts_insert" on public."receipts" as permissive for insert to public with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "receipts_read" on public."receipts";
create policy "receipts_read" on public."receipts" as permissive for select to public using (is_internal_user());
drop policy if exists "receipts_update" on public."receipts";
create policy "receipts_update" on public."receipts" as permissive for update to public using ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text]))) with check ((current_app_role() = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "reimbursements_delete" on public."reimbursements";
create policy "reimbursements_delete" on public."reimbursements" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])));
drop policy if exists "reimbursements_insert" on public."reimbursements";
create policy "reimbursements_insert" on public."reimbursements" as permissive for insert to public with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = reimbursements.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "reimbursements_read" on public."reimbursements";
create policy "reimbursements_read" on public."reimbursements" as permissive for select to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = reimbursements.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "reimbursements_update" on public."reimbursements";
create policy "reimbursements_update" on public."reimbursements" as permissive for update to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = reimbursements.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid))))))) with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'hr'::text, 'finance'::text])) OR (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = reimbursements.employee_id) AND (e.profile_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "inspections_delete" on public."site_inspections";
create policy "inspections_delete" on public."site_inspections" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])));
drop policy if exists "inspections_insert" on public."site_inspections";
create policy "inspections_insert" on public."site_inspections" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "inspections_read" on public."site_inspections";
create policy "inspections_read" on public."site_inspections" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "inspections_update" on public."site_inspections";
create policy "inspections_update" on public."site_inspections" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "issues_delete" on public."site_issues";
create policy "issues_delete" on public."site_issues" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text])));
drop policy if exists "issues_insert" on public."site_issues";
create policy "issues_insert" on public."site_issues" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text, 'designer'::text, 'procurement'::text])));
drop policy if exists "issues_read" on public."site_issues";
create policy "issues_read" on public."site_issues" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "issues_update" on public."site_issues";
create policy "issues_update" on public."site_issues" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text, 'designer'::text, 'procurement'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text, 'designer'::text, 'procurement'::text])));
drop policy if exists "dsr_activities_delete" on public."site_report_activities";
create policy "dsr_activities_delete" on public."site_report_activities" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_activities_insert" on public."site_report_activities";
create policy "dsr_activities_insert" on public."site_report_activities" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_activities_read" on public."site_report_activities";
create policy "dsr_activities_read" on public."site_report_activities" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "dsr_activities_update" on public."site_report_activities";
create policy "dsr_activities_update" on public."site_report_activities" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_equipment_delete" on public."site_report_equipment";
create policy "dsr_equipment_delete" on public."site_report_equipment" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_equipment_insert" on public."site_report_equipment";
create policy "dsr_equipment_insert" on public."site_report_equipment" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_equipment_read" on public."site_report_equipment";
create policy "dsr_equipment_read" on public."site_report_equipment" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "dsr_equipment_update" on public."site_report_equipment";
create policy "dsr_equipment_update" on public."site_report_equipment" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_labour_delete" on public."site_report_labour";
create policy "dsr_labour_delete" on public."site_report_labour" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_labour_insert" on public."site_report_labour";
create policy "dsr_labour_insert" on public."site_report_labour" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_labour_read" on public."site_report_labour";
create policy "dsr_labour_read" on public."site_report_labour" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "dsr_labour_update" on public."site_report_labour";
create policy "dsr_labour_update" on public."site_report_labour" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "dsr_materials_delete" on public."site_report_materials";
create policy "dsr_materials_delete" on public."site_report_materials" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "dsr_materials_insert" on public."site_report_materials";
create policy "dsr_materials_insert" on public."site_report_materials" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "dsr_materials_read" on public."site_report_materials";
create policy "dsr_materials_read" on public."site_report_materials" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "dsr_materials_update" on public."site_report_materials";
create policy "dsr_materials_update" on public."site_report_materials" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text, 'procurement'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text, 'procurement'::text])));
drop policy if exists "site_reports_delete" on public."site_reports";
create policy "site_reports_delete" on public."site_reports" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "site_reports_insert" on public."site_reports";
create policy "site_reports_insert" on public."site_reports" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "site_reports_read" on public."site_reports";
create policy "site_reports_read" on public."site_reports" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "site_reports_update" on public."site_reports";
create policy "site_reports_update" on public."site_reports" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "stock_insert" on public."stock_ledger";
create policy "stock_insert" on public."stock_ledger" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text, 'site_engineer'::text])));
drop policy if exists "stock_read" on public."stock_ledger";
create policy "stock_read" on public."stock_ledger" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "stores_delete" on public."stores";
create policy "stores_delete" on public."stores" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "stores_insert" on public."stores";
create policy "stores_insert" on public."stores" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "stores_read" on public."stores";
create policy "stores_read" on public."stores" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "stores_update" on public."stores";
create policy "stores_update" on public."stores" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "internal_access" on public."tasks";
create policy "internal_access" on public."tasks" as permissive for all to public using (is_internal_user()) with check (is_internal_user());
drop policy if exists "vendor_bills_insert" on public."vendor_bills";
create policy "vendor_bills_insert" on public."vendor_bills" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'finance'::text])));
drop policy if exists "vendor_bills_portal_read" on public."vendor_bills";
create policy "vendor_bills_portal_read" on public."vendor_bills" as permissive for select to public using (((vendor_id IS NOT NULL) AND has_vendor_portal_access(vendor_id)));
drop policy if exists "vendor_bills_read" on public."vendor_bills";
create policy "vendor_bills_read" on public."vendor_bills" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "vendor_bills_update" on public."vendor_bills";
create policy "vendor_bills_update" on public."vendor_bills" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'finance'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'finance'::text])));
drop policy if exists "vendor_payments_insert" on public."vendor_payments";
create policy "vendor_payments_insert" on public."vendor_payments" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'finance'::text])));
drop policy if exists "vendor_payments_portal_read" on public."vendor_payments";
create policy "vendor_payments_portal_read" on public."vendor_payments" as permissive for select to public using (((vendor_id IS NOT NULL) AND has_vendor_portal_access(vendor_id)));
drop policy if exists "vendor_payments_read" on public."vendor_payments";
create policy "vendor_payments_read" on public."vendor_payments" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "quote_items_delete" on public."vendor_quote_items";
create policy "quote_items_delete" on public."vendor_quote_items" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text])));
drop policy if exists "quote_items_insert" on public."vendor_quote_items";
create policy "quote_items_insert" on public."vendor_quote_items" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "quote_items_read" on public."vendor_quote_items";
create policy "quote_items_read" on public."vendor_quote_items" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "quote_items_update" on public."vendor_quote_items";
create policy "quote_items_update" on public."vendor_quote_items" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "vendor_quote_items_portal_insert" on public."vendor_quote_items";
create policy "vendor_quote_items_portal_insert" on public."vendor_quote_items" as permissive for insert to public with check (((current_app_role() IS NULL) AND (EXISTS ( SELECT 1
   FROM (vendor_quotes q
     JOIN vendor_rfq_invites r ON (((r.requisition_id = q.requisition_id) AND (r.vendor_id = q.vendor_id))))
  WHERE ((q.id = vendor_quote_items.quote_id) AND (q.status = 'received'::text) AND (r.status = ANY (ARRAY['invited'::text, 'viewed'::text])) AND has_vendor_portal_access(q.vendor_id))))));
drop policy if exists "vendor_quote_items_portal_read" on public."vendor_quote_items";
create policy "vendor_quote_items_portal_read" on public."vendor_quote_items" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM vendor_quotes q
  WHERE ((q.id = vendor_quote_items.quote_id) AND has_vendor_portal_access(q.vendor_id)))));
drop policy if exists "quotes_delete" on public."vendor_quotes";
create policy "quotes_delete" on public."vendor_quotes" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text])));
drop policy if exists "quotes_insert" on public."vendor_quotes";
create policy "quotes_insert" on public."vendor_quotes" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "quotes_read" on public."vendor_quotes";
create policy "quotes_read" on public."vendor_quotes" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "quotes_update" on public."vendor_quotes";
create policy "quotes_update" on public."vendor_quotes" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "vendor_quotes_portal_insert" on public."vendor_quotes";
create policy "vendor_quotes_portal_insert" on public."vendor_quotes" as permissive for insert to public with check (((current_app_role() IS NULL) AND (created_by IS NULL) AND (status = 'received'::text) AND (subtotal = (0)::numeric) AND (tax_amount = (0)::numeric) AND (total = (0)::numeric) AND has_vendor_portal_access(vendor_id) AND (EXISTS ( SELECT 1
   FROM vendor_rfq_invites r
  WHERE ((r.requisition_id = vendor_quotes.requisition_id) AND (r.vendor_id = vendor_quotes.vendor_id) AND (r.status = ANY (ARRAY['invited'::text, 'viewed'::text])))))));
drop policy if exists "vendor_quotes_portal_read" on public."vendor_quotes";
create policy "vendor_quotes_portal_read" on public."vendor_quotes" as permissive for select to public using (has_vendor_portal_access(vendor_id));
drop policy if exists "vendor_quotes_portal_update" on public."vendor_quotes";
create policy "vendor_quotes_portal_update" on public."vendor_quotes" as permissive for update to public using (((current_app_role() IS NULL) AND (status = 'received'::text) AND has_vendor_portal_access(vendor_id))) with check (((current_app_role() IS NULL) AND (status = 'received'::text) AND has_vendor_portal_access(vendor_id)));
drop policy if exists "vendor_rfq_insert" on public."vendor_rfq_invites";
create policy "vendor_rfq_insert" on public."vendor_rfq_invites" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "vendor_rfq_read" on public."vendor_rfq_invites";
create policy "vendor_rfq_read" on public."vendor_rfq_invites" as permissive for select to public using ((( SELECT is_internal_user() AS is_internal_user) OR has_vendor_portal_access(vendor_id)));
drop policy if exists "vendor_rfq_update" on public."vendor_rfq_invites";
create policy "vendor_rfq_update" on public."vendor_rfq_invites" as permissive for update to public using (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])) OR has_vendor_portal_access(vendor_id))) with check (((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])) OR has_vendor_portal_access(vendor_id)));
drop policy if exists "vendor_rfq_items_insert" on public."vendor_rfq_items";
create policy "vendor_rfq_items_insert" on public."vendor_rfq_items" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text, 'project_manager'::text])));
drop policy if exists "vendor_rfq_items_read" on public."vendor_rfq_items";
create policy "vendor_rfq_items_read" on public."vendor_rfq_items" as permissive for select to public using ((( SELECT is_internal_user() AS is_internal_user) OR (EXISTS ( SELECT 1
   FROM vendor_rfq_invites r
  WHERE ((r.id = vendor_rfq_items.invite_id) AND has_vendor_portal_access(r.vendor_id))))));
drop policy if exists "vendors_delete" on public."vendors";
create policy "vendors_delete" on public."vendors" as permissive for delete to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text])));
drop policy if exists "vendors_insert" on public."vendors";
create policy "vendors_insert" on public."vendors" as permissive for insert to public with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text])));
drop policy if exists "vendors_portal_read" on public."vendors";
create policy "vendors_portal_read" on public."vendors" as permissive for select to public using (has_vendor_portal_access(id));
drop policy if exists "vendors_read" on public."vendors";
create policy "vendors_read" on public."vendors" as permissive for select to public using (( SELECT is_internal_user() AS is_internal_user));
drop policy if exists "vendors_update" on public."vendors";
create policy "vendors_update" on public."vendors" as permissive for update to public using ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text]))) with check ((( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'procurement'::text])));
drop policy if exists "erp_documents_delete" on storage."objects";
create policy "erp_documents_delete" on storage."objects" as permissive for delete to public using (((bucket_id = 'erp-documents'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text])) AND (NOT (EXISTS ( SELECT 1
   FROM document_revisions r
  WHERE ((r.storage_path = objects.name) AND (r.status <> 'draft'::text)))))));
drop policy if exists "erp_documents_insert" on storage."objects";
create policy "erp_documents_insert" on storage."objects" as permissive for insert to public with check (((bucket_id = 'erp-documents'::text) AND (( SELECT current_app_role() AS current_app_role) = ANY (ARRAY['founder'::text, 'admin'::text, 'project_manager'::text, 'designer'::text, 'site_engineer'::text, 'procurement'::text]))));
drop policy if exists "erp_documents_read" on storage."objects";
create policy "erp_documents_read" on storage."objects" as permissive for select to public using (((bucket_id = 'erp-documents'::text) AND (( SELECT is_internal_user() AS is_internal_user) OR (EXISTS ( SELECT 1
   FROM ((document_revisions r
     JOIN project_documents d ON ((d.id = r.document_id)))
     JOIN projects p ON ((p.id = d.project_id)))
  WHERE ((r.storage_path = objects.name) AND (r.id = d.current_revision_id) AND (r.status = 'approved'::text) AND (d.status = 'approved'::text) AND (d.client_visible = true) AND (p.client_id IS NOT NULL) AND has_client_portal_access(p.client_id)))))));

-- Triggers
drop trigger if exists "on_auth_user_created_erp_profile" on auth."users";
CREATE TRIGGER on_auth_user_created_erp_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();
drop trigger if exists "set_updated_at" on public."approvals";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_portal_approval_decision" on public."approvals";
CREATE TRIGGER trg_portal_approval_decision BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION guard_portal_approval_decision();
drop trigger if exists "trg_attendance_guard" on public."attendance";
CREATE TRIGGER trg_attendance_guard BEFORE INSERT OR UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION guard_attendance_write();
drop trigger if exists "set_updated_at" on public."business_units";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON business_units FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "set_updated_at" on public."clients";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_construction_stage_guard" on public."construction_stages";
CREATE TRIGGER trg_construction_stage_guard BEFORE UPDATE ON construction_stages FOR EACH ROW EXECUTE FUNCTION guard_construction_stage();
drop trigger if exists "trg_construction_stage_progress" on public."construction_stages";
CREATE TRIGGER trg_construction_stage_progress AFTER UPDATE OF progress_pct, status ON construction_stages FOR EACH ROW EXECUTE FUNCTION after_construction_stage_progress();
drop trigger if exists "set_updated_at" on public."design_deliverables";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON design_deliverables FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "document_register_protect" on public."document_register";
CREATE TRIGGER document_register_protect BEFORE DELETE OR UPDATE ON document_register FOR EACH ROW EXECUTE FUNCTION protect_document_register();
drop trigger if exists "trg_document_revision_guard" on public."document_revisions";
CREATE TRIGGER trg_document_revision_guard BEFORE DELETE OR UPDATE ON document_revisions FOR EACH ROW EXECUTE FUNCTION guard_document_revision();
drop trigger if exists "set_updated_at" on public."drawings";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON drawings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_employee_number" on public."employees";
CREATE TRIGGER trg_employee_number BEFORE INSERT OR UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_employee_number();
drop trigger if exists "set_updated_at" on public."estimates";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "set_updated_at" on public."expenses";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "set_updated_at" on public."invoices";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_guard_issued_invoice_update" on public."invoices";
CREATE TRIGGER trg_guard_issued_invoice_update BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION guard_issued_invoice_update();
drop trigger if exists "set_updated_at" on public."leads";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_leave_guard" on public."leave_requests";
CREATE TRIGGER trg_leave_guard BEFORE INSERT OR UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION guard_leave_request();
drop trigger if exists "trg_leave_state_guard" on public."leave_requests";
CREATE TRIGGER trg_leave_state_guard BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION guard_leave_state();
drop trigger if exists "trg_requisition_items_lock" on public."material_requisition_items";
CREATE TRIGGER trg_requisition_items_lock BEFORE INSERT OR DELETE OR UPDATE ON material_requisition_items FOR EACH ROW EXECUTE FUNCTION guard_requisition_items();
drop trigger if exists "trg_material_requisition_guard" on public."material_requisitions";
CREATE TRIGGER trg_material_requisition_guard BEFORE UPDATE ON material_requisitions FOR EACH ROW EXECUTE FUNCTION guard_material_requisition_update();
drop trigger if exists "trg_meeting_action_task_sync" on public."meeting_action_items";
CREATE TRIGGER trg_meeting_action_task_sync AFTER UPDATE ON meeting_action_items FOR EACH ROW EXECUTE FUNCTION sync_meeting_action_task();
drop trigger if exists "trg_meeting_action_update_guard" on public."meeting_action_items";
CREATE TRIGGER trg_meeting_action_update_guard BEFORE UPDATE ON meeting_action_items FOR EACH ROW EXECUTE FUNCTION guard_meeting_action_update();
drop trigger if exists "trg_meeting_note_guard" on public."meeting_notes";
CREATE TRIGGER trg_meeting_note_guard BEFORE INSERT OR DELETE OR UPDATE ON meeting_notes FOR EACH ROW EXECUTE FUNCTION guard_meeting_note();
drop trigger if exists "trg_meeting_number" on public."meetings";
CREATE TRIGGER trg_meeting_number BEFORE INSERT OR UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION set_meeting_number();
drop trigger if exists "trg_meeting_update_guard" on public."meetings";
CREATE TRIGGER trg_meeting_update_guard BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION guard_meeting_update();
drop trigger if exists "trg_payroll_entry_guard" on public."payroll_entries";
CREATE TRIGGER trg_payroll_entry_guard BEFORE INSERT OR DELETE OR UPDATE ON payroll_entries FOR EACH ROW EXECUTE FUNCTION guard_payroll_entry();
drop trigger if exists "trg_payroll_run_guard" on public."payroll_runs";
CREATE TRIGGER trg_payroll_run_guard BEFORE UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION guard_payroll_run();
drop trigger if exists "trg_payroll_run_insert_guard" on public."payroll_runs";
CREATE TRIGGER trg_payroll_run_insert_guard BEFORE INSERT ON payroll_runs FOR EACH ROW EXECUTE FUNCTION guard_payroll_run_insert();
drop trigger if exists "trg_goal_weight_guard" on public."performance_goals";
CREATE TRIGGER trg_goal_weight_guard BEFORE INSERT OR UPDATE ON performance_goals FOR EACH ROW EXECUTE FUNCTION guard_goal_weight();
drop trigger if exists "trg_po_items_lock" on public."po_items";
CREATE TRIGGER trg_po_items_lock BEFORE INSERT OR DELETE OR UPDATE ON po_items FOR EACH ROW EXECUTE FUNCTION guard_po_items();
drop trigger if exists "trg_preconstruction_project_release" on public."preconstruction_steps";
CREATE TRIGGER trg_preconstruction_project_release AFTER UPDATE ON preconstruction_steps FOR EACH ROW EXECUTE FUNCTION preconstruction_project_release();
drop trigger if exists "trg_preconstruction_step_guard" on public."preconstruction_steps";
CREATE TRIGGER trg_preconstruction_step_guard BEFORE UPDATE ON preconstruction_steps FOR EACH ROW EXECUTE FUNCTION preconstruction_step_state_guard();
drop trigger if exists "set_updated_at" on public."proforma_invoices";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON proforma_invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_guard_issued_proforma_update" on public."proforma_invoices";
CREATE TRIGGER trg_guard_issued_proforma_update BEFORE UPDATE ON proforma_invoices FOR EACH ROW EXECUTE FUNCTION guard_issued_proforma_update();
drop trigger if exists "trg_project_allocation_guard" on public."project_allocations";
CREATE TRIGGER trg_project_allocation_guard BEFORE INSERT OR UPDATE ON project_allocations FOR EACH ROW EXECUTE FUNCTION guard_project_allocation();
drop trigger if exists "trg_project_document_number" on public."project_documents";
CREATE TRIGGER trg_project_document_number BEFORE INSERT OR UPDATE ON project_documents FOR EACH ROW EXECUTE FUNCTION set_project_document_number();
drop trigger if exists "trg_project_document_update_guard" on public."project_documents";
CREATE TRIGGER trg_project_document_update_guard BEFORE UPDATE ON project_documents FOR EACH ROW EXECUTE FUNCTION guard_project_document_update();
drop trigger if exists "set_updated_at" on public."projects";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_project_seed_preconstruction" on public."projects";
CREATE TRIGGER trg_project_seed_preconstruction AFTER INSERT ON projects FOR EACH ROW EXECUTE FUNCTION project_insert_seed_preconstruction();
drop trigger if exists "set_updated_at" on public."proposals";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "set_updated_at" on public."purchase_orders";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_purchase_order_guard" on public."purchase_orders";
CREATE TRIGGER trg_purchase_order_guard BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION guard_purchase_order_update();
drop trigger if exists "receipts_protect" on public."receipts";
CREATE TRIGGER receipts_protect BEFORE DELETE OR UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION protect_receipt_row();
drop trigger if exists "receipts_sync_invoice_collection" on public."receipts";
CREATE TRIGGER receipts_sync_invoice_collection AFTER INSERT OR UPDATE OF amount, status, invoice_id ON receipts FOR EACH ROW EXECUTE FUNCTION sync_invoice_collection();
drop trigger if exists "trg_guard_receipt_update" on public."receipts";
CREATE TRIGGER trg_guard_receipt_update BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION guard_receipt_update();
drop trigger if exists "trg_reimbursement_insert_guard" on public."reimbursements";
CREATE TRIGGER trg_reimbursement_insert_guard BEFORE INSERT ON reimbursements FOR EACH ROW EXECUTE FUNCTION guard_reimbursement_insert();
drop trigger if exists "trg_reimbursement_state_guard" on public."reimbursements";
CREATE TRIGGER trg_reimbursement_state_guard BEFORE UPDATE ON reimbursements FOR EACH ROW EXECUTE FUNCTION guard_reimbursement_state();
drop trigger if exists "trg_dsr_activities_lock" on public."site_report_activities";
CREATE TRIGGER trg_dsr_activities_lock BEFORE INSERT OR DELETE OR UPDATE ON site_report_activities FOR EACH ROW EXECUTE FUNCTION assert_dsr_child_draft();
drop trigger if exists "trg_dsr_equipment_lock" on public."site_report_equipment";
CREATE TRIGGER trg_dsr_equipment_lock BEFORE INSERT OR DELETE OR UPDATE ON site_report_equipment FOR EACH ROW EXECUTE FUNCTION assert_dsr_child_draft();
drop trigger if exists "trg_dsr_labour_lock" on public."site_report_labour";
CREATE TRIGGER trg_dsr_labour_lock BEFORE INSERT OR DELETE OR UPDATE ON site_report_labour FOR EACH ROW EXECUTE FUNCTION assert_dsr_child_draft();
drop trigger if exists "trg_dsr_materials_lock" on public."site_report_materials";
CREATE TRIGGER trg_dsr_materials_lock BEFORE INSERT OR DELETE OR UPDATE ON site_report_materials FOR EACH ROW EXECUTE FUNCTION assert_dsr_child_draft();
drop trigger if exists "set_updated_at" on public."site_reports";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON site_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_site_report_guard" on public."site_reports";
CREATE TRIGGER trg_site_report_guard BEFORE UPDATE ON site_reports FOR EACH ROW EXECUTE FUNCTION guard_site_report();
drop trigger if exists "trg_site_report_number" on public."site_reports";
CREATE TRIGGER trg_site_report_number BEFORE INSERT OR UPDATE ON site_reports FOR EACH ROW EXECUTE FUNCTION set_site_report_number();
drop trigger if exists "trg_stock_ledger_immutable" on public."stock_ledger";
CREATE TRIGGER trg_stock_ledger_immutable BEFORE DELETE OR UPDATE ON stock_ledger FOR EACH ROW EXECUTE FUNCTION guard_stock_ledger_immutable();
drop trigger if exists "trg_stock_ledger_insert_guard" on public."stock_ledger";
CREATE TRIGGER trg_stock_ledger_insert_guard BEFORE INSERT ON stock_ledger FOR EACH ROW EXECUTE FUNCTION guard_stock_ledger_insert();
drop trigger if exists "set_updated_at" on public."tasks";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_vendor_bill_guard" on public."vendor_bills";
CREATE TRIGGER trg_vendor_bill_guard BEFORE UPDATE ON vendor_bills FOR EACH ROW EXECUTE FUNCTION guard_vendor_bill_update();
drop trigger if exists "trg_vendor_payment_immutable" on public."vendor_payments";
CREATE TRIGGER trg_vendor_payment_immutable BEFORE DELETE OR UPDATE ON vendor_payments FOR EACH ROW EXECUTE FUNCTION guard_vendor_payment_immutable();
drop trigger if exists "trg_vendor_payment_insert_guard" on public."vendor_payments";
CREATE TRIGGER trg_vendor_payment_insert_guard BEFORE INSERT ON vendor_payments FOR EACH ROW EXECUTE FUNCTION guard_vendor_payment_insert();
drop trigger if exists "trg_vendor_payment_sync" on public."vendor_payments";
CREATE TRIGGER trg_vendor_payment_sync AFTER INSERT ON vendor_payments FOR EACH ROW EXECUTE FUNCTION sync_vendor_bill_payment();
drop trigger if exists "trg_quote_items_lock" on public."vendor_quote_items";
CREATE TRIGGER trg_quote_items_lock BEFORE INSERT OR DELETE OR UPDATE ON vendor_quote_items FOR EACH ROW EXECUTE FUNCTION guard_quote_items();
drop trigger if exists "trg_vendor_quote_totals" on public."vendor_quote_items";
CREATE TRIGGER trg_vendor_quote_totals AFTER INSERT OR DELETE OR UPDATE ON vendor_quote_items FOR EACH ROW EXECUTE FUNCTION recalc_vendor_quote_totals();
drop trigger if exists "trg_vendor_quote_portal_update" on public."vendor_quotes";
CREATE TRIGGER trg_vendor_quote_portal_update BEFORE UPDATE ON vendor_quotes FOR EACH ROW EXECUTE FUNCTION guard_vendor_quote_portal_update();
drop trigger if exists "trg_vendor_rfq_guard" on public."vendor_rfq_invites";
CREATE TRIGGER trg_vendor_rfq_guard BEFORE UPDATE ON vendor_rfq_invites FOR EACH ROW EXECUTE FUNCTION guard_vendor_rfq_update();
drop trigger if exists "set_updated_at" on public."vendors";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Data API grants for authenticated ERP users
grant delete,insert,references,select,trigger,truncate,update on table public."accounting_period_locks" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."application_backup_log" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."approvals" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."attendance" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."automation_runs" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."business_units" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."clients" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."construction_stages" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."credit_notes" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."design_deliverables" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."document_approvals" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."document_register" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."document_revisions" to authenticated;
grant insert,select,update on table public."document_sequences" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."drawings" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."employee_compensation" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."employees" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."erp_notification_reads" to authenticated;
grant delete,insert,references,select,trigger,truncate on table public."erp_notifications" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."estimate_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."estimates" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."expenses" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."goods_receipt_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."goods_receipts" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."invoice_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."invoices" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."kudos" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."leads" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."leave_balances" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."leave_requests" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."leave_types" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."material_requisition_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."material_requisitions" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."materials" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."meeting_action_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."meeting_attendees" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."meeting_notes" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."meetings" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."organisation_profiles" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."payroll_entries" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."payroll_inputs" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."payroll_runs" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."performance_cycles" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."performance_goals" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."performance_reviews" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."po_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."portal_memberships" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."portal_messages" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."preconstruction_steps" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."profiles" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."proforma_invoices" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."proforma_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."project_allocations" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."project_documents" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."project_progress_snapshots" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."projects" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."proposal_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."proposals" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."purchase_orders" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."quality_checks" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."receipts" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."reimbursements" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."site_inspections" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."site_issues" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."site_report_activities" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."site_report_equipment" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."site_report_labour" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."site_report_materials" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."site_reports" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."stock_balances" to authenticated;
grant insert,references,select,trigger,truncate on table public."stock_ledger" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."stores" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."tasks" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."vendor_bills" to authenticated;
grant insert,references,select,trigger,truncate on table public."vendor_payments" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."vendor_quote_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."vendor_quotes" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."vendor_rfq_invites" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."vendor_rfq_items" to authenticated;
grant delete,insert,references,select,trigger,truncate,update on table public."vendors" to authenticated;

-- Function execution grants
revoke all on function private."backup_auth_mismatches"(p_payload jsonb) from public;
grant execute on function private."backup_auth_mismatches"(p_payload jsonb) to authenticated;
revoke all on function private."restore_application_backup"(p_payload jsonb) from public;
grant execute on function private."restore_application_backup"(p_payload jsonb) to authenticated;
revoke all on function private."run_daily_erp_automations"() from public;
grant execute on function private."run_daily_erp_automations"() to authenticated;
revoke all on function public."accept_proposal_to_project"(p_proposal_id uuid) from public;
grant execute on function public."accept_proposal_to_project"(p_proposal_id uuid) to authenticated;
revoke all on function public."add_meeting_action"(p_meeting_id uuid, p_title text, p_owner_profile_id uuid, p_due_date date, p_priority text, p_description text) from public;
grant execute on function public."add_meeting_action"(p_meeting_id uuid, p_title text, p_owner_profile_id uuid, p_due_date date, p_priority text, p_description text) to authenticated;
revoke all on function public."after_construction_stage_progress"() from public;
grant execute on function public."after_construction_stage_progress"() to authenticated;
revoke all on function public."approve_payroll_run"(p_run_id uuid) from public;
grant execute on function public."approve_payroll_run"(p_run_id uuid) to authenticated;
revoke all on function public."approve_purchase_order"(p_po_id uuid) from public;
grant execute on function public."approve_purchase_order"(p_po_id uuid) to authenticated;
revoke all on function public."approve_reimbursement"(p_reimbursement_id uuid, p_approve boolean, p_reason text) from public;
grant execute on function public."approve_reimbursement"(p_reimbursement_id uuid, p_approve boolean, p_reason text) to authenticated;
revoke all on function public."approve_vendor_bill"(p_bill_id uuid) from public;
grant execute on function public."approve_vendor_bill"(p_bill_id uuid) to authenticated;
revoke all on function public."assert_accounting_period_open"(p_business_unit_id uuid, p_date date) from public;
grant execute on function public."assert_accounting_period_open"(p_business_unit_id uuid, p_date date) to authenticated;
revoke all on function public."assert_dsr_child_draft"() from public;
grant execute on function public."assert_dsr_child_draft"() to authenticated;
revoke all on function public."cancel_invoice"(p_invoice_id uuid, p_reason text) from public;
grant execute on function public."cancel_invoice"(p_invoice_id uuid, p_reason text) to authenticated;
revoke all on function public."cancel_proforma"(p_proforma_id uuid, p_reason text) from public;
grant execute on function public."cancel_proforma"(p_proforma_id uuid, p_reason text) to authenticated;
revoke all on function public."cancel_receipt"(p_receipt_id uuid, p_reason text) from public;
grant execute on function public."cancel_receipt"(p_receipt_id uuid, p_reason text) to authenticated;
revoke all on function public."claim_portal_access"(p_portal_type text) from public;
grant execute on function public."claim_portal_access"(p_portal_type text) to authenticated;
revoke all on function public."client_decide_approval"(p_approval_id uuid, p_decision text, p_comment text) from public;
grant execute on function public."client_decide_approval"(p_approval_id uuid, p_decision text, p_comment text) to authenticated;
revoke all on function public."complete_construction_stage"(p_stage_id uuid) from public;
grant execute on function public."complete_construction_stage"(p_stage_id uuid) to authenticated;
revoke all on function public."complete_meeting_action"(p_action_id uuid) from public;
grant execute on function public."complete_meeting_action"(p_action_id uuid) to authenticated;
revoke all on function public."create_invoice_from_proforma"(p_proforma_id uuid) from public;
grant execute on function public."create_invoice_from_proforma"(p_proforma_id uuid) to authenticated;
revoke all on function public."create_po_from_quote"(p_quote_id uuid) from public;
grant execute on function public."create_po_from_quote"(p_quote_id uuid) to authenticated;
revoke all on function public."current_app_role"() from public;
grant execute on function public."current_app_role"() to authenticated;
revoke all on function public."ensure_project_store"(p_project_id uuid) from public;
grant execute on function public."ensure_project_store"(p_project_id uuid) to authenticated;
revoke all on function public."erp_period_key"(p_doc_type text, p_date date) from public;
grant execute on function public."erp_period_key"(p_doc_type text, p_date date) to authenticated;
revoke all on function public."erp_prefix"(p_doc_type text) from public;
grant execute on function public."erp_prefix"(p_doc_type text) to authenticated;
revoke all on function public."export_application_backup"() from public;
grant execute on function public."export_application_backup"() to authenticated;
revoke all on function public."finalize_meeting"(p_meeting_id uuid, p_summary text) from public;
grant execute on function public."finalize_meeting"(p_meeting_id uuid, p_summary text) to authenticated;
revoke all on function public."generate_payroll_run"(p_business_unit_id uuid, p_period_month date) from public;
grant execute on function public."generate_payroll_run"(p_business_unit_id uuid, p_period_month date) to authenticated;
revoke all on function public."guard_attendance_write"() from public;
grant execute on function public."guard_attendance_write"() to authenticated;
revoke all on function public."guard_construction_stage"() from public;
grant execute on function public."guard_construction_stage"() to authenticated;
revoke all on function public."guard_document_revision"() from public;
grant execute on function public."guard_document_revision"() to authenticated;
revoke all on function public."guard_erp_notification_update"() from public;
grant execute on function public."guard_erp_notification_update"() to authenticated;
revoke all on function public."guard_goal_weight"() from public;
grant execute on function public."guard_goal_weight"() to authenticated;
revoke all on function public."guard_issued_invoice_update"() from public;
grant execute on function public."guard_issued_invoice_update"() to authenticated;
revoke all on function public."guard_issued_proforma_update"() from public;
grant execute on function public."guard_issued_proforma_update"() to authenticated;
revoke all on function public."guard_leave_request"() from public;
grant execute on function public."guard_leave_request"() to authenticated;
revoke all on function public."guard_leave_state"() from public;
grant execute on function public."guard_leave_state"() to authenticated;
revoke all on function public."guard_material_requisition_update"() from public;
grant execute on function public."guard_material_requisition_update"() to authenticated;
revoke all on function public."guard_meeting_action_update"() from public;
grant execute on function public."guard_meeting_action_update"() to authenticated;
revoke all on function public."guard_meeting_note"() from public;
grant execute on function public."guard_meeting_note"() to authenticated;
revoke all on function public."guard_meeting_update"() from public;
grant execute on function public."guard_meeting_update"() to authenticated;
revoke all on function public."guard_payroll_entry"() from public;
grant execute on function public."guard_payroll_entry"() to authenticated;
revoke all on function public."guard_payroll_run"() from public;
grant execute on function public."guard_payroll_run"() to authenticated;
revoke all on function public."guard_payroll_run_insert"() from public;
grant execute on function public."guard_payroll_run_insert"() to authenticated;
revoke all on function public."guard_po_items"() from public;
grant execute on function public."guard_po_items"() to authenticated;
revoke all on function public."guard_portal_approval_decision"() from public;
grant execute on function public."guard_portal_approval_decision"() to authenticated;
revoke all on function public."guard_project_allocation"() from public;
grant execute on function public."guard_project_allocation"() to authenticated;
revoke all on function public."guard_project_document_update"() from public;
grant execute on function public."guard_project_document_update"() to authenticated;
revoke all on function public."guard_purchase_order_update"() from public;
grant execute on function public."guard_purchase_order_update"() to authenticated;
revoke all on function public."guard_quote_items"() from public;
grant execute on function public."guard_quote_items"() to authenticated;
revoke all on function public."guard_receipt_update"() from public;
grant execute on function public."guard_receipt_update"() to authenticated;
revoke all on function public."guard_reimbursement_insert"() from public;
grant execute on function public."guard_reimbursement_insert"() to authenticated;
revoke all on function public."guard_reimbursement_state"() from public;
grant execute on function public."guard_reimbursement_state"() to authenticated;
revoke all on function public."guard_requisition_items"() from public;
grant execute on function public."guard_requisition_items"() to authenticated;
revoke all on function public."guard_site_report"() from public;
grant execute on function public."guard_site_report"() to authenticated;
revoke all on function public."guard_stock_ledger_immutable"() from public;
grant execute on function public."guard_stock_ledger_immutable"() to authenticated;
revoke all on function public."guard_stock_ledger_insert"() from public;
grant execute on function public."guard_stock_ledger_insert"() to authenticated;
revoke all on function public."guard_vendor_bill_update"() from public;
grant execute on function public."guard_vendor_bill_update"() to authenticated;
revoke all on function public."guard_vendor_payment_immutable"() from public;
grant execute on function public."guard_vendor_payment_immutable"() to authenticated;
revoke all on function public."guard_vendor_payment_insert"() from public;
grant execute on function public."guard_vendor_payment_insert"() to authenticated;
revoke all on function public."guard_vendor_quote_portal_update"() from public;
grant execute on function public."guard_vendor_quote_portal_update"() to authenticated;
revoke all on function public."guard_vendor_rfq_update"() from public;
grant execute on function public."guard_vendor_rfq_update"() to authenticated;
revoke all on function public."handle_new_user_profile"() from public;
revoke all on function public."has_client_portal_access"(p_client_id uuid) from public;
grant execute on function public."has_client_portal_access"(p_client_id uuid) to authenticated;
revoke all on function public."has_vendor_portal_access"(p_vendor_id uuid) from public;
grant execute on function public."has_vendor_portal_access"(p_vendor_id uuid) to authenticated;
revoke all on function public."invite_portal_member"(p_portal_type text, p_entity_id uuid, p_email text, p_display_name text) from public;
grant execute on function public."invite_portal_member"(p_portal_type text, p_entity_id uuid, p_email text, p_display_name text) to authenticated;
revoke all on function public."invite_vendor_rfq"(p_requisition_id uuid, p_vendor_id uuid, p_due_date date, p_note text) from public;
grant execute on function public."invite_vendor_rfq"(p_requisition_id uuid, p_vendor_id uuid, p_due_date date, p_note text) to authenticated;
revoke all on function public."is_internal_user"() from public;
grant execute on function public."is_internal_user"() to authenticated;
revoke all on function public."issue_document_number"(p_doc_type text, p_issue_date date, p_lead_id uuid, p_project_id uuid, p_client_id uuid, p_amount numeric, p_status text, p_metadata jsonb) from public;
grant execute on function public."issue_document_number"(p_doc_type text, p_issue_date date, p_lead_id uuid, p_project_id uuid, p_client_id uuid, p_amount numeric, p_status text, p_metadata jsonb) to authenticated;
revoke all on function public."issue_document_revision"(p_revision_id uuid, p_reviewer_id uuid) from public;
grant execute on function public."issue_document_revision"(p_revision_id uuid, p_reviewer_id uuid) to authenticated;
revoke all on function public."issue_site_stock"(p_store_id uuid, p_material_id uuid, p_qty numeric, p_purpose text, p_moved_on date) from public;
grant execute on function public."issue_site_stock"(p_store_id uuid, p_material_id uuid, p_qty numeric, p_purpose text, p_moved_on date) to authenticated;
revoke all on function public."management_dashboard"(p_business_unit_id uuid, p_from date, p_to date) from public;
grant execute on function public."management_dashboard"(p_business_unit_id uuid, p_from date, p_to date) to authenticated;
revoke all on function public."mark_employee_attendance"(p_employee_id uuid, p_on_date date, p_status text, p_project_id uuid, p_check_in time without time zone, p_check_out time without time zone, p_note text) from public;
grant execute on function public."mark_employee_attendance"(p_employee_id uuid, p_on_date date, p_status text, p_project_id uuid, p_check_in time without time zone, p_check_out time without time zone, p_note text) to authenticated;
revoke all on function public."mark_payroll_paid"(p_run_id uuid, p_pay_date date, p_reference text) from public;
grant execute on function public."mark_payroll_paid"(p_run_id uuid, p_pay_date date, p_reference text) to authenticated;
revoke all on function public."mark_purchase_order_ordered"(p_po_id uuid) from public;
grant execute on function public."mark_purchase_order_ordered"(p_po_id uuid) to authenticated;
revoke all on function public."mark_vendor_rfq_viewed"(p_invite_id uuid) from public;
grant execute on function public."mark_vendor_rfq_viewed"(p_invite_id uuid) to authenticated;
revoke all on function public."next_erp_number"(p_doc_type text, p_date date) from public;
grant execute on function public."next_erp_number"(p_doc_type text, p_date date) to authenticated;
revoke all on function public."pay_reimbursement"(p_reimbursement_id uuid, p_pay_date date, p_reference text) from public;
grant execute on function public."pay_reimbursement"(p_reimbursement_id uuid, p_pay_date date, p_reference text) to authenticated;
revoke all on function public."post_goods_receipt"(p_po_id uuid, p_store_id uuid, p_items jsonb, p_receipt_date date, p_delivery_challan_no text, p_vehicle_no text, p_quality_note text) from public;
grant execute on function public."post_goods_receipt"(p_po_id uuid, p_store_id uuid, p_items jsonb, p_receipt_date date, p_delivery_challan_no text, p_vehicle_no text, p_quality_note text) to authenticated;
revoke all on function public."preconstruction_project_release"() from public;
grant execute on function public."preconstruction_project_release"() to authenticated;
revoke all on function public."preconstruction_step_state_guard"() from public;
grant execute on function public."preconstruction_step_state_guard"() to authenticated;
revoke all on function public."project_insert_seed_preconstruction"() from public;
grant execute on function public."project_insert_seed_preconstruction"() to authenticated;
revoke all on function public."protect_document_register"() from public;
revoke all on function public."protect_receipt_row"() from public;
revoke all on function public."raise_credit_note"(p_invoice_id uuid, p_subtotal numeric, p_reason text, p_narration text, p_issue_date date) from public;
grant execute on function public."raise_credit_note"(p_invoice_id uuid, p_subtotal numeric, p_reason text, p_narration text, p_issue_date date) to authenticated;
revoke all on function public."recalc_vendor_quote_totals"() from public;
grant execute on function public."recalc_vendor_quote_totals"() to authenticated;
revoke all on function public."recompute_project_construction_progress"(p_project_id uuid) from public;
grant execute on function public."recompute_project_construction_progress"(p_project_id uuid) to authenticated;
revoke all on function public."record_erp_payment"(p_target_type text, p_target_id uuid, p_amount numeric, p_receipt_date date, p_payment_mode text, p_reference_no text, p_notes text) from public;
grant execute on function public."record_erp_payment"(p_target_type text, p_target_id uuid, p_amount numeric, p_receipt_date date, p_payment_mode text, p_reference_no text, p_notes text) to authenticated;
revoke all on function public."record_vendor_payment"(p_bill_id uuid, p_amount numeric, p_payment_date date, p_payment_mode text, p_reference_no text, p_notes text) from public;
grant execute on function public."record_vendor_payment"(p_bill_id uuid, p_amount numeric, p_payment_date date, p_payment_mode text, p_reference_no text, p_notes text) to authenticated;
revoke all on function public."register_document_revision"(p_document_id uuid, p_file_name text, p_storage_path text, p_mime_type text, p_size_bytes bigint, p_issue_purpose text, p_note text) from public;
grant execute on function public."register_document_revision"(p_document_id uuid, p_file_name text, p_storage_path text, p_mime_type text, p_size_bytes bigint, p_issue_purpose text, p_note text) to authenticated;
revoke all on function public."restore_application_backup"(p_payload jsonb) from public;
grant execute on function public."restore_application_backup"(p_payload jsonb) to authenticated;
revoke all on function public."review_document_revision"(p_revision_id uuid, p_approve boolean, p_comment text) from public;
grant execute on function public."review_document_revision"(p_revision_id uuid, p_approve boolean, p_comment text) to authenticated;
revoke all on function public."review_leave_request"(p_leave_id uuid, p_approve boolean, p_note text) from public;
grant execute on function public."review_leave_request"(p_leave_id uuid, p_approve boolean, p_note text) to authenticated;
revoke all on function public."review_material_requisition"(p_requisition_id uuid, p_approve boolean, p_reason text) from public;
grant execute on function public."review_material_requisition"(p_requisition_id uuid, p_approve boolean, p_reason text) to authenticated;
revoke all on function public."review_site_report"(p_report_id uuid, p_approve boolean, p_comment text) from public;
grant execute on function public."review_site_report"(p_report_id uuid, p_approve boolean, p_comment text) to authenticated;
revoke all on function public."run_erp_automations_now"() from public;
grant execute on function public."run_erp_automations_now"() to authenticated;
revoke all on function public."seed_project_construction"(p_project_id uuid) from public;
grant execute on function public."seed_project_construction"(p_project_id uuid) to authenticated;
revoke all on function public."seed_project_preconstruction"(p_project_id uuid) from public;
grant execute on function public."seed_project_preconstruction"(p_project_id uuid) to authenticated;
revoke all on function public."set_employee_number"() from public;
grant execute on function public."set_employee_number"() to authenticated;
revoke all on function public."set_meeting_number"() from public;
grant execute on function public."set_meeting_number"() to authenticated;
revoke all on function public."set_project_document_number"() from public;
grant execute on function public."set_project_document_number"() to authenticated;
revoke all on function public."set_site_report_number"() from public;
grant execute on function public."set_site_report_number"() to authenticated;
revoke all on function public."set_updated_at"() from public;
revoke all on function public."submit_leave_request"(p_employee_id uuid, p_leave_type_id uuid, p_from_date date, p_to_date date, p_days numeric, p_reason text) from public;
grant execute on function public."submit_leave_request"(p_employee_id uuid, p_leave_type_id uuid, p_from_date date, p_to_date date, p_days numeric, p_reason text) to authenticated;
revoke all on function public."submit_material_requisition"(p_requisition_id uuid) from public;
grant execute on function public."submit_material_requisition"(p_requisition_id uuid) to authenticated;
revoke all on function public."submit_payroll_run"(p_run_id uuid) from public;
grant execute on function public."submit_payroll_run"(p_run_id uuid) to authenticated;
revoke all on function public."submit_purchase_order"(p_po_id uuid) from public;
grant execute on function public."submit_purchase_order"(p_po_id uuid) to authenticated;
revoke all on function public."submit_reimbursement"(p_reimbursement_id uuid) from public;
grant execute on function public."submit_reimbursement"(p_reimbursement_id uuid) to authenticated;
revoke all on function public."submit_site_report"(p_report_id uuid) from public;
grant execute on function public."submit_site_report"(p_report_id uuid) to authenticated;
revoke all on function public."submit_vendor_rfq_quote"(p_invite_id uuid, p_quote_ref text, p_valid_until date, p_delivery_days integer, p_payment_terms text, p_items jsonb, p_notes text) from public;
grant execute on function public."submit_vendor_rfq_quote"(p_invite_id uuid, p_quote_ref text, p_valid_until date, p_delivery_days integer, p_payment_terms text, p_items jsonb, p_notes text) to authenticated;
revoke all on function public."sync_invoice_collection"() from public;
revoke all on function public."sync_meeting_action_task"() from public;
grant execute on function public."sync_meeting_action_task"() to authenticated;
revoke all on function public."sync_vendor_bill_payment"() from public;
grant execute on function public."sync_vendor_bill_payment"() to authenticated;
revoke all on function public."validate_application_backup"(p_payload jsonb) from public;
grant execute on function public."validate_application_backup"(p_payload jsonb) to authenticated;
revoke all on function public."verify_reimbursement"(p_reimbursement_id uuid, p_approve boolean, p_reason text) from public;
grant execute on function public."verify_reimbursement"(p_reimbursement_id uuid, p_approve boolean, p_reason text) to authenticated;

-- Core business-unit seed (no Auth user/profile seed)
insert into public.business_units("id","code","name","active","created_at","updated_at") values('6ca59d7f-4ac9-42da-9d73-25162c6bd0e0','BB','Bind Builds',true,'2026-09-20 19:10:39.53098+00','2026-09-20 19:10:39.53098+00') on conflict (id) do nothing;
insert into public.business_units("id","code","name","active","created_at","updated_at") values('9df8f882-bf7d-48e9-9afa-ded71465a2be','SBA','Studio Bind Architects',true,'2026-09-20 19:10:39.53098+00','2026-09-20 19:10:39.53098+00') on conflict (id) do nothing;
insert into public.organisation_profiles("id","business_unit_id","trade_name","legal_name","gstin","pan","address","city","state","state_code","pincode","email","phone","bank_name","account_name","account_no","ifsc","upi","updated_at","updated_by") values('661ec060-ee85-47a8-9fb6-acac65d1791e','6ca59d7f-4ac9-42da-9d73-25162c6bd0e0','Bind Builds',null,null,null,null,'Chennai','Tamil Nadu','33',null,null,null,null,null,null,null,null,'2026-09-22 15:49:14.838822+00',null) on conflict (id) do nothing;
insert into public.organisation_profiles("id","business_unit_id","trade_name","legal_name","gstin","pan","address","city","state","state_code","pincode","email","phone","bank_name","account_name","account_no","ifsc","upi","updated_at","updated_by") values('aba01a71-f38b-488c-be15-f3499add991a','9df8f882-bf7d-48e9-9afa-ded71465a2be','Studio Bind Architects',null,null,null,null,'Chennai','Tamil Nadu','33',null,null,null,null,null,null,null,null,'2026-09-22 15:49:14.838822+00',null) on conflict (id) do nothing;

-- Private ERP document bucket
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('erp-documents','erp-documents',false,52428800,null)
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Scheduled daily operations scan
do $$ begin
  if exists(select 1 from cron.job where jobname='bindbuild-daily-ops-scan') then
    perform cron.unschedule('bindbuild-daily-ops-scan');
  end if;
  perform cron.schedule('bindbuild-daily-ops-scan','30 2 * * *','select private.run_daily_erp_automations();');
end $$;

-- Baseline complete.
