"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIAS,
  ETIQUETAS_CATEGORIA,
  type Categoria,
  type TurnoDTO,
} from "@/features/turnero/lib/turnos";
import { TurneroLogo } from "@/features/turnero/components/turnero-brand";

type Puesto = {
  id: string;
  nombre: string;
  categoria: Categoria;
  activo: boolean;
};

type SesionPuesto = { id: string; nombre: string; categoria: Categoria };

const STORAGE_KEY = "constructora-turnero-puesto";

async function leerTurno(respuesta: Response) {
  const data = await respuesta.json();
  if (!respuesta.ok) throw new Error(data.error ?? "La operación no pudo completarse");
  return data as TurnoDTO;
}

export default function OperadorPage() {
  const [puesto, setPuesto] = useState<SesionPuesto | null>(null);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [turnos, setTurnos] = useState<TurnoDTO[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [inicializado, setInicializado] = useState(false);
  const [modoAbm, setModoAbm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState<Categoria>("CAJA");

  const cargarPuestos = useCallback(async () => {
    const respuesta = await fetch(`/api/turnero/puestos?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!respuesta.ok) throw new Error("No se pudieron cargar los puestos");
    setPuestos((await respuesta.json()) as Puesto[]);
  }, []);

  const actualizar = useCallback(async () => {
    try {
      const respuesta = await fetch(`/api/turnero/turnos?scope=activos&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!respuesta.ok) throw new Error();
      setTurnos((await respuesta.json()) as TurnoDTO[]);
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }, []);

  useEffect(() => {
    async function iniciar() {
      try {
        const lista = (await fetch(`/api/turnero/puestos?t=${Date.now()}`, {
          cache: "no-store",
        }).then((r) => r.json())) as Puesto[];
        setPuestos(lista);

        const guardado = window.localStorage.getItem(STORAGE_KEY);
        if (guardado) {
          try {
            const valor = JSON.parse(guardado) as SesionPuesto;
            const valido = lista.find(
              (item) =>
                item.activo &&
                item.id === valor.id &&
                item.nombre === valor.nombre &&
                item.categoria === valor.categoria,
            );
            if (valido) {
              setPuesto({
                id: valido.id,
                nombre: valido.nombre,
                categoria: valido.categoria,
              });
            } else {
              window.localStorage.removeItem(STORAGE_KEY);
            }
          } catch {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        setError("No se pudieron cargar los puestos");
      } finally {
        setInicializado(true);
      }
    }
    void iniciar();
  }, []);

  useEffect(() => {
    if (!puesto) return;
    void actualizar();
    const intervalo = window.setInterval(actualizar, 1000);
    return () => window.clearInterval(intervalo);
  }, [actualizar, puesto]);

  const turnoActual = useMemo(
    () =>
      puesto
        ? turnos.find(
            (turno) => turno.estado === "LLAMADO" && turno.puesto === puesto.nombre,
          ) ?? null
        : null,
    [puesto, turnos],
  );

  const espera = useMemo(
    () =>
      puesto
        ? turnos.filter(
            (turno) =>
              turno.categoria === puesto.categoria && turno.estado === "ESPERA",
          )
        : [],
    [puesto, turnos],
  );

  function seleccionar(item: Puesto) {
    const sesion = {
      id: item.id,
      nombre: item.nombre,
      categoria: item.categoria,
    };
    setPuesto(sesion);
    setError("");
    setModoAbm(false);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
  }

  function limpiarFormulario() {
    setEditandoId(null);
    setFormNombre("");
    setFormCategoria("CAJA");
  }

  function empezarEdicion(item: Puesto) {
    setEditandoId(item.id);
    setFormNombre(item.nombre);
    setFormCategoria(item.categoria);
    setError("");
  }

  async function guardarPuesto(event: FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setError("");

    try {
      const respuesta = await fetch(
        editandoId ? `/api/turnero/puestos/${editandoId}` : "/api/turnero/puestos",
        {
          method: editandoId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: formNombre,
            categoria: formCategoria,
          }),
        },
      );
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.error ?? "No se pudo guardar el puesto");

      await cargarPuestos();
      limpiarFormulario();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarPuesto(item: Puesto) {
    if (!window.confirm(`¿Dar de baja el puesto "${item.nombre}"?`)) return;
    setGuardando(true);
    setError("");
    try {
      const respuesta = await fetch(`/api/turnero/puestos/${item.id}`, {
        method: "DELETE",
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.error ?? "No se pudo eliminar");
      if (editandoId === item.id) limpiarFormulario();
      await cargarPuestos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutar(accion: () => Promise<TurnoDTO>) {
    setCargando(true);
    setError("");
    try {
      await accion();
      await actualizar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setCargando(false);
    }
  }

  function llamarSiguiente() {
    if (!puesto) return;
    void ejecutar(async () =>
      leerTurno(
        await fetch("/api/turnero/turnos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accion: "LLAMAR_SIGUIENTE",
            categoria: puesto.categoria,
            puesto: puesto.nombre,
          }),
        }),
      ),
    );
  }

  function actualizarActual(estado: "LLAMADO" | "ATENDIDO" | "CANCELADO") {
    if (!puesto || !turnoActual) return;
    void ejecutar(async () =>
      leerTurno(
        await fetch(`/api/turnero/turnos/${turnoActual.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado, puesto: puesto.nombre }),
        }),
      ),
    );
  }

  if (!inicializado) {
    return <main className="min-h-dvh bg-[#0a0a0a]" />;
  }

  if (!puesto) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-5">
        <section className="w-full max-w-4xl rounded-3xl border border-neutral-800 bg-[#111111] p-6 shadow-2xl sm:p-10">
          <div className="mb-6 flex justify-center">
            <TurneroLogo sizeClass="size-16" />
          </div>
          <p className="text-center text-sm font-extrabold uppercase tracking-[.3em] text-[#f97316]">
            Panel de operador
          </p>
          <h1 className="mt-2 text-center text-4xl font-bold text-white sm:text-5xl">
            {modoAbm ? "Administrar puestos" : "Seleccione su puesto"}
          </h1>
          <p className="mt-3 text-center text-lg text-neutral-400">
            {modoAbm
              ? "Alta, edición y baja de puestos para las 4 áreas."
              : "La selección quedará guardada en este equipo."}
          </p>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setModoAbm((v) => !v);
                limpiarFormulario();
                setError("");
              }}
              className="rounded-xl border border-[#f97316] px-5 py-3 font-extrabold text-[#f97316] hover:bg-[#f97316] hover:text-black"
            >
              {modoAbm ? "Volver a selección" : "Administrar puestos (ABM)"}
            </button>
          </div>

          {!modoAbm ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {puestos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => seleccionar(item)}
                  className="rounded-2xl border-2 border-neutral-700 bg-[#1a1a1a] p-5 text-left transition hover:border-[#f97316] hover:bg-[#2a2a2a]"
                >
                  <span className="block text-xl font-extrabold text-white">{item.nombre}</span>
                  <span className="mt-1 block text-sm font-bold uppercase tracking-wider text-[#f97316]">
                    {ETIQUETAS_CATEGORIA[item.categoria]}
                  </span>
                </button>
              ))}
              {!puestos.length && (
                <p className="col-span-full rounded-2xl border border-dashed border-neutral-700 p-6 text-center text-neutral-500">
                  No hay puestos activos. Usá el ABM para dar de alta el primero.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <form
                onSubmit={guardarPuesto}
                className="rounded-2xl border border-neutral-700 bg-[#1a1a1a] p-5 sm:p-6"
              >
                <p className="mb-4 text-sm font-extrabold uppercase tracking-[.2em] text-[#f97316]">
                  {editandoId ? "Editar puesto" : "Nuevo puesto"}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-neutral-400">Nombre</span>
                    <input
                      required
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      placeholder="Ej: Caja 3"
                      className="w-full rounded-xl border border-neutral-600 bg-[#111111] px-4 py-3 text-white outline-none focus:border-[#f97316]"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-neutral-400">
                      Tipo de atención
                    </span>
                    <select
                      value={formCategoria}
                      onChange={(e) => setFormCategoria(e.target.value as Categoria)}
                      className="w-full rounded-xl border border-neutral-600 bg-[#111111] px-4 py-3 text-white outline-none focus:border-[#f97316]"
                    >
                      {CATEGORIAS.map((cat) => (
                        <option key={cat} value={cat}>
                          {ETIQUETAS_CATEGORIA[cat]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={guardando || formNombre.trim().length < 2}
                    className="rounded-xl bg-[#f97316] px-5 py-3 font-extrabold text-black hover:bg-[#fb923c] disabled:opacity-50"
                  >
                    {guardando
                      ? "Guardando…"
                      : editandoId
                        ? "Guardar cambios"
                        : "Dar de alta"}
                  </button>
                  {editandoId && (
                    <button
                      type="button"
                      onClick={limpiarFormulario}
                      className="rounded-xl border border-neutral-600 px-5 py-3 font-bold text-neutral-300 hover:border-[#f97316] hover:text-[#f97316]"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-3">
                {puestos.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-700 bg-[#1a1a1a] p-4"
                  >
                    <div>
                      <p className="text-lg font-extrabold text-white">{item.nombre}</p>
                      <p className="text-sm font-bold uppercase tracking-wider text-[#f97316]">
                        {ETIQUETAS_CATEGORIA[item.categoria]}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => empezarEdicion(item)}
                        className="rounded-lg border border-neutral-500 px-3 py-2 text-sm font-bold text-neutral-200 hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => void eliminarPuesto(item)}
                        className="rounded-lg border border-red-800 px-3 py-2 text-sm font-bold text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                      >
                        Baja
                      </button>
                    </div>
                  </div>
                ))}
                {!puestos.length && (
                  <p className="rounded-2xl border border-dashed border-neutral-700 p-6 text-center text-neutral-500">
                    Todavía no hay puestos cargados.
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-red-950/60 p-4 text-center font-bold text-red-300">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <header className="border-b border-neutral-800 bg-[#111111] px-5 py-5 text-white sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <TurneroLogo sizeClass="size-12" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.3em] text-[#f97316]">
                Operador · {ETIQUETAS_CATEGORIA[puesto.categoria]}
              </p>
              <h1 className="mt-1 text-3xl font-extrabold">{puesto.nombre}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPuesto(null);
              setTurnos([]);
              window.localStorage.removeItem(STORAGE_KEY);
            }}
            className="rounded-xl bg-[#f97316] px-4 py-3 font-extrabold text-black appearance-none hover:bg-[#fb923c] [-webkit-tap-highlight-color:transparent]"
          >
            Cambiar puesto
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-5 sm:p-10 lg:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-3xl border border-neutral-800 bg-[#111111] p-6 shadow-lg sm:p-10">
          <p className="text-sm font-extrabold uppercase tracking-[.25em] text-neutral-500">
            Turno en atención
          </p>
          {turnoActual ? (
            <>
              <p className="my-7 break-words text-center text-3xl font-extrabold leading-tight text-[#f97316] sm:text-5xl">
                {turnoActual.codigo}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={cargando}
                  onClick={() => actualizarActual("LLAMADO")}
                  className="rounded-2xl border-2 border-[#f97316] bg-transparent px-6 py-5 text-xl font-extrabold text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-50"
                >
                  Re-llamar
                </button>
                <button
                  type="button"
                  disabled={cargando}
                  onClick={() => actualizarActual("ATENDIDO")}
                  className="rounded-2xl bg-[#f97316] px-6 py-5 text-xl font-extrabold text-black hover:bg-[#fb923c] disabled:opacity-50"
                >
                  Finalizar turno
                </button>
              </div>
              <button
                type="button"
                disabled={cargando}
                onClick={() => actualizarActual("CANCELADO")}
                className="mt-3 w-full rounded-xl px-5 py-3 font-bold text-neutral-500 hover:bg-red-950/40 hover:text-red-400 disabled:opacity-50"
              >
                Cancelar turno
              </button>
            </>
          ) : (
            <div className="py-10 text-center">
              <p className="text-3xl font-extrabold text-neutral-500">Puesto disponible</p>
              <button
                type="button"
                disabled={cargando || espera.length === 0}
                onClick={llamarSiguiente}
                className="mt-8 w-full rounded-2xl bg-[#f97316] px-8 py-7 text-2xl font-extrabold text-black shadow-lg hover:bg-[#fb923c] disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                {cargando ? "Llamando…" : "Llamar siguiente"}
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-red-950/60 p-4 font-bold text-red-300">
              {error}
            </p>
          )}
        </section>

        <aside className="rounded-3xl border border-neutral-800 bg-[#1a1a1a] p-6 text-white shadow-lg sm:p-8">
          <p className="text-sm font-extrabold uppercase tracking-[.25em] text-[#f97316]">
            Cola de {ETIQUETAS_CATEGORIA[puesto.categoria]}
          </p>
          <p className="my-5 text-8xl font-extrabold">{espera.length}</p>
          <p className="text-xl text-neutral-400">
            {espera.length === 1 ? "persona en espera" : "personas en espera"}
          </p>
          <div className="mt-8 border-t border-neutral-700 pt-6">
            <p className="mb-3 font-bold text-neutral-500">Próximos</p>
            <div className="flex flex-wrap gap-2">
              {espera.slice(0, 6).map((turno) => (
                <span
                  key={turno.id}
                  className="rounded-lg bg-[#0a0a0a] px-3 py-2 text-sm font-extrabold leading-tight text-[#f97316]"
                >
                  {turno.codigo}
                </span>
              ))}
              {!espera.length && <span className="text-neutral-600">Sin turnos pendientes</span>}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
