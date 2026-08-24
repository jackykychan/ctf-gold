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
  // Visible only once the "Price Change" card title has scrolled above the top
  // edge of the viewport (i.e. the user has scrolled down past it).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const onScroll = () => {
      const heading = document.getElementById("cards-heading");
      setVisible(heading ? heading.getBoundingClientRect().top < 0 : false);
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
    // Scroll so the top edge of the screen lands in the gap between the chart
    // card's bottom and the "Price Change" card's top. From there the title is
    // below the top edge again, so this button hides until scrolled past it.
    const chart = document.getElementById("chart-panel");
    const cards = document.getElementById("cards-panel");
    if (chart && cards) {
      const chartRect = chart.getBoundingClientRect();
      const cardsRect = cards.getBoundingClientRect();
      const target = Math.max(0, window.scrollY + (chartRect.bottom + cardsRect.top) / 2);
      window.scrollTo({ top: target, behavior: "smooth" });
      return;
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
        // Positioned via .back-to-top-fab: horizontally centred near the top,
        // offset below the browser address bar / status bar (safe-area).
        "back-to-top-fab fixed z-50 rounded-full shadow-md transition-opacity duration-200 lg:hidden",
        visible
          ? scrolling
            ? "opacity-100"
            : "opacity-40 hover:opacity-100"
          : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp />
    </Button>
  );
}
