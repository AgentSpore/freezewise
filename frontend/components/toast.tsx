"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function Toast() {
  const message = useUIStore((s) => s.toastMessage);
  const type = useUIStore((s) => s.toastType);
  const clearToast = useUIStore((s) => s.clearToast);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(clearToast, 3000);
    return () => clearTimeout(timer);
  }, [message, clearToast]);

  if (!message) return null;

  return (
    <div className="fixed left-4 right-4 top-4 z-[100] flex justify-center">
      <div
        className={cn(
          "max-w-md border px-4 py-2.5 font-sans text-sm shadow-sm transition-all duration-300",
          type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
          type === "error" && "border-red-200 bg-red-50 text-red-800",
          type === "info" && "border-neutral-200 bg-white text-neutral-800",
        )}
      >
        {message}
      </div>
    </div>
  );
}
