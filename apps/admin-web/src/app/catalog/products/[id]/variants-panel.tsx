"use client";

import type { AdminProductDetail } from "@qc/contracts";
import Link from "next/link";
import { Thumb } from "../../../../components/catalog-ui";
import { Badge, Panel } from "../../../../components/kit";
import { rupees } from "../../../../lib/api";

/** The other sizes of this item. Customers switch between them on the product page. */
export function VariantsPanel({
  product,
  onEdit,
}: {
  product: AdminProductDetail;
  onEdit: () => void;
}) {
  if (!product.group) {
    return (
      <Panel title="Variants">
        <p className="text-[13px] text-muted">
          Not part of a group. To sell other sizes of this item,{" "}
          <button
            type="button"
            onClick={onEdit}
            className="font-medium text-accent hover:underline"
          >
            put it in a group
          </button>{" "}
          and give each size a label like 500 ml or 1 L.
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      title="Variants"
      description={`${product.group.name} · ${product.variants.length} on sale`}
      flush
    >
      <ul className="divide-y divide-line">
        {product.variants.map((v) => {
          const current = v.id === product.id;
          return (
            <li key={v.id}>
              <Link
                href={`/catalog/products/${encodeURIComponent(v.id)}`}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2 ${current ? "bg-accent-soft/50" : ""}`}
              >
                <Thumb imageUrl={v.imageUrl} emoji={product.emoji} size="size-10" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{v.label}</div>
                  <div className="text-xs text-muted">{v.unit}</div>
                </div>
                <div className="text-right">
                  <div className="tnum text-[13px] font-semibold text-ink">
                    {rupees(v.pricePaise)}
                  </div>
                  {v.mrpPaise > v.pricePaise ? (
                    <div className="tnum text-xs text-muted line-through">{rupees(v.mrpPaise)}</div>
                  ) : null}
                </div>
                {current ? <Badge tone="green">This one</Badge> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
