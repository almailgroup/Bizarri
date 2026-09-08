import type { ElementType, ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";

/**
 * Fades its children up as they scroll into view. Prefer this over the
 * mount-time `animate-fade-up` class for anything below the fold.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const ref = useReveal<HTMLElement>();
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}
