import { NextResponse } from "next/server";
import { readModeratorConfig } from "@/app/lib/server/moderator-config-store";

// Owner credentials are hardcoded and cannot be changed
const OWNER_NAME = "Szamar19";
const OWNER_PASSWORD = "123";

type LoginRequest = {
  name?: string;
  password?: string;
  mode?: string; // "adminKey" for admin panel key verification
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginRequest;
  const name = body.name?.trim() ?? "";
  const password = body.password?.trim() ?? "";
  const mode = body.mode ?? "login";

  // Owner login (not valid for adminKey mode)
  if (mode !== "adminKey" && name === OWNER_NAME && password === OWNER_PASSWORD) {
    return NextResponse.json({ ok: true, isOwner: true, message: "Sikeres bejelentkezés." });
  }

  const config = await readModeratorConfig();

  if (mode === "adminKey") {
    if (!password || password !== config.adminKey) {
      return NextResponse.json({ ok: false, message: "Hibás kulcs." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, isOwner: false, message: "Kulcs érvényes." });
  }

  if (!password || password !== config.moderatorPassword) {
    return NextResponse.json({ ok: false, message: "Hibás jelszó." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, isOwner: false, message: "Sikeres moderátor bejelentkezés." });
}
