import { siteConfig } from "@/config/site";

/** Site-wide strip stating that catalogue content is placeholder data. Driven by `demoMode`. */
export function DemoNotice() {
  if (!siteConfig.demoMode) return null;
  return (
    <div role="note" className="bg-stone text-ink">
      <p className="container-site py-1.5 text-center text-[11px] leading-snug sm:text-xs">
        <span className="font-semibold tracking-label uppercase">Demo preview</span>
        <span aria-hidden> · </span>
        Products, prices, stock and images are placeholders until the JYGS catalogue is supplied.
      </p>
    </div>
  );
}
