import { useEffect, useRef } from "react";
import type { Chart } from "chart.js";
import type { HistoryResponse } from "../../src/shared/types";
import { createPriceChart, updateChart, type ViewMode } from "@/chart";
import type { Locale } from "@/i18n";
import type { ResolvedTheme } from "@/theme";
import { Card } from "@/components/ui/card";

interface PriceChartProps {
  data: HistoryResponse | null;
  mode: ViewMode;
  locale: Locale;
  theme: ResolvedTheme;
}

export function PriceChart({ data, mode, locale, theme }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (canvasRef.current) chartRef.current = createPriceChart(canvasRef.current);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && data) updateChart(chartRef.current, data, mode, locale);
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
