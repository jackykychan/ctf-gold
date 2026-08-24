import type { Range } from "../../src/shared/types";
import { RANGES } from "../../src/shared/types";
import type { ViewMode } from "@/chart";
import { t, type Locale } from "@/i18n";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const VIEW_MODES: readonly ViewMode[] = ["both", "sell", "buy"];

interface ControlsProps {
  range: Range;
  mode: ViewMode;
  locale: Locale;
  onRangeChange: (range: Range) => void;
  onModeChange: (mode: ViewMode) => void;
}

export function Controls({ range, mode, locale, onRangeChange, onModeChange }: ControlsProps) {
  return (
    <div className="mb-4 flex flex-nowrap items-center justify-between gap-2">
      <ToggleGroup
        type="single"
        value={range}
        onValueChange={(v) => v && onRangeChange(v as Range)}
        aria-label="Time range"
      >
        {RANGES.map((r) => (
          <ToggleGroupItem key={r} value={r} className="px-2 text-xs sm:px-2.5 sm:text-sm">
            {t(locale, `range.${r}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && onModeChange(v as ViewMode)}
        aria-label="Series"
      >
        {VIEW_MODES.map((m) => (
          <ToggleGroupItem key={m} value={m} className="px-2 text-xs sm:px-2.5 sm:text-sm">
            {t(locale, `view.${m}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
