"use client";
import { useState } from "react";
import { updateStaff, type StaffMember } from "@/api/admin-staff";

export function StaffForm({ staff }: { staff: StaffMember[] }) {
  const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState("");
  async function toggle(item: StaffMember) { setBusy(item.id); setMessage(""); try { await updateStaff(item.id, item.roles === null ? "enable" : "disable"); setMessage("Staff access updated"); } catch { setMessage("Could not update staff access"); } finally { setBusy(null); } }
  return <section className="border border-neutral-200 bg-white" aria-label="Staff accounts"><div className="border-b border-neutral-200 px-4 py-4"><h2 className="text-lg font-semibold">Staff accounts</h2><p className="mt-1 text-sm text-neutral-600">Manage access and revoke active sessions immediately.</p></div><div className="divide-y divide-neutral-200">{staff.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4" key={item.id}><div><p className="font-medium">{item.name}</p><p className="text-sm text-neutral-600">{item.email}</p><p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{item.roles ?? "No role"}</p></div><button className="min-h-11 border border-neutral-300 px-3 text-sm font-medium" disabled={busy === item.id} onClick={() => void toggle(item)}>{busy === item.id ? "Updating..." : "Revoke sessions"}</button></div>)}</div>{message ? <p className="border-t border-neutral-200 px-4 py-3 text-sm" role="status">{message}</p> : null}</section>;
}
