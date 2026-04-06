"use client";

import { useState } from "react";
import type { LocalFridgeItem } from "@/lib/store";
import { useLocaleStore, useFridgeStore, useUIStore, useHistoryStore, determineDaysLeft, getFridgeItemStatus } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { formatDateShort, statusColor, cn } from "@/lib/utils";
import { getProductName } from "@/lib/utils";

interface FridgeItemProps {
  item: LocalFridgeItem;
}

export default function FridgeItem({ item }: FridgeItemProps) {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const removeItem = useFridgeStore((s) => s.removeItem);
  const showToast = useUIStore((s) => s.showToast);
  const addEntry = useHistoryStore((s) => s.addEntry);

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const { daysLeft, status } = getFridgeItemStatus(item);

  const handleRemoveAction = (action: "eaten" | "wasted") => {
    const daysBeforeExpiry = determineDaysLeft(item);
    addEntry({
      productName: getProductName(item.product, locale),
      productIcon: item.product.icon,
      action,
      daysBeforeExpiry,
    });
    // Also add "added" entry is tracked at addItem time, not here
    removeItem(item.id);
    setShowRemoveDialog(false);
    showToast(t(`history.action_${action}`), "success");
  };

  const name = getProductName(item.product, locale);

  const daysText = (() => {
    if (daysLeft === null) return "";
    if (daysLeft < 0)
      return `${Math.abs(daysLeft)} ${t("fridge.days_left")} ${t("fridge.expired_label")}`;
    if (daysLeft === 0) return t("fridge.today");
    return `${daysLeft} ${t("fridge.days_left")}`;
  })();

  return (
    <div className="flex items-start gap-4 border-b border-neutral-100 py-4">
      <span className="mt-0.5 text-2xl">{item.product.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-serif text-base text-neutral-900">
              {name}
            </h3>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-sans text-[10px] uppercase tracking-wider text-neutral-400">
                {item.location}
              </span>
              {item.quantity && (
                <>
                  <span className="text-neutral-200">|</span>
                  <span className="font-sans text-[10px] text-neutral-400">
                    {item.quantity}
                  </span>
                </>
              )}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider",
              statusColor(status),
            )}
          >
            {daysText}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="font-sans text-[10px] text-neutral-300">
            {t("fridge.added")} {formatDateShort(item.addedAt, locale)}
          </span>

          {!showRemoveDialog ? (
            <button
              onClick={() => setShowRemoveDialog(true)}
              className="font-sans text-[10px] uppercase tracking-wider text-neutral-400 transition-colors hover:text-red-600"
            >
              {t("fridge.remove")}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleRemoveAction("eaten")}
                className="border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-sans text-[10px] uppercase tracking-wider text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                {t("history.eaten")}
              </button>
              <button
                onClick={() => handleRemoveAction("wasted")}
                className="border border-red-200 bg-red-50 px-2.5 py-1 font-sans text-[10px] uppercase tracking-wider text-red-700 transition-colors hover:bg-red-100"
              >
                {t("history.wasted")}
              </button>
              <button
                onClick={() => setShowRemoveDialog(false)}
                className="px-1.5 py-1 font-sans text-[10px] text-neutral-400 hover:text-neutral-600"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>

        {item.notes && (
          <p className="mt-1.5 border-l-2 border-neutral-200 pl-3 font-serif text-xs italic text-neutral-500">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  );
}
