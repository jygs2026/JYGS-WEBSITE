import { expect, test } from "./fixtures";

// HTTP-level checks using the request fixture (no page). Desktop project only — see config.
test.describe("Routing, SEO and crawl", () => {
  test("unknown slugs return 404 on the first request", async ({ request }) => {
    const unique = `never-seen-${Date.now()}`;
    for (const path of [
      `/product/${unique}`,
      "/product/studio-sample-tee",
      `/category/${unique}`,
      `/collections/${unique}`,
      `/policies/${unique}`,
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      expect(await res.text(), path).toContain("Page not found");
    }
  });

  test("internal per-colour product paths are not publicly reachable", async ({ request }) => {
    for (const path of [
      "/product/signature-oversized-tee/colour/white",
      "/product/signature-oversized-tee/colour/purple",
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
    }
    // The public ?colour= URL is served (200) from the prebuilt colour page.
    expect((await request.get("/product/signature-oversized-tee?colour=white")).status()).toBe(200);
    // Invalid colours fall back to the default product page (200, not an error).
    expect((await request.get("/product/signature-oversized-tee?colour=purple")).status()).toBe(
      200,
    );
  });

  test("/search redirects to the shop and keeps the query", async ({ request }) => {
    const res = await request.get("/search?q=orbit", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toMatch(/\/shop\?q=orbit$/);
  });

  test("demo mode keeps the site out of search engines", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /");
    const html = await (await request.get("/shop")).text();
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(html).toMatch(/<link rel="canonical" href="[^"]*\/shop"/);
  });

  test("sitemap lists published products only", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/product/signature-oversized-tee");
    expect(xml).toContain("/category/women");
    expect(xml).not.toContain("studio-sample-tee");
  });

  test("every internal link resolves (crawl)", async ({ request }) => {
    const seen = new Map<string, number>();
    const queue = ["/", "/shop"];
    while (queue.length > 0) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      const res = await request.get(path);
      seen.set(path, res.status());
      if (!res.ok() || !(res.headers()["content-type"] ?? "").includes("text/html")) continue;
      const html = await res.text();
      for (const match of html.matchAll(/href="(\/[^"#?]*)/g)) {
        const href = match[1];
        if (href.startsWith("/_next") || href.includes("favicon") || seen.has(href)) continue;
        queue.push(href);
      }
    }
    const broken = [...seen].filter(([, status]) => status !== 200);
    expect(broken, "broken internal links").toEqual([]);
    expect(seen.size).toBeGreaterThan(20);
  });
});
