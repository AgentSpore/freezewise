"use client";

import type { ProductResponse } from "@/lib/types";
import { useLocaleStore, useProductsStore, useUIStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { getProductName, padNumber, cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductResponse;
  index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const setSelectedProduct = useProductsStore((s) => s.setSelectedProduct);
  const setShowProductDetail = useUIStore((s) => s.setShowProductDetail);

  const name = getProductName(product, locale);

  const handleClick = () => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  return (
    <button
      onClick={handleClick}
      className="block w-full border-b border-[var(--card-border)] py-5 text-left transition-colors duration-200 hover:bg-[var(--accent-light)]"
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <span className="font-sans text-[10px] uppercase tracking-widest text-neutral-300">
            {padNumber(index + 1)}
          </span>
          <span className="mt-1 text-2xl">{product.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-lg leading-tight text-neutral-900">
              {name}
            </h3>
            <span
              className={cn(
                "shrink-0 border px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider",
                product.can_freeze
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-neutral-200 bg-neutral-50 text-neutral-500",
              )}
            >
              {product.can_freeze ? t("product.can_freeze") : t("product.no_freeze")}
            </span>
          </div>
          <p className="mt-0.5 font-sans text-xs uppercase tracking-wider text-neutral-400">
            {product.category}
          </p>
          <div className="mt-3 flex gap-6">
            {product.freeze_months > 0 && (
              <StorageStat
                label={t("product.freezer")}
                value={`${product.freeze_months}`}
                unit={t("product.months")}
              />
            )}
            {product.fridge_days > 0 && (
              <StorageStat
                label={t("product.fridge")}
                value={`${product.fridge_days}`}
                unit={t("product.days")}
              />
            )}
            {product.pantry_days > 0 && (
              <StorageStat
                label={t("product.pantry")}
                value={`${product.pantry_days}`}
                unit={t("product.days")}
              />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function StorageStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="text-center">
      <div className="font-serif text-xl leading-none text-neutral-900">{value}</div>
      <div className="mt-0.5 font-sans text-[9px] uppercase tracking-wider text-neutral-400">
        {unit}
      </div>
      <div className="font-sans text-[9px] uppercase tracking-wider text-neutral-300">
        {label}
      </div>
    </div>
  );
}
