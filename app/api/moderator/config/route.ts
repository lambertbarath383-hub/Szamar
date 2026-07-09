import { NextResponse } from "next/server";
import { readModeratorConfig, writeModeratorConfig } from "@/app/lib/server/moderator-config-store";

const OWNER_NAME = "Szamar19";
const OWNER_PASSWORD = "123";

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;

  // Require owner credentials to change config
  if (body.ownerName !== OWNER_NAME || body.ownerPassword !== OWNER_PASSWORD) {
    return NextResponse.json({ ok: false, message: "Nincs jogosultságod." }, { status: 403 });
  }

  const updates: { moderatorPassword?: string; adminKey?: string } = {};
  if (typeof body.moderatorPassword === "string" && body.moderatorPassword.trim()) {
    updates.moderatorPassword = body.moderatorPassword.trim();
  }
  if (typeof body.adminKey === "string" && body.adminKey.trim()) {
    updates.adminKey = body.adminKey.trim();
  }

  if (!updates.moderatorPassword && !updates.adminKey) {
    return NextResponse.json({ ok: false, message: "Nincs módosítandó adat." }, { status: 400 });
  }

  const next = await writeModeratorConfig(updates);
  return NextResponse.json({ ok: true, config: { moderatorPassword: "***", adminKey: "***" }, message: "Beállítások mentve." });
}

export async function GET(request: Request) {
  const body = new URL(request.url).searchParams;
  if (body.get("ownerName") !== OWNER_NAME || body.get("ownerPassword") !== OWNER_PASSWORD) {
    return NextResponse.json({ ok: false, message: "Nincs jogosultságod." }, { status: 403 });
  }
  const config = await readModeratorConfig();
  return NextResponse.json({ ok: true, config });
}
