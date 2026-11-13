"use client";

import { dialogFooter } from "../../components/kit";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Category } from "@qc/contracts";
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
import { blankToNull, catalogAdmin } from "../../lib/catalog-admin";

const formSchema = z.object({
  name: z.string().trim().min(1, "Required").max(60, "At most 60 characters"),
  emoji: z.string().trim().max(16, "Too long"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #E8F5E9"),
  imageUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Use an https image link"),
  imageFit: z.enum(["cover", "contain"]),
  sortOrder: z
    .string()
    .regex(/^\d+$/, "Whole number, zero or more")
    .refine((v) => Number(v) <= 10_000, "At most 10000"),
  parentId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function CategoryDialog({
  category,
  categories,
  defaultParentId = "",
  nextSortOrder,
  onClose,
  onSaved,
}: {
  /** Null to add a new category */
  category: Category | null;
  /** Every category, to pick a parent from */
  categories: Category[];
  defaultParentId?: string;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const client = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name ?? "",
      emoji: category?.emoji ?? "",
      color: category?.color ?? "#F3F6F5",
      imageUrl: category?.imageUrl ?? "",
      imageFit: category?.imageFit ?? "cover",
      sortOrder: String(category?.sortOrder ?? nextSortOrder),
      parentId: category?.parentId ?? defaultParentId,
    },
  });
  const { errors } = form.formState;
  const [imageUrl, emoji, color, imageFit] = form.watch(["imageUrl", "emoji", "color", "imageFit"]);

  // Two levels only: a parent must itself be top level, and never this category
  const parents = categories.filter((c) => !c.parentId && c.id !== category?.id);
  const hasChildren = Boolean(category && categories.some((c) => c.parentId === category.id));

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const next = {
        name: v.name,
        emoji: v.emoji,
        color: v.color,
        imageUrl: blankToNull(v.imageUrl),
        imageFit: v.imageFit,
        sortOrder: Number(v.sortOrder),
        parentId: v.parentId === "" ? null : v.parentId,
      };
      if (!category) return catalogAdmin.createCategory(next);
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(next)) {
        const before = (category as unknown as Record<string, unknown>)[key] ?? null;
        if (value !== before) changes[key] = value;
      }
      if (Object.keys(changes).length === 0) return Promise.resolve(category);
      return catalogAdmin.updateCategory(category.id, changes);
    },
    onSuccess: async (_saved, v) => {
      await client.invalidateQueries({ queryKey: ["categories"] });
      onSaved(category ? `Saved ${v.name}` : `Added ${v.name}`);
      onClose();
    },
  });

  return (
    <Modal title={category ? "Edit category" : "New category"} onClose={onClose}>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <label className="block text-sm font-semibold">
          Name
          <input {...form.register("name")} className={fieldClass} />
          <FieldError message={errors.name?.message} />
        </label>

        <label className="block text-sm font-semibold">
          Sits under
          <select {...form.register("parentId")} disabled={hasChildren} className={fieldClass}>
            <option value="">Nothing: a top level category</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {hasChildren ? (
            <span className="mt-1 block text-xs font-normal text-muted">
              It has sub categories of its own, so it stays at the top level.
            </span>
          ) : null}
        </label>

        <div className="grid grid-cols-3 gap-4">
          <label className="block text-sm font-semibold">
            Emoji
            <input {...form.register("emoji")} className={fieldClass} />
            <FieldError message={errors.emoji?.message} />
          </label>
          <label className="block text-sm font-semibold">
            Tile colour
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#F3F6F5"}
                onChange={(e) => form.setValue("color", e.target.value, { shouldValidate: true })}
                aria-label="Pick a tile colour"
                className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line"
              />
              <input
                {...form.register("color")}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <FieldError message={errors.color?.message} />
          </label>
          <label className="block text-sm font-semibold">
            Sort order
            <input {...form.register("sortOrder")} inputMode="numeric" className={fieldClass} />
            <FieldError message={errors.sortOrder?.message} />
          </label>
        </div>

        <div className="flex gap-4">
          <div className="grid flex-1 gap-4">
            <label className="block text-sm font-semibold">
              Image link (https)
              <input {...form.register("imageUrl")} placeholder="https://" className={fieldClass} />
              <FieldError message={errors.imageUrl?.message} />
            </label>
            <label className="block text-sm font-semibold">
              Image fit
              <select {...form.register("imageFit")} className={fieldClass}>
                <option value="cover">Cover (fill the tile)</option>
                <option value="contain">Contain (whole picture)</option>
              </select>
            </label>
          </div>
          <div className="w-24 shrink-0 text-center text-xs font-semibold text-muted">
            Preview
            <div className="mt-1">
              <Thumb
                imageUrl={/^https:\/\/\S+$/.test(imageUrl) ? imageUrl : null}
                emoji={emoji}
                fit={imageFit}
                size="size-24"
                color={/^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined}
              />
            </div>
          </div>
        </div>

        <ErrorBanner error={save.error} />
        <div className={dialogFooter}>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={save.isPending} className={primaryButton}>
            {save.isPending ? "Saving" : category ? "Save changes" : "Add category"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
