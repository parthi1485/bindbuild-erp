import { supabase } from './supabase.js';

export async function nextErpNumber(type, issueDate = new Date()) {
  const { data, error } = await supabase.rpc('next_erp_number', {
    p_doc_type: type,
    p_date: issueDate.toISOString().slice(0, 10)
  });
  if (error) throw error;
  return data;
}

export async function issueDocumentNumber(type, {
  issueDate = new Date(),
  leadId = null,
  projectId = null,
  clientId = null,
  amount = 0,
  status = 'issued',
  metadata = {}
} = {}) {
  const { data, error } = await supabase.rpc('issue_document_number', {
    p_doc_type: type,
    p_issue_date: issueDate.toISOString().slice(0, 10),
    p_lead_id: leadId,
    p_project_id: projectId,
    p_client_id: clientId,
    p_amount: Number(amount || 0),
    p_status: status,
    p_metadata: metadata
  });
  if (error) throw error;
  return data;
}
