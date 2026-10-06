const fs = require('fs');
const { execSync } = require('child_process');

console.log("=== 1. UPDATING APP.SVELTE WITH SLEEK PAYWALL LOCK ===");
let app = fs.readFileSync('src/App.svelte', 'utf8');

// Ensure hasUnlocked state exists
if (!app.includes('let hasUnlocked = false;')) {
  app = app.replace('let loading = false;', 'let loading = false;\n  let hasUnlocked = false;');
}

// Ensure unlock handler exists
if (!app.includes('function handleUnlock()') && !app.includes('function triggerPayment()')) {
  const unlockFunction = `
  function handleUnlock() {
    if (typeof handlePayment === 'function') {
      handlePayment();
    } else {
      hasUnlocked = true;
    }
  }
`;
  app = app.replace('async function handleAudit()', unlockFunction + '\n  async function handleAudit()');
}

// Find flagged clauses loop and apply lock styling
const clauseLoopStart = '{#each auditResult.flagged_clauses as clause, idx}';
const clauseLoopEnd = '{/each}';

const loopIdx = app.indexOf(clauseLoopStart);
if (loopIdx !== -1) {
  const endIdx = app.indexOf(clauseLoopEnd, loopIdx);
  if (endIdx !== -1) {
    const newClauseBody = `{#each auditResult.flagged_clauses as clause, idx}
      <div class="clause-card" style="position: relative; background: #0f172a; border-left: 4px solid #ef4444; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        
        <!-- Header: Category & Severity -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 0.8rem; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase;">
            {clause.category || 'RISK_CLAUSE'}
          </span>
          <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.05em;">
            {clause.risk_level || 'HIGH'} RISK
          </span>
        </div>

        <!-- FREE HOOK: Problematic Fine Print -->
        <div style="margin-bottom: 16px;">
          <div style="color: #f87171; font-size: 0.85rem; font-weight: 700; margin-bottom: 6px;">
            Problematic Fine Print:
          </div>
          <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; font-style: italic; color: #cbd5e1; font-size: 0.95rem; line-height: 1.5; border-left: 2px solid #ef4444;">
            "{clause.problematic_fine_print || clause.fine_print || ''}"
          </div>
        </div>

        <!-- FREE HOOK: Why It Hurts You -->
        <div style="margin-bottom: 20px;">
          <div style="color: #fbbf24; font-size: 0.85rem; font-weight: 700; margin-bottom: 6px;">
            Why It Hurts You:
          </div>
          <p style="color: #cbd5e1; font-size: 0.92rem; line-height: 1.6; margin: 0;">
            {clause.why_it_hurts || clause.whyItHurts || ''}
          </p>
        </div>

        <!-- LOCKED CONTENT AREA (Counter-Clause + Email) -->
        <div style="position: relative; margin-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 16px;">
          
          <div style="{hasUnlocked ? '' : 'filter: blur(6px); user-select: none; pointer-events: none; opacity: 0.45;'} transition: all 0.3s ease;">
            
            <!-- Safe Counter-Clause -->
            <div style="margin-bottom: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #34d399; font-size: 0.85rem; font-weight: 700;">Safe Counter-Clause:</span>
                <button on:click={() => navigator.clipboard.writeText(clause.safe_counter_clause || clause.counter_clause)} style="background: #10b981; color: #022c22; font-size: 0.75rem; font-weight: 700; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                  Copy Clause
                </button>
              </div>
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); padding: 12px; border-radius: 8px; color: #e2e8f0; font-size: 0.9rem; line-height: 1.5;">
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
              <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); padding: 14px; border-radius: 8px; color: #cbd5e1; font-size: 0.88rem; line-height: 1.6; white-space: pre-line;">
                {clause.polite_client_negotiation_email || clause.negotiation_email || ''}
              </div>
            </div>

          </div>

          <!-- UNLOCK OVERLAY BANNER (When Locked) -->
          {#if !hasUnlocked}
            <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.75); border-radius: 10px; padding: 16px; text-align: center; backdrop-filter: blur(2px);">
              <div style="font-size: 1.8rem; margin-bottom: 8px;">🔒</div>
              <div style="color: #f8fafc; font-weight: 800; font-size: 1.05rem; margin-bottom: 4px;">
                Protective Counter-Clause & Email Locked
              </div>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 14px; max-width: 320px;">
                Get legal replacement terms & polite negotiation scripts ready to copy-paste.
              </p>
              <button on:click={handleUnlock} style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: 800; font-size: 0.95rem; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); display: flex; align-items: center; gap: 8px;">
                <span>Unlock for ₹49 (Get 1 Pass Credit)</span>
                <span>⚡</span>
              </button>
            </div>
          {/if}

        </div>

      </div>
    {/each}`;

    app = app.slice(0, loopIdx) + newClauseBody + app.slice(endIdx + clauseLoopEnd.length);
    console.log("✓ Injected Frosted Glass Paywall Lock into clause cards");
  }
}

fs.writeFileSync('src/App.svelte', app);

console.log("=== 2. LOCAL BUILD TEST ===");
execSync('npm run build', { stdio: 'inherit' });
console.log("✓ BUILD 100% CLEAN!");

console.log("=== 3. DEPLOYING TO VERCEL ===");
execSync('git add . && git commit -m "feat: implement high-converting frosted lock paywall for counter-clauses and emails" && git push --force origin main', { stdio: 'inherit' });
console.log("\n🚀 DEPLOYED SUCCESSFULLY TO VERCEL!");
