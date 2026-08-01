/**
 * Envío de email transaccional.
 * Configurá RESEND_API_KEY + EMAIL_FROM (ej. Buñas <noreply@tudominio.com>).
 */

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim(),
  );
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Email no configurado (RESEND_API_KEY / EMAIL_FROM).",
    };
  }

  const to = input.to.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: "Email de destino inválido." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error:
          json?.error?.message ||
          json?.message ||
          `No se pudo enviar el email (${res.status}).`,
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("sendTransactionalEmail", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Error al enviar el email.",
    };
  }
}
