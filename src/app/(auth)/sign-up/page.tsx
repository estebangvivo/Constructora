import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { LocalRegisterForm } from "@/features/auth/components/local-register-form";
import { isClerkConfigured, isDevAuthBypass } from "@/lib/auth-config";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  const session = await getSession();
  if (session && !isDevAuthBypass()) {
    if (!session.organizationId) redirect("/onboarding/planes");
    redirect("/");
  }

  if (isClerkConfigured() && !isDevAuthBypass()) {
    return (
      <div className="flex min-h-dvh min-h-screen items-center justify-center bg-background px-4 py-8">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/onboarding/planes"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border bg-surface p-5 sm:p-6">
        <div className="text-center">
          <h1 className="font-display text-2xl tracking-tight">Crear cuenta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registrate para contratar el sistema y crear tu empresa.
          </p>
        </div>
        <LocalRegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link href="/sign-in" className="text-accent hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
