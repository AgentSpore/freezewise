"use client";

import { useLocaleStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export default function Masthead() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);

  return (
    <header className="border-b border-[var(--card-border)] bg-[var(--masthead-bg)] transition-colors duration-500">
      <div className="mx-auto max-w-2xl px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            {formatDate(new Date(), locale)}
          </span>
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            {t("masthead.subtitle")}
          </span>
        </div>
        <div className="mt-2 text-center">
          <h1 className="font-serif text-3xl tracking-tight text-neutral-900 sm:text-4xl">
            {t("masthead.title")}
          </h1>
          <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.15em] text-neutral-400">
            {t("masthead.tagline")}
          </p>
        </div>
      </div>
    </header>
  );
}
