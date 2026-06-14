"use client";

import { useState } from "react";
import type { ProductResponse } from "@/lib/types";
import { useLocaleStore, useProductsStore, useUIStore, useFridgeStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { getProductName } from "@/lib/utils";

export default function ProductDetail() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const product = useProductsStore((s) => s.selectedProduct);
  const showDetail = useUIStore((s) => s.showProductDetail);
  const setShowProductDetail = useUIStore((s) => s.setShowProductDetail);
  const showToast = useUIStore((s) => s.showToast);
  const addItem = useFridgeStore((s) => s.addItem);

  const [location, setLocation] = useState("fridge");
  const [quantity, setQuantity] = useState("1");

  if (!showDetail || !product) return null;

  const name = getProductName(product, locale);

  const handleAdd = () => {
    addItem(product, location, quantity);
    showToast(t("product.added"), "success");
    setShowProductDetail(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowProductDetail(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center"
      onClick={handleBackdropClick}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto bg-white sm:max-h-[80vh]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{product.icon}</span>
            <div>
              <h2 className="font-serif text-xl text-neutral-900">{name}</h2>
              <p className="font-sans text-xs uppercase tracking-wider text-neutral-400">
                {product.category}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowProductDetail(false)}
            className="p-2 text-neutral-400 transition-colors hover:text-neutral-900"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* All names */}
          <div className="space-y-1">
            <NameRow label="EN" value={product.name} />
            <NameRow label="RU" value={product.name_ru} />
            <NameRow label="CN" value={product.name_cn} />
          </div>

          <hr className="border-neutral-100" />

          {/* Freezability badge */}
          <div className="flex items-center gap-2">
            {product.can_freeze ? (
              <span className="border border-blue-200 bg-blue-50 px-3 py-1 font-sans text-xs uppercase tracking-wider text-blue-700">
                {t("product.can_freeze")}
              </span>
            ) : (
              <span className="border border-neutral-200 bg-neutral-50 px-3 py-1 font-sans text-xs uppercase tracking-wider text-neutral-500">
                {t("product.no_freeze")}
              </span>
            )}
          </div>

          {/* Storage grid */}
          <div>
            <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              {t("product.storage_guide")}
            </h3>
            <div className="mt-3 grid grid-cols-3 divide-x divide-neutral-100 border border-neutral-100">
              <StorageCell
                label={t("product.freezer")}
                value={product.freeze_months > 0 ? `${product.freeze_months}` : "---"}
                unit={product.freeze_months > 0 ? t("product.months") : ""}
                icon="&#10052;"
              />
              <StorageCell
                label={t("product.fridge")}
                value={product.fridge_days > 0 ? `${product.fridge_days}` : "---"}
                unit={product.fridge_days > 0 ? t("product.days") : ""}
                icon="&#9731;"
              />
              <StorageCell
                label={t("product.pantry")}
                value={product.pantry_days > 0 ? `${product.pantry_days}` : "---"}
                unit={product.pantry_days > 0 ? t("product.days") : ""}
                icon="&#9782;"
              />
            </div>
          </div>

          {/* How to freeze */}
          {product.freeze_how && (
            <DetailSection title={t("product.how_to_freeze")} content={product.freeze_how} />
          )}

          {/* How to thaw */}
          {product.thaw_how && (
            <DetailSection title={t("product.how_to_thaw")} content={product.thaw_how} />
          )}

          {/* Eat cold? badge */}
          {product.cold_safe && (
            <ColdSafeBadge coldSafe={product.cold_safe} coldNote={product.cold_note} t={t} />
          )}

          {/* Spoilage / rancidity */}
          {(product.rancid_signs || product.spoilage_signs) && (
            <DetailSection
              title={t("product.rancid_signs")}
              content={product.rancid_signs || product.spoilage_signs}
            />
          )}

          {/* Tips — pull quotes */}
          {product.tips && product.tips.length > 0 && (
            <div>
              <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                {t("product.tips")}
              </h3>
              <div className="mt-2 space-y-2">
                {product.tips.map((tip, i) => (
                  <blockquote
                    key={i}
                    className="border-l-2 border-neutral-300 pl-4 font-serif text-sm italic text-neutral-600"
                  >
                    {tip}
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          <hr className="border-neutral-100" />

          {/* Add to fridge */}
          <div>
            <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              {t("product.add_to_fridge")}
            </h3>
            <div className="mt-3 flex gap-3">
              <div className="flex-1">
                <label className="block font-sans text-[10px] uppercase tracking-wider text-neutral-400">
                  {t("product.location")}
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full border-b border-neutral-300 bg-transparent py-2 font-sans text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                  <option value="freezer">{t("product.freezer")}</option>
                  <option value="fridge">{t("product.fridge")}</option>
                  <option value="pantry">{t("product.pantry")}</option>
                </select>
              </div>
              <div className="w-24">
                <label className="block font-sans text-[10px] uppercase tracking-wider text-neutral-400">
                  {t("product.quantity")}
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full border-b border-neutral-300 bg-transparent py-2 font-sans text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleAdd}
              className="mt-4 w-full border border-neutral-900 bg-neutral-900 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-neutral-800"
            >
              {t("product.add_to_fridge")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NameRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-sans text-[10px] uppercase tracking-wider text-neutral-300 w-6">
        {label}
      </span>
      <span className="font-sans text-sm text-neutral-700">{value}</span>
    </div>
  );
}

function StorageCell({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: string;
}) {
  return (
    <div className="py-4 text-center">
      <div
        className="text-lg text-neutral-300"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
      <div className="mt-1 font-serif text-2xl text-neutral-900">{value}</div>
      <div className="font-sans text-[10px] uppercase tracking-wider text-neutral-500">
        {unit}
      </div>
      <div className="mt-0.5 font-sans text-[9px] uppercase tracking-wider text-neutral-300">
        {label}
      </div>
    </div>
  );
}

function DetailSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        {title}
      </h3>
      <p className="mt-1.5 font-sans text-sm leading-relaxed text-neutral-700">
        {content}
      </p>
    </div>
  );
}

const COLD_SAFE_CONFIG = {
  yes: {
    badgeClass:
      "border border-green-200 bg-green-50 px-3 py-1 font-sans text-xs uppercase tracking-wider text-green-700",
    icon: (
      <svg
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  no: {
    badgeClass:
      "border border-amber-200 bg-amber-50 px-3 py-1 font-sans text-xs uppercase tracking-wider text-amber-700",
    icon: (
      <svg
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  depends: {
    badgeClass:
      "border border-neutral-200 bg-neutral-50 px-3 py-1 font-sans text-xs uppercase tracking-wider text-neutral-500",
    icon: (
      <svg
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
      </svg>
    ),
  },
} as const;

function ColdSafeBadge({
  coldSafe,
  coldNote,
  t,
}: {
  coldSafe: "yes" | "no" | "depends";
  coldNote?: string;
  t: (key: string) => string;
}) {
  const cfg = COLD_SAFE_CONFIG[coldSafe];
  const label = t(`product.cold_safe.${coldSafe}`);
  return (
    <div>
      <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        {t("product.cold_safe")}
      </h3>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={cfg.badgeClass} role="status" aria-label={label}>
          <span className="inline-flex items-center gap-1">
            {cfg.icon}
            {label}
          </span>
        </span>
      </div>
      {coldNote && (
        <p className="mt-1.5 font-sans text-sm leading-relaxed text-neutral-700">{coldNote}</p>
      )}
    </div>
  );
}
