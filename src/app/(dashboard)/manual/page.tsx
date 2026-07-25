import Link from "next/link";
import { existsSync } from "fs";
import path from "path";
import { MANUAL_INTRO, MANUAL_SECTIONS } from "@/features/manual/content";

export const metadata = {
  title: "Manual de uso",
};

function shotExists(src: string) {
  const rel = src.replace(/^\//, "");
  return existsSync(path.join(process.cwd(), "public", rel));
}

export default function ManualPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <header className="mb-10 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Ayuda
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight md:text-4xl">
          {MANUAL_INTRO.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{MANUAL_INTRO.subtitle}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Tip: usá el índice para saltar. Las capturas son pantallas reales del
          sistema.
        </p>
      </header>

      <nav
        aria-label="Índice del manual"
        className="mb-12 rounded-md border border-border bg-surface p-4"
      >
        <p className="mb-3 text-sm font-medium">Índice</p>
        <ol className="columns-1 gap-x-8 space-y-1.5 text-sm sm:columns-2">
          {MANUAL_SECTIONS.map((section) => (
            <li key={section.id} className="break-inside-avoid">
              <a
                href={`#${section.id}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-16">
        {MANUAL_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
            >
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-2xl tracking-tight">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {section.summary}
                  </p>
                </div>
              </div>

              <h3 className="mb-2 text-sm font-medium">Cómo hacerlo</h3>
              <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              {section.tips && section.tips.length > 0 && (
                <div className="mb-6 border-l-2 border-accent/50 pl-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tips
                  </p>
                  <ul className="mt-1 space-y-1.5 text-sm text-muted-foreground">
                    {section.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {section.shots.length > 0 && (
                <div className="space-y-6">
                  {section.shots.map((shot) => {
                    const ok = shotExists(shot.src);
                    return (
                      <figure key={shot.src} className="space-y-2">
                        {ok ? (
                          <div className="overflow-hidden rounded-md border border-border bg-surface">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={shot.src}
                              alt={shot.alt}
                              className="h-auto w-full"
                            />
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                            Captura pendiente: {shot.src}
                            <br />
                            <span className="text-xs">
                              Ejecutá{" "}
                              <code className="text-accent">
                                npm run manual:screenshots
                              </code>
                            </span>
                          </div>
                        )}
                        {shot.caption && (
                          <figcaption className="text-center text-xs text-muted-foreground">
                            {shot.caption}
                          </figcaption>
                        )}
                      </figure>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          ¿Falta algo? Pedile a tu administrador que actualice este manual o
          que regenere las capturas.
        </p>
        <p className="mt-2">
          <Link href="/" className="text-accent hover:underline">
            Volver al inicio
          </Link>
        </p>
      </footer>
    </div>
  );
}
