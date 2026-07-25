import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { isClerkConfigured, isDevAuthBypass } from "@/lib/auth-config";

export default function SignUpPage() {
  if (isClerkConfigured()) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-surface p-6 text-center">
        <h1 className="font-display text-2xl tracking-tight">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground">
          {isDevAuthBypass()
            ? "En modo desarrollo no hay registro. Usa el usuario seed."
            : "Configura las keys de Clerk en .env para habilitar el registro."}
        </p>
        <Link
          href="/sign-in"
          className="inline-flex text-sm font-medium text-accent hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
