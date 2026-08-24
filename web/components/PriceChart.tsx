import { useEffect, useRef } from "react";
import type { Chart } from "chart.js";
import type { HistoryResponse, Range } from "../../src/shared/types";
import { createPriceChart, updateChart, type ViewMode } from "@/chart";
import type { Locale } from "@/i18n";
import type { ResolvedTheme } from "@/theme";
import { Card } from "@/components/ui/card";

interface PriceChartProps {
  data: HistoryResponse | null;
  mode: ViewMode;
  locale: Locale;
  theme: ResolvedTheme;
  range: Range;
}

export function PriceChart({ data, mode, locale, theme, range }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  // Play the left-to-right draw on first render and whenever a filter (range or
  // mode) changes — but not on the 60s background refresh or theme/locale swaps.
  const drawNext = useRef(true);

  useEffect(() => {
    if (canvasRef.current) chartRef.current = createPriceChart(canvasRef.current);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  // Arm the draw when a filter changes. Runs before the render effect below so
  // the flag is set when the (possibly newly fetched) data is drawn.
  useEffect(() => {
    drawNext.current = true;
  }, [range, mode]);

  useEffect(() => {
    if (chartRef.current && data) {
      updateChart(chartRef.current, data, mode, locale, drawNext.current);
      drawNext.current = false;
    }
    // `theme` is a dependency so the chart re-reads themed CSS colors on toggle.
  }, [data, mode, locale, theme]);

  return (
    <Card id="chart-panel" className="p-4 lg:flex lg:h-[440px] lg:flex-col">
      <div className="relative h-80 md:h-[440px] lg:h-auto lg:min-h-0 lg:flex-1">
        <canvas ref={canvasRef} />
      </div>
    </Card>
  );
}
