export const PERMISSION_KEYS = [
  "content.read",
  "content.write",
  "content.submit",
  "content.review",
  "content.publish",
  "preview.create",
  "preview.share",
  "preview.revoke",
  "media.read",
  "media.write",
  "inquiry.read",
  "inquiry.assign",
  "inquiry.status",
  "inquiry.note",
  "inquiry.retry",
  "inquiry.export",
  "staff.manage",
  "settings.manage",
  "audit.read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function can(
  granted: readonly string[],
  required: PermissionKey,
): boolean {
  return granted.includes(required);
}
