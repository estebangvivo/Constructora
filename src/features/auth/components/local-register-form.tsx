"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerWithPassword } from "@/features/auth/actions/register-actions";
import { isClerkConfigured } from "@/lib/auth-config";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function LocalRegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const clerk = typeof window !== "undefined" && isClerkConfigured();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await registerWithPassword({
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        firstName: String(fd.get("firstName") ?? "") || undefined,
        lastName: String(fd.get("lastName") ?? "") || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/onboarding/planes");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nombre</span>
          <input name="firstName" className={fieldClass} autoComplete="given-name" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Apellido</span>
          <input name="lastName" className={fieldClass} autoComplete="family-name" />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="text"
          name="email"
          inputMode="email"
          required
          autoComplete="email"
          className={fieldClass}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contraseña</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={fieldClass}
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
      {clerk && (
        <p className="text-center text-xs text-muted-foreground">
          También podés registrarte con Google desde la opción de Clerk.
        </p>
      )}
    </form>
  );
}
