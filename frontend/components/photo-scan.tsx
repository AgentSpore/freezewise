"use client";

import { useState, useRef } from "react";
import type { ProductResponse, ScannedProduct } from "@/lib/types";
import { useLocaleStore, useUIStore, useFridgeStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { scanPhoto, getProduct } from "@/lib/api";
import { getProductName, cn } from "@/lib/utils";

export default function PhotoScan() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const showScanModal = useUIStore((s) => s.showScanModal);
  const setShowScanModal = useUIStore((s) => s.setShowScanModal);
  const showToast = useUIStore((s) => s.showToast);
  const addItem = useFridgeStore((s) => s.addItem);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedProduct[]>([]);
  const [resolvedProducts, setResolvedProducts] = useState<ProductResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showScanModal) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    resetState();

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const resetState = () => {
    setScannedItems([]);
    setResolvedProducts([]);
    setSelectedIds(new Set());
    setIsDone(false);
    setError(null);
    setProgress(0);
    setStage("");
    setMessage("");
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    resetState();

    try {
      const response = await scanPhoto(selectedFile);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let addedIds: number[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            setProgress(data.progress);
            setStage(data.stage);
            setMessage(data.message);

            if (data.stage === "identified" && data.products?.length > 0) {
              setScannedItems(data.products);
            }

            if (data.stage === "done") {
              addedIds = data.added_ids || [];
              setIsDone(true);
            }

            if (data.stage === "error") {
              setError(data.message);
            }
          } catch {
            // skip malformed
          }
        }
      }

      // Fetch full ProductResponse for each added_id
      if (addedIds.length > 0) {
        const products: ProductResponse[] = [];
        for (const id of addedIds) {
          try {
            const p = await getProduct(id);
            products.push(p);
          } catch {
            // skip
          }
        }
        setResolvedProducts(products);
        setSelectedIds(new Set(products.map((p) => p.id)));
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleProduct = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelected = () => {
    for (const product of resolvedProducts) {
      if (selectedIds.has(product.id)) {
        addItem(product, "fridge", "1");
      }
    }
    showToast(t("product.added"), "success");
    handleClose();
  };

  const handleClose = () => {
    setShowScanModal(false);
    setImagePreview(null);
    setSelectedFile(null);
    resetState();
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
            <h2 className="font-serif text-xl text-neutral-900">{t("scan.title")}</h2>
            <p className="font-sans text-xs text-neutral-400">{t("scan.subtitle")}</p>
          </div>
          <button onClick={handleClose} className="p-2 text-neutral-400 hover:text-neutral-900">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {!imagePreview ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 border-2 border-dashed border-neutral-200 py-12 text-neutral-400 hover:border-neutral-400"
            >
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="5" width="18" height="14" rx="1" />
                <circle cx="8.5" cy="11.5" r="2" />
                <path d="M21 19l-5-5-3 3-2-2-8 8" />
              </svg>
              <span className="font-sans text-sm">{t("scan.choose")}</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full object-contain" style={{ maxHeight: "200px" }} />
                {!isAnalyzing && !isDone && (
                  <button
                    onClick={() => { setImagePreview(null); setSelectedFile(null); resetState(); }}
                    className="absolute right-2 top-2 bg-white/80 p-1"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Analyze button */}
              {!isAnalyzing && !isDone && !error && (
                <button
                  onClick={handleAnalyze}
                  className="w-full bg-neutral-900 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white hover:bg-neutral-800"
                >
                  {t("scan.analyze")}
                </button>
              )}

              {/* Progress */}
              {isAnalyzing && (
                <div className="space-y-2">
                  <div className="h-1 w-full bg-neutral-100">
                    <div className="h-1 bg-neutral-900 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="font-sans text-xs text-neutral-500">
                    {message}
                  </p>
                  {/* Show detected items as they come in */}
                  {scannedItems.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {scannedItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 font-sans text-xs text-neutral-600">
                          <span className="text-neutral-300">{String(i + 1).padStart(2, "0")}</span>
                          <span>{item.name}</span>
                          {item.quantity > 1 && <span className="text-neutral-400">x{item.quantity}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="border border-red-200 bg-red-50 px-4 py-3">
                  <p className="font-sans text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => { setError(null); setIsDone(false); }}
                    className="mt-2 font-sans text-xs uppercase tracking-wider text-red-600 underline"
                  >
                    {t("common.retry")}
                  </button>
                </div>
              )}

              {/* Resolved products checklist */}
              {isDone && resolvedProducts.length > 0 && (
                <div>
                  <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                    {t("scan.detected")} ({resolvedProducts.length})
                  </h3>
                  <div className="mt-2 space-y-1">
                    {resolvedProducts.map((product) => (
                      <label
                        key={product.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 border px-3 py-2",
                          selectedIds.has(product.id)
                            ? "border-neutral-900 bg-neutral-50"
                            : "border-neutral-100",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleProduct(product.id)}
                          className="h-4 w-4 accent-neutral-900"
                        />
                        <span className="text-lg">{product.icon}</span>
                        <div className="flex-1">
                          <span className="font-sans text-sm text-neutral-900">
                            {getProductName(product, locale)}
                          </span>
                          <span className="ml-2 font-sans text-[10px] uppercase text-neutral-400">
                            {product.category}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* No products */}
              {isDone && resolvedProducts.length === 0 && !error && (
                <p className="text-center font-sans text-sm text-neutral-400">
                  {t("scan.no_products")}
                </p>
              )}

              {/* Add selected */}
              {isDone && selectedIds.size > 0 && (
                <button
                  onClick={handleAddSelected}
                  className="w-full bg-neutral-900 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white hover:bg-neutral-800"
                >
                  {t("scan.add_selected")} ({selectedIds.size})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
