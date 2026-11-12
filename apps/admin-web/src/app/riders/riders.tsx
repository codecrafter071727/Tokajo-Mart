"use client";

import { phoneSchema, type AdminRider, type AdminUser } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Modal } from "../../components/dialogs";
import { BlockDialog } from "../../components/user-actions";
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
import { useUserList, useWarehouses } from "../../lib/users";

const LIVE: Record<AdminRider["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  online: { label: "Online", tone: "green" },
  on_delivery: { label: "On a delivery", tone: "amber" },
  offline: { label: "Offline", tone: "gray" },
};

export function Riders() {
  const users = useUserList({ role: "rider" }, 100);
  const live = useQuery({
    queryKey: ["live-riders"],
    refetchInterval: 10_000,
    queryFn: () => gw<{ items: AdminRider[] }>("GET", "/v1/delivery/admin/riders"),
  });
  const warehouses = useWarehouses();
  const nameOf = (id: string | null) =>
    warehouses.data?.items.find((w) => w.id === id)?.name ?? id ?? "";

  const riders = useMemo(() => users.data?.pages.flatMap((p) => p.items) ?? [], [users.data]);
  const liveById = useMemo(
    () => new Map((live.data?.items ?? []).map((r) => [r.id, r])),
    [live.data],
  );
  const working = (live.data?.items ?? []).filter((r) => r.status !== "offline").length;

  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [blocking, setBlocking] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <Toolbar>
        <span className="text-sm text-ink-700">
          {working} of {riders.filter((r) => r.status === "active").length} active riders are
          working right now.
        </span>
        <div className="ml-auto">
          <Button variant="primary" onClick={() => setEditing("new")}>
            Add rider
          </Button>
        </div>
      </Toolbar>
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {users.isError ? <Alert>{errorMessage(users.error)}</Alert> : null}

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Rider", "Vehicle", "Now", "Warehouse", ""].map((h, i) => (
                <th key={h || i} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.isPending ? (
              <LoadingRows colSpan={5} />
            ) : riders.length === 0 ? (
              <EmptyRow colSpan={5}>
                No riders yet. Add one so they can sign in to the rider app.
              </EmptyRow>
            ) : (
              riders.map((r) => {
                const status = liveById.get(r.id)?.status ?? "offline";
                const blocked = r.status === "blocked";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-line last:border-0 hover:bg-brand-50/40"
                  >
                    <td className={td}>
                      <div className="font-bold">{r.name}</div>
                      <div className="text-xs tabular-nums text-ink-500">
                        {r.phone ?? ""}
                        {r.rating ? ` · ${r.rating.toFixed(1)} rating` : ""}
                      </div>
                    </td>
                    <td className={`${td} max-w-40`}>{r.vehicle}</td>
                    <td className={td}>
                      {blocked ? (
                        <Badge tone="red">Blocked</Badge>
                      ) : (
                        <Badge tone={LIVE[status].tone}>{LIVE[status].label}</Badge>
                      )}
                      <div className="mt-1 text-xs tabular-nums text-ink-500">
                        {liveById.get(r.id)?.deliveriesToday ?? 0} delivered today
                      </div>
                    </td>
                    <td className={td}>{nameOf(r.warehouseId)}</td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <Button small variant="ghost" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button small variant="ghost" onClick={() => setBlocking(r)}>
                        {blocked ? "Unblock" : "Block"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>
      {users.hasNextPage ? (
        <div className="mt-4">
          <Button disabled={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
            Load more
          </Button>
        </div>
      ) : null}

      {editing ? (
        <RiderDialog
          rider={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      ) : null}
      {blocking ? (
        <BlockDialog
          user={blocking}
          onClose={() => setBlocking(null)}
          onDone={(message) => {
            setBlocking(null);
            setNotice(message);
          }}
        />
      ) : null}
    </>
  );
}

function RiderDialog({
  rider,
  onClose,
  onDone,
}: {
  rider: AdminUser | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const client = useQueryClient();
  const warehouses = useWarehouses();
  const creating = rider === null;
  const [name, setName] = useState(rider?.name ?? "");
  const [phone, setPhone] = useState(rider?.phone ?? "+91");
  const [vehicle, setVehicle] = useState(rider?.vehicle ?? "");
  const [warehouseId, setWarehouseId] = useState(rider?.warehouseId ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const warehouse = warehouseId || warehouses.data?.items[0]?.id || "";

  const save = useMutation({
    mutationFn: () =>
      creating
        ? gw("POST", "/v1/identity/admin/riders", {
            name: name.trim(),
            phone,
            vehicle: vehicle.trim(),
            warehouseId: warehouse,
          })
        : gw("PATCH", `/v1/identity/admin/riders/${rider.id}`, {
            name: name.trim(),
            vehicle: vehicle.trim(),
            warehouseId: warehouse,
          }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["users"] });
      await client.invalidateQueries({ queryKey: ["live-riders"] });
      onDone(
        creating ? `${name.trim()} can now sign in to the rider app.` : `Saved ${name.trim()}.`,
      );
    },
  });

  const submit = () => {
    setProblem(null);
    if (!name.trim()) return setProblem("Enter the rider's name.");
    if (creating) {
      const parsed = phoneSchema.safeParse(phone);
      if (!parsed.success)
        return setProblem(parsed.error.issues[0]?.message ?? "Check the phone number.");
    }
    if (!warehouse) return setProblem("Pick a warehouse.");
    save.mutate();
  };

  return (
    <Modal title={creating ? "Add rider" : `Edit ${rider.name}`} onClose={onClose}>
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
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className={inputCls}
          />
        </Field>
        <Field
          label="Phone"
          hint={
            creating
              ? "They sign in with a code sent to this number"
              : "The phone number cannot be changed"
          }
        >
          <input
            value={phone}
            disabled={!creating}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
            className={inputCls}
          />
        </Field>
        <Field label="Vehicle">
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Bike, scooter, bicycle"
            maxLength={80}
            className={inputCls}
          />
        </Field>
        <Field label="Warehouse">
          <select
            value={warehouse}
            onChange={(e) => setWarehouseId(e.target.value)}
            className={inputCls}
          >
            {warehouses.data?.items.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        {problem ? <Alert>{problem}</Alert> : null}
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : creating ? "Add rider" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
