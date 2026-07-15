export const ADMIN_NAVIGATION_REQUEST = "anshow:admin-navigation-request";

export type AdminNavigationRequest = {
  destination?: string;
  source: "history" | "link" | "sign-out";
};

export function requestAdminNavigation(
  detail: AdminNavigationRequest,
): boolean {
  return window.dispatchEvent(
    new CustomEvent<AdminNavigationRequest>(ADMIN_NAVIGATION_REQUEST, {
      cancelable: true,
      detail,
    }),
  );
}
