"use client";

import {
  createWarehouseBodySchema,
  updateWarehouseBodySchema,
  type AdminWarehouse,
} from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog, Modal } from "../../components/dialogs";
import {
  Alert,
  Badge,
  Button,
  EmptyRow,
  Field,
  inputCls,
  LoadingRows,
  TableShell,
  th,
  td,
  Toolbar,
} from "../../components/ui";
import { errorMessage, gw } from "../../lib/gw";

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function Warehouses() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => gw<{ items: AdminWarehouse[] }>("GET", "/v1/inventory/warehouses"),
  });
  const [editing, setEditing] = useState<AdminWarehouse | "new" | null>(null);
  const [toggling, setToggling] = useState<AdminWarehouse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: (w: AdminWarehouse) =>
      gw("PATCH", `/v1/inventory/warehouses/${w.id}`, { open: !w.open }),
    onSuccess: async (_data, w) => {
      setToggling(null);
      setNotice(`${w.name} is now ${w.open ? "closed" : "open"}.`);
      await client.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });

  return (
    <>
      <Toolbar>
        <div className="ml-auto">
          <Button variant="primary" onClick={() => setEditing("new")}>
            Add warehouse
          </Button>
        </div>
      </Toolbar>
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {list.isError ? <Alert>{errorMessage(list.error)}</Alert> : null}

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Warehouse", "Id", "Location", "Radius", "Status", ""].map((h, i) => (
                <th key={h || i} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.isPending ? (
              <LoadingRows colSpan={6} />
            ) : list.data?.items.length === 0 ? (
              <EmptyRow colSpan={6}>No warehouses yet.</EmptyRow>
            ) : (
              list.data?.items.map((w) => (
                <tr key={w.id} className="border-b border-line last:border-0 hover:bg-brand-50/40">
                  <td className={`${td} font-bold`}>{w.name}</td>
                  <td className={`${td} text-ink-500`}>{w.id}</td>
                  <td className={`${td} tabular-nums`}>
                    {w.lat.toFixed(4)}, {w.lng.toFixed(4)}
                  </td>
                  <td className={`${td} tabular-nums`}>{w.radiusKm} km</td>
                  <td className={td}>
                    <Badge tone={w.open ? "green" : "gray"}>{w.open ? "Open" : "Closed"}</Badge>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button small variant="ghost" onClick={() => setToggling(w)}>
                      {w.open ? "Close" : "Open"}
                    </Button>
                    <Button small variant="ghost" onClick={() => setEditing(w)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {editing ? (
        <WarehouseDialog
          warehouse={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={async (message) => {
            setEditing(null);
            setNotice(message);
            await client.invalidateQueries({ queryKey: ["warehouses"] });
          }}
        />
      ) : null}
      {toggling ? (
        <ConfirmDialog
          title={toggling.open ? `Close ${toggling.name}?` : `Open ${toggling.name}?`}
          message={
            toggling.open
              ? "Customers in this area will see that we are closed and cannot place orders until it opens again. Orders already placed carry on."
              : "Customers in this area can order again straight away."
          }
          confirmLabel={toggling.open ? "Close warehouse" : "Open warehouse"}
          danger={toggling.open}
          busy={toggle.isPending}
          error={toggle.isError ? errorMessage(toggle.error) : null}
          onConfirm={() => toggle.mutate(toggling)}
          onClose={() => setToggling(null)}
        />
      ) : null}
    </>
  );
}

function WarehouseDialog({
  warehouse,
  onClose,
  onDone,
}: {
  warehouse: AdminWarehouse | null;
  onClose: () => void;
  onDone: (message: string) => void | Promise<void>;
}) {
  const creating = warehouse === null;
  const [name, setName] = useState(warehouse?.name ?? "");
  const [id, setId] = useState(warehouse?.id ?? "");
  const [idEdited, setIdEdited] = useState(false);
  const [lat, setLat] = useState(warehouse ? String(warehouse.lat) : "");
  const [lng, setLng] = useState(warehouse ? String(warehouse.lng) : "");
  const [radius, setRadius] = useState(warehouse ? String(warehouse.radiusKm) : "3");
  const [open, setOpen] = useState(warehouse?.open ?? true);
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: unknown) =>
      creating
        ? gw("POST", "/v1/inventory/warehouses", body)
        : gw("PATCH", `/v1/inventory/warehouses/${warehouse.id}`, body),
    onSuccess: () => onDone(creating ? `Added ${name.trim()}.` : `Saved ${name.trim()}.`),
  });

  const submit = () => {
    setProblem(null);
    const numbers = { lat: Number(lat), lng: Number(lng), radiusKm: Number(radius) };
    if (
      lat.trim() === "" ||
      lng.trim() === "" ||
      radius.trim() === "" ||
      Object.values(numbers).some(Number.isNaN)
    ) {
      return setProblem("Latitude, longitude and radius must be numbers.");
    }
    const parsed = creating
      ? createWarehouseBodySchema.safeParse({ id, name, ...numbers, open })
      : updateWarehouseBodySchema.safeParse({ name, ...numbers, open });
    if (!parsed.success) return setProblem(parsed.error.issues[0]?.message ?? "Check the form.");
    save.mutate(parsed.data);
  };

  return (
    <Modal title={creating ? "Add warehouse" : `Edit ${warehouse.name}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (creating && !idEdited) setId(slug(e.target.value));
            }}
            maxLength={100}
            className={inputCls}
          />
        </Field>
        <Field
          label="Id"
          hint={
            creating
              ? "Lowercase letters, numbers and dashes. It cannot change later."
              : "It cannot be changed."
          }
        >
          <input
            value={id}
            disabled={!creating}
            onChange={(e) => {
              setIdEdited(true);
              setId(e.target.value);
            }}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Latitude">
            <input
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Longitude">
            <input
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Radius (km)">
            <input
              inputMode="decimal"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          Open for orders
        </label>
        {problem ? <Alert>{problem}</Alert> : null}
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : creating ? "Add warehouse" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
