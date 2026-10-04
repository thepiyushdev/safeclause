export function GET() {
  const body = `User-agent: *
Allow: /

# Generative AI & Search Engine Crawlers
User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: https://safeclause-nine.vercel.app/sitemap.xml`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'max-age=0, s-maxage=3600'
    }
  });
}
