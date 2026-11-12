"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Banner, Category } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ErrorBanner,
  FieldError,
  fieldClass,
  Modal,
  primaryButton,
  secondaryButton,
} from "../../components/catalog-ui";
import { blankToNull, catalogAdmin, isoToLocal, localToIso } from "../../lib/catalog-admin";
import { BannerPreview } from "./banner-preview";

const formSchema = z
  .object({
    title: z.string().trim().min(1, "Required").max(80, "At most 80 characters"),
    subtitle: z.string().trim().max(160, "At most 160 characters"),
    imageUrl: z
      .string()
      .trim()
      .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Use an https image link"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #E8F5E9"),
    linkType: z.enum(["none", "category", "product"]),
    linkTarget: z.string(),
    sortOrder: z
      .string()
      .regex(/^\d+$/, "Whole number, zero or more")
      .refine((v) => Number(v) <= 10_000, "At most 10000"),
    active: z.boolean(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .refine((v) => v.linkType === "none" || v.linkTarget !== "", {
    path: ["linkTarget"],
    message: "Choose where the banner leads",
  })
  .refine(
    (v) => v.startsAt === "" || v.endsAt === "" || new Date(v.endsAt) > new Date(v.startsAt),
    {
      path: ["endsAt"],
      message: "The end must be after the start",
    },
  );
type FormValues = z.infer<typeof formSchema>;

export function BannerDialog({
  banner,
  categories,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  /** Null to add a new banner */
  banner: Banner | null;
  categories: Category[];
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const client = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: banner?.title ?? "",
      subtitle: banner?.subtitle ?? "",
      imageUrl: banner?.imageUrl ?? "",
      color: banner?.color ?? "#E8F5E9",
      linkType: banner?.linkType ?? "none",
      linkTarget: banner?.linkTarget ?? "",
      sortOrder: String(banner?.sortOrder ?? nextSortOrder),
      active: banner?.active ?? true,
      startsAt: isoToLocal(banner?.startsAt ?? null),
      endsAt: isoToLocal(banner?.endsAt ?? null),
    },
  });
  const { errors } = form.formState;
  const [title, subtitle, imageUrl, color, linkType, linkTarget] = form.watch([
    "title",
    "subtitle",
    "imageUrl",
    "color",
    "linkType",
    "linkTarget",
  ]);

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const next = {
        title: v.title,
        subtitle: v.subtitle,
        imageUrl: blankToNull(v.imageUrl),
        color: v.color,
        linkType: v.linkType,
        linkTarget: v.linkType === "none" ? null : v.linkTarget,
        sortOrder: Number(v.sortOrder),
        active: v.active,
        startsAt: localToIso(v.startsAt),
        endsAt: localToIso(v.endsAt),
      };
      if (!banner) return catalogAdmin.createBanner(next);
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(next)) {
        if (value !== (banner as unknown as Record<string, unknown>)[key]) changes[key] = value;
      }
      if (Object.keys(changes).length === 0) return Promise.resolve(banner);
      return catalogAdmin.updateBanner(banner.id, changes);
    },
    onSuccess: async (_saved, v) => {
      await client.invalidateQueries({ queryKey: ["admin-banners"] });
      onSaved(banner ? `Saved ${v.title}` : `Added ${v.title}`);
      onClose();
    },
  });

  return (
    <Modal title={banner ? "Edit banner" : "New banner"} onClose={onClose} wide>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <BannerPreview
          title={title}
          subtitle={subtitle}
          imageUrl={/^https:\/\/\S+$/.test(imageUrl) ? imageUrl : null}
          color={color}
        />

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-semibold">
            Title
            <input {...form.register("title")} className={fieldClass} />
            <FieldError message={errors.title?.message} />
          </label>
          <label className="block text-sm font-semibold">
            Subtitle
            <input {...form.register("subtitle")} className={fieldClass} />
            <FieldError message={errors.subtitle?.message} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="col-span-2 block text-sm font-semibold">
            Image link (https)
            <input {...form.register("imageUrl")} placeholder="https://" className={fieldClass} />
            <FieldError message={errors.imageUrl?.message} />
          </label>
          <label className="block text-sm font-semibold">
            Colour
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#E8F5E9"}
                onChange={(e) => form.setValue("color", e.target.value, { shouldValidate: true })}
                aria-label="Pick a colour"
                className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line"
              />
              <input
                {...form.register("color")}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <FieldError message={errors.color?.message} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-semibold">
            Tapping it goes to
            <select
              {...form.register("linkType", {
                onChange: () => form.setValue("linkTarget", ""),
              })}
              className={fieldClass}
            >
              <option value="none">Nothing</option>
              <option value="category">A category</option>
              <option value="product">A product</option>
            </select>
          </label>
          {linkType === "category" ? (
            <label className="block text-sm font-semibold">
              Category
              <select {...form.register("linkTarget")} className={fieldClass}>
                <option value="">Choose</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.linkTarget?.message} />
            </label>
          ) : null}
          {linkType === "product" ? (
            <ProductPicker
              value={linkTarget}
              onPick={(id) => form.setValue("linkTarget", id, { shouldValidate: true })}
              error={errors.linkTarget?.message}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="block text-sm font-semibold">
            Show from
            <input type="datetime-local" {...form.register("startsAt")} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">
            Show until
            <input type="datetime-local" {...form.register("endsAt")} className={fieldClass} />
            <FieldError message={errors.endsAt?.message} />
          </label>
          <label className="block text-sm font-semibold">
            Sort order
            <input {...form.register("sortOrder")} inputMode="numeric" className={fieldClass} />
            <FieldError message={errors.sortOrder?.message} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" {...form.register("active")} className="size-4 accent-brand-600" />
          Active (customers see it while it is inside its dates)
        </label>

        <ErrorBanner error={save.error} />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={save.isPending} className={primaryButton}>
            {save.isPending ? "Saving" : banner ? "Save changes" : "Add banner"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Search for a product by name and pick one. Shows the chosen product's name. */
function ProductPicker({
  value,
  onPick,
  error,
}: {
  value: string;
  onPick: (id: string) => void;
  error?: string;
}) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const current = useQuery({
    queryKey: ["product", value],
    enabled: value !== "",
    queryFn: () => catalogAdmin.product(value),
    retry: false,
  });
  const results = useQuery({
    queryKey: ["admin-products-pick", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => (await catalogAdmin.products({ q: debounced })).items,
  });

  return (
    <div className="text-sm font-semibold">
      Product
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={current.data ? current.data.name : "Search by name"}
        aria-label="Search for a product"
        className={fieldClass}
      />
      {value !== "" ? (
        <p className="mt-1 text-xs font-semibold text-ink-700">
          Chosen: {current.data ? `${current.data.name} (${current.data.unit})` : value}
        </p>
      ) : null}
      {results.data && debounced.length >= 2 ? (
        <ul className="mt-1 max-h-32 overflow-auto rounded-lg border border-line bg-white">
          {results.data
            .filter((p) => !p.archived)
            .slice(0, 8)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p.id);
                    setText("");
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm font-medium hover:bg-brand-50"
                >
                  {p.name} <span className="text-ink-500">{p.unit}</span>
                </button>
              </li>
            ))}
          {results.data.length === 0 ? (
            <li className="px-3 py-1.5 text-xs text-ink-500">No products match.</li>
          ) : null}
        </ul>
      ) : null}
      <FieldError message={error} />
    </div>
  );
}
