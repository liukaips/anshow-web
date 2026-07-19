export function loginAccountToEmail(account: string): string {
  const normalized = account.trim().toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@anshow.local`;
}
