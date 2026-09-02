import { useEffect, useRef } from "react";

/**
 * Reveals an element as it scrolls into view by adding `is-visible` to it.
 * Pair with the `reveal` class from styles.css. Unlike a mount-time CSS
 * animation, this fires when the element is actually seen rather than
 * finishing off-screen before the visitor gets there.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      },
      { rootMargin, threshold: 0.05 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return ref;
}
