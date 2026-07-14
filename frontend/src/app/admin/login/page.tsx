"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/auth/client";
import { AnShowLogo } from "@/components/brand/anshow-logo";

const inputClassName =
  "h-12 w-full rounded border border-white/20 bg-white/5 px-3 text-base text-white outline-none transition-colors placeholder:text-white/35 focus:border-[var(--color-cyan)] focus:ring-2 focus:ring-[var(--color-cyan)]/25";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setError("");

    try {
      const result = await authClient.signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        callbackURL: "/admin",
      });

      if (result.error) {
        setError(result.error.message ?? "Unable to sign in");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Unable to sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[var(--color-carbon)] text-[var(--color-text-inverse)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <header className="flex min-h-12 items-center border-b border-white/10 pb-5">
          <AnShowLogo className="text-white" />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <section className="w-full max-w-md rounded border border-white/15 bg-[var(--color-dark-surface)] p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-7 flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded bg-[var(--color-cyan)] text-[var(--color-carbon)]">
                <LockKeyhole aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold">Staff sign in</h1>
                <p className="mt-1 text-sm text-[var(--color-muted-inverse)]">
                  AnShow administration
                </p>
              </div>
            </div>

            <form action={submit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <input
                  autoComplete="username"
                  className={inputClassName}
                  id="email"
                  name="email"
                  required
                  type="email"
                />
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-medium"
                  htmlFor="password"
                >
                  Password
                </label>
                <input
                  autoComplete="current-password"
                  className={inputClassName}
                  id="password"
                  name="password"
                  required
                  type="password"
                />
              </div>

              {error ? (
                <p
                  className="rounded border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm text-red-100"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                aria-busy={pending}
                className="flex h-12 w-full items-center justify-center gap-2 rounded bg-[var(--color-action)] px-4 font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan)] disabled:cursor-wait disabled:opacity-65"
                disabled={pending}
                type="submit"
              >
                <LogIn aria-hidden="true" className="size-5" />
                {pending ? "Signing in" : "Sign in"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
