type StubPageProps = {
  title: string;
  description: string;
};

export function ModuleStub({ title, description }: StubPageProps) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="mt-6 rounded-md border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted-foreground">
        Módulo planificado — UI y Server Actions en el siguiente incremento.
      </p>
    </div>
  );
}
