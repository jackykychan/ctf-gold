import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { t, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BackToTopProps {
  locale: Locale;
}

export function BackToTop({ locale }: BackToTopProps) {
  const [scrolling, setScrolling] = useState(false);
  const [atTop, setAtTop] = useState(() => (typeof window === "undefined" ? true : window.scrollY <= 4));

  useEffect(() => {
    let timer: number | undefined;
    const onScroll = () => {
      setAtTop(window.scrollY <= 4);
      setScrolling(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setScrolling(false), 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const onClick = () => {
    // Two-stage: if scrolled beyond the price-changes card, first bring the top
    // edge of the screen into the gap between the chart card's bottom and the
    // price-changes card's top; once at/above there, go to the very top.
    const chart = document.getElementById("chart-panel");
    const cards = document.getElementById("cards-panel");
    if (chart && cards) {
      const chartRect = chart.getBoundingClientRect();
      const cardsRect = cards.getBoundingClientRect();
      const target = Math.max(0, window.scrollY + (chartRect.bottom + cardsRect.top) / 2);
      if (window.scrollY > target + 4) {
        window.scrollTo({ top: target, behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={t(locale, "cards.backToTop")}
      className={cn(
        "fixed bottom-4 right-4 z-50 rounded-full shadow-md transition-opacity duration-200 lg:hidden",
        atTop
          ? "pointer-events-none opacity-0"
          : scrolling
            ? "opacity-100"
            : "opacity-40 hover:opacity-100",
      )}
    >
      <ArrowUp />
    </Button>
  );
}
