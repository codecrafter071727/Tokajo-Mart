"use client";

import { useState } from "react";
import { ConfirmDialog } from "../../components/dialogs";
import { Ring, TrendChart } from "../../components/ui/charts";
import { Combo } from "../../components/ui/combo";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  KeyValue,
  Meter,
  Mono,
  Stat,
} from "../../components/ui/core";
import { RangePicker } from "../../components/ui/date-picker";
import { FilterMenu, SearchFilter } from "../../components/ui/filter-menu";
import { Check, Field, FormGrid, Input, Select, Textarea } from "../../components/ui/form";
import { Boxes, IndianRupee, Plus, ShoppingBag, Timer, Trash2 } from "../../components/ui/icons";
import { PageHeader, Segmented, Toolbar } from "../../components/ui/layout";
import { Modal } from "../../components/ui/modal";
import { StatsSkeleton, TableSkeleton } from "../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { TagInput } from "../../components/ui/tag-input";
import { buttonClass } from "../../components/ui/button-style";

const TREND = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 1 + i));
  return { date: d.toISOString().slice(0, 10), value: 18 + ((i * 7) % 13) + (i > 9 ? 9 : 0) };
});
const today = new Date().toISOString().slice(0, 10);

function Sample() {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-6 bg-canvas p-5 text-ink">
      <PageHeader
        title="Page title"
        description="One line that says what this page is for."
        crumbs={[{ label: "Catalog", href: "#" }, { label: "Products" }]}
        badge={<Badge tone="ok">Live</Badge>}
        actions={
          <>
            <ButtonLink href="#">Secondary</ButtonLink>
            <ButtonLink href="#" variant="primary">
              Primary
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat
          icon={ShoppingBag}
          label="Orders"
          value={128}
          delta="+12%"
          deltaTone="up"
          hint="vs the 7 days before"
        />
        <Stat
          icon={IndianRupee}
          label="Delivered sales"
          value="₹48,920"
          delta="-4%"
          deltaTone="down"
          hint="98 delivered"
        />
        <Stat
          icon={Timer}
          label="Average delivery"
          value="11 min"
          tone="ok"
          hint="Placed to delivered"
        />
        <Stat icon={Boxes} label="Low stock" value={6} tone="warn" hint="3 or fewer left" />
      </div>

      <Card
        title="Buttons"
        description="Primary for the one main action, danger for destructive ones."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={Plus}>
            New product
          </Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={Trash2}>
            Delete
          </Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button
            variant="primary"
            pending={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => setBusy(false), 2000);
            }}
          >
            Save (try me)
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Card>

      <Card title="Badges and callouts">
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="info">New</Badge>
          <Badge tone="warn">Packing</Badge>
          <Badge tone="ok">Delivered</Badge>
          <Badge tone="bad">Cancelled</Badge>
          <Badge tone="neutral">Archived</Badge>
          <Badge tone="accent">Featured</Badge>
        </div>
        <div className="space-y-2">
          <Callout tone="info" title="Heads up">
            Prices change at midnight.
          </Callout>
          <Callout tone="ok">Saved.</Callout>
          <Callout tone="warn" title="Running low">
            Six products have 3 or fewer left.
          </Callout>
          <Callout tone="bad" title="Could not save">
            The server said no.
          </Callout>
        </div>
      </Card>

      <Card title="Table" flush>
        <Toolbar>
          <Segmented
            options={[
              { id: "all", label: "All", href: "#", count: 24 },
              { id: "live", label: "Live", href: "#", count: 20 },
            ]}
            current="all"
          />
          <FilterMenu
            param="sample"
            label="Category"
            options={[
              { value: "dairy", label: "Dairy", count: 6 },
              { value: "snacks", label: "Snacks", count: 9 },
            ]}
            current={null}
            searchable
          />
          <SearchFilter placeholder="Search products" className="ml-auto w-56" />
        </Toolbar>
        <Table>
          <THead>
            <tr>
              <Th>Product</Th>
              <Th>Status</Th>
              <Th className="w-36">Stock</Th>
              <Th align="right">Price</Th>
            </tr>
          </THead>
          <TBody>
            {[
              ["Amul Taaza milk 500 ml", "ok", "Live", 18, 24, "₹29"],
              ["Lay's classic salted", "warn", "Low", 2, 40, "₹20"],
              ["Brown bread", "bad", "Out", 0, 20, "₹45"],
            ].map(([name, tone, label, sold, cap, price]) => (
              <Tr key={String(name)}>
                <Td className="font-medium">{name}</Td>
                <Td>
                  <Badge tone={tone as "ok"}>{label}</Badge>
                </Td>
                <Td>
                  <Meter sold={Number(sold)} capacity={Number(cap)} />
                </Td>
                <Td align="right">{price}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card title="Forms">
        <FormGrid>
          <Field label="Name" required>
            <Input defaultValue="Amul Taaza milk" />
          </Field>
          <Field label="Category" hint="Where it shows in the app">
            <Select
              options={[
                { value: "dairy", label: "Dairy" },
                { value: "snacks", label: "Snacks" },
              ]}
            />
          </Field>
          <Field label="Price" error="Must not be above the MRP">
            <Input defaultValue="3200" />
          </Field>
          <Field label="Pick from a long list">
            <Combo
              name="product"
              options={[
                { value: "p1", label: "Milk", hint: "p1", group: "Dairy" },
                { value: "p2", label: "Paneer", hint: "p2", group: "Dairy" },
                { value: "p3", label: "Chips", hint: "p3", group: "Snacks" },
              ]}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea defaultValue="Fresh toned milk." />
          </Field>
          <Field label="Search words" className="sm:col-span-2">
            <TagInput name="tags" defaultValue={["milk"]} suggestions={["dairy", "breakfast"]} />
          </Field>
        </FormGrid>
        <div className="mt-4">
          <Check label="Show on the home screen" defaultChecked />
        </div>
      </Card>

      <Card title="Dialogs">
        <div className="flex flex-wrap gap-2">
          <Modal
            trigger="Open a dialog"
            triggerClass={buttonClass("secondary", "md")}
            title="Edit product"
            description="Changes show in the app at once."
          >
            <Field label="Name">
              <Input defaultValue="Milk" />
            </Field>
          </Modal>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Ask before deleting
          </Button>
        </div>
        {confirm ? (
          <ConfirmDialog
            title="Archive this product?"
            message="It disappears from the app. You can restore it later."
            confirmLabel="Archive"
            danger
            onConfirm={() => setConfirm(false)}
            onClose={() => setConfirm(false)}
          />
        ) : null}
      </Card>

      <Card title="Charts">
        <TrendChart data={TREND} name="Orders" color="var(--chart-1)" height={200} />
        <div className="mt-6">
          <Ring
            parts={[
              { name: "In progress", value: 12, color: "var(--chart-3)" },
              { name: "Delivered", value: 96, color: "var(--chart-2)" },
              { name: "Cancelled", value: 4, color: "var(--chart-4)" },
            ]}
            centre="86%"
            caption="delivered"
            label="12 in progress, 96 delivered, 4 cancelled"
          />
        </div>
      </Card>

      <Card title="Pick dates">
        <RangePicker from="from" to="to" min={today} />
      </Card>

      <Card title="Details and empty states">
        <KeyValue
          items={[
            { label: "Order", value: <Mono>QC-261113-00042</Mono> },
            { label: "Customer", value: "Aarav Sharma" },
            { label: "Total", value: "₹412" },
          ]}
        />
        <div className="mt-4">
          <EmptyState icon={<ShoppingBag className="size-5" />} title="No orders yet">
            They show here as they come in.
          </EmptyState>
        </div>
      </Card>

      <Card title="Loading">
        <StatsSkeleton />
        <div className="mt-4">
          <TableSkeleton rows={3} cols={4} />
        </div>
      </Card>
    </div>
  );
}

export function Gallery() {
  return (
    <>
      <PageHeader
        title="Style guide"
        description="Every component of the console in src/components/ui, light on the left and dark on the right. Build new screens from these."
      />
      <div className="grid gap-6 2xl:grid-cols-2">
        <div className="theme-light overflow-hidden rounded-xl border border-line">
          <Sample />
        </div>
        <div className="dark overflow-hidden rounded-xl border border-line">
          <Sample />
        </div>
      </div>
    </>
  );
}
