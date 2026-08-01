/**
 * Asegura el superadmin de plataforma en cada deploy.
 * Único por defecto: adminesteban@bunas.com.ar (AdminEsteban).
 *
 * Contraseña: PLATFORM_SUPERADMIN_PASSWORD o SebaEmma0210.
 * No crea membresías: opera en modo plataforma.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL = "adminesteban@bunas.com.ar";
const SUPERADMIN_AUTH_ID = "local:adminesteban@bunas.com.ar";
const SUPERADMIN_PASSWORD =
  process.env.PLATFORM_SUPERADMIN_PASSWORD?.trim() || "SebaEmma0210";

async function main() {
  const passwordHash = await hash(SUPERADMIN_PASSWORD, 10);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: SUPERADMIN_EMAIL }, { authId: SUPERADMIN_AUTH_ID }],
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: SUPERADMIN_EMAIL,
        authId: SUPERADMIN_AUTH_ID,
        firstName: "AdminEsteban",
        lastName: null,
        passwordHash,
        isActive: true,
      },
    });
    console.log(`✓ Superadmin actualizado: ${SUPERADMIN_EMAIL}`);
  } else {
    await prisma.user.create({
      data: {
        authId: SUPERADMIN_AUTH_ID,
        email: SUPERADMIN_EMAIL,
        firstName: "AdminEsteban",
        passwordHash,
        isActive: true,
      },
    });
    console.log(`✓ Superadmin creado: ${SUPERADMIN_EMAIL}`);
  }
}

main()
  .catch((error) => {
    console.error("seed-platform-superadmin", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
