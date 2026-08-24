import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { dailyHighSeries, groupCardEvents } from "../../src/domain/changes";
import type { CardEvent, HistoryResponse, PricePoint, SeriesKey } from "../../src/shared/types";
import type { ViewMode } from "@/chart";
import { t, type Locale } from "@/i18n";
import { formatHkClock, formatHkDate, formatPct, formatPrice } from "@/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const INITIAL_DESKTOP = 4;
const INITIAL_MOBILE = 5;
const BATCH_COUNT = 10;

type CardFilter = "daily" | "all";

function readFilter(): CardFilter {
  try {
    const v = localStorage.getItem("cards-filter");
    return v === "daily" || v === "all" ? v : "all";
  } catch {
    return "all";
  }
}

function direction(pct: number | null): "up" | "down" | "flat" {
  if (pct === null || pct === 0) return "flat";
  return pct > 0 ? "up" : "down";
}
const ARROW: Record<"up" | "down" | "flat", string> = { up: "▲", down: "▼", flat: "–" };
const DELTA_VAR: Record<"up" | "down" | "flat", string> = {
  up: "var(--up)",
  down: "var(--down)",
  flat: "var(--flat)",
};

function SeriesRow({ seriesKey, point, locale }: { seriesKey: SeriesKey; point: PricePoint; locale: Locale }) {
  const dir = direction(point.changePct);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2 py-0.5">
      <span className="text-sm text-muted-foreground">{t(locale, `series.${seriesKey}`)}</span>
      <span className="font-bold tabular-nums">{formatPrice(point.price, locale)}</span>
      <span
        className="min-w-[5.5rem] text-right text-sm tabular-nums"
        style={{ color: DELTA_VAR[dir] }}
      >
        {point.changePct === null ? ARROW.flat : `${ARROW[dir]} ${formatPct(point.changePct, locale)}`}
      </span>
    </div>
  );
}

function EventCard({ event, dateLabel, showSell, showBuy, locale }: {
  event: CardEvent;
  dateLabel: string;
  showSell: boolean;
  showBuy: boolean;
  locale: Locale;
}) {
  return (
    <Card className="bg-muted/40 p-3">
      <time className="mb-1.5 block text-xs tabular-nums text-muted-foreground">{dateLabel}</time>
      {showSell && event.sell && <SeriesRow seriesKey="sell" point={event.sell} locale={locale} />}
      {showBuy && event.buy && <SeriesRow seriesKey="buy" point={event.buy} locale={locale} />}
    </Card>
  );
}

interface ChangeCardsProps {
  data: HistoryResponse | null;
  mode: ViewMode;
  locale: Locale;
}

export function ChangeCards({ data, mode, locale }: ChangeCardsProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [filter, setFilter] = useState<CardFilter>(readFilter);
  const showSell = mode === "both" || mode === "sell";
  const showBuy = mode === "both" || mode === "buy";

  useEffect(() => {
    try {
      localStorage.setItem("cards-filter", filter);
    } catch {
      /* ignore */
    }
  }, [filter]);

  const events = useMemo<CardEvent[]>(() => {
    if (!data) return [];
    // In "daily" mode each series becomes one point per day (the day's high),
    // with the % change recomputed day-over-day; cards are grouped by day.
    const seriesFor = (key: SeriesKey): PricePoint[] =>
      filter === "daily" ? dailyHighSeries(data.series[key]) : data.series[key];
    return groupCardEvents(
      showSell ? seriesFor("sell") : [],
      showBuy ? seriesFor("buy") : [],
      filter === "daily" ? "day" : "second",
    );
  }, [data, showSell, showBuy, filter]);

  const signature = `${mode}|${filter}|${events.length}|${events[0]?.t ?? ""}`;
  const initialCount = isDesktop ? INITIAL_DESKTOP : INITIAL_MOBILE;
  const [count, setCount] = useState(initialCount);
  const [listAtTop, setListAtTop] = useState(true);
  const listRef = useRef<HTMLDivElement>(null); // internal scroll container on desktop

  // Reset to the first batch when the data, filter or the breakpoint changes.
  useEffect(() => {
    setCount(initialCount);
    setListAtTop(true);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [signature, initialCount]);

  // Infinite load: append a batch as the relevant surface nears its end — the
  // internal card container on desktop, the window on mobile.
  useEffect(() => {
    const bump = () => setCount((c) => Math.min(c + BATCH_COUNT, events.length));
    const container = isDesktop ? listRef.current : null;
    if (container) {
      const onScroll = () => {
        setListAtTop(container.scrollTop <= 4);
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 250) bump();
      };
      container.addEventListener("scroll", onScroll, { passive: true });
      return () => container.removeEventListener("scroll", onScroll);
    }
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 400) bump();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDesktop, events.length]);

  // Desktop: if the initial batch does not fill (and thus can't scroll) the
  // fixed-height container, load more so the rest stays reachable.
  useEffect(() => {
    if (!isDesktop) return;
    const container = listRef.current;
    if (container && count < events.length && container.scrollHeight <= container.clientHeight + 4) {
      setCount((c) => Math.min(c + BATCH_COUNT, events.length));
    }
  }, [isDesktop, count, mode, filter, events.length]);

  const scrollCardToTop = () => listRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const labelFor = (ev: CardEvent): string =>
    filter === "daily"
      ? formatHkDate(ev.t, locale)
      : `${formatHkClock(ev.t, locale, true)} HKT`;

  return (
    <Card id="cards-panel" className="p-4 lg:flex lg:h-[440px] lg:flex-col">
      <div className="relative mb-3 flex items-center justify-between gap-2">
        <h2 id="cards-heading" className="text-base font-semibold">
          {t(locale, "label.changes")}
        </h2>

        {/* Desktop only, absolutely centered in the row so it doesn't shift the
            heading or filter; invisible (but present) while scrolled to the top. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={scrollCardToTop}
          aria-hidden={listAtTop}
          tabIndex={listAtTop ? -1 : 0}
          className={cn(
            "absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 gap-1 text-muted-foreground lg:inline-flex",
            listAtTop && "lg:invisible",
          )}
        >
          <ArrowUp />
          {t(locale, "cards.backToTop")}
        </Button>

        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => (v === "daily" || v === "all") && setFilter(v)}
          aria-label={t(locale, "label.changes")}
        >
          <ToggleGroupItem value="all" className="px-2 text-xs">
            {t(locale, "cards.all")}
          </ToggleGroupItem>
          <ToggleGroupItem value="daily" className="px-2 text-xs">
            {t(locale, "cards.daily")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(locale, "label.noData")}</p>
      ) : (
        <div
          ref={listRef}
          className={cn(
            "flex flex-col gap-2.5",
            "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1",
          )}
        >
          {events.slice(0, count).map((ev) => (
            <EventCard
              key={ev.t}
              event={ev}
              dateLabel={labelFor(ev)}
              showSell={showSell}
              showBuy={showBuy}
              locale={locale}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
