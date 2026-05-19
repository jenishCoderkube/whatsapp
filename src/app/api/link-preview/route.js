import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
    }

    // Add protocol if missing
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 500 });
    }

    const html = await res.text();

    // Extract title
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1];
    }

    // Extract OG Title
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || 
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    }

    // Extract Description
    let description = "";
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) {
      description = descMatch[1];
    }

    // Extract OG Description
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDescMatch) {
      description = ogDescMatch[1];
    }

    // Extract OG Image
    let image = "";
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImageMatch) {
      image = ogImageMatch[1];
    }

    // Extract Site Name
    let siteName = "";
    const ogSiteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
    if (ogSiteMatch) {
      siteName = ogSiteMatch[1];
    }

    // Resolve domain name
    let domain = "";
    try {
      domain = new URL(targetUrl).hostname;
    } catch (e) {}

    // HTML entities decoding for basic titles
    const decodeHtmlEntities = (str) => {
      if (!str) return "";
      return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    };

    return NextResponse.json({
      title: decodeHtmlEntities(title),
      description: decodeHtmlEntities(description),
      image,
      siteName: decodeHtmlEntities(siteName) || domain,
      domain,
      url: targetUrl,
    });
  } catch (error) {
    console.error("Link preview scraping error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
