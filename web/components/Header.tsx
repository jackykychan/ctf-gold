import { Languages, Moon, Sun, SunMoon } from "lucide-react";
import type { ReactNode } from "react";
import { t, type Locale, LOCALES } from "@/i18n";
import { THEME_CHOICES, type ThemeChoice } from "@/theme";
import { Marquee } from "@/components/Marquee";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const THEME_ICON: Record<ThemeChoice, ReactNode> = {
  system: <SunMoon />,
  light: <Sun />,
  dark: <Moon />,
};

const LANG_ABBREV: Record<Locale, string> = {
  en: "EN",
  "zh-Hant": "繁中",
};

interface HeaderProps {
  locale: Locale;
  themeChoice: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  onLocaleChange: (locale: Locale) => void;
}

export function Header({ locale, themeChoice, onThemeChange, onLocaleChange }: HeaderProps) {
  return (
    <header className="mb-4 flex flex-nowrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-bold md:text-2xl">
          <Marquee text={t(locale, "app.title")} />
        </h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          <Marquee text={t(locale, "app.subtitle")} />
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Theme: trigger shows only the selected theme's icon; the open list
            shows each theme's icon + full label. */}
        <Select value={themeChoice} onValueChange={(v) => onThemeChange(v as ThemeChoice)}>
          <SelectTrigger
            aria-label={t(locale, "theme.label")}
            hideChevron
            className="w-9 justify-center px-0"
          >
            {THEME_ICON[themeChoice]}
          </SelectTrigger>
          <SelectContent>
            {THEME_CHOICES.map((choice) => (
              <SelectItem key={choice} value={choice} icon={THEME_ICON[choice]}>
                {t(locale, `theme.${choice}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Language: trigger shows the language icon + abbreviation; the open
            list shows the full language names. */}
        <Select value={locale} onValueChange={(v) => onLocaleChange(v as Locale)}>
          <SelectTrigger aria-label={t(locale, "lang.label")} className="gap-1.5">
            <Languages className="text-muted-foreground" />
            {LANG_ABBREV[locale]}
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {t(locale, `lang.${loc}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
