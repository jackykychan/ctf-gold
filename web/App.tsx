import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryResponse, LatestResponse, Range } from "../src/shared/types";
import { RANGES } from "../src/shared/types";
import { fetchHistory, fetchLatest } from "@/api";
import type { ViewMode } from "@/chart";
import { applyTheme, isThemeChoice, type ResolvedTheme, type ThemeChoice } from "@/theme";
import { detectLocale, type Locale } from "@/i18n";
import { Header } from "@/components/Header";
import { LatestSummary } from "@/components/LatestSummary";
import { Controls } from "@/components/Controls";
import { PriceChart } from "@/components/PriceChart";
import { ChangeCards } from "@/components/ChangeCards";
import { BackToTop } from "@/components/BackToTop";

const REFRESH_MS = 60_000;
const VIEW_MODES: readonly ViewMode[] = ["both", "sell", "buy"];

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function initialRange(): Range {
  const stored = readStore("range");
  return (RANGES as readonly string[]).includes(stored ?? "") ? (stored as Range) : "1m";
}
function initialMode(): ViewMode {
  const stored = readStore("view");
  return (VIEW_MODES as readonly string[]).includes(stored ?? "") ? (stored as ViewMode) : "both";
}
function initialTheme(): ThemeChoice {
  const stored = readStore("theme");
  return isThemeChoice(stored) ? stored : "system";
}
function initialLocale(): Locale {
  const langs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  return detectLocale(langs, readStore("locale"));
}

export function App() {
  const [range, setRange] = useState<Range>(initialRange);
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(initialTheme);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  // Theme: apply on change and follow the OS while in "system" mode.
  useEffect(() => {
    setResolvedTheme(applyTheme(themeChoice));
    writeStore("theme", themeChoice);
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (themeChoice === "system") setResolvedTheme(applyTheme("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeChoice]);

  // Locale: persist + reflect on <html lang>.
  useEffect(() => {
    writeStore("locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => writeStore("view", mode), [mode]);
  useEffect(() => writeStore("range", range), [range]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [h, l] = await Promise.all([fetchHistory(rangeRef.current), fetchLatest()]);
      setHistory(h);
      setLatest(l);
    } catch (err) {
      console.error("Failed to load data", err);
    }
  }, []);

  // Refetch when the range changes, and poll for updates on an interval.
  useEffect(() => {
    void load();
  }, [range, load]);
  useEffect(() => {
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="mx-auto max-w-[1200px] p-3 md:p-4">
      <Header
        locale={locale}
        themeChoice={themeChoice}
        onThemeChange={setThemeChoice}
        onLocaleChange={setLocale}
      />

      <LatestSummary latest={latest} locale={locale} />

      <Controls
        range={range}
        mode={mode}
        locale={locale}
        onRangeChange={setRange}
        onModeChange={setMode}
      />

      <main className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <PriceChart data={history} mode={mode} locale={locale} theme={resolvedTheme} range={range} />
        <ChangeCards data={history} mode={mode} locale={locale} />
      </main>

      <BackToTop locale={locale} />
    </div>
  );
}
