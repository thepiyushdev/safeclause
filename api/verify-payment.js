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

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel settings.' });
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // Full Multimodal Models Fallback Chain
  const visionFallbackChain = [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-pro-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
  ];

  const promptText = `You are a strict Indian payment verification auditor.
Inspect the attached UPI payment screenshot (FamPay, Paytm, PhonePe, Google Pay, GPay, BHIM, Bank).

Verification Rules:
1. Payee Verification: Must match "Ashok Ray" (allow minor case differences).
2. Amount Verification: Must be EQUAL TO OR GREATER THAN ${expectedPrice} INR. If the screenshot shows 1 INR or any amount below ${expectedPrice}, amount_valid must be FALSE.
3. Status: Must clearly show SUCCESS, PAID, or COMPLETED.
4. Extract 12-digit UPI Reference / UTR Number.

Return ONLY a clean JSON object with no markdown formatting:
{
  "is_valid_receipt": true,
  "status_success": true,
  "payee_name": "detected payee name",
  "payee_matches": true,
  "amount_paid": 49,
  "amount_valid": true,
  "utr_number": "12-digit string or null",
  "rejection_reason": null
}`;

  let parsedContent = null;
  let activeModelUsed = '';
  let modelErrors = [];

  // Sequential Fallback Execution
  for (const model of visionFallbackChain) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        modelErrors.push(`${model}: ${errJson.error?.message || response.statusText}`);
        continue; // Move to next fallback model
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
          activeModelUsed = model;
          break; // Successfully scanned
        }
      }
    } catch (err) {
      modelErrors.push(`${model}: ${err.message}`);
      continue;
    }
  }

  if (!parsedContent) {
    return res.status(500).json({
      error: `All vision models unavailable. ${modelErrors[0] || 'Please retry in a moment.'}`
    });
  }

  // 1. Business Logic Checks
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

  // 2. Supabase Duplicate UTR Check
  const supabase = createClient(supabaseUrl, supabaseServiceKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldHpianpwZ29tdXZncmNnZ2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTE1NzcsImV4cCI6MjEwNjUyNzU3N30.R2tV8fWGVKIG6G44PcQvjwTkwLWnhGcOjkH_mwT4Z_0");

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('payment_id', detectedUtr)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(400).json({ error: `This UTR (${detectedUtr}) has already been redeemed previously!` });
  }

  // 3. Grant Credits
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
      amount: parsedContent.amount_paid,
      modelUsed: activeModelUsed
    });
  }

  return res.status(200).json({ success: true, credits: creditsToAdd, utr: detectedUtr, modelUsed: activeModelUsed });
}
