"use client";

import { useState } from "react";
import { compressToEncodedURIComponent } from "lz-string";
import { QRCodeSVG } from "qrcode.react";
import { useLocaleStore, useFridgeStore, useUIStore } from "@/lib/store";
import { createT } from "@/lib/i18n";

interface ShareFridgeProps {
  open: boolean;
  onClose: () => void;
}

export default function ShareFridge({ open, onClose }: ShareFridgeProps) {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const items = useFridgeStore((s) => s.items);
  const showToast = useUIStore((s) => s.showToast);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const data = JSON.stringify(
    items.map((i) => ({
      n: i.product.name,
      c: i.product.category,
      i: i.product.icon,
      l: i.location,
      q: i.quantity,
    })),
  );
  const compressed = compressToEncodedURIComponent(data);
  const shareUrl = `${window.location.origin}/fridge?share=${compressed}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast(t("share.copied"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      showToast(t("share.copied"), "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "FreezeWise",
          text: t("share.subtitle"),
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="font-serif text-xl text-neutral-900">{t("share.title")}</h2>
            <p className="font-sans text-xs text-neutral-400">{t("share.subtitle")}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {/* QR Code */}
          <div>
            <h3 className="mb-3 font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              {t("share.qr")}
            </h3>
            <div className="flex justify-center border border-neutral-100 p-6">
              <QRCodeSVG value={shareUrl} size={200} level="M" />
            </div>
          </div>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="flex w-full items-center justify-between border border-neutral-100 px-4 py-3 transition-colors hover:border-neutral-300"
          >
            <span className="font-sans text-sm text-neutral-900">
              {copied ? t("share.copied") : t("share.copy_link")}
            </span>
            <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {copied ? (
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="1" />
                  <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
                </>
              )}
            </svg>
          </button>

          {/* Native Share (if available) */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full bg-neutral-900 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white hover:bg-neutral-800"
            >
              {t("share.native_share")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
