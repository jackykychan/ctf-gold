/**
 * Internationalisation: English + Traditional Chinese. `detectLocale` is a pure
 * function (unit-tested); the DOM helpers are the thin shell.
 */

export type Locale = "en" | "zh-Hant";

export const LOCALES: readonly Locale[] = ["en", "zh-Hant"];

export const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    "app.title": "Gold Price Tracker",
    "app.subtitle": "Chow Tai Fook · 9999 Gold (HK)",
    "source.link": "Official price page",
    "series.sell": "9999 Gold Sell",
    "series.buy": "9999 Gold Buy",
    "label.latest": "Latest",
    "label.updated": "Updated",
    "label.perTael": "HKD / 兩",
    "label.noData": "No data yet — the tracker is collecting prices.",
    "label.changes": "Price changes",
    "cards.daily": "Daily High",
    "cards.all": "All",
    "range.5d": "Last 5 Days",
    "range.2w": "Last 2 Weeks",
    "range.1m": "Last 1 Month",
    "range.3m": "Last 3 Months",
    "range.6m": "Last 6 Months",
    "view.both": "All",
    "view.sell": "Sell",
    "view.buy": "Buy",
    "theme.label": "Theme",
    "theme.system": "System",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "lang.label": "Language",
    "lang.en": "English",
    "lang.zh-Hant": "繁體中文",
    "cards.backToTop": "Back to top",
    "notify.label": "Notifications",
    "notify.title": "Notification Settings",
    "notify.enable": "Enable notifications",
    "notify.series": "Watch price",
    "notify.seriesSell": "Sell",
    "notify.seriesBuy": "Buy",
    "notify.seriesBoth": "Both",
    "notify.everyUpdate": "Every price update",
    "notify.dailyHigh": "New daily high",
    "notify.upTarget": "When it rises to",
    "notify.downTarget": "When it drops to",
    "notify.targetPlaceholder": "Price (HKD)",
    "notify.save": "Save",
    "notify.saved": "Saved",
    "notify.edit": "Edit",
    "notify.cmpHigher": "{pct} higher than the current {series} price of {price}",
    "notify.cmpLower": "{pct} lower than the current {series} price of {price}",
    "notify.cmpEqual": "Same as the current {series} price of {price}",
    "notify.denied": "Notifications are blocked. Enable them in your browser settings.",
    "notify.unsupported": "This browser doesn't support notifications.",
    "notify.notConfigured": "Notifications aren't available right now.",
    "notify.iosHint": "On iPhone, add this site to your Home Screen first, then open it from there to enable notifications.",
  },
  "zh-Hant": {
    "app.title": "金價追蹤",
    "app.subtitle": "周大福 · 飾金 9999（香港）",
    "source.link": "官方金價頁面",
    "series.sell": "飾金賣出價",
    "series.buy": "飾金買入價",
    "label.latest": "最新",
    "label.updated": "更新時間",
    "label.perTael": "港元 / 兩",
    "label.noData": "尚未有數據 — 系統正在收集金價。",
    "label.changes": "價格變動",
    "cards.daily": "每日最高",
    "cards.all": "全部",
    "range.5d": "最近5日",
    "range.2w": "最近2週",
    "range.1m": "最近1個月",
    "range.3m": "最近3個月",
    "range.6m": "最近6個月",
    "view.both": "全部",
    "view.sell": "賣出",
    "view.buy": "買入",
    "theme.label": "主題",
    "theme.system": "系統",
    "theme.light": "淺色",
    "theme.dark": "深色",
    "lang.label": "語言",
    "lang.en": "English",
    "lang.zh-Hant": "繁體中文",
    "cards.backToTop": "回到頂部",
    "notify.label": "通知",
    "notify.title": "通知設定",
    "notify.enable": "開啟通知",
    "notify.series": "追蹤價格",
    "notify.seriesSell": "賣出",
    "notify.seriesBuy": "買入",
    "notify.seriesBoth": "兩者",
    "notify.everyUpdate": "每次價格更新",
    "notify.dailyHigh": "當日新高",
    "notify.upTarget": "當升至",
    "notify.downTarget": "當跌至",
    "notify.targetPlaceholder": "價格（港元）",
    "notify.save": "儲存",
    "notify.saved": "已儲存",
    "notify.edit": "編輯",
    "notify.cmpHigher": "比目前{series}價 {price} 高 {pct}",
    "notify.cmpLower": "比目前{series}價 {price} 低 {pct}",
    "notify.cmpEqual": "與目前{series}價 {price} 相同",
    "notify.denied": "通知已被封鎖，請在瀏覽器設定中開啟。",
    "notify.unsupported": "此瀏覽器不支援通知。",
    "notify.notConfigured": "暫時無法使用通知。",
    "notify.iosHint": "在 iPhone 上，請先將此網站加入主畫面，再從主畫面開啟以啟用通知。",
  },
};

function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "zh-Hant";
}

/**
 * PURE. Choose a locale: an explicit stored choice wins; otherwise follow the
 * browser's preferred languages (any Chinese variant -> Traditional Chinese),
 * defaulting to English.
 */
export function detectLocale(navigatorLanguages: readonly string[], stored: string | null): Locale {
  if (isLocale(stored)) return stored;
  for (const lang of navigatorLanguages) {
    const lower = lang.toLowerCase();
    if (lower.startsWith("zh")) return "zh-Hant";
    if (lower.startsWith("en")) return "en";
  }
  return "en";
}

export function t(locale: Locale, key: string): string {
  return STRINGS[locale][key] ?? key;
}

export function intlLocale(locale: Locale): string {
  return locale === "zh-Hant" ? "zh-HK" : "en-HK";
}
