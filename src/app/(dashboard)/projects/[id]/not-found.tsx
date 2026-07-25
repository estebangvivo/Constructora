import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-display text-2xl tracking-tight">Obra no encontrada</h1>
      <p className="text-sm text-muted-foreground">
        No existe o no pertenece a tu organización.
      </p>
      <Link
        href="/projects"
        className="text-sm font-medium text-accent hover:underline"
      >
        Volver a obras
      </Link>
    </div>
  );
}
