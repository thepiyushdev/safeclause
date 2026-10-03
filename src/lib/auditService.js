import { supabase } from './supabase.js';

export async function runContractAudit({ contractTitle, contractText, jurisdiction, userId }) {
  // 1. Call AI Audit API
  const res = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractTitle, contractText, jurisdiction })
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Audit failed');

  const auditData = json.data;

  // 2. If user is logged in, save to Supabase audits table
  if (userId) {
    try {
      await supabase.from('audits').insert({
        user_id: userId,
        contract_title: contractTitle || 'Untitled Agreement',
        overall_risk_score: auditData.overall_risk_score,
        summary_notes: auditData.summary,
        full_analysis_json: auditData
      });

      // Update quota count
      await supabase.rpc('increment_audit_count', { user_row_id: userId }).catch(() => {
        // Fallback update if RPC not present
        supabase.from('profiles').update({ free_audits_used: 1 }).eq('id', userId);
      });
    } catch (dbErr) {
      console.warn("DB save skipped or offline:", dbErr.message);
    }
  }

  return auditData;
}
