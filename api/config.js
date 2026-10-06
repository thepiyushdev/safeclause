export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    supabaseUrl: "https://cetzbjzpgomuvgrcggjs.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldHpianpwZ29tdXZncmNnZ2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTE1NzcsImV4cCI6MjEwNjUyNzU3N30.R2tV8fWGVKIG6G44PcQvjwTkwLWnhGcOjkH_mwT4Z_0"
  });
}
