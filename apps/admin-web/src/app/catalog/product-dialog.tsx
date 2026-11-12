"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminProduct, Category } from "@qc/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { blankToNull, catalogAdmin, fromPaise, toPaise } from "../../lib/catalog-admin";

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
    },
  });
  const { errors } = form.formState;
  const [imageUrl, emoji, imageFit] = form.watch(["imageUrl", "emoji", "imageFit"]);

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
        optionsCount: v.optionsCount === "" ? null : Number(v.optionsCount),
        description: blankToNull(v.description),
      };
      if (!product) return catalogAdmin.createProduct(next);
      // Send only what changed, so an edit never overwrites someone else's change to another field
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(next)) {
        if (value !== (product as unknown as Record<string, unknown>)[key]) changes[key] = value;
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.categoryId?.message} />
        </label>

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
          <div className="w-28 shrink-0 text-center text-xs font-semibold text-ink-500">
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
          <label className="block text-sm font-semibold">
            Variants (optional)
            <input
              {...form.register("optionsCount")}
              inputMode="numeric"
              placeholder="Number of options"
              className={fieldClass}
            />
            <FieldError message={errors.optionsCount?.message} />
          </label>
        </div>

        <label className="block text-sm font-semibold">
          Description
          <textarea {...form.register("description")} rows={3} className={fieldClass} />
          <FieldError message={errors.description?.message} />
        </label>

        <ErrorBanner error={save.error} />

        <div className="flex justify-end gap-3 pt-2">
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
