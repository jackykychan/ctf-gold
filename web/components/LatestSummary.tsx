import { useState } from "react";
import type { LatestEntry, SeriesKey, LatestResponse } from "../../src/shared/types";
import { t, type Locale } from "@/i18n";
import { formatHkDate, formatHkTime, formatPct } from "@/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { SlotNumber } from "@/components/SlotNumber";

const SERIES: readonly SeriesKey[] = ["sell", "buy"];

const ARROW = { up: "▲", down: "▼", flat: "–" } as const;
const DELTA_VAR = {
  up: "var(--up)",
  down: "var(--down)",
  flat: "var(--flat)",
} as const;

function direction(pct: number): "up" | "down" | "flat" {
  if (pct === 0) return "flat";
  return pct > 0 ? "up" : "down";
}

function PriceCard({ entry, seriesKey, locale }: {
  entry: LatestEntry | null;
  seriesKey: SeriesKey;
  locale: Locale;
}) {
  const [priceReady, setPriceReady] = useState(false);
  const pct = entry?.changePct ?? null;
  const dir = pct === null ? "flat" : direction(pct);

  return (
    <Card className="flex flex-col gap-0.5 p-4">
      <span className="text-sm text-muted-foreground">{t(locale, `series.${seriesKey}`)}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold md:text-3xl">
          <SlotNumber
            value={entry ? entry.price : null}
            locale={locale}
            onDone={() => setPriceReady(true)}
          />
        </span>
        {priceReady && pct !== null && (
          <span
            className={cn(
              "whitespace-nowrap text-[0.625rem] font-medium tabular-nums md:text-sm",
              "motion-reduce:animate-none",
              dir === "down" ? "animate-fade-in-down" : "animate-fade-in-up",
            )}
            style={{ color: DELTA_VAR[dir] }}
          >
            {`${ARROW[dir]}${formatPct(pct, locale)}`}
          </span>
        )}
      </div>
      {entry && (
        <span className="flex flex-col text-xs text-muted-foreground sm:flex-row sm:gap-1">
          <span>{formatHkDate(entry.updateDate, locale)}</span>
          <span>{formatHkTime(entry.updateDate, locale)} HKT</span>
        </span>
      )}
    </Card>
  );
}

interface LatestSummaryProps {
  latest: LatestResponse | null;
  locale: Locale;
}

export function LatestSummary({ latest, locale }: LatestSummaryProps) {
  return (
    <section aria-live="polite" className="mb-4 grid grid-cols-2 gap-3">
      {SERIES.map((key) => (
        <PriceCard key={key} entry={latest?.[key] ?? null} seriesKey={key} locale={locale} />
      ))}
    </section>
  );
}
