export interface ProductResponse {
  id: number;
  name: string;
  name_ru: string;
  name_cn: string;
  category: string;
  can_freeze: boolean;
  freeze_months: number;
  freeze_how: string;
  thaw_how: string;
  fridge_days: number;
  pantry_days: number;
  spoilage_signs: string;
  tips: string[];
  icon: string;
}

export interface ProductSearchResponse {
  products: ProductResponse[];
  source: string;
  query: string;
}

export interface FridgeStats {
  total_items: number;
  expiring_soon: number;
  expired: number;
  by_category: Record<string, number>;
  dominant_category: string;
  theme: "green" | "warm" | "colorful" | "neutral";
}

export interface RecipeSuggestion {
  title: string;
  ingredients: string[];
  steps: string[];
  time_minutes: number;
  uses_expiring: string[];
}

export interface RecipeResponse {
  recipes: RecipeSuggestion[];
  source: string;
}

export interface CategoryInfo {
  name: string;
  count: number;
  icon: string;
}

export interface ScannedProduct {
  name: string;
  quantity: number;
  category: string;
  confidence: number;
}

export interface ScanProgress {
  stage: string;
  progress: number;
  message: string;
  products: ScannedProduct[];
  added_ids: number[];
}

export interface ModelInfo {
  id: string;
  name: string;
  context: number;
  vision: boolean;
  tools: boolean;
}

export interface ModelsResponse {
  default: string;
  agent_default: string;
  models: ModelInfo[];
}

export type Locale = "en" | "ru" | "cn";
export type ThemeName = "green" | "warm" | "colorful" | "neutral";
