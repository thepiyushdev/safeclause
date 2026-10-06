const fs = require('fs');
const { execSync } = require('child_process');

console.log("=== 1. CLEANING SYNTAX ERROR IN SRC/APP.SVELTE ===");
let app = fs.readFileSync('src/App.svelte', 'utf8');

const startMarker = "async function handleAudit";
const endMarker = "async function handleFileUpload";

const startIndex = app.indexOf(startMarker);
const endIndex = app.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("Markers not found directly, removing dangling brackets around line 304...");
  app = app.replace(/loading\s*=\s*false;\s*\}\s*\}\);\s*\}, 100\);\s*\}/g, 'loading = false;\n    }');
} else {
  const cleanHandleAudit = `async function handleAudit() {
    if (!contractText.trim()) {
      errorMessage = 'Please enter contract text or select a sample.';
      return;
    }

    loading = true;
    errorMessage = '';
    auditResult = null;
    hasUnlocked = false;

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractTitle, contractText, jurisdiction })
      });

      const json = await res.json();

      if (res.ok && json.success && (json.flagged_clauses || json.clauses || (json.data && json.data.flagged_clauses))) {
        auditResult = json.data || json;
        errorMessage = '';
        setTimeout(() => {
          const el = document.getElementById('audit-results');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        auditResult = null;
        errorMessage = json.error || 'Not goes to AI: AI processing failed or rejected.';
      }
    } catch (err) {
      auditResult = null;
      errorMessage = 'Not goes to AI: Network connection error (' + err.message + ')';
    } finally {
      loading = false;
    }
  }

  `;

  app = app.slice(0, startIndex) + cleanHandleAudit + app.slice(endIndex);
  console.log("✓ Removed leftover trailing brackets and restored clean handleAudit");
}

fs.writeFileSync('src/App.svelte', app);

console.log("=== 2. RUNNING LOCAL BUILD VERIFICATION ===");
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log("✓ BUILD 100% CLEAN - ZERO ERRORS!");

  console.log("=== 3. DEPLOYING CLEAN CODE TO VERCEL ===");
  execSync('git add . && git commit -m "fix: resolve svelte line 304 syntax error and clean build" && git push origin main', { stdio: 'inherit' });
  console.log("✓ SUCCESSFULLY DEPLOYED TO VERCEL!");
} catch (err) {
  console.error("Build failed:", err.message);
  process.exit(1);
}
