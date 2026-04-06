import type { Locale, ProductResponse } from "./types";

export function formatDate(date: Date, locale: Locale = "en"): string {
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    ru: "ru-RU",
    cn: "zh-CN",
  };
  return date.toLocaleDateString(localeMap[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(dateStr: string, locale: Locale = "en"): string {
  const date = new Date(dateStr);
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    ru: "ru-RU",
    cn: "zh-CN",
  };
  return date.toLocaleDateString(localeMap[locale], {
    month: "short",
    day: "numeric",
  });
}

export function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function statusColor(status: "fresh" | "expiring_soon" | "expired"): string {
  switch (status) {
    case "fresh":
      return "bg-emerald-100 text-emerald-800";
    case "expiring_soon":
      return "bg-amber-100 text-amber-800";
    case "expired":
      return "bg-red-100 text-red-800";
  }
}

export function statusLabel(
  status: "fresh" | "expiring_soon" | "expired",
  t: (key: string) => string,
): string {
  switch (status) {
    case "fresh":
      return t("status.fresh");
    case "expiring_soon":
      return t("status.expiring");
    case "expired":
      return t("status.expired");
  }
}

export function padNumber(n: number): string {
  return n.toString().padStart(2, "0");
}

export function getProductName(product: ProductResponse, locale: Locale): string {
  switch (locale) {
    case "ru":
      return product.name_ru || product.name;
    case "cn":
      return product.name_cn || product.name;
    default:
      return product.name;
  }
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
