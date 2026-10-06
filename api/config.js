export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const rawKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

  function clean(s) {
    return String(s || '')
      .trim()
      .replace(/^[\"']|[\"']$/g, '')
      .replace(/[\r\n\t\s]+/g, '')
      .trim();
  }

  let url = clean(rawUrl);
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  url = url.replace(/\/+$/, '');

  let key = clean(rawKey);
  if (key.toLowerCase().startsWith('bearer ')) {
    key = key.slice(7).trim();
  }

  return res.status(200).json({
    supabaseUrl: url,
    supabaseAnonKey: key
  });
}
