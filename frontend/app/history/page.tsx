"use client";

import { useLocaleStore, useHistoryStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { formatDateShort, cn } from "@/lib/utils";
import Link from "next/link";

export default function HistoryPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const history = useHistoryStore((s) => s.history);

  // Compute stats
  const consumedEntries = history.filter((e) => e.action === "eaten" || e.action === "wasted");
  const totalTracked = consumedEntries.length;
  const eatenCount = consumedEntries.filter((e) => e.action === "eaten").length;
  const wastedCount = consumedEntries.filter((e) => e.action === "wasted").length;
  const wastePct = totalTracked > 0 ? Math.round((wastedCount / totalTracked) * 100) : 0;

  // Streak: consecutive days without waste (going backwards from today)
  const streak = (() => {
    if (consumedEntries.length === 0) return 0;

    // Get unique dates with waste
    const wasteDates = new Set(
      consumedEntries
        .filter((e) => e.action === "wasted")
        .map((e) => e.date.slice(0, 10)),
    );

    let days = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      if (wasteDates.has(dateStr)) break;
      // Only count days where we have any tracked activity
      const hasActivity = consumedEntries.some((e) => e.date.slice(0, 10) === dateStr);
      if (hasActivity || i === 0) days++;
      if (!hasActivity && i > 0) {
        // Check if we ran out of data
        const earliestDate = consumedEntries[consumedEntries.length - 1]?.date.slice(0, 10);
        if (dateStr < earliestDate) break;
      }
    }
    return days;
  })();

  // Group by date
  const grouped: Record<string, typeof history> = {};
  for (const entry of consumedEntries) {
    const dateKey = entry.date.slice(0, 10);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(entry);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/fridge"
            className="text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h2 className="font-serif text-2xl text-neutral-900">{t("history.title")}</h2>
        </div>
        <p className="mt-1 pl-7 font-sans text-sm text-neutral-400">
          {t("history.subtitle")}
        </p>
      </div>

      {consumedEntries.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl text-neutral-200">&#128203;</div>
          <p className="mt-4 font-serif text-lg text-neutral-400">
            {t("history.empty")}
          </p>
        </div>
      ) : (
        <>
          {/* Stats section */}
          <div className="mb-8">
            <h3 className="mb-3 font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              {t("history.stats")}
            </h3>

            <div className="grid grid-cols-3 divide-x divide-neutral-100 border border-neutral-100">
              <div className="py-3 text-center">
                <div className="font-serif text-2xl text-neutral-900">{totalTracked}</div>
                <div className="font-sans text-[9px] uppercase tracking-wider text-neutral-400">
                  {t("history.total")}
                </div>
              </div>
              <div className="py-3 text-center">
                <div className={cn("font-serif text-2xl", wastePct > 30 ? "text-red-600" : wastePct > 15 ? "text-amber-600" : "text-emerald-600")}>
                  {wastePct}%
                </div>
                <div className="font-sans text-[9px] uppercase tracking-wider text-neutral-400">
                  {t("history.waste_pct")}
                </div>
              </div>
              <div className="py-3 text-center">
                <div className="font-serif text-2xl text-neutral-900">{streak}</div>
                <div className="font-sans text-[9px] uppercase tracking-wider text-neutral-400">
                  {t("history.streak")}
                </div>
              </div>
            </div>

            {/* Mini pie chart (CSS) */}
            {totalTracked > 0 && (
              <div className="mt-4 flex items-center gap-4">
                <div
                  className="h-16 w-16 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(
                      #059669 0deg ${(eatenCount / totalTracked) * 360}deg,
                      #dc2626 ${(eatenCount / totalTracked) * 360}deg 360deg
                    )`,
                  }}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 bg-emerald-600" />
                    <span className="font-sans text-xs text-neutral-600">
                      {t("history.eaten")} ({eatenCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 bg-red-600" />
                    <span className="font-sans text-xs text-neutral-600">
                      {t("history.wasted")} ({wastedCount})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History entries grouped by date */}
          {sortedDates.map((dateKey) => (
            <div key={dateKey} className="mb-6">
              <div className="border-b border-neutral-200 pb-2">
                <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                  {formatDateShort(dateKey + "T00:00:00Z", locale)}
                </h3>
              </div>
              {grouped[dateKey].map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 border-b border-neutral-100 py-3"
                >
                  <span className="text-xl">{entry.productIcon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-sm text-neutral-900">{entry.productName}</p>
                    {entry.daysBeforeExpiry !== null && (
                      <p className="font-sans text-[10px] text-neutral-400">
                        {entry.daysBeforeExpiry > 0
                          ? `${entry.daysBeforeExpiry} ${t("fridge.days_left")}`
                          : entry.daysBeforeExpiry === 0
                            ? t("fridge.today")
                            : `${Math.abs(entry.daysBeforeExpiry)} ${t("fridge.days_left")} ${t("fridge.expired_label")}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider",
                      entry.action === "eaten"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800",
                    )}
                  >
                    {entry.action === "eaten" ? t("history.eaten") : t("history.wasted")}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
