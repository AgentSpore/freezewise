import type {
  ProductResponse,
  ProductSearchResponse,
  RecipeResponse,
  CategoryInfo,
  ModelsResponse,
} from "./types";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiError(text, res.status);
  }
  return res.json();
}

// Products
export async function getProducts(): Promise<ProductResponse[]> {
  return request<ProductResponse[]>("/api/products");
}

export async function searchProducts(query: string, model?: string | null, locale?: string): Promise<ProductSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (model) params.set("model", model);
  if (locale) params.set("locale", locale);
  return request<ProductSearchResponse>(`/api/products/search?${params.toString()}`);
}

export async function getProduct(id: number): Promise<ProductResponse> {
  return request<ProductResponse>(`/api/products/${id}`);
}

export async function getCategories(): Promise<CategoryInfo[]> {
  return request<CategoryInfo[]>("/api/categories");
}

// Models
export async function getModels(): Promise<ModelsResponse> {
  return request<ModelsResponse>("/api/models");
}

// Recipes
export async function generateRecipes(
  productNames: string[],
  locale: string,
  model?: string | null,
): Promise<RecipeResponse> {
  const body: Record<string, unknown> = { product_names: productNames, locale };
  if (model) body.model = model;
  return request<RecipeResponse>("/api/fridge/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Photo Scan — returns ReadableStream for SSE
export async function scanPhoto(file: File): Promise<Response> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/fridge/scan", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Scan failed");
    throw new ApiError(text, res.status);
  }
  return res;
}

export { ApiError };
