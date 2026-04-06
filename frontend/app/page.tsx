"use client";

import { useEffect } from "react";
import SearchBar from "@/components/search-bar";
import CategoryTabs from "@/components/category-tabs";
import ProductCard from "@/components/product-card";
import { SkeletonList } from "@/components/skeleton";
import { useLocaleStore, useProductsStore, useUIStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { getProducts } from "@/lib/api";

export default function SearchPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const products = useProductsStore((s) => s.products);
  const searchResults = useProductsStore((s) => s.searchResults);
  const searchQuery = useProductsStore((s) => s.searchQuery);
  const searchSource = useProductsStore((s) => s.searchSource);
  const selectedCategory = useProductsStore((s) => s.selectedCategory);
  const isSearching = useProductsStore((s) => s.isSearching);
  const setProducts = useProductsStore((s) => s.setProducts);
  const error = useProductsStore((s) => s.error);
  const setShowScanModal = useUIStore((s) => s.setShowScanModal);

  // Load initial products
  useEffect(() => {
    let cancelled = false;
    getProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        // silent
      });
    return () => {
      cancelled = true;
    };
  }, [setProducts]);

  const displayProducts = searchQuery ? searchResults : products;
  const filteredProducts = selectedCategory
    ? displayProducts.filter((p) => p.category === selectedCategory)
    : displayProducts;

  return (
    <div>
      {/* Section heading */}
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-neutral-900">{t("search.title")}</h2>
        <p className="mt-1 font-sans text-sm text-neutral-400">
          {t("search.subtitle")}
        </p>
      </div>

      {/* Search */}
      <SearchBar />

      {/* Categories */}
      <div className="mt-4">
        <CategoryTabs />
      </div>

      {/* Source indicator */}
      {searchSource && (
        <div className="mt-4 border-b border-neutral-100 pb-2">
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-300">
            {t("search.source")}: {searchSource}
          </span>
        </div>
      )}

      {/* Results */}
      <div className="mt-2">
        {isSearching ? (
          <SkeletonList count={5} />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="font-sans text-sm text-red-500">{error}</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div>
            <div className="flex items-center justify-between py-3">
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                {t("search.results")} ({filteredProducts.length})
              </span>
            </div>
            {filteredProducts.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="py-12 text-center">
            <p className="font-serif text-lg text-neutral-400">
              {t("search.no_results")}
            </p>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="font-serif text-lg italic text-neutral-300">
              {t("search.hint")}
            </p>
          </div>
        )}
      </div>

      {/* FAB camera button */}
      <button
        onClick={() => setShowScanModal(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center border border-neutral-900 bg-neutral-900 text-white shadow-lg transition-transform hover:scale-105 sm:right-8"
        aria-label={t("search.scan")}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <circle cx="12" cy="12" r="3" />
          <path d="M7 5V3h3M14 3h3v2" />
        </svg>
      </button>
    </div>
  );
}
