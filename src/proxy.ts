import { NextResponse, type NextRequest } from "next/server";

import { slugRouteExists } from "@/services/routes";

/**
 * Returns a real HTTP 404 for unknown product, category, collection and policy slugs on the
 * very first request. Valid slugs pass straight through to the page.
 */
export async function proxy(request: NextRequest) {
  const [, section, rawSlug, ...rest] = request.nextUrl.pathname.split("/");
  if (!rawSlug || rest.length > 0) return NextResponse.next();

  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    slug = "";
  }

  if (slug && (await slugRouteExists(section, slug))) return NextResponse.next();

  // Render the branded not-found page with a 404 status before any streaming starts.
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  matcher: ["/product/:slug", "/category/:slug", "/collections/:slug", "/policies/:slug"],
};
