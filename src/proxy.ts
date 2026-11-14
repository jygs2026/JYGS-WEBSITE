import { NextResponse, type NextRequest } from "next/server";

import { resolveRequestedColourSlug, slugRouteExists } from "@/services/routes";

function notFound(request: NextRequest) {
  // Render the branded not-found page with a 404 status before any streaming starts.
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
}

/**
 * 1. Returns a real HTTP 404 for unknown product, category, collection and policy slugs on the
 *    very first request.
 * 2. Serves `/product/<slug>?colour=<colour>` from the prebuilt per-colour page (internal path
 *    `/product/<slug>/colour/<colour>`), so the requested colourway is in the first HTML response.
 *    The address bar keeps the `?colour=` URL. Invalid colours fall through to the default page.
 * 3. Hides the internal per-colour path: direct requests to it return 404.
 */
export async function proxy(request: NextRequest) {
  const [, section, rawSlug, ...rest] = request.nextUrl.pathname.split("/");

  // Internal per-colour pages are only reachable through the rewrite below.
  if (section === "product" && rest[0] === "colour") return notFound(request);
  if (!rawSlug || rest.length > 0) return NextResponse.next();

  const slug = decode(rawSlug);
  if (!slug || !(await slugRouteExists(section, slug))) return notFound(request);

  if (section === "product") {
    const requested = request.nextUrl.searchParams.get("colour");
    if (requested) {
      const colour = await resolveRequestedColourSlug(slug, requested);
      if (colour) {
        const target = request.nextUrl.clone();
        target.pathname = `/product/${encodeURIComponent(slug)}/colour/${encodeURIComponent(colour)}`;
        return NextResponse.rewrite(target);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/product/:slug",
    "/product/:slug/colour/:colour",
    "/category/:slug",
    "/collections/:slug",
    "/policies/:slug",
  ],
};
