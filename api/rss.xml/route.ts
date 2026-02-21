// Edge function to proxy RSS feed to Convex HTTP endpoint
export async function GET(request: Request) {
  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

  if (!convexUrl) {
    return new Response(
      'Configuration error: VITE_CONVEX_URL not set',
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    );
  }

  const convexSiteUrl = convexUrl.replace('.cloud', '.site');
  const url = new URL(request.url);
  const targetUrl = `${convexSiteUrl}${url.pathname}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/rss+xml',
      },
    });

    if (!response.ok) {
      return new Response('RSS feed not available', {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const xml = await response.text();
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
      },
    });
  } catch {
    return new Response('Failed to fetch RSS feed', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
