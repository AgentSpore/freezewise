"use client";

import { create } from "zustand";
import type {
  ProductResponse,
  FridgeStats,
  RecipeSuggestion,
  CategoryInfo,
  Locale,
  ThemeName,
} from "./types";
import { getStoredLocale, setStoredLocale } from "./i18n";

// ── Locale Store ──

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  setLocale: (locale) => {
    setStoredLocale(locale);
    set({ locale });
  },
}));

// ── Theme Store ──

interface ThemeState {
  theme: ThemeName;
  themeOverride: ThemeName | null;
  setTheme: (theme: ThemeName) => void;
  setThemeOverride: (override: ThemeName | null) => void;
  effectiveTheme: () => ThemeName;
}

function getStoredThemeOverride(): ThemeName | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("freezewise-theme-override");
  if (
    stored === "green" ||
    stored === "warm" ||
    stored === "colorful" ||
    stored === "neutral"
  )
    return stored;
  return null;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "neutral",
  themeOverride: null,
  setTheme: (theme) => set({ theme }),
  setThemeOverride: (override) => {
    if (typeof window !== "undefined") {
      if (override) {
        localStorage.setItem("freezewise-theme-override", override);
      } else {
        localStorage.removeItem("freezewise-theme-override");
      }
    }
    set({ themeOverride: override });
  },
  effectiveTheme: () => {
    const state = get();
    return state.themeOverride ?? state.theme;
  },
}));

// ── Model Store ──

interface ModelState {
  selectedModel: string | null;
  setSelectedModel: (model: string | null) => void;
}

const MODEL_KEY = "freezewise-model";

function getStoredModel(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(MODEL_KEY) || null;
}

export const useModelStore = create<ModelState>((set) => ({
  selectedModel: null,
  setSelectedModel: (model) => {
    if (typeof window !== "undefined") {
      if (model) {
        localStorage.setItem(MODEL_KEY, model);
      } else {
        localStorage.removeItem(MODEL_KEY);
      }
    }
    set({ selectedModel: model });
  },
}));

// ── Products Store ──

interface ProductsState {
  products: ProductResponse[];
  searchResults: ProductResponse[];
  searchQuery: string;
  searchSource: string;
  categories: CategoryInfo[];
  selectedCategory: string | null;
  selectedProduct: ProductResponse | null;
  isSearching: boolean;
  isLoadingCategories: boolean;
  error: string | null;
  setProducts: (products: ProductResponse[]) => void;
  setSearchResults: (results: ProductResponse[], source: string, query: string) => void;
  setCategories: (categories: CategoryInfo[]) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedProduct: (product: ProductResponse | null) => void;
  setIsSearching: (isSearching: boolean) => void;
  setIsLoadingCategories: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProductsStore = create<ProductsState>((set) => ({
  products: [],
  searchResults: [],
  searchQuery: "",
  searchSource: "",
  categories: [],
  selectedCategory: null,
  selectedProduct: null,
  isSearching: false,
  isLoadingCategories: false,
  error: null,
  setProducts: (products) => set({ products }),
  setSearchResults: (results, source, query) =>
    set({ searchResults: results, searchSource: source, searchQuery: query }),
  setCategories: (categories) => set({ categories }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setIsLoadingCategories: (isLoading) => set({ isLoadingCategories: isLoading }),
  setError: (error) => set({ error }),
}));

// ── Fridge Store (localStorage) ──

export interface LocalFridgeItem {
  id: string; // UUID
  product: ProductResponse; // full product data
  location: "fridge" | "freezer" | "pantry";
  quantity: string;
  notes: string;
  addedAt: string; // ISO date
}

interface FridgeState {
  items: LocalFridgeItem[];
  addItem: (product: ProductResponse, location: string, quantity: string) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<Pick<LocalFridgeItem, "location" | "quantity" | "notes">>) => void;
  clearAll: () => void;
  importItems: (items: LocalFridgeItem[]) => void;
  getStats: () => FridgeStats;
}

const FRIDGE_KEY = "freezewise-fridge";

function loadFridge(): LocalFridgeItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FRIDGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFridge(items: LocalFridgeItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FRIDGE_KEY, JSON.stringify(items));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calcExpiresAt(location: string, product: ProductResponse, addedAt: string): string | null {
  const base = new Date(addedAt);
  if (location === "fridge" && product.fridge_days > 0) {
    return new Date(base.getTime() + product.fridge_days * 86400000).toISOString();
  }
  if (location === "pantry" && product.pantry_days > 0) {
    return new Date(base.getTime() + product.pantry_days * 86400000).toISOString();
  }
  if (location === "freezer" && product.freeze_months > 0) {
    return new Date(base.getTime() + product.freeze_months * 30 * 86400000).toISOString();
  }
  return null;
}

function determineDaysLeft(item: LocalFridgeItem): number | null {
  const expires = calcExpiresAt(item.location, item.product, item.addedAt);
  if (!expires) return null;
  return Math.floor((new Date(expires).getTime() - Date.now()) / 86400000);
}

function determineStatus(daysLeft: number | null): "fresh" | "expiring_soon" | "expired" {
  if (daysLeft === null) return "fresh";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 3) return "expiring_soon";
  return "fresh";
}

function determineTheme(items: LocalFridgeItem[]): ThemeName {
  if (items.length === 0) return "neutral";
  const counts: Record<string, number> = {};
  for (const item of items) {
    const cat = item.product.category;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";
  if (["vegetables", "herbs", "grains"].includes(dominant)) return "green";
  if (["meat", "dairy", "seafood", "prepared"].includes(dominant)) return "warm";
  if (["fruits", "beverages", "snacks"].includes(dominant)) return "colorful";
  return "neutral";
}

export const useFridgeStore = create<FridgeState>((set, get) => ({
  items: [],

  addItem: (product, location, quantity) => {
    const item: LocalFridgeItem = {
      id: generateId(),
      product,
      location: location as LocalFridgeItem["location"],
      quantity: quantity || "1",
      notes: "",
      addedAt: new Date().toISOString(),
    };
    const updated = [...get().items, item];
    saveFridge(updated);
    set({ items: updated });
    // Auto-update theme
    useThemeStore.getState().setTheme(determineTheme(updated));
  },

  removeItem: (id) => {
    const updated = get().items.filter((i) => i.id !== id);
    saveFridge(updated);
    set({ items: updated });
    useThemeStore.getState().setTheme(determineTheme(updated));
  },

  updateItem: (id, updates) => {
    const updated = get().items.map((i) =>
      i.id === id ? { ...i, ...updates } : i,
    );
    saveFridge(updated);
    set({ items: updated });
  },

  clearAll: () => {
    saveFridge([]);
    set({ items: [] });
    useThemeStore.getState().setTheme("neutral");
  },

  importItems: (items) => {
    saveFridge(items);
    set({ items });
    useThemeStore.getState().setTheme(determineTheme(items));
  },

  getStats: () => {
    const items = get().items;
    const byCategory: Record<string, number> = {};
    let expiringSoon = 0;
    let expired = 0;

    for (const item of items) {
      byCategory[item.product.category] = (byCategory[item.product.category] || 0) + 1;
      const dl = determineDaysLeft(item);
      const st = determineStatus(dl);
      if (st === "expiring_soon") expiringSoon++;
      if (st === "expired") expired++;
    }

    const dominant = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

    return {
      total_items: items.length,
      expiring_soon: expiringSoon,
      expired,
      by_category: byCategory,
      dominant_category: dominant,
      theme: determineTheme(items),
    };
  },
}));

// Helper: get days left and status for a fridge item
export function getFridgeItemStatus(item: LocalFridgeItem) {
  const daysLeft = determineDaysLeft(item);
  const status = determineStatus(daysLeft);
  const expiresAt = calcExpiresAt(item.location, item.product, item.addedAt);
  return { daysLeft, status, expiresAt };
}

// ── Recipes Store ──

interface RecipesState {
  recipes: RecipeSuggestion[];
  source: string;
  isGenerating: boolean;
  error: string | null;
  setRecipes: (recipes: RecipeSuggestion[], source: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRecipesStore = create<RecipesState>((set) => ({
  recipes: [],
  source: "",
  isGenerating: false,
  error: null,
  setRecipes: (recipes, source) => set({ recipes, source }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
}));

// ── UI Store ──

interface UIState {
  showScanModal: boolean;
  showProductDetail: boolean;
  toastMessage: string | null;
  toastType: "success" | "error" | "info";
  setShowScanModal: (show: boolean) => void;
  setShowProductDetail: (show: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  showScanModal: false,
  showProductDetail: false,
  toastMessage: null,
  toastType: "info",
  setShowScanModal: (show) => set({ showScanModal: show }),
  setShowProductDetail: (show) => set({ showProductDetail: show }),
  showToast: (message, type = "info") => set({ toastMessage: message, toastType: type }),
  clearToast: () => set({ toastMessage: null }),
}));

// ── Hydration helper ──

export function initializeStores() {
  useLocaleStore.getState().setLocale(getStoredLocale());

  const themeOverride = getStoredThemeOverride();
  if (themeOverride) {
    useThemeStore.getState().setThemeOverride(themeOverride);
  }

  // Load model from localStorage
  const storedModel = getStoredModel();
  if (storedModel) {
    useModelStore.setState({ selectedModel: storedModel });
  }

  // Load fridge from localStorage
  const fridgeItems = loadFridge();
  useFridgeStore.setState({ items: fridgeItems });
  useThemeStore.getState().setTheme(determineTheme(fridgeItems));
}
