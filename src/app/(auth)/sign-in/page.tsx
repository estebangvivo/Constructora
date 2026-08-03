import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
import { LocalLoginForm } from "@/features/auth/components/local-login-form";
import { isClerkConfigured, isDevAuthBypass } from "@/lib/auth-config";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { APP_NAME, APP_SLOGAN } from "@/config/brand";

export default async function SignInPage() {
  const session = await getSession();
  if (session && !isDevAuthBypass()) {
    if (!session.organizationId) redirect("/onboarding/planes");
    redirect("/");
  }

  if (isClerkConfigured() && !isDevAuthBypass()) {
    return (
      <div className="flex min-h-dvh min-h-screen items-center justify-center bg-background px-4 py-8">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border bg-surface p-5 sm:p-6">
        <div className="text-center">
          <p className="font-display text-3xl tracking-tight">{APP_NAME}</p>
          <p className="mt-1 text-sm text-muted-foreground">{APP_SLOGAN}</p>
          <h1 className="mt-5 font-display text-xl tracking-tight">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresá con tu email y contraseña.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <LocalLoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          ¿Nuevo?{" "}
          <a href="/sign-up" className="text-accent hover:underline">
            Crear cuenta
          </a>
        </p>
        {isDevAuthBypass() && (
          <p className="text-center text-xs text-muted-foreground">
            Bypass de desarrollo activo: también podés entrar sin login si ya
            hay sesión seed.
          </p>
        )}
      </div>
    </div>
  );
}
