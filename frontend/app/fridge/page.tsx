"use client";

import FridgeItem from "@/components/fridge-item";
import { useLocaleStore, useFridgeStore, getFridgeItemStatus } from "@/lib/store";
import { createT } from "@/lib/i18n";
import Link from "next/link";

export default function FridgePage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const items = useFridgeStore((s) => s.items);
  const getStats = useFridgeStore((s) => s.getStats);

  const stats = getStats();

  const expiringItems = items.filter(
    (i) => getFridgeItemStatus(i).status === "expiring_soon",
  );
  const expiredItems = items.filter(
    (i) => getFridgeItemStatus(i).status === "expired",
  );
  const freshItems = items.filter(
    (i) => getFridgeItemStatus(i).status === "fresh",
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-neutral-900">{t("fridge.title")}</h2>
        <p className="mt-1 font-sans text-sm text-neutral-400">
          {t("fridge.subtitle")}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl text-neutral-200">&#10052;</div>
          <p className="mt-4 font-serif text-lg text-neutral-400">
            {t("fridge.empty")}
          </p>
          <p className="mt-1 font-sans text-sm text-neutral-300">
            {t("fridge.empty_hint")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block border border-neutral-900 px-6 py-2.5 font-sans text-xs uppercase tracking-[0.2em] text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
          >
            {t("nav.search")}
          </Link>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="mb-6 grid grid-cols-3 divide-x divide-neutral-100 border border-neutral-100">
            <StatCell label={t("fridge.total")} value={stats.total_items} />
            <StatCell
              label={t("fridge.expiring")}
              value={stats.expiring_soon}
              warn={stats.expiring_soon > 0}
            />
            <StatCell
              label={t("fridge.expired")}
              value={stats.expired}
              danger={stats.expired > 0}
            />
          </div>

          {/* Expiring soon section */}
          {expiringItems.length > 0 && (
            <Section title={t("fridge.expiring_soon")} count={expiringItems.length}>
              {expiringItems.map((item) => (
                <FridgeItem key={item.id} item={item} />
              ))}
            </Section>
          )}

          {/* Expired section */}
          {expiredItems.length > 0 && (
            <Section title={t("status.expired")} count={expiredItems.length}>
              {expiredItems.map((item) => (
                <FridgeItem key={item.id} item={item} />
              ))}
            </Section>
          )}

          {/* Fresh items */}
          {freshItems.length > 0 && (
            <Section title={t("fridge.all_items")} count={freshItems.length}>
              {freshItems.map((item) => (
                <FridgeItem key={item.id} item={item} />
              ))}
            </Section>
          )}

          {/* Recipe CTA */}
          {items.length > 0 && (
            <div className="mt-8 border-t border-neutral-200 pt-6 text-center">
              <Link
                href="/recipes"
                className="inline-block border border-neutral-900 bg-neutral-900 px-8 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-neutral-800"
              >
                {t("fridge.get_recipes")}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: number;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="py-3 text-center">
      <div
        className={`font-serif text-2xl ${
          danger ? "text-red-600" : warn ? "text-amber-600" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
      <div className="font-sans text-[9px] uppercase tracking-wider text-neutral-400">
        {label}
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {title}
        </h3>
        <span className="font-sans text-[10px] text-neutral-300">{count}</span>
      </div>
      {children}
    </div>
  );
}
