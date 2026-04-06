"use client";

import { useEffect } from "react";
import Masthead from "@/components/masthead";
import BottomNav from "@/components/bottom-nav";
import ProductDetail from "@/components/product-detail";
import PhotoScan from "@/components/photo-scan";
import Toast from "@/components/toast";
import { initializeStores, useThemeStore } from "@/lib/store";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);

  // Initialize stores from localStorage on mount
  useEffect(() => {
    initializeStores();
  }, []);

  // Apply theme to html element
  useEffect(() => {
    const theme = effectiveTheme();
    document.documentElement.setAttribute("data-theme", theme);
  }, [effectiveTheme]);

  return (
    <>
      <Masthead />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-4">
        {children}
      </main>
      <BottomNav />
      <ProductDetail />
      <PhotoScan />
      <Toast />
    </>
  );
}
