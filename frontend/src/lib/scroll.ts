/**
 * Put the next step at the top of the screen.
 *
 * Moving between pages already does this -- the router sends a new location
 * to the top and restores the old position on Back, which is what you want.
 * The booking flow is the exception: dates, details and confirmation are
 * three steps at one URL, so nothing navigates and the page keeps whatever
 * scroll the last step left it at. Tapping Continue at the foot of a long
 * calendar dropped the guest into the middle of a form whose first field was
 * off the top of the screen.
 *
 * Instant rather than smooth: the stylesheet sets scroll-behavior smooth for
 * in-page links, but here the content has already been replaced, so animating
 * through it is a scroll past something that is no longer there.
 */
export function scrollToTop() {
  try {
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch {
    // Older Safari rejects "instant" as a behavior rather than ignoring it.
    window.scrollTo(0, 0);
  }
}
