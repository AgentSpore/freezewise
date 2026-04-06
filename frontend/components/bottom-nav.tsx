"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocaleStore } from "@/lib/store";
import { createT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", labelKey: "nav.search", icon: SearchIcon },
  { href: "/fridge", labelKey: "nav.fridge", icon: FridgeIcon },
  { href: "/recipes", labelKey: "nav.recipes", icon: RecipeIcon },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const t = createT(locale);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-stretch">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2 transition-colors duration-200",
                isActive
                  ? "border-t-2 border-neutral-900 text-neutral-900"
                  : "border-t-2 border-transparent text-neutral-400",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-sans text-[9px] uppercase tracking-[0.15em]">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16 16l4.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

function FridgeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="5" y="2" width="14" height="20" rx="1" />
      <line x1="5" y1="10" x2="19" y2="10" />
      <line x1="9" y1="6" x2="9" y2="8" />
      <line x1="9" y1="13" x2="9" y2="16" />
    </svg>
  );
}

function RecipeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 6h16M4 10h16M4 14h10M4 18h7" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M2 12h3m14 0h3M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12" />
    </svg>
  );
}
