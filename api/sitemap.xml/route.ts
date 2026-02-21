// Edge function to proxy sitemap to Convex HTTP endpoint
export async function GET(request: Request) {
  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

  if (!convexUrl) {
    return new Response(
      'Configuration error: VITE_CONVEX_URL not set',
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    );
  }

  const convexSiteUrl = convexUrl.replace('.cloud', '.site');
  const targetUrl = `${convexSiteUrl}/sitemap.xml`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/xml',
      },
    });

    if (!response.ok) {
      return new Response('Sitemap not available', {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const xml = await response.text();
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
      },
    });
  } catch {
    return new Response('Failed to fetch sitemap', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
