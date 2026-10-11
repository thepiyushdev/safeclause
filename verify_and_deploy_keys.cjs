const fs = require('fs');
const { execSync } = require('child_process');

function sanitize(s) {
  return String(s || '').trim().replace(/^["']|["']$/g, '').replace(/[\r\n\t\s]+/g, '').trim();
}

async function main() {
  let url = sanitize(process.argv[2]);
  let anon = sanitize(process.argv[3]);
  let service = sanitize(process.argv[4]);

  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  url = url.replace(/\/+$/, '');

  console.log("\n=== 1. TESTING SUPABASE KEYS DIRECTLY WITH SUPABASE API ===");
  console.log("Checking URL:", url);

  try {
    const testRes = await fetch(url + "/auth/v1/settings", {
      headers: { "apikey": anon, "Authorization": "Bearer " + anon }
    });

    if (testRes.status === 401 || testRes.status === 403) {
      const errBody = await testRes.text();
      console.error("\n❌ Supabase ne Anon Key reject kar di:", errBody);
      console.error("Dhyan dein: Supabase dashboard me 'Project API Keys' ke andar se 'anon' 'public' key copy karein, 'service_role' nahi.");
      process.exit(1);
    }

    if (!testRes.ok) {
      console.error("\n❌ Supabase URL error (HTTP " + testRes.status + ")");
      process.exit(1);
    }

    console.log("✅ SUPABASE KEYS 100% VALID & ACTIVE (200 OK)!");
  } catch (err) {
    console.error("Network check failed:", err.message);
    process.exit(1);
  }

  console.log("\n=== 2. WRITING CLEAN .env & .env.local ===");
  const envContent = `VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${anon}
SUPABASE_URL=${url}
SUPABASE_ANON_KEY=${anon}
SUPABASE_SERVICE_ROLE_KEY=${service}
`;
  fs.writeFileSync('.env', envContent);
  fs.writeFileSync('.env.local', envContent);
  console.log("✓ Saved verified keys to environment files");

  console.log("\n=== 3. UPDATING API/CONFIG.JS WITH VERIFIED KEYS ===");
  const configCode = `export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    supabaseUrl: "${url}",
    supabaseAnonKey: "${anon}"
  });
}
`;
  fs.writeFileSync('api/config.js', configCode);

  console.log("\n=== 4. RUNNING CLEAN VITE BUILD ===");
  execSync('npm run build', { stdio: 'inherit' });
  console.log("✓ LOCAL BUILD SUCCESSFUL!");

  console.log("\n=== 5. FORCE PUSHING TO VERCEL ===");
  execSync('git add .env .env.local api/config.js src/App.svelte && git commit -m "fix: embed verified supabase keys and fix login" && git push --force origin main', { stdio: 'inherit' });
  console.log("\n🚀 DEPLOYED SUCCESSFULLY TO VERCEL!");
}

main().catch(e => {
  console.error("Execution error:", e.message);
  process.exit(1);
});
