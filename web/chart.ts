import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { enUS, zhHK } from "date-fns/locale";
import { parseApiDate } from "../src/shared/time";
import { dailyHigh } from "../src/domain/changes";
import type { HistoryResponse } from "../src/shared/types";
import { intlLocale, t, type Locale } from "./i18n";

export type ViewMode = "both" | "sell" | "buy";

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toXY(points: readonly { t: string; price: number }[]): { x: number; y: number }[] {
  return points.map((p) => ({ x: parseApiDate(p.t).getTime(), y: p.price }));
}

export function createPriceChart(canvas: HTMLCanvasElement): Chart {
  return new Chart(canvas, {
    type: "line",
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      elements: { point: { radius: 0, hitRadius: 12, hoverRadius: 4 } },
      scales: {
        x: {
          type: "time",
          time: {
            tooltipFormat: "yyyy-MM-dd",
            // Compact day/month axis labels (e.g. 22/8) at every zoom unit.
            displayFormats: { day: "d/M", week: "d/M", month: "d/M", quarter: "d/M", year: "d/M" },
          },
          ticks: { maxRotation: 0, autoSkip: true },
        },
        y: { ticks: { callback: (v) => Number(v).toLocaleString() } },
      },
      plugins: { legend: { display: true, position: "top" } },
    },
  });
}

export function updateChart(
  chart: Chart,
  data: HistoryResponse,
  mode: ViewMode,
  locale: Locale,
): void {
  const sellColor = cssVar("--series-sell") || "#d4a017";
  const buyColor = cssVar("--series-buy") || "#2a9d8f";
  const gridColor = cssVar("--chart-grid") || "rgba(128,128,128,0.2)";
  const textColor = cssVar("--chart-text") || "#333";

  const makeDataset = (
    key: "sell" | "buy",
    label: string,
    color: string,
  ) => ({
    label,
    // Group by day and plot each day's highest price.
    data: toXY(dailyHigh(data.series[key])),
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    tension: 0.4,
    cubicInterpolationMode: "monotone" as const,
    spanGaps: true,
  });

  const datasets = [];
  if (mode === "both" || mode === "sell") {
    datasets.push(makeDataset("sell", t(locale, "series.sell"), sellColor));
  }
  if (mode === "both" || mode === "buy") {
    datasets.push(makeDataset("buy", t(locale, "series.buy"), buyColor));
  }
  chart.data.datasets = datasets;

  const dfLocale = locale === "zh-Hant" ? zhHK : enUS;
  const scales = chart.options.scales as Record<string, Record<string, unknown>>;
  scales["x"]!["adapters"] = { date: { locale: dfLocale } };
  (scales["x"]!["grid"] as Record<string, unknown>) = { color: gridColor };
  (scales["x"]!["ticks"] as Record<string, unknown>) = {
    color: textColor,
    maxRotation: 0,
    autoSkip: true,
  };
  (scales["y"]!["grid"] as Record<string, unknown>) = { color: gridColor };
  (scales["y"]!["ticks"] as Record<string, unknown>) = {
    color: textColor,
    callback: (v: unknown) => Number(v).toLocaleString(intlLocale(locale)),
  };
  const legend = chart.options.plugins!.legend!;
  legend.labels = { ...legend.labels, color: textColor };

  chart.update();
}
