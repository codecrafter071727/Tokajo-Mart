"use client";

import { dialogFooter } from "../../components/kit";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminProduct, Category } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ErrorBanner,
  FieldError,
  fieldClass,
  Modal,
  primaryButton,
  secondaryButton,
  Thumb,
} from "../../components/catalog-ui";
import { TagInput } from "../../components/ui/tag-input";
import { blankToNull, catalogAdmin, fromPaise, toPaise } from "../../lib/catalog-admin";
import { categoryOptions } from "./category-tree";

/** Amounts are typed in rupees and sent as whole paise. */
const money = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^\d+(\.\d{1,2})?$/, "Use a number like 29 or 29.50");

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(120, "At most 120 characters"),
    unit: z.string().trim().min(1, "Required").max(40, "At most 40 characters"),
    categoryId: z.string().min(1, "Pick a category"),
    price: money,
    mrp: money,
    emoji: z.string().trim().max(16, "Too long"),
    imageUrl: z
      .string()
      .trim()
      .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Use an https image link"),
    imageFit: z.enum(["contain", "cover"]),
    deliveryMins: z
      .string()
      .regex(/^\d+$/, "Whole minutes")
      .refine((v) => Number(v) >= 1 && Number(v) <= 120, "Between 1 and 120"),
    optionsCount: z
      .string()
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 50),
        "Between 1 and 50, or leave empty",
      ),
    description: z.string().trim().max(2000, "At most 2000 characters"),
    brand: z.string().trim().max(60, "At most 60 characters"),
    tags: z.array(z.string()).max(10, "At most 10 tags"),
    groupId: z.string(),
    variantLabel: z.string().trim().max(40, "At most 40 characters"),
  })
  .refine((v) => v.groupId === "" || v.variantLabel !== "", {
    path: ["variantLabel"],
    message: "Say what tells this variant apart, like 1 L",
  })
  .refine(
    (v) =>
      !/^\d+(\.\d{1,2})?$/.test(v.price) ||
      !/^\d+(\.\d{1,2})?$/.test(v.mrp) ||
      Number(v.price) <= Number(v.mrp),
    {
      path: ["price"],
      message: "Price cannot be higher than the MRP",
    },
  );

type FormValues = z.infer<typeof formSchema>;

export function ProductDialog({
  product,
  categories,
  onClose,
  onSaved,
}: {
  /** Null to add a new product */
  product: AdminProduct | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const client = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product?.name ?? "",
      unit: product?.unit ?? "",
      categoryId: product?.categoryId ?? categories[0]?.id ?? "",
      price: product ? fromPaise(product.pricePaise) : "",
      mrp: product ? fromPaise(product.mrpPaise) : "",
      emoji: product?.emoji ?? "",
      imageUrl: product?.imageUrl ?? "",
      imageFit: product?.imageFit ?? "contain",
      deliveryMins: String(product?.deliveryMins ?? 10),
      optionsCount: product?.optionsCount ? String(product.optionsCount) : "",
      description: product?.description ?? "",
      brand: product?.brand ?? "",
      tags: product?.tags ?? [],
      groupId: product?.groupId ?? "",
      variantLabel: product?.variantLabel ?? "",
    },
  });
  const groups = useQuery({ queryKey: ["product-groups"], queryFn: catalogAdmin.groups });
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const createGroup = useMutation({
    mutationFn: (name: string) =>
      catalogAdmin.createGroup({
        name,
        categoryId: form.getValues("categoryId"),
        brand: blankToNull(form.getValues("brand")),
      }),
    onSuccess: async (group) => {
      await client.invalidateQueries({ queryKey: ["product-groups"] });
      form.setValue("groupId", group.id, { shouldDirty: true });
      if (!form.getValues("variantLabel")) form.setValue("variantLabel", form.getValues("unit"));
      setNewGroup(null);
    },
  });
  const { errors } = form.formState;
  const [imageUrl, emoji, imageFit, groupId, categoryId] = form.watch([
    "imageUrl",
    "emoji",
    "imageFit",
    "groupId",
    "categoryId",
  ]);
  // Groups of the chosen category first, so the right one is easy to find
  const groupList = [...(groups.data ?? [])].sort(
    (a, b) =>
      Number(b.categoryId === categoryId) - Number(a.categoryId === categoryId) ||
      a.name.localeCompare(b.name),
  );

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const next = {
        name: v.name,
        unit: v.unit,
        categoryId: v.categoryId,
        pricePaise: toPaise(v.price),
        mrpPaise: toPaise(v.mrp),
        emoji: v.emoji,
        imageUrl: blankToNull(v.imageUrl),
        imageFit: v.imageFit,
        deliveryMins: Number(v.deliveryMins),
        // A grouped product's options are counted by the server from its group
        ...(v.groupId === ""
          ? { optionsCount: v.optionsCount === "" ? null : Number(v.optionsCount) }
          : {}),
        description: blankToNull(v.description),
        brand: blankToNull(v.brand),
        tags: v.tags,
        groupId: v.groupId === "" ? null : v.groupId,
        variantLabel: v.groupId === "" ? null : blankToNull(v.variantLabel),
      };
      if (!product) return catalogAdmin.createProduct(next);
      // Send only what changed, so an edit never overwrites someone else's change to another field
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(next)) {
        const before = (product as unknown as Record<string, unknown>)[key];
        const same = Array.isArray(value)
          ? JSON.stringify(value) === JSON.stringify(before ?? [])
          : value === (before ?? null);
        if (!same) changes[key] = value;
      }
      if (Object.keys(changes).length === 0) return Promise.resolve(product);
      return catalogAdmin.updateProduct(product.id, changes);
    },
    onSuccess: async (_saved, values) => {
      await client.invalidateQueries({ queryKey: ["admin-products"] });
      onSaved(product ? `Saved ${values.name}` : `Added ${values.name}`);
      onClose();
    },
  });

  return (
    <Modal title={product ? "Edit product" : "New product"} onClose={onClose} wide>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-4">
          <label className="col-span-2 block text-sm font-semibold">
            Name
            <input {...form.register("name")} className={fieldClass} />
            <FieldError message={errors.name?.message} />
          </label>
          <label className="block text-sm font-semibold">
            Pack size
            <input {...form.register("unit")} placeholder="500 ml" className={fieldClass} />
            <FieldError message={errors.unit?.message} />
          </label>
        </div>

        <label className="block text-sm font-semibold">
          Category
          <select {...form.register("categoryId")} className={fieldClass}>
            {categoryOptions(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.categoryId?.message} />
        </label>

        <div className="grid grid-cols-3 gap-4">
          <label className="block text-sm font-semibold">
            Brand
            <input {...form.register("brand")} placeholder="Amul" className={fieldClass} />
            <FieldError message={errors.brand?.message} />
          </label>
          <div className="col-span-2 text-sm font-semibold">
            <span className="mb-1 block">Tags</span>
            <TagInput
              name="tags"
              defaultValue={form.getValues("tags")}
              max={10}
              placeholder="dairy, breakfast"
              onChange={(tags) => form.setValue("tags", tags, { shouldDirty: true })}
            />
            <FieldError message={errors.tags?.message} />
          </div>
        </div>

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Variants</legend>
          <p className="mb-3 text-xs text-muted">
            Sizes of the same item share a group, so customers can switch between 500 ml and 1 L on
            the product page.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 text-sm font-semibold">
              <label className="block">
                Group
                <select {...form.register("groupId")} className={fieldClass}>
                  <option value="">Not a variant</option>
                  {groupList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.variantCount} on sale)
                    </option>
                  ))}
                </select>
              </label>
              {newGroup === null ? (
                <button
                  type="button"
                  onClick={() => setNewGroup(form.getValues("name"))}
                  className="mt-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  + New group
                </button>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    placeholder="Amul Taaza Milk"
                    aria-label="New group name"
                    className={`${fieldClass} mt-0`}
                  />
                  <button
                    type="button"
                    disabled={newGroup.trim() === "" || createGroup.isPending}
                    onClick={() => createGroup.mutate(newGroup.trim())}
                    className={primaryButton}
                  >
                    {createGroup.isPending ? "Creating" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGroup(null)}
                    className={secondaryButton}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <ErrorBanner error={createGroup.error} />
            </div>
            <label className="block text-sm font-semibold">
              Variant label
              <input
                {...form.register("variantLabel")}
                placeholder="1 L"
                disabled={groupId === ""}
                className={fieldClass}
              />
              <FieldError message={errors.variantLabel?.message} />
            </label>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-semibold">
            Price (₹)
            <input {...form.register("price")} inputMode="decimal" className={fieldClass} />
            <FieldError message={errors.price?.message} />
          </label>
          <label className="block text-sm font-semibold">
            MRP (₹)
            <input {...form.register("mrp")} inputMode="decimal" className={fieldClass} />
            <FieldError message={errors.mrp?.message} />
          </label>
        </div>

        <div className="flex gap-4">
          <div className="grid flex-1 gap-4">
            <label className="block text-sm font-semibold">
              Image link (https)
              <input {...form.register("imageUrl")} placeholder="https://" className={fieldClass} />
              <FieldError message={errors.imageUrl?.message} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-semibold">
                Image fit
                <select {...form.register("imageFit")} className={fieldClass}>
                  <option value="contain">Contain (whole pack)</option>
                  <option value="cover">Cover (fill)</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Emoji fallback
                <input {...form.register("emoji")} className={fieldClass} />
                <FieldError message={errors.emoji?.message} />
              </label>
            </div>
          </div>
          <div className="w-28 shrink-0 text-center text-xs font-semibold text-muted">
            Preview
            <div className="mt-1">
              <Thumb
                imageUrl={/^https:\/\/\S+$/.test(imageUrl) ? imageUrl : null}
                emoji={emoji}
                fit={imageFit}
                size="size-28"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-semibold">
            Delivery promise (minutes)
            <input {...form.register("deliveryMins")} inputMode="numeric" className={fieldClass} />
            <FieldError message={errors.deliveryMins?.message} />
          </label>
          {groupId === "" ? (
            <label className="block text-sm font-semibold">
              Options shown on the card (optional)
              <input
                {...form.register("optionsCount")}
                inputMode="numeric"
                placeholder="Leave empty for none"
                className={fieldClass}
              />
              <FieldError message={errors.optionsCount?.message} />
            </label>
          ) : (
            <p className="self-end pb-2 text-xs text-muted">Options are counted from the group.</p>
          )}
        </div>

        <label className="block text-sm font-semibold">
          Description
          <textarea {...form.register("description")} rows={3} className={fieldClass} />
          <FieldError message={errors.description?.message} />
        </label>

        <ErrorBanner error={save.error} />

        <div className={dialogFooter}>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={save.isPending} className={primaryButton}>
            {save.isPending ? "Saving" : product ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
