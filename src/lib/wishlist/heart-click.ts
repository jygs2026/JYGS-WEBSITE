/**
 * Whether a heart click may act (M3.4 QA fix).
 *
 * The listing is streamed and revealed before it is hydrated, so a heart can be clicked while it
 * still shows "loading". When such a click arrives, React hydrates that part of the page
 * synchronously and then delivers the SAME click event to the now-hydrated heart. If the wishlist
 * has already loaded by then, the handler would act on a click the customer made on a heart that
 * still showed "loading" (verified in the browser under load).
 *
 * So a click is accepted only if it ARRIVED after the heart first showed its loaded state:
 * - `readySince`: `performance.now()` when the loaded state was committed to the page (recorded
 *   in a layout effect, i.e. before it could be painted or clicked); null = not loaded yet.
 * - `eventTime`: the click's `event.timeStamp`, the time the event was created.
 * Both are DOMHighResTimeStamps measured from the same time origin (`performance.timeOrigin`).
 */
export function acceptsHeartClick(readySince: number | null, eventTime: number): boolean {
  return readySince !== null && eventTime >= readySince;
}
