"use client";

import { useState, useRef, useEffect } from "react";
import { useLocaleStore, useThemeStore, useFridgeStore, useModelStore } from "@/lib/store";
import type { LocalFridgeItem } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import type { Locale, ThemeName, ModelInfo, ModelsResponse } from "@/lib/types";
import { getModels } from "@/lib/api";

const languages: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "cn", label: "中文" },
];

const themes: { code: ThemeName | "auto"; labelKey: string }[] = [
  { code: "auto", labelKey: "settings.theme.auto" },
  { code: "green", labelKey: "settings.theme.green" },
  { code: "warm", labelKey: "settings.theme.warm" },
  { code: "colorful", labelKey: "settings.theme.colorful" },
  { code: "neutral", labelKey: "settings.theme.neutral" },
];

const themeColors: Record<string, string> = {
  auto: "#171717",
  green: "#2d6a4f",
  warm: "#8b5e3c",
  colorful: "#d35400",
  neutral: "#171717",
};

export default function SettingsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = createT(locale);
  const themeOverride = useThemeStore((s) => s.themeOverride);
  const setThemeOverride = useThemeStore((s) => s.setThemeOverride);
  const fridgeItems = useFridgeStore((s) => s.items);
  const importItems = useFridgeStore((s) => s.importItems);
  const clearAll = useFridgeStore((s) => s.clearAll);
  const showToast = useUIStore((s) => s.showToast);

  const selectedModel = useModelStore((s) => s.selectedModel);
  const setSelectedModel = useModelStore((s) => s.setSelectedModel);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getModels()
      .then((data: ModelsResponse) => {
        if (cancelled) return;
        setModels(data.models);
        setDefaultModel(data.default);
        setModelsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setModelsError(true);
        setModelsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleThemeChange = (code: ThemeName | "auto") => {
    if (code === "auto") {
      setThemeOverride(null);
    } else {
      setThemeOverride(code);
    }
  };

  const currentThemeCode = themeOverride ?? "auto";

  const handleExport = () => {
    const data = JSON.stringify(fridgeItems, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freezewise-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("settings.exported"), "success");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) {
          showToast(t("settings.import_error"), "error");
          return;
        }
        // Basic validation: each item must have id, product, location, addedAt
        const valid = parsed.every(
          (item: LocalFridgeItem) =>
            item.id && item.product && item.location && item.addedAt,
        );
        if (!valid) {
          showToast(t("settings.import_error"), "error");
          return;
        }
        importItems(parsed);
        showToast(t("settings.imported"), "success");
      } catch {
        showToast(t("settings.import_error"), "error");
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClear = () => {
    clearAll();
    setShowClearConfirm(false);
    showToast(t("settings.cleared"), "success");
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-serif text-2xl text-neutral-900">{t("settings.title")}</h2>
      </div>

      {/* Language */}
      <section className="mb-8">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {t("settings.language")}
        </h3>
        <div className="mt-3 space-y-1">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLocale(lang.code)}
              className={`flex w-full items-center justify-between border px-4 py-3 text-left transition-colors ${
                locale === lang.code
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-100 hover:border-neutral-300"
              }`}
            >
              <span className="font-sans text-sm text-neutral-900">{lang.label}</span>
              {locale === lang.code && (
                <svg
                  className="h-4 w-4 text-neutral-900"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>

      <hr className="border-neutral-100 mb-8" />

      {/* Theme */}
      <section className="mb-8">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {t("settings.theme")}
        </h3>
        <div className="mt-3 space-y-1">
          {themes.map((theme) => (
            <button
              key={theme.code}
              onClick={() => handleThemeChange(theme.code)}
              className={`flex w-full items-center gap-3 border px-4 py-3 text-left transition-colors ${
                currentThemeCode === theme.code
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-100 hover:border-neutral-300"
              }`}
            >
              <span
                className="h-3 w-3 shrink-0"
                style={{ backgroundColor: themeColors[theme.code] }}
              />
              <span className="flex-1 font-sans text-sm text-neutral-900">
                {t(theme.labelKey)}
              </span>
              {currentThemeCode === theme.code && (
                <svg
                  className="h-4 w-4 text-neutral-900"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>

      <hr className="border-neutral-100 mb-8" />

      {/* AI Model */}
      <section className="mb-8">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {t("settings.model")}
        </h3>
        <div className="mt-3 space-y-1">
          {modelsLoading ? (
            <p className="py-4 text-center font-sans text-sm text-neutral-400">
              {t("settings.model.loading")}
            </p>
          ) : modelsError ? (
            <p className="py-4 text-center font-sans text-sm text-red-500">
              {t("settings.model.error")}
            </p>
          ) : (
            models.map((model) => {
              const isSelected = selectedModel
                ? selectedModel === model.id
                : model.id === defaultModel;
              const isDefault = model.id === defaultModel;

              return (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id === defaultModel && !selectedModel ? null : model.id === selectedModel ? null : model.id)}
                  className={`flex w-full items-center gap-3 border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-100 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-sm text-neutral-900 truncate">
                        {model.name}
                      </span>
                      {isDefault && (
                        <span className="shrink-0 font-sans text-[10px] uppercase tracking-[0.15em] text-neutral-400">
                          ({t("settings.model.default")})
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-sans text-[10px] text-neutral-400">
                        {(model.context / 1000).toFixed(0)}k {t("settings.model.context")}
                      </span>
                      {model.vision && (
                        <span className="inline-flex items-center border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-sans text-[9px] uppercase tracking-[0.1em] text-blue-600">
                          {t("settings.model.vision")}
                        </span>
                      )}
                      {model.tools && (
                        <span className="inline-flex items-center border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-sans text-[9px] uppercase tracking-[0.1em] text-amber-600">
                          {t("settings.model.tools")}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <svg
                      className="h-4 w-4 shrink-0 text-neutral-900"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>

      <hr className="border-neutral-100 mb-8" />

      {/* Data Management */}
      <section className="mb-8">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {t("settings.data")}
        </h3>
        <div className="mt-3 space-y-2">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={fridgeItems.length === 0}
            className="flex w-full items-center justify-between border border-neutral-100 px-4 py-3 text-left transition-colors hover:border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="font-sans text-sm text-neutral-900">{t("settings.export")}</span>
            <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-between border border-neutral-100 px-4 py-3 text-left transition-colors hover:border-neutral-300"
          >
            <span className="font-sans text-sm text-neutral-900">{t("settings.import")}</span>
            <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Clear All */}
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={fridgeItems.length === 0}
              className="flex w-full items-center justify-between border border-red-100 px-4 py-3 text-left transition-colors hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="font-sans text-sm text-red-600">{t("settings.clear")}</span>
              <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div className="border border-red-200 bg-red-50 px-4 py-3 space-y-3">
              <p className="font-sans text-sm text-red-700">
                {t("settings.clear_confirm")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  className="flex-1 border border-red-600 bg-red-600 py-2 font-sans text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-700"
                >
                  {t("settings.clear")}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 border border-neutral-300 py-2 font-sans text-xs uppercase tracking-[0.2em] text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <hr className="border-neutral-100 mb-8" />

      {/* About */}
      <section className="mb-8">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {t("settings.about")}
        </h3>
        <blockquote className="mt-3 border-l-2 border-neutral-300 pl-4 font-serif text-sm italic leading-relaxed text-neutral-600">
          {t("settings.about.text")}
        </blockquote>
        <div className="mt-4 flex items-center gap-2">
          <span className="font-sans text-[10px] uppercase tracking-wider text-neutral-300">
            {t("settings.version")}
          </span>
          <span className="font-sans text-xs text-neutral-500">1.0.0</span>
        </div>
      </section>
    </div>
  );
}
