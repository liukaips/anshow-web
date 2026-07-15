export type StaffMember = { id: string; name: string; email: string; createdAt: string; roles: string | null };
export type StaffRole = { id: string; name: string; permissions: string[] };

export async function updateStaff(id: string, action: "enable" | "disable") {
  const response = await fetch(`/api/admin/staff/${id}/${action}`, { method: "POST" });
  if (!response.ok) throw new Error("Unable to update staff member");
  return response.json() as Promise<{ data: { updated: true } }>;
}
