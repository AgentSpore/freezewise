"use client";

import { useState, useRef } from "react";
import { useLocaleStore, useProductsStore, useUIStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { searchProducts } from "@/lib/api";
import type { ProductResponse } from "@/lib/types";
import { getProductName } from "@/lib/utils";

// Extend Window for BarcodeDetector which is not yet in standard TS lib
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

interface BarcodeScanProps {
  open: boolean;
  onClose: () => void;
}

export default function BarcodeScan({ open, onClose }: BarcodeScanProps) {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const setSelectedProduct = useProductsStore((s) => s.setSelectedProduct);
  const setShowProductDetail = useUIStore((s) => s.setShowProductDetail);
  const showToast = useUIStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundProduct, setFoundProduct] = useState<ProductResponse | null>(null);
  const [foundName, setFoundName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  if (!open) return null;

  const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

  const lookupBarcode = async (barcode: string) => {
    setSearching(true);
    setError(null);
    setFoundProduct(null);
    setFoundName(null);

    try {
      // Step 1: Look up product name via Open Food Facts
      const offRes = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      );
      const offData = await offRes.json();

      if (offData.status !== 1) {
        setError(t("barcode.not_found"));
        setSearching(false);
        return;
      }

      const productName =
        offData.product?.product_name ||
        offData.product?.product_name_en ||
        "";

      if (!productName) {
        setError(t("barcode.not_found"));
        setSearching(false);
        return;
      }

      setFoundName(productName);

      // Step 2: Search our API for storage info
      const result = await searchProducts(productName, null, locale);
      if (result.products.length > 0) {
        setFoundProduct(result.products[0]);
      }
    } catch {
      setError(t("barcode.not_found"));
    } finally {
      setSearching(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!hasBarcodeDetector) {
      showToast(t("barcode.not_supported"), "error");
      setShowManual(true);
      return;
    }

    try {
      const imageBitmap = await createImageBitmap(file);
      const detector = new window.BarcodeDetector!({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });
      const barcodes = await detector.detect(imageBitmap);

      if (barcodes.length > 0) {
        const barcode = barcodes[0].rawValue;
        await lookupBarcode(barcode);
      } else {
        setError(t("barcode.not_found"));
        setShowManual(true);
      }
    } catch {
      setError(t("barcode.not_found"));
      setShowManual(true);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualBarcode.trim();
    if (!code) return;
    await lookupBarcode(code);
  };

  const handleViewProduct = () => {
    if (foundProduct) {
      setSelectedProduct(foundProduct);
      setShowProductDetail(true);
      onClose();
    }
  };

  const handleClose = () => {
    setManualBarcode("");
    setSearching(false);
    setFoundProduct(null);
    setFoundName(null);
    setError(null);
    setShowManual(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="font-serif text-xl text-neutral-900">{t("barcode.title")}</h2>
            <p className="font-sans text-xs text-neutral-400">{t("barcode.subtitle")}</p>
          </div>
          <button onClick={handleClose} className="p-2 text-neutral-400 hover:text-neutral-900">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Camera capture */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {!searching && !foundProduct && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 border-2 border-dashed border-neutral-200 py-10 text-neutral-400 hover:border-neutral-400"
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="20" height="16" rx="1" />
                  <path d="M7 4V2M17 4V2M7 20v2M17 20v2M2 9h2M2 15h2M20 9h2M20 15h2" strokeLinecap="round" />
                  <path d="M8 10v4M10 10v4M13 10v4M16 10v4" strokeLinecap="round" />
                </svg>
                <span className="font-sans text-sm">{t("barcode.scan")}</span>
              </button>

              {(!hasBarcodeDetector || showManual) && (
                <div>
                  {!hasBarcodeDetector && (
                    <p className="mb-3 font-sans text-xs text-neutral-400">
                      {t("barcode.not_supported")}
                    </p>
                  )}
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value)}
                      placeholder={t("barcode.placeholder")}
                      className="flex-1 border border-neutral-200 px-3 py-2 font-sans text-sm focus:border-neutral-900 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!manualBarcode.trim()}
                      className="border border-neutral-900 bg-neutral-900 px-4 py-2 font-sans text-xs uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("barcode.scan")}
                    </button>
                  </form>
                </div>
              )}

              {hasBarcodeDetector && !showManual && (
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full font-sans text-xs text-neutral-400 underline hover:text-neutral-600"
                >
                  {t("barcode.manual")}
                </button>
              )}
            </>
          )}

          {/* Searching */}
          {searching && (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin border-2 border-neutral-200 border-t-neutral-900" />
              <p className="mt-3 font-sans text-sm text-neutral-500">{t("barcode.searching")}</p>
            </div>
          )}

          {/* Error */}
          {error && !searching && (
            <div className="border border-red-200 bg-red-50 px-4 py-3">
              <p className="font-sans text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Found product */}
          {foundProduct && !searching && (
            <div className="space-y-3">
              {foundName && (
                <div className="border border-neutral-100 px-4 py-3">
                  <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                    {t("barcode.found")}
                  </span>
                  <p className="mt-1 font-sans text-sm text-neutral-600">{foundName}</p>
                </div>
              )}
              <div className="flex items-center gap-3 border border-neutral-900 bg-neutral-50 px-4 py-3">
                <span className="text-2xl">{foundProduct.icon}</span>
                <div className="flex-1">
                  <p className="font-serif text-base text-neutral-900">
                    {getProductName(foundProduct, locale)}
                  </p>
                  <p className="font-sans text-[10px] uppercase tracking-wider text-neutral-400">
                    {foundProduct.category}
                  </p>
                </div>
              </div>
              <button
                onClick={handleViewProduct}
                className="w-full bg-neutral-900 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white hover:bg-neutral-800"
              >
                {t("product.add_to_fridge")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
