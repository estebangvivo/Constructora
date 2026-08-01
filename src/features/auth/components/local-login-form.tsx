"use client";

import { useSearchParams } from "next/navigation";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

/**
 * Login por POST clásico a /api/auth/login.
 * Evita Server Actions (Silk / Fire OS suelen fallar con ellas).
 */
export function LocalLoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <form
      method="POST"
      action="/api/auth/login"
      className="space-y-4 text-left"
      noValidate
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        {/* type=text: Silk rechaza emails .local con type=email */}
        <input
          type="text"
          name="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={fieldClass}
          required
          placeholder="tu@email.com"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className={fieldClass}
          required
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          {decodeURIComponent(error)}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
      >
        Ingresar
      </button>
    </form>
  );
}
