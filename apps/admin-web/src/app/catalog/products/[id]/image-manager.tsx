"use client";

import {
  MAX_EXTRA_PRODUCT_IMAGES,
  type AdminProductDetail,
  type ProductImage,
} from "@qc/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBanner, Thumb } from "../../../../components/catalog-ui";
import { Button, inputCls, Panel } from "../../../../components/kit";
import { ChevronLeft, ChevronRight, Trash2 } from "../../../../components/ui/icons";
import { catalogAdmin } from "../../../../lib/catalog-admin";

const HTTPS = /^https:\/\/\S+$/;

/**
 * The product's photos. The first one is the main photo (the product's image link, shown on
 * cards). Extra photos can be added by link, moved, made the main photo, or removed.
 */
export function ImageManager({ product }: { product: AdminProductDetail }) {
  const client = useQueryClient();
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [preview, setPreview] = useState<"idle" | "ok" | "broken">("idle");

  const images = product.images;
  const extras = images.filter((i): i is ProductImage & { id: string } => i.id !== null);
  const full = extras.length >= MAX_EXTRA_PRODUCT_IMAGES;
  const refresh = () => client.invalidateQueries({ queryKey: ["admin-product", product.id] });

  const add = useMutation({
    mutationFn: () => catalogAdmin.addImage(product.id, { url: url.trim(), alt: alt.trim() }),
    onSuccess: async () => {
      setUrl("");
      setAlt("");
      setPreview("idle");
      await refresh();
    },
  });
  const change = useMutation({
    mutationFn: async (
      action:
        | { kind: "move"; id: string; direction: -1 | 1 }
        | { kind: "primary"; id: string }
        | { kind: "remove"; id: string },
    ) => {
      if (action.kind === "primary") return catalogAdmin.makePrimary(product.id, action.id);
      if (action.kind === "remove") return catalogAdmin.removeImage(product.id, action.id);
      const order = extras.map((i) => i.id);
      const at = order.indexOf(action.id);
      const to = at + action.direction;
      if (at < 0 || to < 0 || to >= order.length) return null;
      [order[at], order[to]] = [order[to] as string, order[at] as string];
      return catalogAdmin.reorderImages(product.id, order);
    },
    onSettled: () => refresh(),
  });

  const validUrl = HTTPS.test(url.trim());

  return (
    <Panel
      title="Photos"
      description={`The first photo shows on product cards. Up to ${MAX_EXTRA_PRODUCT_IMAGES} more.`}
    >
      {images.length === 0 ? (
        <p className="mb-4 text-[13px] text-muted">
          No photos yet. Customers see the emoji until one is added.
        </p>
      ) : (
        <ul className="mb-4 grid grid-cols-3 gap-3">
          {images.map((image, index) => {
            const extraIndex = image.id ? extras.findIndex((e) => e.id === image.id) : -1;
            return (
              <li key={image.id ?? "main"} className="group relative">
                <Thumb imageUrl={image.url} fit={product.imageFit} size="aspect-square w-full" />
                {index === 0 ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-on-accent">
                    Main
                  </span>
                ) : null}
                {image.id ? (
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="flex">
                      <button
                        type="button"
                        aria-label="Move photo left"
                        disabled={extraIndex <= 0 || change.isPending}
                        onClick={() =>
                          change.mutate({ kind: "move", id: image.id as string, direction: -1 })
                        }
                        className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move photo right"
                        disabled={extraIndex === extras.length - 1 || change.isPending}
                        onClick={() =>
                          change.mutate({ kind: "move", id: image.id as string, direction: 1 })
                        }
                        className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </span>
                    <button
                      type="button"
                      disabled={change.isPending}
                      onClick={() => change.mutate({ kind: "primary", id: image.id as string })}
                      className="text-[11px] font-medium text-accent hover:underline disabled:opacity-40"
                    >
                      Make main
                    </button>
                    <button
                      type="button"
                      aria-label="Remove photo"
                      disabled={change.isPending}
                      onClick={() => change.mutate({ kind: "remove", id: image.id as string })}
                      className="rounded p-1 text-muted hover:bg-bad-soft hover:text-bad disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted">From the product image link</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {full ? (
        <p className="text-[13px] text-muted">
          This product has the most photos allowed. Remove one to add another.
        </p>
      ) : (
        <form
          className="space-y-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (validUrl && preview !== "broken") add.mutate();
          }}
        >
          <div className="flex gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setPreview("idle");
                }}
                placeholder="https:// image link"
                aria-label="Photo link"
                className={inputCls}
              />
              <input
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="What it shows (optional)"
                aria-label="Photo description"
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div className="size-[76px] shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
              {validUrl ? (
                <img
                  src={url.trim()}
                  alt=""
                  onLoad={() => setPreview("ok")}
                  onError={() => setPreview("broken")}
                  className="size-full object-contain"
                />
              ) : null}
            </div>
          </div>
          {url && !validUrl ? (
            <p className="text-xs text-bad">Use an https image link.</p>
          ) : preview === "broken" ? (
            <p className="text-xs text-bad">That link does not load an image.</p>
          ) : null}
          <ErrorBanner error={add.error ?? change.error} />
          <Button
            type="submit"
            variant="secondary"
            small
            icon="plus"
            disabled={!validUrl || preview === "broken" || add.isPending}
          >
            {add.isPending ? "Adding" : "Add photo"}
          </Button>
        </form>
      )}
    </Panel>
  );
}
