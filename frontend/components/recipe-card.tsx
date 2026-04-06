"use client";

import type { RecipeSuggestion } from "@/lib/types";
import { useLocaleStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { padNumber } from "@/lib/utils";

interface RecipeCardProps {
  recipe: RecipeSuggestion;
  index: number;
}

export default function RecipeCard({ recipe, index }: RecipeCardProps) {
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);

  return (
    <article className="border-b border-neutral-100 py-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="font-sans text-[10px] uppercase tracking-widest text-neutral-300">
          {padNumber(index + 1)}
        </span>
        <div className="flex-1">
          <h3 className="font-serif text-xl leading-tight text-neutral-900">
            {recipe.title}
          </h3>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-sans text-xs text-neutral-500">
              {recipe.time_minutes} {t("recipes.time")}
            </span>
            {recipe.uses_expiring.length > 0 && (
              <>
                <span className="text-neutral-200">|</span>
                <span className="font-sans text-[10px] uppercase tracking-wider text-amber-600">
                  {t("recipes.uses")}: {recipe.uses_expiring.join(", ")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="mt-4">
        <h4 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {t("recipes.ingredients")}
        </h4>
        <ul className="mt-2 space-y-1">
          {recipe.ingredients.map((ing, i) => (
            <li
              key={i}
              className="flex items-start gap-2 font-sans text-sm text-neutral-700"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 bg-neutral-300" />
              {ing}
            </li>
          ))}
        </ul>
      </div>

      {/* Steps */}
      <div className="mt-4">
        <h4 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {t("recipes.steps")}
        </h4>
        <ol className="mt-2 space-y-2">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 font-serif text-sm text-neutral-300">
                {i + 1}.
              </span>
              <p className="font-sans text-sm leading-relaxed text-neutral-700">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
