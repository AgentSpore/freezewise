"use client";

import { useId, useRef, useState } from "react";
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
  const updateItem = useFridgeStore((s) => s.updateItem);
  const showToast = useUIStore((s) => s.showToast);
  const addEntry = useHistoryStore((s) => s.addEntry);

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);
  const [quantityError, setQuantityError] = useState(false);
  const quantityId = useId();
  const editButton = useRef<HTMLButtonElement>(null);

  const closeQuantityEditor = () => {
    setEditingQuantity(false);
    setQuantityError(false);
    editButton.current?.focus();
  };

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
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
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
              <button
                ref={editButton}
                type="button"
                aria-expanded={editingQuantity}
                onClick={() => {
                  setQuantity(item.quantity);
                  setQuantityError(false);
                  setEditingQuantity(true);
                  setShowRemoveDialog(false);
                }}
                className="font-sans text-xs text-neutral-600 underline hover:text-neutral-900"
              >
                {t("fridge.edit_quantity")}
              </button>
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

        {editingQuantity && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = quantity.trim();
              if (!trimmed) {
                setQuantityError(true);
                return;
              }
              updateItem(item.id, { quantity: trimmed });
              closeQuantityEditor();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeQuantityEditor();
              }
            }}
          >
            <label htmlFor={quantityId} className="min-w-0 flex-1 basis-full font-sans text-xs text-neutral-600">
              {t("product.quantity")}
              <input
                id={quantityId}
                autoFocus
                value={quantity}
                aria-invalid={quantityError}
                aria-describedby={quantityError ? `${quantityId}-error` : undefined}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setQuantityError(false);
                }}
                className="mt-1 block w-full border border-neutral-400 px-3 py-2 text-sm text-neutral-900"
              />
            </label>
            {quantityError && (
              <p id={`${quantityId}-error`} role="alert" className="basis-full font-sans text-xs text-red-700">
                {t("fridge.quantity_required")}
              </p>
            )}
            <button type="submit" className="border border-neutral-900 bg-neutral-900 px-3 py-2 font-sans text-xs text-white">
              {t("common.save")}
            </button>
            <button type="button" onClick={closeQuantityEditor} className="border border-neutral-400 px-3 py-2 font-sans text-xs text-neutral-700">
              {t("common.cancel")}
            </button>
          </form>
        )}

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
