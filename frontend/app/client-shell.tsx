"use client";

import { useEffect } from "react";
import Masthead from "@/components/masthead";
import BottomNav from "@/components/bottom-nav";
import ProductDetail from "@/components/product-detail";
import PhotoScan from "@/components/photo-scan";
import Toast from "@/components/toast";
import { initializeStores, useThemeStore } from "@/lib/store";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const themeOverride = useThemeStore((s) => s.themeOverride);

  // Initialize stores from localStorage on mount
  useEffect(() => {
    initializeStores();
  }, []);

  // Apply theme to html element — reacts to theme/themeOverride changes
  useEffect(() => {
    const effective = themeOverride ?? theme;
    document.documentElement.setAttribute("data-theme", effective);
  }, [theme, themeOverride]);

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
