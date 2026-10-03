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

  // Active OpenRouter Free Multimodal Vision Models
  const candidateModels = [
    'meta-llama/llama-3.2-11b-vision-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'qwen/qwen-2-vl-72b-instruct:free'
  ];

  let parsedContent = null;
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterApiKey}`,
          'HTTP-Referer': 'https://safeclause-nine.vercel.app',
          'X-Title': 'SafeClause Receipt Auditor'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `You are an Indian payment fraud detector.
Inspect the uploaded UPI payment receipt screenshot (FamPay, Paytm, PhonePe, Google Pay, GPay, BHIM, Bank).

Target Payee Name: "Ashok Ray" (allow minor case differences).
Target Amount: ${expectedPrice} INR.

Verification Rules:
1. Status must indicate SUCCESS / PAID / COMPLETED.
2. Amount must be equal to or greater than ${expectedPrice}. If receipt shows 1 INR or anything less than ${expectedPrice}, amount_valid must be FALSE.
3. Payee name must match Ashok Ray.
4. Extract the 12-digit UPI Reference / UTR Number.

Output ONLY valid JSON:
{
  "is_valid_receipt": true,
  "status_success": true,
  "payee_name": "detected payee name",
  "payee_matches": true,
  "amount_paid": 49,
  "amount_valid": true,
  "utr_number": "12-digit string or null",
  "rejection_reason": null
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
          temperature: 0.1
        })
      });

      const aiData = await aiResponse.json();
      if (!aiResponse.ok) {
        lastError = aiData.error?.message || `Model ${model} failed`;
        continue; // Try next model
      }

      const rawText = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
        break; // Successfully got parsed JSON from vision AI
      }
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  if (!parsedContent) {
    return res.status(500).json({ error: `Vision AI pipeline busy. ${lastError || 'Please try again in 10 seconds.'}` });
  }

  // 1. Business & Fraud Rule Validations
  if (!parsedContent.is_valid_receipt || !parsedContent.status_success) {
    return res.status(400).json({ error: parsedContent.rejection_reason || 'Screenshot does not appear to be a completed payment receipt.' });
  }

  if (!parsedContent.payee_matches) {
    return res.status(400).json({ error: `Payee mismatch: Paid to "${parsedContent.payee_name}" instead of Ashok Ray.` });
  }

  if (!parsedContent.amount_valid || parsedContent.amount_paid < expectedPrice) {
    return res.status(400).json({ error: `Amount mismatch: Receipt shows ₹${parsedContent.amount_paid}, but ₹${expectedPrice} is required.` });
  }

  const detectedUtr = parsedContent.utr_number ? String(parsedContent.utr_number).replace(/\D/g, '') : null;
  if (!detectedUtr || detectedUtr.length < 8) {
    return res.status(400).json({ error: 'Could not detect a clear 12-digit UTR on the receipt.' });
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
      amount: parsedContent.amount_paid
    });
  }

  return res.status(200).json({ success: true, credits: creditsToAdd, utr: detectedUtr });
}
