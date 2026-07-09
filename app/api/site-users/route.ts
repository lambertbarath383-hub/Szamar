import { NextResponse } from "next/server";
import { type SiteUser } from "@/app/lib/site-users";
import { readSiteUsersFromFile, sanitizeSiteUser, writeSiteUsersToFile } from "@/app/lib/server/site-users-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const light = searchParams.get("light") === "1";
  const users = await readSiteUsersFromFile();
  const data = users.map((u) => {
    const sanitized = sanitizeSiteUser(u);
    if (light) {
      const { avatar: _avatar, ...rest } = sanitized;
      return rest;
    }
    return sanitized;
  });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<SiteUser> & { mode?: "register" | "login" | "reset_password" };
  const mode = body.mode;
  const users = await readSiteUsersFromFile();

  if (mode === "login") {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json({ ok: false, message: "Hiányzó e-mail vagy jelszó." }, { status: 400 });
    }
    const user = users.find((item) => item.email.toLowerCase() === email && item.password === password);
    if (!user) {
      return NextResponse.json({ ok: false, message: "Hibás e-mail vagy jelszó." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, user: sanitizeSiteUser(user) });
  }

  if (mode === "reset_password") {
    const email = body.email?.trim().toLowerCase();
    const newPassword = body.password ?? "";
    if (!email || !newPassword) {
      return NextResponse.json({ ok: false, message: "Hiányzó e-mail vagy új jelszó." }, { status: 400 });
    }
    if (!users.some((item) => item.email.toLowerCase() === email)) {
      return NextResponse.json({ ok: false, message: "Nem található felhasználó ezzel az e-mail címmel." }, { status: 404 });
    }
    const nextUsers = users.map((item) =>
      item.email.toLowerCase() === email
        ? {
            ...item,
            password: newPassword,
          }
        : item
    );
    await writeSiteUsersToFile(nextUsers);
    return NextResponse.json({ ok: true });
  }

  if (mode === "register") {
    const id = typeof body.id === "string" ? body.id : null;
    const name = typeof body.name === "string" ? body.name : null;
    const email = typeof body.email === "string" ? body.email : null;
    const password = typeof body.password === "string" ? body.password : null;
    const faceitProfileUrl = typeof body.faceitProfileUrl === "string" ? body.faceitProfileUrl : null;
    const faceitNickname = typeof body.faceitNickname === "string" ? body.faceitNickname : null;
    const createdAt = typeof body.createdAt === "string" ? body.createdAt : null;
    if (!id || !name || !email || !password || !faceitProfileUrl || !faceitNickname || !createdAt) {
      return NextResponse.json({ ok: false, message: "Hiányos regisztrációs adat." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((item) => item.email.toLowerCase() === normalizedEmail)) {
      return NextResponse.json({ ok: false, message: "Ezzel az e-mail címmel már van regisztráció." }, { status: 409 });
    }

    const nextUser: SiteUser = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      password,
      faceitProfileUrl,
      faceitNickname,
      faceitElo: body.faceitElo ?? null,
      faceitLevel: body.faceitLevel ?? null,
      country: body.country,
      manualCountryCode: body.manualCountryCode,
      avatar: body.avatar,
      createdAt,
    };

    const nextUsers = [...users, nextUser];
    await writeSiteUsersToFile(nextUsers);
    return NextResponse.json({ ok: true, user: sanitizeSiteUser(nextUser) });
  }

  return NextResponse.json({ ok: false, message: "Érvénytelen művelet." }, { status: 400 });
}
