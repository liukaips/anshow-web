"use client";

import { CircleAlert, LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { authClient } from "../../auth/client";
import { requestAdminNavigation } from "./admin-navigation";

type AdminTopbarProps = {
  email: string;
  navigation?: ReactNode;
};

export function AdminTopbar({ email, navigation }: AdminTopbarProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (
      !requestAdminNavigation({
        destination: "/admin/login",
        source: "sign-out",
      })
    ) {
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message ?? "Unable to sign out. Try again.");
        return;
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Unable to sign out. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-black/10 bg-white px-3 sm:px-5">
      <div className="flex min-w-11 items-center">{navigation}</div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span
          className="max-w-[55vw] truncate text-sm text-neutral-600 sm:max-w-none"
          title={email}
        >
          {email}
        </span>
        <button
          aria-label="Sign out"
          className="grid size-11 shrink-0 cursor-pointer place-items-center text-neutral-600 transition-colors duration-[var(--motion-fast)] hover:bg-neutral-100 hover:text-[var(--color-danger)] disabled:cursor-wait disabled:opacity-50"
          disabled={pending}
          onClick={signOut}
          title="Sign out"
          type="button"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <LogOut aria-hidden="true" className="size-5" strokeWidth={1.8} />
          )}
        </button>
      </div>
      {error ? (
        <p
          className="absolute right-3 top-[calc(100%+0.5rem)] flex max-w-[calc(100vw-1.5rem)] items-start gap-2 border border-red-200 bg-white px-3 py-2 text-sm text-red-800 shadow-lg sm:right-5"
          role="alert"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </header>
  );
}
