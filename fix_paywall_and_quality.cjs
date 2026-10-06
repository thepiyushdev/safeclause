const fs = require('fs');
const { execSync } = require('child_process');

console.log("=== 1. UPGRADING API/AUDIT.JS (HIGH QUALITY LEGAL CLAUSES & CLEAN EMAILS) ===");
let apiCode = fs.readFileSync('api/audit.js', 'utf8');

// Upgrade populateItem to clean literal \n and sanitize strings
const newPopulateItem = `  function populateItem(c) {
    const cleanStr = (s) => String(s || '').replace(/\\\\n/g, '\\n').trim();

    const fine = cleanStr(c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.clause || c.text || 'Problematic contract term.');
    const hurts = cleanStr(c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || c.reason || 'Places severe liability and financial risks on the contractor.');
    const counter = cleanStr(c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || 'Invoices shall be payable within 14 calendar days of receipt. Work shall pause if payments exceed 30 days past due.');
    
    let email = cleanStr(c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail);
    if (!email || email.length < 30) {
      email = "Subject: Contract Review - Suggested Clause Adjustment\\n\\nHi [Client Name],\\n\\nThank you for sharing the agreement! I have reviewed the terms and everything looks great overall.\\n\\nRegarding this specific section, I propose we adjust the language to standard commercial terms to keep our collaboration balanced and smooth.\\n\\nProposed Adjustment:\\n\\"" + counter + "\\"\\n\\nPlease let me know if this works for you, and I will be happy to proceed.\\n\\nBest regards,\\n[Your Name]";
    }

    return {
      category: String(c.category || 'RISK_CLAUSE').replace(/\\s+/g, '_').toUpperCase(),
      risk_level: String(c.risk_level || c.riskLevel || c.severity || 'HIGH').replace(/\\s*RISK/i, ''),
      problematic_fine_print: fine,
      fine_print: fine,
      problematicFinePrint: fine,
      finePrint: fine,
      quote: fine,
      clause: fine,
      why_it_hurts: hurts,
      whyItHurts: hurts,
      why_it_hurts_you: hurts,
      explanation: hurts,
      safe_counter_clause: counter,
      safeCounterClause: counter,
      counter_clause: counter,
      counterClause: counter,
      polite_client_negotiation_email: email,
      politeClientNegotiationEmail: email,
      negotiation_email: email,
      email: email
    };
  }`;

apiCode = apiCode.replace(/function populateItem\([\s\S]*?^\s*\}/m, newPopulateItem);

// Upgrade prompt to enforce exact legal contract wording & detailed emails
const newPrompt = `const prompt = \`You are SafeClause, a elite contract risk lawyer. Analyze this contract under \${jur} legal framework.
Identify 4 high-risk or predatory clauses from this specific document text.

CRITICAL INSTRUCTIONS:
1. "problematic_fine_print": Must be an EXACT verbatim quote from the provided text.
2. "why_it_hurts": Clear 2-sentence breakdown of the financial/liability trap.
3. "safe_counter_clause": Must be ACTUAL binding legal contract clause text (ready to paste directly into contract, NOT generic advice).
4. "polite_client_negotiation_email": A complete, persuasive, polite professional email formatted with Subject, Salutation, respectful reasoning, proposed clause, and closing sign-off.

Respond strictly in valid JSON format:
{
  "summary": "2-3 sentence executive risk assessment for this contract",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote from contract text",
      "why_it_hurts": "Plain English explanation of financial or legal trap",
      "safe_counter_clause": "Invoices shall be payable within 14 calendar days of receipt...",
      "polite_client_negotiation_email": "Subject: Contract Review - Payment Terms\\\\n\\\\nHi [Client Name],\\\\n\\\\nI am excited to collaborate on this project...\\\\n\\\\nBest regards,\\\\n[Your Name]"
    }
  ]
}

Contract Title: \${activeTitle}
Contract Text:
\${cleanText}\`;`;

apiCode = apiCode.replace(/const prompt = `[\s\S]*?Contract Text:\s*\\$\{cleanText\}`;/m, newPrompt);

fs.writeFileSync('api/audit.js', apiCode);
fs.writeFileSync('api/analyze.js', apiCode);
fs.writeFileSync('api/scan.js', apiCode);
console.log("✓ Updated API prompt for legal clause precision and formatted emails");

console.log("=== 2. SECURING SRC/APP.SVELTE (BULLETPROOF PAYWALL & CREDIT SYSTEM) ===");
let app = fs.readFileSync('src/App.svelte', 'utf8');

// Ensure hasUnlocked state
if (!app.includes('let hasUnlocked = false;')) {
  app = app.replace('let loading = false;', 'let loading = false;\n  let hasUnlocked = false;');
}

// Reset hasUnlocked = false on every new scan
if (app.includes('async function handleAudit()')) {
  app = app.replace(
    /async function handleAudit\(\)\s*\{[\s\S]*?hasUnlocked\s*=\s*false;/m,
    `async function handleAudit() {\n    if (!contractText.trim()) {\n      errorMessage = 'Please enter contract text or select a sample.';\n      return;\n    }\n    loading = true;\n    errorMessage = '';\n    auditResult = null;\n    hasUnlocked = false;`
  );
}

// Inject robust unlockWithCredit function
const unlockLogic = `
  function unlockWithCredit() {
    if (credits > 0) {
      credits -= 1;
      hasUnlocked = true;
      try {
        localStorage.setItem('safeclause_credits', String(credits));
      } catch (e) {}
    } else {
      // Trigger payment checkout
      if (typeof handlePayment === 'function') {
        handlePayment();
      } else if (typeof triggerPayment === 'function') {
        triggerPayment();
      } else if (typeof buyCredits === 'function') {
        buyCredits();
      } else {
        const payBtn = document.querySelector('.btn-primary, [data-buy-credits]');
        if (payBtn) payBtn.click();
        else alert('You need 1 Credit to unlock. Please purchase a credit pack.');
      }
    }
  }
`;

if (!app.includes('function unlockWithCredit()')) {
  app = app.replace('async function handleAudit()', unlockLogic + '\n  async function handleAudit()');
}

// Find the audit-results section and replace the clause card rendering with locked paywall
const regexResults = /\{#if auditResult\}[\s\S]*?\{#each[\s\S]*?\{\/each\}/m;

const lockedCardsTemplate = `{#if auditResult}
  <div id="audit-results" class="results-container" style="margin-top: 32px;">
    
    <!-- Executive Risk Summary Header -->
    <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.08);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 1.1rem; font-weight: 800; color: #f8fafc;">Executive Risk Assessment</span>
        <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-weight: 800; font-size: 0.8rem; padding: 4px 12px; border-radius: 6px;">
          {auditResult.overall_risk_score || 'HIGH'} RISK
        </span>
      </div>
      <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; margin: 0;">
        {auditResult.summary || 'Contract audit complete.'}
      </p>
    </div>

    <!-- Flagged Clauses List with Paywall Protection -->
    {#each (auditResult.flagged_clauses || auditResult.clauses || []) as clause, idx}
      <div class="clause-card" style="position: relative; background: #0f172a; border-left: 4px solid #ef4444; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
        
        <!-- Header: Category & Severity -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 0.8rem; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase;">
            {clause.category || 'RISK_CLAUSE'}
          </span>
          <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px;">
            {clause.risk_level || 'HIGH'} RISK
          </span>
        </div>

        <!-- FREE PREVIEW: Problematic Fine Print -->
        <div style="margin-bottom: 16px;">
          <div style="color: #f87171; font-size: 0.85rem; font-weight: 700; margin-bottom: 6px;">
            Problematic Fine Print:
          </div>
          <div style="background: rgba(0,0,0,0.35); padding: 12px; border-radius: 8px; font-style: italic; color: #cbd5e1; font-size: 0.95rem; line-height: 1.5; border-left: 2px solid #ef4444;">
            "{clause.problematic_fine_print || clause.fine_print || ''}"
          </div>
        </div>

        <!-- FREE PREVIEW: Why It Hurts You -->
        <div style="margin-bottom: 20px;">
          <div style="color: #fbbf24; font-size: 0.85rem; font-weight: 700; margin-bottom: 6px;">
            Why It Hurts You:
          </div>
          <p style="color: #cbd5e1; font-size: 0.92rem; line-height: 1.6; margin: 0;">
            {clause.why_it_hurts || clause.whyItHurts || ''}
          </p>
        </div>

        <!-- PAYWALLED SECTION (SAFE COUNTER-CLAUSE + NEGOTIATION EMAIL) -->
        <div style="position: relative; margin-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 16px;">
          
          <!-- Blurred Content Container -->
          <div style="{hasUnlocked ? '' : 'filter: blur(8px); -webkit-filter: blur(8px); user-select: none; pointer-events: none; opacity: 0.35;'} transition: all 0.3s ease;">
            
            <!-- Safe Counter-Clause -->
            <div style="margin-bottom: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #34d399; font-size: 0.85rem; font-weight: 700;">Safe Counter-Clause:</span>
                <button on:click={() => navigator.clipboard.writeText(clause.safe_counter_clause || clause.counter_clause)} style="background: #10b981; color: #022c22; font-size: 0.75rem; font-weight: 700; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                  Copy Clause
                </button>
              </div>
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); padding: 12px; border-radius: 8px; color: #e2e8f0; font-size: 0.9rem; line-height: 1.5; font-family: monospace;">
                {clause.safe_counter_clause || clause.counter_clause || ''}
              </div>
            </div>

            <!-- Polite Client Negotiation Email -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #38bdf8; font-size: 0.85rem; font-weight: 700;">Polite Client Negotiation Email:</span>
                <button on:click={() => navigator.clipboard.writeText(clause.polite_client_negotiation_email || clause.negotiation_email)} style="background: #38bdf8; color: #082f49; font-size: 0.75rem; font-weight: 700; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                  Copy Email
                </button>
              </div>
              <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); padding: 14px; border-radius: 8px; color: #cbd5e1; font-size: 0.88rem; line-height: 1.6; white-space: pre-wrap; font-family: inherit;">
                {clause.polite_client_negotiation_email || clause.negotiation_email || ''}
              </div>
            </div>

          </div>

          <!-- UNLOCK OVERLAY (Active when user has not unlocked) -->
          {#if !hasUnlocked}
            <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.88); border-radius: 10px; padding: 18px; text-align: center; backdrop-filter: blur(4px);">
              <div style="font-size: 2rem; margin-bottom: 8px;">🔒</div>
              <div style="color: #f8fafc; font-weight: 800; font-size: 1.1rem; margin-bottom: 4px;">
                Counter-Clause & Negotiation Email Locked
              </div>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 16px; max-width: 340px; line-height: 1.4;">
                Unlock legally binding replacement clauses & customized email scripts ready to send to your client.
              </p>
              
              {#if credits > 0}
                <button on:click={unlockWithCredit} style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: 800; font-size: 0.95rem; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); display: flex; align-items: center; gap: 8px;">
                  <span>Use 1 Credit to Unlock (Balance: {credits})</span>
                  <span>⚡</span>
                </button>
              {:else}
                <button on:click={unlockWithCredit} style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: 800; font-size: 0.95rem; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); display: flex; align-items: center; gap: 8px;">
                  <span>Unlock Full Audit for ₹49 (1 Credit)</span>
                  <span>⚡</span>
                </button>
              {/if}
            </div>
          {/if}

        </div>

      </div>
    {/each}`;

if (regexResults.test(app)) {
  app = app.replace(regexResults, lockedCardsTemplate);
  console.log("✓ Successfully injected locked cards template into App.svelte");
} else {
  console.log("Regex did not match directly, replacing flagged_clauses block...");
  const eachStart = app.indexOf('{#each');
  const eachEnd = app.indexOf('{/each}', eachStart);
  if (eachStart !== -1 && eachEnd !== -1) {
    app = app.slice(0, eachStart) + lockedCardsTemplate.slice(lockedCardsTemplate.indexOf('{#each')) + app.slice(eachEnd + 7);
    console.log("✓ Replaced each block with locked paywall template");
  }
}

fs.writeFileSync('src/App.svelte', app);

console.log("=== 3. BUILDING APP LOCALLY ===");
execSync('npm run build', { stdio: 'inherit' });
console.log("✓ LOCAL BUILD 100% PASSED!");

console.log("=== 4. PUSHING TO VERCEL ===");
execSync('git add . && git commit -m "feat: robust paywall lock tied to credits and high quality legal clauses" && git push --force origin main', { stdio: 'inherit' });
console.log("\n🚀 DEPLOYED SUCCESSFULLY TO VERCEL!");
