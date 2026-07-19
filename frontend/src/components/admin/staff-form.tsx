"use client";

import {
  LogOut,
  Save,
  ShieldCheck,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { useState } from "react";

import type { StaffMember, StaffRole } from "@/api/admin-staff";
import {
  AdminConfirmDialog,
  AdminEmptyState,
  AdminToast,
} from "./ui/admin-feedback";
import { staffRoleLabel } from "./role-matrix";

type OperationalStaffMember = StaffMember & {
  enabled?: boolean;
  isSuperAdmin?: boolean;
  roleIds?: string[];
  roleNames?: string[];
};

type PendingConfirmation = {
  action: "disable" | "enable" | "revoke";
  employee: OperationalStaffMember;
};

const ERROR_MESSAGES: Record<string, string> = {
  SELF_DISABLE: "不能停用当前登录账号。",
  LAST_SUPER_ADMIN: "系统必须保留至少一名正常使用的超级管理员。",
  SUPER_ADMIN_REQUIRED: "只有超级管理员可以修改其他超级管理员。",
  STAFF_NOT_FOUND: "未找到该员工账号，请刷新后重试。",
  INVALID_ROLE: "选择的角色已发生变化，请刷新后重新选择。",
  STAFF_ALREADY_EXISTS: "该登录账号已存在，请换一个账号。",
};

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (response.ok) return (await response.json()) as T;

  let payload: { error?: { code?: string; message?: string } } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // The recovery message below remains useful for non-JSON proxy errors.
  }
  const code = payload.error?.code ?? "";
  throw new Error(
    ERROR_MESSAGES[code] ??
      payload.error?.message ??
      "操作失败，请检查网络后重试。",
  );
}

async function mutate(path: string, body?: unknown): Promise<void> {
  await postJson(path, body);
}

function normalizeStaff(item: StaffMember): OperationalStaffMember {
  const staff = item as OperationalStaffMember;
  return {
    ...staff,
    enabled: staff.enabled ?? true,
    isSuperAdmin: staff.isSuperAdmin ?? false,
    roleIds: staff.roleIds ?? [],
    roleNames: staff.roleNames ?? [],
  };
}

export function StaffForm({
  currentUserId,
  roles,
  staff,
}: {
  currentUserId: string;
  roles: StaffRole[];
  staff: StaffMember[];
}) {
  const [items, setItems] = useState<OperationalStaffMember[]>(() =>
    staff.map(normalizeStaff),
  );
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        staff.map((item) => {
          const normalized = normalizeStaff(item);
          return [normalized.id, normalized.roleIds ?? []];
        }),
      ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [newStaff, setNewStaff] = useState({
    account: "",
    name: "",
    password: "",
    roleIds: [] as string[],
  });

  function toggleRole(userId: string, roleId: string) {
    setSelectedRoles((current) => {
      const assigned = current[userId] ?? [];
      return {
        ...current,
        [userId]: assigned.includes(roleId)
          ? assigned.filter((value) => value !== roleId)
          : [...assigned, roleId],
      };
    });
  }

  function toggleNewStaffRole(roleId: string) {
    setNewStaff((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((value) => value !== roleId)
        : [...current.roleIds, roleId],
    }));
  }

  async function createStaff() {
    setBusy("create");
    setMessage(null);
    try {
      const response = await postJson<{ data: StaffMember }>("/api/admin/staff", newStaff);
      const created = normalizeStaff(response.data);
      setItems((current) => [...current, created]);
      setSelectedRoles((current) => ({
        ...current,
        [created.id]: created.roleIds ?? [],
      }));
      setNewStaff({ account: "", name: "", password: "", roleIds: [] });
      setMessage({
        text: "员工账号已创建，可使用初始密码登录",
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "创建员工失败，请重试。",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function saveRoles(employee: OperationalStaffMember) {
    const roleIds = roles
      .map((role) => role.id)
      .filter((roleId) => selectedRoles[employee.id]?.includes(roleId));
    setBusy(`${employee.id}:roles`);
    setMessage(null);
    try {
      await mutate(`/api/admin/staff/${employee.id}/roles`, { roleIds });
      const roleNames = roles
        .filter((role) => roleIds.includes(role.id))
        .map((role) => role.name);
      setItems((current) =>
        current.map((item) =>
          item.id === employee.id
            ? {
                ...item,
                roles: roleNames.join("、") || null,
                roleIds,
                roleNames,
                isSuperAdmin: roleNames.includes("Super Administrator"),
              }
            : item,
        ),
      );
      setMessage({
        text: "角色已更新，该员工需要重新登录",
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "角色更新失败，请重试。",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function runConfirmedAction() {
    if (!confirmation) return;
    const { action, employee } = confirmation;
    setConfirmation(null);
    setBusy(`${employee.id}:${action}`);
    setMessage(null);
    try {
      if (action === "revoke") {
        await mutate(`/api/admin/staff/${employee.id}/sessions/revoke`);
        setMessage({ text: "该员工已强制退出", tone: "success" });
      } else {
        await mutate(`/api/admin/staff/${employee.id}/${action}`);
        setItems((current) =>
          current.map((item) =>
            item.id === employee.id
              ? { ...item, enabled: action === "enable" }
              : item,
          ),
        );
        setMessage({
          text: action === "enable" ? "员工账号已启用" : "员工账号已停用",
          tone: "success",
        });
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "操作失败，请重试。",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  const confirmationText = confirmation
    ? confirmation.action === "disable"
      ? {
          title: "停用员工账号",
          description: `停用后，${confirmation.employee.name} 将立即退出且无法再次登录。`,
          confirmLabel: "确认停用",
        }
      : confirmation.action === "enable"
        ? {
            title: "启用员工账号",
            description: `启用后，${confirmation.employee.name} 可以重新登录管理后台。`,
            confirmLabel: "确认启用",
          }
        : {
            title: "强制员工退出",
            description: `${confirmation.employee.name} 的所有登录会话将立即失效，账号仍保持启用。`,
            confirmLabel: "确认强制退出",
          }
    : null;

  return (
    <section
      aria-labelledby="staff-accounts-title"
      className="border border-neutral-200 bg-white"
    >
      <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <h2
          className="text-lg font-semibold text-neutral-950"
          id="staff-accounts-title"
        >
          员工账号
        </h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          分配角色、处理账号状态或立即撤销登录会话。
        </p>
      </div>

      <form
        className="grid gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-5 sm:px-5"
        onSubmit={(event) => {
          event.preventDefault();
          void createStaff();
        }}
      >
        <div>
          <h3 className="text-base font-semibold text-neutral-950">
            新建员工账号
          </h3>
          <p className="mt-1 text-sm leading-6 text-neutral-600">
            填写账号、姓名、初始密码并选择角色，保存后员工即可登录后台。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium text-neutral-900">
            登录账号
            <input
              className="min-h-11 rounded border border-neutral-300 bg-white px-3 text-base font-normal text-neutral-950 outline-none focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100"
              onChange={(event) =>
                setNewStaff((current) => ({
                  ...current,
                  account: event.target.value,
                }))
              }
              placeholder="例如 liukai"
              required
              value={newStaff.account}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-neutral-900">
            员工姓名
            <input
              className="min-h-11 rounded border border-neutral-300 bg-white px-3 text-base font-normal text-neutral-950 outline-none focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100"
              onChange={(event) =>
                setNewStaff((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="例如 刘凯"
              required
              value={newStaff.name}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-neutral-900">
            初始密码
            <input
              className="min-h-11 rounded border border-neutral-300 bg-white px-3 text-base font-normal text-neutral-950 outline-none focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100"
              minLength={8}
              onChange={(event) =>
                setNewStaff((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="至少 8 位"
              required
              type="password"
              value={newStaff.password}
            />
          </label>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-neutral-900">
            初始角色
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <label
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-neutral-200 bg-white px-3 text-sm text-neutral-800 hover:bg-neutral-50"
                key={role.id}
              >
                <input
                  checked={newStaff.roleIds.includes(role.id)}
                  className="size-5 accent-[var(--color-cyan-ink)]"
                  onChange={() => toggleNewStaffRole(role.id)}
                  required={newStaff.roleIds.length === 0}
                  type="checkbox"
                />
                新员工角色：{staffRoleLabel(role.name)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded bg-[var(--color-cyan-ink)] px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy !== null}
            type="submit"
          >
            <UserPlus aria-hidden="true" className="size-4" />
            {busy === "create" ? "正在创建..." : "创建员工账号"}
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <AdminEmptyState
          description="创建管理员账号后，可在这里分配角色。"
          title="暂无员工账号"
        />
      ) : (
        <div className="divide-y divide-neutral-200">
          {items.map((employee) => {
            const isCurrent = employee.id === currentUserId;
            const assigned = selectedRoles[employee.id] ?? [];
            return (
              <article className="grid gap-4 px-4 py-5 sm:px-5" key={employee.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-neutral-950">
                        {employee.name}
                      </h3>
                      <span
                        className={`inline-flex min-h-6 items-center rounded px-2 text-xs font-medium ${
                          employee.enabled
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-neutral-200 text-neutral-700"
                        }`}
                      >
                        {employee.enabled ? "正常使用" : "已停用"}
                      </span>
                      {isCurrent ? (
                        <span className="inline-flex min-h-6 items-center rounded bg-sky-50 px-2 text-xs font-medium text-sky-800">
                          当前登录账号
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-all text-sm text-neutral-600">
                      {employee.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isCurrent && employee.enabled ? (
                      <button
                        className="inline-flex min-h-11 items-center gap-2 rounded border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
                        disabled={busy !== null}
                        onClick={() =>
                          setConfirmation({ action: "revoke", employee })
                        }
                        type="button"
                      >
                        <LogOut aria-hidden="true" className="size-4" />
                        强制退出
                      </button>
                    ) : null}
                    {!isCurrent ? (
                      <button
                        className={`inline-flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                          employee.enabled
                            ? "border-red-300 bg-white text-red-800 hover:bg-red-50 focus-visible:outline-red-700"
                            : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 focus-visible:outline-emerald-700"
                        }`}
                        disabled={busy !== null}
                        onClick={() =>
                          setConfirmation({
                            action: employee.enabled ? "disable" : "enable",
                            employee,
                          })
                        }
                        type="button"
                      >
                        {employee.enabled ? (
                          <UserRoundX aria-hidden="true" className="size-4" />
                        ) : (
                          <UserRoundCheck aria-hidden="true" className="size-4" />
                        )}
                        {employee.enabled ? "停用账号" : "启用账号"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <fieldset className="grid gap-3">
                  <legend className="text-sm font-medium text-neutral-900">
                    分配角色
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {roles.map((role) => {
                      const protectsCurrentSuperAdmin =
                        isCurrent &&
                        employee.isSuperAdmin &&
                        role.name === "Super Administrator";
                      return (
                        <label
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-neutral-200 px-3 text-sm text-neutral-800 hover:bg-neutral-50"
                          key={role.id}
                        >
                          <input
                            checked={assigned.includes(role.id)}
                            className="size-5 accent-[var(--color-cyan-ink)]"
                            disabled={protectsCurrentSuperAdmin || busy !== null}
                            onChange={() => toggleRole(employee.id, role.id)}
                            type="checkbox"
                          />
                          {staffRoleLabel(role.name)}
                          {protectsCurrentSuperAdmin ? (
                            <ShieldCheck
                              aria-label="受保护角色"
                              className="ml-auto size-4 text-sky-700"
                            />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="flex justify-end">
                  <button
                    className="inline-flex min-h-11 items-center gap-2 rounded bg-[var(--color-cyan-ink)] px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => void saveRoles(employee)}
                    type="button"
                  >
                    <Save aria-hidden="true" className="size-4" />
                    {busy === `${employee.id}:roles` ? "正在保存..." : "保存角色"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {message ? (
        <div className="border-t border-neutral-200 p-3">
          <AdminToast message={message.text} tone={message.tone} />
        </div>
      ) : null}

      <AdminConfirmDialog
        confirmLabel={confirmationText?.confirmLabel}
        description={confirmationText?.description ?? ""}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void runConfirmedAction()}
        open={confirmation !== null}
        title={confirmationText?.title ?? ""}
      />
    </section>
  );
}
