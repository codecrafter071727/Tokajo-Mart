"use client";

import {
  createCouponBodySchema,
  updateCouponBodySchema,
  type AdminCoupon,
  type CouponType,
} from "@qc/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Callout } from "../../components/ui/core";
import { Dialog } from "../../components/ui/dialog";
import { Check, Field, FormGrid, Input, Select, Textarea } from "../../components/ui/form";
import { errorMessage, gw } from "../../lib/gw";
import { couponValue } from "../../lib/coupons";

/** ISO time to the value a datetime-local input wants, in the admin's own time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const rupeesToPaise = (value: string) =>
  value.trim() === "" ? null : Math.round(Number(value) * 100);
const paiseToRupees = (paise: number | null) => (paise === null ? "" : String(paise / 100));
const intOrNull = (value: string) => (value.trim() === "" ? null : Math.round(Number(value)));

type Form = {
  code: string;
  title: string;
  description: string;
  type: CouponType;
  /** Percent as a number, or rupees for a flat coupon */
  value: string;
  maxDiscount: string;
  minOrder: string;
  startsAt: string;
  endsAt: string;
  usageLimitTotal: string;
  usageLimitPerUser: string;
  firstOrderOnly: boolean;
  active: boolean;
};

function initial(c: AdminCoupon | null): Form {
  if (!c) {
    return {
      code: "",
      title: "",
      description: "",
      type: "flat",
      value: "",
      maxDiscount: "",
      minOrder: "",
      startsAt: "",
      endsAt: "",
      usageLimitTotal: "",
      usageLimitPerUser: "1",
      firstOrderOnly: false,
      active: true,
    };
  }
  return {
    code: c.code,
    title: c.title,
    description: c.description,
    type: c.type,
    value: c.type === "flat" ? paiseToRupees(c.value) : c.type === "percent" ? String(c.value) : "",
    maxDiscount: paiseToRupees(c.maxDiscountPaise),
    minOrder: c.minOrderPaise ? paiseToRupees(c.minOrderPaise) : "",
    startsAt: toLocalInput(c.startsAt),
    endsAt: toLocalInput(c.endsAt),
    usageLimitTotal: c.usageLimitTotal ? String(c.usageLimitTotal) : "",
    usageLimitPerUser: c.usageLimitPerUser ? String(c.usageLimitPerUser) : "",
    firstOrderOnly: c.firstOrderOnly,
    active: c.active,
  };
}

/** The request body in paise and ISO times, as the order service expects it. */
function toBody(f: Form) {
  const value =
    f.type === "percent"
      ? (intOrNull(f.value) ?? 0)
      : f.type === "flat"
        ? (rupeesToPaise(f.value) ?? 0)
        : 0;
  return {
    title: f.title,
    description: f.description,
    type: f.type,
    value,
    maxDiscountPaise: f.type === "percent" ? rupeesToPaise(f.maxDiscount) : null,
    minOrderPaise: rupeesToPaise(f.minOrder) ?? 0,
    startsAt: fromLocalInput(f.startsAt),
    endsAt: fromLocalInput(f.endsAt),
    usageLimitTotal: intOrNull(f.usageLimitTotal),
    usageLimitPerUser: intOrNull(f.usageLimitPerUser),
    firstOrderOnly: f.firstOrderOnly,
    active: f.active,
  };
}

export function CouponDialog({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: AdminCoupon | null;
  onClose: () => void;
  onSaved: (coupon: AdminCoupon, created: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(() => initial(coupon));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const save = useMutation({
    mutationFn: (body: object) =>
      coupon
        ? gw<AdminCoupon>("PATCH", `/v1/orders/admin/coupons/${coupon.id}`, body)
        : gw<AdminCoupon>("POST", "/v1/orders/admin/coupons", body),
    onSuccess: (saved) => onSaved(saved, !coupon),
  });

  const submit = () => {
    const body = coupon ? toBody(form) : { code: form.code, ...toBody(form) };
    const parsed = coupon
      ? updateCouponBodySchema.safeParse(body)
      : createCouponBodySchema.safeParse(body);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        const field =
          key === "maxDiscountPaise" ? "maxDiscount" : key === "minOrderPaise" ? "minOrder" : key;
        next[field] ||= issue.message;
      }
      setErrors(next);
      return;
    }
    save.mutate(parsed.data);
  };

  const preview = couponValue({
    type: form.type,
    value: form.type === "flat" ? (rupeesToPaise(form.value) ?? 0) : (intOrNull(form.value) ?? 0),
    maxDiscountPaise: form.type === "percent" ? rupeesToPaise(form.maxDiscount) : null,
  });

  return (
    <Dialog
      wide
      title={coupon ? `Edit ${coupon.code}` : "New coupon"}
      description="Customers type the code in the cart. Amounts are in rupees."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" pending={save.isPending} onClick={submit}>
            {coupon ? "Save changes" : "Create coupon"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {save.isError ? <Callout tone="bad">{errorMessage(save.error)}</Callout> : null}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-accent-line bg-accent-soft px-4 py-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold tracking-wider text-accent">
              {form.code || "CODE"}
            </div>
            <div className="truncate text-[13px] text-ink-2">{form.title || "Title"}</div>
          </div>
          <div className="text-right text-sm font-semibold text-ink">{preview}</div>
        </div>

        <FormGrid>
          <Field label="Code" required error={errors.code} hint="3 to 20 letters or digits">
            <Input
              value={form.code}
              disabled={Boolean(coupon)}
              onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="WELCOME50"
              maxLength={20}
              className="font-mono tracking-wider"
            />
          </Field>
          <Field label="Title" required error={errors.title} hint="Shown to customers">
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="₹50 off your first order"
              maxLength={80}
            />
          </Field>
        </FormGrid>

        <Field label="Description" error={errors.description}>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={300}
            placeholder="On orders above ₹199"
          />
        </Field>

        <FormGrid>
          <Field label="Type" required>
            <Select
              value={form.type}
              onChange={(e) => set("type", e.target.value as CouponType)}
              options={[
                { value: "flat", label: "Flat amount off" },
                { value: "percent", label: "Percent off" },
                { value: "free_delivery", label: "Free delivery" },
              ]}
            />
          </Field>
          {form.type === "flat" ? (
            <Field label="Amount off (₹)" required error={errors.value}>
              <Input
                type="number"
                min={1}
                inputMode="decimal"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
              />
            </Field>
          ) : form.type === "percent" ? (
            <Field label="Percent off" required error={errors.value} hint="1 to 100">
              <Input
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Saves" hint="The delivery fee, on carts that would pay it">
              <Input value="Delivery fee" disabled />
            </Field>
          )}
        </FormGrid>

        <FormGrid>
          {form.type === "percent" ? (
            <Field
              label="Most it can save (₹)"
              error={errors.maxDiscount}
              hint="Leave empty for no cap"
            >
              <Input
                type="number"
                min={1}
                inputMode="decimal"
                value={form.maxDiscount}
                onChange={(e) => set("maxDiscount", e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Minimum order (₹)" error={errors.minOrder} hint="Item total before fees">
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={form.minOrder}
              onChange={(e) => set("minOrder", e.target.value)}
            />
          </Field>
        </FormGrid>

        <FormGrid>
          <Field label="Starts" error={errors.startsAt} hint="Empty means now">
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </Field>
          <Field label="Ends" error={errors.endsAt} hint="Empty means no end">
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </Field>
        </FormGrid>

        <FormGrid>
          <Field label="Total uses" error={errors.usageLimitTotal} hint="Empty means unlimited">
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={form.usageLimitTotal}
              onChange={(e) => set("usageLimitTotal", e.target.value)}
            />
          </Field>
          <Field
            label="Uses per customer"
            error={errors.usageLimitPerUser}
            hint="Empty means unlimited"
          >
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={form.usageLimitPerUser}
              onChange={(e) => set("usageLimitPerUser", e.target.value)}
            />
          </Field>
        </FormGrid>

        <div className="flex flex-wrap gap-5">
          <Check
            label="Only on a customer's first order"
            checked={form.firstOrderOnly}
            onChange={(e) => set("firstOrderOnly", e.target.checked)}
          />
          <Check
            label="Customers can use it"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />
        </div>
        {errors.form ? <Callout tone="bad">{errors.form}</Callout> : null}
      </div>
    </Dialog>
  );
}
