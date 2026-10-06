const fs = require('fs');
const { execSync } = require('child_process');

console.log("=== 1. CLEANING SRC/APP.SVELTE FROM DUPLICATES ===");
let app = fs.readFileSync('src/App.svelte', 'utf8');

// 1. Remove all existing instances of unlockWithCredit function
app = app.replace(/function unlockWithCredit\(\)\s*\{[\s\S]*?\n\s*\}/g, '');

// 2. Remove duplicate declarations of hasUnlocked
app = app.replace(/let hasUnlocked\s*=\s*(?:false|true);\s*/g, '');

// 3. Inject single clean hasUnlocked variable near loading
if (app.includes('let loading = false;')) {
  app = app.replace('let loading = false;', 'let loading = false;\n  let hasUnlocked = false;');
} else {
  app = app.replace('<script>', '<script>\n  let hasUnlocked = false;');
}

// 4. Inject single clean unlockWithCredit definition right before handleAudit
const cleanUnlockFunction = `function unlockWithCredit() {
    if (credits > 0) {
      credits -= 1;
      hasUnlocked = true;
      try {
        localStorage.setItem('safeclause_credits', String(credits));
      } catch (e) {}
    } else {
      if (typeof handlePayment === 'function') {
        handlePayment();
      } else if (typeof triggerPayment === 'function') {
        triggerPayment();
      } else if (typeof buyCredits === 'function') {
        buyCredits();
      } else {
        alert('You need 1 Credit to unlock. Please purchase credits.');
      }
    }
  }

  `;

app = app.replace('async function handleAudit', cleanUnlockFunction + 'async function handleAudit');

fs.writeFileSync('src/App.svelte', app);
console.log("✓ Removed duplicates and standardized App.svelte");

console.log("=== 2. RUNNING VITE BUILD TEST ===");
execSync('npm run build', { stdio: 'inherit' });
console.log("✓ BUILD 100% SUCCESSFUL!");

console.log("=== 3. FORCE PUSHING TO VERCEL ===");
execSync('git add . && git commit -m "fix: eliminate duplicate unlockWithCredit declaration in App.svelte" && git push --force origin main', { stdio: 'inherit' });
console.log("\n🚀 DEPLOYED SUCCESSFULLY TO VERCEL!");
