/**
 * Light/dark theming. `resolveTheme` is a pure function (unit-tested); the rest
 * applies the choice to the document and reports the resolved theme so the chart
 * can read matching colors.
 */

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "system" || v === "light" || v === "dark";
}

/**
 * PURE. An explicit light/dark choice wins; "system" (or unknown) follows the OS
 * preference.
 */
export function resolveTheme(stored: ThemeChoice | null, systemPrefersDark: boolean): ResolvedTheme {
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Apply the choice by toggling Tailwind's `.dark` class on <html>. "system"
 * follows the OS preference. Returns the resolved theme so the chart can read
 * matching colors.
 */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice, systemPrefersDark());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}
