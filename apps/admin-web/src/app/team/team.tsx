"use client";

import { resetPasswordBodySchema, type AdminUser } from "@qc/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useMe, useUserList, useWarehouses } from "../../lib/users";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  warehouse_manager: "Manager",
  warehouse_staff: "Packer",
};

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; user: AdminUser }
  | { kind: "password"; user: AdminUser }
  | { kind: "block"; user: AdminUser }
  | null;

export function Team() {
  const admins = useUserList({ role: "admin" }, 100);
  const managers = useUserList({ role: "warehouse_manager" }, 100);
  const staff = useUserList({ role: "warehouse_staff" }, 100);
  const me = useMe();
  const warehouses = useWarehouses();
  const nameOf = (id: string | null) =>
    warehouses.data?.items.find((w) => w.id === id)?.name ?? id ?? "";

  const people = useMemo(
    () => [admins, managers, staff].flatMap((q) => q.data?.pages.flatMap((p) => p.items) ?? []),
    [admins.data, managers.data, staff.data], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const loading = admins.isPending || managers.isPending || staff.isPending;
  const error = admins.error ?? managers.error ?? staff.error;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
  };

  return (
    <>
      <Toolbar>
        <div className="ml-auto">
          <Button variant="primary" onClick={() => setDialog({ kind: "create" })}>
            Add team member
          </Button>
        </div>
      </Toolbar>
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error ? <Alert>{errorMessage(error)}</Alert> : null}

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Name", "Role", "Warehouse", "Status", ""].map((h, i) => (
                <th key={h || i} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows colSpan={5} />
            ) : people.length === 0 ? (
              <EmptyRow colSpan={5}>No team members yet.</EmptyRow>
            ) : (
              people.map((p) => {
                const self = p.id === me.data?.id;
                const isAdmin = p.role === "admin";
                return (
                  <tr
                    key={p.id}
                    className="border-b border-line last:border-0 hover:bg-brand-50/40"
                  >
                    <td className={td}>
                      <div className="font-bold">
                        {p.name}
                        {self ? (
                          <span className="ml-2 text-xs font-semibold text-ink-500">(you)</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-ink-500">{p.email}</div>
                    </td>
                    <td className={td}>
                      <Badge tone={isAdmin ? "blue" : "gray"}>{ROLE_LABEL[p.role] ?? p.role}</Badge>
                    </td>
                    <td className={td}>{isAdmin ? "All" : nameOf(p.warehouseId)}</td>
                    <td className={td}>
                      <Badge tone={p.status === "blocked" ? "red" : "green"}>
                        {p.status === "blocked" ? "Blocked" : "Active"}
                      </Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      {self ? (
                        <span className="text-xs text-ink-500">
                          You cannot change your own account
                        </span>
                      ) : (
                        <>
                          {isAdmin ? null : (
                            <Button
                              small
                              variant="ghost"
                              onClick={() => setDialog({ kind: "edit", user: p })}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            small
                            variant="ghost"
                            onClick={() => setDialog({ kind: "password", user: p })}
                          >
                            Reset password
                          </Button>
                          <Button
                            small
                            variant="ghost"
                            onClick={() => setDialog({ kind: "block", user: p })}
                          >
                            {p.status === "blocked" ? "Unblock" : "Block"}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>

      {dialog?.kind === "create" || dialog?.kind === "edit" ? (
        <StaffDialog
          user={dialog.kind === "edit" ? dialog.user : null}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
      {dialog?.kind === "password" ? (
        <PasswordDialog user={dialog.user} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
      {dialog?.kind === "block" ? (
        <BlockDialog user={dialog.user} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
    </>
  );
}

function StaffDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const client = useQueryClient();
  const warehouses = useWarehouses();
  const creating = user === null;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "warehouse_staff");
  const [warehouseId, setWarehouseId] = useState(user?.warehouseId ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const warehouse = warehouseId || warehouses.data?.items[0]?.id || "";

  const save = useMutation({
    mutationFn: () =>
      creating
        ? gw("POST", "/v1/identity/admin/staff", {
            name: name.trim(),
            email: email.trim(),
            password,
            role,
            warehouseId: warehouse,
          })
        : gw("PATCH", `/v1/identity/admin/staff/${user.id}`, {
            name: name.trim(),
            role,
            warehouseId: warehouse,
          }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["users"] });
      onDone(creating ? `${name.trim()} can now sign in.` : `Saved ${name.trim()}.`);
    },
  });

  const submit = () => {
    setProblem(null);
    if (!name.trim()) return setProblem("Enter their name.");
    if (creating) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setProblem("Enter a valid email address.");
      const parsed = resetPasswordBodySchema.safeParse({ password });
      if (!parsed.success) return setProblem("The password needs at least 10 characters.");
    }
    if (!warehouse) return setProblem("Pick a warehouse.");
    save.mutate();
  };

  return (
    <Modal title={creating ? "Add team member" : `Edit ${user.name}`} onClose={onClose}>
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
          label="Email"
          hint={
            creating ? "They sign in to the warehouse app with this" : "The email cannot be changed"
          }
        >
          <input
            type="email"
            value={email}
            disabled={!creating}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>
        {creating ? (
          <Field label="Password" hint="At least 10 characters. Share it with them safely.">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className={inputCls}
            >
              <option value="warehouse_staff">Packer</option>
              <option value="warehouse_manager">Manager</option>
            </select>
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
        </div>
        {problem ? <Alert>{problem}</Alert> : null}
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : creating ? "Add member" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      gw("POST", `/v1/identity/admin/users/${user.id}/reset-password`, { password }),
    onSuccess: () => onDone(`New password set for ${user.name}. They were signed out.`),
  });
  return (
    <Modal title={`Reset password for ${user.name}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setProblem(null);
          if (!resetPasswordBodySchema.safeParse({ password }).success) {
            return setProblem("The password needs at least 10 characters.");
          }
          save.mutate();
        }}
        className="space-y-4"
      >
        <Field
          label="New password"
          hint="They are signed out everywhere and must use this next time."
        >
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </Field>
        {problem ? <Alert>{problem}</Alert> : null}
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : "Set password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
