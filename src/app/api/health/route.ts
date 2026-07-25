import { NextResponse } from "next/server";

/** Healthcheck para Railway (no requiere sesión ni DB). */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
