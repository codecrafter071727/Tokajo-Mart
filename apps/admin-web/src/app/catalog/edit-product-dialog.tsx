"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Product, UpdateProductBody } from "@qc/contracts";
import { ApiClientError } from "@qc/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "../../lib/api";

/** Amounts are typed in rupees and stored as whole paise. */
const money = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^\d+(\.\d{1,2})?$/, "Use a number like 29 or 29.50");

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(120),
    unit: z.string().trim().min(1, "Required").max(40),
    price: money,
    mrp: money,
    description: z.string().trim().max(2000),
  })
  .refine((v) => Number(v.price) <= Number(v.mrp), {
    path: ["price"],
    message: "Price cannot be higher than the MRP",
  });

type FormValues = z.infer<typeof formSchema>;

const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);

export function EditProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product.name,
      unit: product.unit,
      price: String(product.pricePaise / 100),
      mrp: String(product.mrpPaise / 100),
      description: product.description ?? "",
    },
  });

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      // Send only what changed so an edit never overwrites someone else's change to another field
      const changes: UpdateProductBody = {};
      if (values.name !== product.name) changes.name = values.name;
      if (values.unit !== product.unit) changes.unit = values.unit;
      if (toPaise(values.price) !== product.pricePaise) changes.pricePaise = toPaise(values.price);
      if (toPaise(values.mrp) !== product.mrpPaise) changes.mrpPaise = toPaise(values.mrp);
      const description = values.description === "" ? null : values.description;
      if (description !== product.description) changes.description = description;
      if (Object.keys(changes).length === 0) return Promise.resolve(product);
      return api.catalog.updateProduct(product.id, changes);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
  });

  const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm";
  const errorText = (message?: string) =>
    message ? (
      <p role="alert" className="mt-1 text-xs font-semibold text-red-700">
        {message}
      </p>
    ) : null;
  const { errors } = form.formState;
  const serverError =
    save.error instanceof ApiClientError
      ? save.error.message
      : save.error
        ? "Could not save. Try again."
        : null;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="edit-title"
      className="m-auto w-full max-w-lg rounded-2xl p-0 shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4 p-6">
        <h2 id="edit-title" className="text-lg font-extrabold">
          Edit product
        </h2>

        <label className="block text-sm font-semibold">
          Name
          <input {...form.register("name")} className={field} />
          {errorText(errors.name?.message)}
        </label>

        <label className="block text-sm font-semibold">
          Pack size
          <input {...form.register("unit")} className={field} />
          {errorText(errors.unit?.message)}
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-semibold">
            Price (₹)
            <input {...form.register("price")} inputMode="decimal" className={field} />
            {errorText(errors.price?.message)}
          </label>
          <label className="block text-sm font-semibold">
            MRP (₹)
            <input {...form.register("mrp")} inputMode="decimal" className={field} />
            {errorText(errors.mrp?.message)}
          </label>
        </div>

        <label className="block text-sm font-semibold">
          Description
          <textarea {...form.register("description")} rows={3} className={field} />
          {errorText(errors.description?.message)}
        </label>

        {serverError ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-extrabold text-ink-900 disabled:opacity-50"
          >
            {save.isPending ? "Saving" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
