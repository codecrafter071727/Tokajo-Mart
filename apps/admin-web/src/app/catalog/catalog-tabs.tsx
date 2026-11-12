"use client";

import { useState } from "react";
import { CategoriesPanel } from "./categories-panel";
import { CatalogTable } from "./catalog-table";

const TABS = [
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
] as const;

export function CatalogTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("products");
  return (
    <>
      <div role="tablist" aria-label="Catalog" className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold ${
              tab === t.id
                ? "border-brand-600 text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "products" ? <CatalogTable /> : <CategoriesPanel />}</div>
    </>
  );
}
