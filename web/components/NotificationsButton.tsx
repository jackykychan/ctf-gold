import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { t, type Locale } from "@/i18n";
import type { AlertPrefs, AlertSeries } from "../../src/shared/push";
import { DEFAULT_ALERT_PREFS } from "../../src/shared/push";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const supported = pushSupported();
  // On iOS, push only works from an installed PWA.
  const iosBlocked = isIos() && !isStandalone();

  useEffect(() => {
    void currentSubscription().then((sub) => setEnabled(!!sub));
  }, []);

  // Keep the stored locale in sync with the UI language.
  useEffect(() => {
    setPrefs((p) => (p.locale === locale ? p : { ...p, locale }));
  }, [locale]);

  const update = (patch: Partial<AlertPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writePrefs(next);
      return next;
    });
    setNote(null);
  };

  const toggleEnabled = async (on: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      if (on) {
        await enablePush({ ...prefs, locale });
        setEnabled(true);
      } else {
        await disablePush();
        setEnabled(false);
      }
    } catch (err) {
      const msg = (err as Error).message;
      setNote(msg === "push-not-configured" ? t(locale, "notify.notConfigured") : t(locale, "notify.denied"));
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setBusy(true);
    try {
      await savePrefs({ ...prefs, locale });
      setNote(t(locale, "notify.saved"));
    } catch {
      setNote(t(locale, "notify.notConfigured"));
    } finally {
      setBusy(false);
    }
  };

  const denied = permissionState() === "denied";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t(locale, "notify.label")}
          className="w-9"
        >
          <Bell className={enabled ? "text-primary" : "text-muted-foreground"} />
        </Button>
      </DialogTrigger>
      <DialogContent>
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

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-enable">{t(locale, "notify.enable")}</Label>
              <Switch
                id="notify-enable"
                checked={enabled}
                disabled={busy || iosBlocked || denied}
                onCheckedChange={toggleEnabled}
              />
            </div>

            {/* Alert configuration (editable regardless; sent on enable/save). */}
            <div className="flex items-center justify-between gap-2">
              <Label>{t(locale, "notify.series")}</Label>
              <Select value={prefs.series} onValueChange={(v) => update({ series: v as AlertSeries })}>
                <SelectTrigger className="w-28 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sell">{t(locale, "notify.seriesSell")}</SelectItem>
                  <SelectItem value="buy">{t(locale, "notify.seriesBuy")}</SelectItem>
                  <SelectItem value="both">{t(locale, "notify.seriesBoth")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-every">{t(locale, "notify.everyUpdate")}</Label>
              <Switch
                id="notify-every"
                checked={prefs.everyUpdate}
                onCheckedChange={(v) => update({ everyUpdate: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-high">{t(locale, "notify.dailyHigh")}</Label>
              <Switch
                id="notify-high"
                checked={prefs.dailyHigh}
                onCheckedChange={(v) => update({ dailyHigh: v })}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="notify-up">{t(locale, "notify.upTarget")}</Label>
              <Input
                id="notify-up"
                type="number"
                inputMode="numeric"
                className="w-32"
                placeholder={t(locale, "notify.targetPlaceholder")}
                value={prefs.upTarget ?? ""}
                onChange={(e) => update({ upTarget: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="notify-down">{t(locale, "notify.downTarget")}</Label>
              <Input
                id="notify-down"
                type="number"
                inputMode="numeric"
                className="w-32"
                placeholder={t(locale, "notify.targetPlaceholder")}
                value={prefs.downTarget ?? ""}
                onChange={(e) => update({ downTarget: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{note ?? ""}</span>
              <Button type="button" size="sm" disabled={!enabled || busy} onClick={onSave}>
                {t(locale, "notify.save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
