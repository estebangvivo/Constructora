"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth-config";

/**
 * Envuelve la app con Clerk solo si hay keys configuradas.
 * En bypass de desarrollo renderiza children sin provider.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}
