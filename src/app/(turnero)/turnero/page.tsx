"use client";

import { TurneroLogo } from "@/features/turnero/components/turnero-brand";
import { APP_NAME } from "@/config/brand";

const vistas = [
  { href: "/turnero/totem", titulo: "Tótem", texto: "Emitir turnos por nombre" },
  {
    href: "/turnero/pantalla",
    titulo: "Pantalla",
    texto: "Monitor de sala de espera",
  },
  {
    href: "/turnero/operador",
    titulo: "Operador",
    texto: "Atender la cola de turnos",
  },
];

export default function TurneroInicio() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="w-full max-w-5xl">
        <div className="mb-10 flex justify-center">
          <TurneroLogo
            sizeClass="size-24 sm:size-28"
            showName
            nameClassName="mt-4 text-xl font-bold text-white"
          />
        </div>
        <h1 className="mb-3 text-center text-4xl font-bold text-white sm:text-5xl">
          Sistema de turnos
        </h1>
        <p className="mb-10 text-center text-lg text-neutral-400">
          Seleccione la vista que desea abrir
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {vistas.map((vista) => (
            <a
              key={vista.href}
              href={vista.href}
              className="rounded-3xl border border-neutral-800 bg-[#111111] p-8 text-white shadow-xl transition hover:-translate-y-1 hover:border-[#f97316] hover:bg-[#1a1a1a]"
            >
              <span className="block text-3xl font-bold text-[#f97316]">
                {vista.titulo}
              </span>
              <span className="mt-3 block text-neutral-400">{vista.texto}</span>
            </a>
          ))}
        </div>
        <div className="mt-10 text-center">
          <a
            href="/"
            className="text-sm font-bold text-neutral-500 underline-offset-4 hover:text-[#f97316] hover:underline"
          >
            Volver a {APP_NAME}
          </a>
        </div>
      </section>
    </main>
  );
}
