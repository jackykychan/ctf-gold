import { useEffect, useState } from "react";
import { Bell, Check, Pencil } from "lucide-react";
import { intlLocale, t, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/format";
import { fetchLatest } from "@/api";
import type { AlertPrefs } from "../../src/shared/push";
import { DEFAULT_ALERT_PREFS } from "../../src/shared/push";
import type { LatestResponse, SeriesKey } from "../../src/shared/types";
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIos,
  isStandalone,
  permissionState,
  pushSupported,
  savePrefs,
} from "@/push";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PREFS_KEY = "notify-prefs";

function readPrefs(): AlertPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_ALERT_PREFS, ...(JSON.parse(raw) as AlertPrefs) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_ALERT_PREFS };
}
function writePrefs(prefs: AlertPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

interface NotificationsButtonProps {
  locale: Locale;
}

export function NotificationsButton({ locale }: NotificationsButtonProps) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AlertPrefs>(readPrefs);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Target fields currently in edit mode, keyed by `${series}-${dir}`.
  const [editing, setEditing] = useState<Set<string>>(() => new Set());
  // Latest prices (for the "% vs current" typing hint) + the focused field key.
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const supported = pushSupported();
  // On iOS, push only works from an installed PWA.
  const iosBlocked = isIos() && !isStandalone();

  useEffect(() => {
    void currentSubscription().then((sub) => setEnabled(!!sub));
  }, []);

  // Fetch current prices when the dialog opens, for the "% vs current" hint.
  useEffect(() => {
    if (open) void fetchLatest().then(setLatest).catch(() => setLatest(null));
  }, [open]);

  // Keep the stored locale in sync with the UI language.
  useEffect(() => {
    setPrefs((p) => (p.locale === locale ? p : { ...p, locale }));
  }, [locale]);

  // Whether any actual alert is active (the Watch-price scope doesn't count).
  // For a single series only that series' targets count; for "both", either.
  const hasTarget = (p: AlertPrefs, s: "sell" | "buy"): boolean =>
    p.targets[s].up != null || p.targets[s].down != null;
  const hasAnyAlert = (p: AlertPrefs): boolean => {
    const targetsActive =
      p.series === "both" ? hasTarget(p, "sell") || hasTarget(p, "buy") : hasTarget(p, p.series);
    return p.everyUpdate || p.dailyHigh || targetsActive;
  };

  const setNoteFromError = (err: unknown) => {
    const msg = (err as Error).message;
    setNote(msg === "push-not-configured" ? t(locale, "notify.notConfigured") : t(locale, "notify.denied"));
  };

  // Local-only update (state + storage), used while typing in the target inputs.
  const update = (patch: Partial<AlertPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writePrefs(next);
      return next;
    });
    setNote(null);
  };

  // Persist `next` to the server; if it leaves no active alert, turn
  // notifications off entirely (there is nothing left to notify about).
  const persist = async (next: AlertPrefs) => {
    if (!enabled) return;
    setBusy(true);
    setNote(null);
    try {
      if (!hasAnyAlert(next)) {
        await disablePush();
        setEnabled(false);
      } else {
        await savePrefs({ ...next, locale });
      }
    } catch (err) {
      setNoteFromError(err);
    } finally {
      setBusy(false);
    }
  };

  // Change a setting and immediately persist it (switches + series selector).
  const change = (patch: Partial<AlertPrefs>) => {
    const next = { ...prefs, ...patch };
    update(patch);
    void persist(next);
  };

  const toggleEnabled = async (on: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      if (on) {
        // Enabling with nothing configured defaults to "every price update".
        const next = hasAnyAlert(prefs) ? prefs : { ...prefs, everyUpdate: true };
        writePrefs(next);
        setPrefs(next);
        await enablePush({ ...next, locale });
        setEnabled(true);
      } else {
        await disablePush();
        setEnabled(false);
      }
    } catch (err) {
      setNoteFromError(err);
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const denied = permissionState() === "denied";
  // Alert options can only be changed once notifications are enabled.
  const configDisabled = !enabled || busy;

  const setTarget = (s: SeriesKey, dir: "up" | "down", value: number | null) =>
    update({ targets: { ...prefs.targets, [s]: { ...prefs.targets[s], [dir]: value } } });

  const startEdit = (key: string) =>
    setEditing((prev) => new Set(prev).add(key));
  const stopEdit = (key: string) =>
    setEditing((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  // Commit a target field: leave edit mode and persist the value.
  const saveField = (key: string) => {
    stopEdit(key);
    void persist(prefs);
  };

  // A rise-to / drop-to field with an Edit ⇄ Save toggle: the input is locked
  // (showing the saved value) until Edit, and Save persists it.
  const targetInput = (s: SeriesKey, dir: "up" | "down", widthClass: string) => {
    const key = `${s}-${dir}`;
    const isEditing = editing.has(key);
    const value = prefs.targets[s][dir];
    const current = latest?.[s]?.price ?? null;
    // While typing a target, hint the % change vs the current Sell/Buy price.
    const showTip =
      focusedKey === key && value != null && Number.isFinite(value) && current != null && current > 0;
    const pct = showTip ? ((value! - current!) / current!) * 100 : 0;
    const sign = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
    // "55.55% higher than the current SELL price of 52,232" (localized). Only the
    // percentage is colored, so split the template around the {pct} placeholder.
    const cmpKey = pct > 0 ? "notify.cmpHigher" : pct < 0 ? "notify.cmpLower" : "notify.cmpEqual";
    const pctText =
      Math.abs(pct).toLocaleString(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    const [tipBefore, tipAfter] = t(locale, cmpKey)
      .replace("{series}", t(locale, s === "sell" ? "notify.seriesSell" : "notify.seriesBuy").toUpperCase())
      .replace("{price}", current != null ? formatPrice(current, locale) : "")
      .split("{pct}");
    return (
      <div className="relative flex items-center gap-1">
        <Input
          type="number"
          inputMode="numeric"
          className={widthClass}
          disabled={configDisabled || !isEditing}
          placeholder={t(locale, "notify.targetPlaceholder")}
          value={value ?? ""}
          onChange={(e) => setTarget(s, dir, e.target.value === "" ? null : Number(e.target.value))}
          onFocus={() => setFocusedKey(key)}
          onBlur={() => setFocusedKey(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isEditing) saveField(key);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          disabled={configDisabled}
          aria-label={t(locale, isEditing ? "notify.save" : "notify.edit")}
          onClick={() => (isEditing ? saveField(key) : startEdit(key))}
        >
          {isEditing ? <Check /> : <Pencil />}
        </Button>
        {showTip && (
          <div
            className={cn(
              "pointer-events-none absolute bottom-full z-50 mb-1 max-w-56 rounded-md border bg-popover px-2 py-1 text-xs shadow-md",
              // Grow inward so a long message stays within the dialog bounds.
              series === "both" && s === "buy" ? "right-0" : "left-0",
            )}
          >
            {tipBefore}
            {tipAfter !== undefined && <span style={{ color: `var(--${sign})` }}>{pctText}</span>}
            {tipAfter}
          </div>
        )}
      </div>
    );
  };

  // A target row: the label sits above a fixed two-column grid holding the Sell
  // (left) and Buy (right) fields. Both cells stay mounted so switching Watch
  // price animates smoothly — the unwatched series fades out, and in "buy" mode
  // the Buy cell slides into the left column (Sell stays put in "sell" mode).
  const series = prefs.series;
  const tagClass = "text-[10px] uppercase tracking-wide text-muted-foreground";
  const cellClass = "flex min-w-0 flex-col gap-0.5 transition-[opacity,translate] duration-300 ease-in-out";
  const targetRow = (dir: "up" | "down", labelKey: string) => (
    <div className="flex flex-col gap-1.5 py-3">
      <Label>{t(locale, labelKey)}</Label>
      <div className="grid grid-cols-2 gap-3">
        <div
          className={cn(cellClass, series === "buy" ? "pointer-events-none opacity-0" : "opacity-100")}
          aria-hidden={series === "buy"}
        >
          <span className={tagClass}>{t(locale, "notify.seriesSell")}</span>
          {targetInput("sell", dir, "w-full min-w-0")}
        </div>
        <div
          className={cn(
            cellClass,
            series === "sell" ? "pointer-events-none opacity-0" : "opacity-100",
            series === "buy" && "translate-x-[calc(-100%_-_0.75rem)]",
          )}
          aria-hidden={series === "sell"}
        >
          <span className={tagClass}>{t(locale, "notify.seriesBuy")}</span>
          {targetInput("buy", dir, "w-full min-w-0")}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setEditing(new Set()); // reset edit state when the dialog closes
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t(locale, "notify.label")}
          className="relative w-9"
        >
          <Bell className={enabled ? "text-primary" : "text-muted-foreground"} />
          {/* Active indicator: a dot on the bell while notifications are on. */}
          {enabled && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </DialogTrigger>
      {/* Top-anchored (not vertically centered) so expanding the settings grows
          the dialog downward, keeping "Enable notifications" fixed in place. */}
      <DialogContent className="top-[12vh] max-h-[80vh] translate-y-0 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(locale, "notify.title")}</DialogTitle>
        </DialogHeader>

        {!supported ? (
          <p className="text-sm text-muted-foreground">{t(locale, "notify.unsupported")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {iosBlocked && (
              <p className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
                {t(locale, "notify.iosHint")}
              </p>
            )}

            {/* Enable row + the settings that expand/collapse beneath it. */}
            <div>
              <div className="flex min-h-15 items-center justify-between py-3">
                <Label htmlFor="notify-enable">{t(locale, "notify.enable")}</Label>
                <Switch
                  id="notify-enable"
                  checked={enabled}
                  disabled={busy || iosBlocked || denied}
                  onCheckedChange={toggleEnabled}
                />
              </div>

              {/* Alert configuration — smoothly expands/collapses with the toggle
                  (grid-rows 0fr↔1fr animates to the content's natural height). */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                  enabled ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  !enabled && "pointer-events-none",
                )}
                aria-hidden={!enabled}
              >
                {/* overflow-hidden enables the height animation but also clips
                    focus-ring box-shadows; the -mx-2/px-2 (and pb-1) give the
                    rings room so the right/bottom edges aren't cut off. */}
                <div className="-mx-2 min-h-0 overflow-hidden px-2">
                  <div
                    className={cn(
                      // divide-y separates each setting; border-t divides them
                      // from the Enable row above (border color from the base *).
                      "flex flex-col divide-y border-t transition-opacity",
                      busy && "pointer-events-none opacity-50",
                    )}
                    aria-disabled={busy}
                  >
              <div className="flex min-h-15 items-center justify-between gap-2 py-3">
                <Label>{t(locale, "notify.series")}</Label>
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={prefs.series}
                  disabled={configDisabled}
                  aria-label={t(locale, "notify.series")}
                  onValueChange={(v) => {
                    if (v !== "sell" && v !== "buy" && v !== "both") return; // ignore deselect
                    setEditing(new Set()); // fields differ per series; drop edit state
                    change({ series: v });
                  }}
                >
                  <ToggleGroupItem value="sell">{t(locale, "notify.seriesSell")}</ToggleGroupItem>
                  <ToggleGroupItem value="buy">{t(locale, "notify.seriesBuy")}</ToggleGroupItem>
                  <ToggleGroupItem value="both">{t(locale, "notify.seriesBoth")}</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="flex min-h-15 items-center justify-between py-3">
                <Label htmlFor="notify-every">{t(locale, "notify.everyUpdate")}</Label>
                <Switch
                  id="notify-every"
                  checked={prefs.everyUpdate}
                  disabled={configDisabled}
                  onCheckedChange={(v) => change({ everyUpdate: v })}
                />
              </div>

              <div className="flex min-h-15 items-center justify-between py-3">
                <Label htmlFor="notify-high">{t(locale, "notify.dailyHigh")}</Label>
                <Switch
                  id="notify-high"
                  checked={prefs.dailyHigh}
                  disabled={configDisabled}
                  onCheckedChange={(v) => change({ dailyHigh: v })}
                />
              </div>

                  {targetRow("up", "notify.upTarget")}
                  {targetRow("down", "notify.downTarget")}
                  </div>
                </div>
              </div>
            </div>

            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
