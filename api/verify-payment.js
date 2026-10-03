import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cetzbjzpgomuvgrcggjs.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, expectedPrice, planName, userId } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Payment screenshot is required.' });
  }

  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) {
    return res.status(500).json({ error: 'OpenRouter API key is missing on server.' });
  }

  try {
    // 1. OpenRouter Stable Multimodal Vision Model (Gemini Flash 1.5)
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': 'https://safeclause-nine.vercel.app',
        'X-Title': 'SafeClause Payment Auditor'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [
          {
            role: 'system',
            content: `You are a financial fraud verification system in India.
Inspect the uploaded UPI payment receipt screenshot (FamPay, Paytm, PhonePe, Google Pay, GPay, BHIM, Bank).

Target Payee Name: "Ashok Ray" (allow case insensitivity).
Target Amount: ${expectedPrice} INR.

Verification Criteria:
1. Status must indicate SUCCESS / PAID / COMPLETED.
2. Amount must be equal to or greater than ${expectedPrice}. If the receipt shows 1 INR or anything less than ${expectedPrice}, amount_valid must be FALSE.
3. Payee name must match Ashok Ray.
4. Extract the 12-digit UPI Reference / UTR Number.

Return ONLY a valid JSON object:
{
  "is_valid_receipt": true/false,
  "status_success": true/false,
  "payee_name": "extracted payee name",
  "payee_matches": true/false,
  "amount_paid": number,
  "amount_valid": true/false,
  "utr_number": "12-digit string or null",
  "rejection_reason": "Clear explanation in English if rejected, or null if approved"
}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Verify if this receipt shows a successful payment of exactly ₹${expectedPrice} to Ashok Ray.` },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      throw new Error(aiData.error?.message || 'AI Vision scan failed.');
    }

    const parsedContent = JSON.parse(aiData.choices[0].message.content);

    // 2. Fraud & Rule Checks
    if (!parsedContent.is_valid_receipt || !parsedContent.status_success) {
      return res.status(400).json({ error: parsedContent.rejection_reason || 'Screenshot is not a valid successful payment receipt.' });
    }

    if (!parsedContent.payee_matches) {
      return res.status(400).json({ error: `Payee mismatch: Paid to "${parsedContent.payee_name}" instead of Ashok Ray.` });
    }

    if (!parsedContent.amount_valid || parsedContent.amount_paid < expectedPrice) {
      return res.status(400).json({ error: `Amount mismatch: Receipt shows ₹${parsedContent.amount_paid}, but ₹${expectedPrice} is required.` });
    }

    const detectedUtr = parsedContent.utr_number ? String(parsedContent.utr_number).replace(/\D/g, '') : null;
    if (!detectedUtr || detectedUtr.length < 8) {
      return res.status(400).json({ error: 'Could not extract a clear 12-digit UTR from the receipt.' });
    }

    // 3. Database Duplicate UTR Check
    const supabase = createClient(supabaseUrl, supabaseServiceKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldHpianpwZ29tdXZncmNnZ2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTE1NzcsImV4cCI6MjEwNjUyNzU3N30.R2tV8fWGVKIG6G44PcQvjwTkwLWnhGcOjkH_mwT4Z_0");

    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('payment_id', detectedUtr)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: `This UTR (${detectedUtr}) has already been used previously!` });
    }

    // 4. Grant Credits to User
    const creditsToAdd = planName.toLowerCase().includes('pro') ? 10 : 1;

    if (userId) {
      await supabase.from('payments').insert({
        user_id: userId,
        amount: parsedContent.amount_paid,
        currency: 'INR',
        plan_type: planName.toLowerCase().includes('pro') ? 'pro_monthly' : 'single_pass',
        payment_id: detectedUtr,
        payment_status: 'ai_verified_success'
      });

      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      const newCredits = ((profile?.credits) || 0) + creditsToAdd;

      await supabase
        .from('profiles')
        .upsert({ id: userId, credits: newCredits });

      return res.status(200).json({
        success: true,
        credits: newCredits,
        utr: detectedUtr,
        amount: parsedContent.amount_paid
      });
    }

    return res.status(200).json({ success: true, credits: creditsToAdd, utr: detectedUtr });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Verification service error.' });
  }
}
