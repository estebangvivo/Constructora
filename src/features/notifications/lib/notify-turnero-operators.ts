import { prisma } from "@/lib/prisma";
import {
  ETIQUETAS_CATEGORIA,
  type Categoria,
} from "@/features/turnero/lib/turnos";

/**
 * Avisa a los usuarios cuyo puesto de operador coincide con la categoría
 * del turno recién emitido.
 */
export async function notifyTurneroOperators(input: {
  organizationId: string;
  categoria: Categoria;
  codigo: string;
  clienteNombre: string;
}) {
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: input.organizationId,
      turneroPuestoId: { not: null },
      user: { isActive: true },
      turneroPuesto: {
        activo: true,
        categoria: input.categoria,
      },
    },
    select: {
      userId: true,
      turneroPuesto: { select: { nombre: true } },
    },
  });

  if (members.length === 0) return;

  const etiqueta = ETIQUETAS_CATEGORIA[input.categoria];
  const title = `Nuevo turno · ${etiqueta}`;
  const body = `${input.clienteNombre.trim() || input.codigo} espera atención en ${etiqueta}.`;

  await prisma.appNotification.createMany({
    data: members.map((m) => ({
      organizationId: input.organizationId,
      userId: m.userId,
      type: "TURNERO_TURNO",
      title,
      body,
      href: "/turnero/operador",
    })),
  });
}
