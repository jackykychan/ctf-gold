export type PriceDirection = "up" | "down" | "flat";

/** Map the latest Sell change versus its preceding observation to an icon state. */
export function priceDirection(changePct: number | null | undefined): PriceDirection {
  if (typeof changePct !== "number" || !Number.isFinite(changePct) || changePct === 0) return "flat";
  return changePct > 0 ? "up" : "down";
}

/** Small, high-contrast SVG that remains legible at a browser favicon's size. */
export function faviconSvg(direction: PriceDirection): string {
  const color = direction === "up" ? "#087f5b" : direction === "down" ? "#c92a2a" : "#9a7200";
  const arrow =
    direction === "up"
      ? '<path d="M32 12 50 31H40v20H24V31H14Z" fill="#fff"/>'
      : direction === "down"
        ? '<path d="M32 52 14 33h10V13h16v20h10Z" fill="#fff"/>'
        : '<path d="M16 27h32v10H16Z" fill="#fff"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${color}"/><circle cx="32" cy="32" r="25" fill="none" stroke="#e6b422" stroke-width="4"/>${arrow}</svg>`;
}

export function faviconDataUrl(direction: PriceDirection): string {
  return `data:image/svg+xml,${encodeURIComponent(faviconSvg(direction))}`;
}

/** Update the browser-tab favicon; installed PWA/Home Screen icons stay static. */
export function applyPriceFavicon(changePct: number | null | undefined): void {
  if (typeof document === "undefined") return;
  const direction = priceDirection(changePct);
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.dataset.priceDirection = direction;
  link.href = faviconDataUrl(direction);
}
