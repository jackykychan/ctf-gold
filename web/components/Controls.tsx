import type { Range } from "../../src/shared/types";
import { RANGES } from "../../src/shared/types";
import type { ViewMode } from "@/chart";
import { t, type Locale } from "@/i18n";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      <Select value={range} onValueChange={(v) => onRangeChange(v as Range)}>
        <SelectTrigger aria-label="Time range" className="text-xs sm:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGES.map((r) => (
            <SelectItem key={r} value={r} className="text-xs sm:text-sm">
              {t(locale, `range.${r}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
