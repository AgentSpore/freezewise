"use client";

import { useEffect } from "react";
import { useLocaleStore, useProductsStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { getCategories } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function CategoryTabs() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const categories = useProductsStore((s) => s.categories);
  const setCategories = useProductsStore((s) => s.setCategories);
  const selectedCategory = useProductsStore((s) => s.selectedCategory);
  const setSelectedCategory = useProductsStore((s) => s.setSelectedCategory);
  const setIsLoadingCategories = useProductsStore((s) => s.setIsLoadingCategories);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingCategories(true);
    getCategories(locale)
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch(() => {
        // silent
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setCategories, setIsLoadingCategories, locale]);

  if (categories.length === 0) return null;

  return (
    <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
      <div className="flex gap-1 pb-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "whitespace-nowrap border px-3 py-1.5 font-sans text-xs uppercase tracking-wider transition-colors",
            !selectedCategory
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400",
          )}
        >
          {t("search.all")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() =>
              setSelectedCategory(cat.name === selectedCategory ? null : cat.name)
            }
            className={cn(
              "whitespace-nowrap border px-3 py-1.5 font-sans text-xs uppercase tracking-wider transition-colors",
              cat.name === selectedCategory
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400",
            )}
          >
            <span className="mr-1">{cat.icon}</span>
            {t(`categories.${cat.name}`) !== `categories.${cat.name}` ? t(`categories.${cat.name}`) : cat.name}
            <span className="ml-1 text-[10px] opacity-60">{cat.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
