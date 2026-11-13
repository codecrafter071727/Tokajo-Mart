"use client";

import { useState } from "react";
import { CategoriesPanel } from "./categories-panel";
import { CatalogTable } from "./catalog-table";
import { ImportPanel } from "./import-panel";

const TABS = [
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "import", label: "Import and export" },
] as const;

export function CatalogTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("products");
  return (
    <>
      <div role="tablist" aria-label="Catalog" className="mb-5 flex gap-6 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "products" ? (
          <CatalogTable />
        ) : tab === "categories" ? (
          <CategoriesPanel />
        ) : (
          <ImportPanel />
        )}
      </div>
    </>
  );
}
