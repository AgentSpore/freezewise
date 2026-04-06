"use client";

import { useCallback } from "react";
import RecipeCard from "@/components/recipe-card";
import { SkeletonRecipe } from "@/components/skeleton";
import { useLocaleStore, useFridgeStore, useRecipesStore, useUIStore, useModelStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { generateRecipes } from "@/lib/api";
import Link from "next/link";

export default function RecipesPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);
  const fridgeItems = useFridgeStore((s) => s.items);
  const recipes = useRecipesStore((s) => s.recipes);
  const source = useRecipesStore((s) => s.source);
  const isGenerating = useRecipesStore((s) => s.isGenerating);
  const setRecipes = useRecipesStore((s) => s.setRecipes);
  const setIsGenerating = useRecipesStore((s) => s.setIsGenerating);
  const setRecipeError = useRecipesStore((s) => s.setError);
  const recipeError = useRecipesStore((s) => s.error);
  const showToast = useUIStore((s) => s.showToast);
  const selectedModel = useModelStore((s) => s.selectedModel);

  const handleGenerate = useCallback(async () => {
    if (fridgeItems.length === 0) return;

    setIsGenerating(true);
    setRecipeError(null);
    try {
      const productNames = fridgeItems.map((item) => item.product.name);
      const uniqueNames = [...new Set(productNames)];
      const result = await generateRecipes(uniqueNames, locale, selectedModel);
      setRecipes(result.recipes, result.source);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate recipes";
      setRecipeError(msg);
      showToast(msg, "error");
    } finally {
      setIsGenerating(false);
    }
  }, [fridgeItems, locale, selectedModel, setIsGenerating, setRecipeError, setRecipes, showToast]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-neutral-900">{t("recipes.title")}</h2>
        <p className="mt-1 font-sans text-sm text-neutral-400">
          {t("recipes.subtitle")}
        </p>
      </div>

      {fridgeItems.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-serif text-lg text-neutral-400">
            {t("recipes.empty")}
          </p>
          <p className="mt-1 font-sans text-sm text-neutral-300">
            {t("recipes.empty_hint")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block border border-neutral-900 px-6 py-2.5 font-sans text-xs uppercase tracking-[0.2em] text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
          >
            {t("nav.search")}
          </Link>
        </div>
      ) : (
        <>
          {/* Generate button */}
          <div className="mb-6">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full border border-neutral-900 bg-neutral-900 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {isGenerating ? t("recipes.generating") : t("recipes.generate")}
            </button>
            <p className="mt-2 text-center font-sans text-[10px] text-neutral-300">
              {fridgeItems.length} {t("fridge.total").toLowerCase()} in fridge
            </p>
          </div>

          {/* Loading */}
          {isGenerating && (
            <div>
              <SkeletonRecipe />
              <SkeletonRecipe />
              <SkeletonRecipe />
            </div>
          )}

          {/* Error */}
          {recipeError && (
            <div className="py-8 text-center">
              <p className="font-sans text-sm text-red-500">{recipeError}</p>
            </div>
          )}

          {/* Recipes list */}
          {!isGenerating && recipes.length > 0 && (
            <div>
              {source && (
                <div className="mb-2 border-b border-neutral-100 pb-2">
                  <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-300">
                    {t("recipes.source")}: {source}
                  </span>
                </div>
              )}
              {recipes.map((recipe, i) => (
                <RecipeCard key={i} recipe={recipe} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
