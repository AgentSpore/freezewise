"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { decompressFromEncodedURIComponent } from "lz-string";
import { useLocaleStore, useFridgeStore, useUIStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { searchProducts } from "@/lib/api";

interface SharedItem {
  n: string; // name
  c: string; // category
  i: string; // icon
  l: string; // location
  q: string; // quantity
}

export default function ImportShare() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const addItem = useFridgeStore((s) => s.addItem);
  const showToast = useUIStore((s) => s.showToast);

  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const shareParam = searchParams.get("share");

  useEffect(() => {
    if (!shareParam) return;
    try {
      const decompressed = decompressFromEncodedURIComponent(shareParam);
      if (!decompressed) return;
      const parsed = JSON.parse(decompressed) as SharedItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSharedItems(parsed);
        setShowModal(true);
      }
    } catch {
      // invalid share data, ignore
    }
  }, [shareParam]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    let imported = 0;

    for (const item of sharedItems) {
      try {
        const result = await searchProducts(item.n, null, locale);
        if (result.products.length > 0) {
          const product = result.products[0];
          addItem(product, item.l, item.q);
          imported++;
        }
      } catch {
        // skip failed items
      }
    }

    setImporting(false);
    setShowModal(false);
    showToast(`${imported} / ${sharedItems.length} items imported`, "success");

    // Remove ?share= from URL
    router.replace("/fridge");
  }, [sharedItems, locale, addItem, showToast, router]);

  const handleClose = useCallback(() => {
    setShowModal(false);
    router.replace("/fridge");
  }, [router]);

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="font-serif text-xl text-neutral-900">{t("share.import_title")}</h2>
            <p className="font-sans text-xs text-neutral-400">{t("share.import_subtitle")}</p>
          </div>
          <button onClick={handleClose} className="p-2 text-neutral-400 hover:text-neutral-900">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* Items list */}
          <div className="space-y-1">
            {sharedItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 border border-neutral-100 px-3 py-2"
              >
                <span className="text-lg">{item.i}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-sans text-sm text-neutral-900">{item.n}</span>
                  <span className="ml-2 font-sans text-[10px] uppercase text-neutral-400">
                    {item.c}
                  </span>
                </div>
                <span className="font-sans text-[10px] uppercase tracking-wider text-neutral-400">
                  {item.l}
                </span>
              </div>
            ))}
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full bg-neutral-900 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing
              ? t("share.importing")
              : t("share.import_btn").replace("{count}", String(sharedItems.length))}
          </button>
        </div>
      </div>
    </div>
  );
}
