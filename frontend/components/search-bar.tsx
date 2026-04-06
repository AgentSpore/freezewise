"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useLocaleStore, useProductsStore, useModelStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { searchProducts, getProducts } from "@/lib/api";

export default function SearchBar() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const setSearchResults = useProductsStore((s) => s.setSearchResults);
  const setProducts = useProductsStore((s) => s.setProducts);
  const setIsSearching = useProductsStore((s) => s.setIsSearching);
  const setError = useProductsStore((s) => s.setError);
  const selectedModel = useModelStore((s) => s.selectedModel);

  const [query, setQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([], "", "");
        setIsSearching(true);
        try {
          const products = await getProducts();
          setProducts(products);
        } catch {
          // silent — cached products might not be available
        } finally {
          setIsSearching(false);
        }
        return;
      }

      setIsSearching(true);
      setError(null);
      try {
        const result = await searchProducts(q.trim(), selectedModel, locale);
        setSearchResults(result.products, result.source, result.query);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [setSearchResults, setProducts, setIsSearching, setError, selectedModel, locale],
  );

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      handleSearch(query);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, handleSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search.placeholder")}
        className="w-full border-b-2 border-neutral-900 bg-transparent py-3 pl-0 pr-8 font-serif text-lg text-neutral-900 placeholder:text-neutral-300 focus:outline-none"
      />
      <svg
        className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M16 16l4.5 4.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
