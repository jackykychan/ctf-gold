import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/format";
import { type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

const SPIN_CYCLES = 2; // full 0-9 rotations before landing, for the slot spin
const DIGIT_DURATION_MS = 1300; // must match the reel transition duration
const DIGIT_STAGGER_MS = 80; // must match the per-digit transition delay

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** One rolling digit reel that spins to `digit` on mount. */
function SlotDigit({ digit, index }: { digit: number; index: number }) {
  const reduce = prefersReducedMotion();
  const [rolled, setRolled] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    let raf2 = 0;
    // Double rAF: paint the start (0) first, then transition to the target.
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRolled(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [reduce]);

  const rows = (SPIN_CYCLES + 1) * 10;
  const targetIndex = SPIN_CYCLES * 10 + digit;
  const offset = rolled ? targetIndex : 0;

  return (
    <span className="inline-block overflow-hidden" style={{ height: "1em" }}>
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${offset}em)`,
          transition: rolled && !reduce
            ? `transform ${DIGIT_DURATION_MS}ms cubic-bezier(0.15, 0.85, 0.25, 1) ${index * DIGIT_STAGGER_MS}ms`
            : "none",
        }}
      >
        {Array.from({ length: rows }, (_, i) => (
          <span
            key={i}
            className="flex items-center justify-center"
            style={{ height: "1em", lineHeight: "1em" }}
          >
            {i % 10}
          </span>
        ))}
      </span>
    </span>
  );
}

interface SlotNumberProps {
  value: number | null;
  locale: Locale;
  className?: string;
  /** Fired once the reels have finished rolling (or immediately if reduced motion). */
  onDone?: () => void;
}

/**
 * Renders a formatted price where each digit rolls into place like a slot
 * machine on load. Non-digit characters (grouping separators) are static.
 */
export function SlotNumber({ value, locale, className, onDone }: SlotNumberProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (value === null) return;
    const text = formatPrice(value, locale);
    let lastDigit = -1;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c >= 48 && c <= 57) lastDigit = i;
    }
    const total = prefersReducedMotion()
      ? 0
      : lastDigit * DIGIT_STAGGER_MS + DIGIT_DURATION_MS + 60;
    const id = window.setTimeout(() => onDoneRef.current?.(), total);
    return () => window.clearTimeout(id);
  }, [value, locale]);

  if (value === null) return <span className={className}>—</span>;
  const text = formatPrice(value, locale);
  return (
    <span className={cn("inline-flex items-center tabular-nums leading-none", className)}>
      {text.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <SlotDigit key={i} digit={Number(ch)} index={i} />
        ) : (
          <span key={i} className="inline-flex items-center" style={{ height: "1em" }}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
