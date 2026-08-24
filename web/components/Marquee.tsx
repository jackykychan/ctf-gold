import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  text: string;
  className?: string;
}

const GAP_PX = 40; // space between the repeated copies
const SPEED_PX_PER_S = 30; // constant scroll speed

/**
 * Renders `text` on a single line; if it overflows its container, scrolls it
 * continuously (looping seamlessly by repeating the text) so the whole thing can
 * be read. Static when it already fits.
 */
export function Marquee({ text, className }: MarqueeProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);
  const [copyWidth, setCopyWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const copy = copyRef.current;
    if (!container || !copy) return;
    const measure = () => {
      const width = copy.scrollWidth;
      setCopyWidth(width);
      setOverflowing(width > container.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [text]);

  const distance = copyWidth + GAP_PX;
  const trackStyle: CSSProperties | undefined = overflowing
    ? ({
        gap: `${GAP_PX}px`,
        "--marquee-distance": `-${distance}px`,
        "--marquee-duration": `${Math.max(5, distance / SPEED_PX_PER_S)}s`,
      } as CSSProperties)
    : undefined;

  return (
    <span ref={containerRef} className={cn("block overflow-hidden", className)}>
      <span
        className={cn("inline-flex w-max whitespace-nowrap", overflowing && "animate-marquee-scroll")}
        style={trackStyle}
      >
        <span ref={copyRef}>{text}</span>
        {overflowing && <span aria-hidden>{text}</span>}
      </span>
    </span>
  );
}
