import { NextResponse } from "next/server";
import { readSiteUsersFromFile, sanitizeSiteUser, writeSiteUsersToFile } from "@/app/lib/server/site-users-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const users = await readSiteUsersFromFile();
  const index = users.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ ok: false, message: "Felhasználó nem található." }, { status: 404 });
  }

  const current = users[index];
  const updated = {
    ...current,
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(typeof body.password === "string" ? { password: body.password } : {}),
    ...(typeof body.faceitProfileUrl === "string" ? { faceitProfileUrl: body.faceitProfileUrl } : {}),
    ...(typeof body.faceitNickname === "string" ? { faceitNickname: body.faceitNickname } : {}),
    ...(typeof body.faceitElo === "number" || body.faceitElo === null ? { faceitElo: body.faceitElo } : {}),
    ...(typeof body.faceitLevel === "number" || body.faceitLevel === null ? { faceitLevel: body.faceitLevel } : {}),
    ...(typeof body.country === "string" || typeof body.country === "undefined" ? { country: body.country } : {}),
    ...(typeof body.manualCountryCode === "string" || typeof body.manualCountryCode === "undefined"
      ? { manualCountryCode: body.manualCountryCode }
      : {}),
    ...(typeof body.avatar === "string" || typeof body.avatar === "undefined" ? { avatar: body.avatar } : {}),
  };

  const nextUsers = [...users];
  nextUsers[index] = updated;
  await writeSiteUsersToFile(nextUsers);
  return NextResponse.json({ ok: true, user: sanitizeSiteUser(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const users = await readSiteUsersFromFile();
  if (!users.some((item) => item.id === id)) {
    return NextResponse.json({ ok: false, message: "Felhasználó nem található." }, { status: 404 });
  }
  const nextUsers = users.filter((item) => item.id !== id);
  await writeSiteUsersToFile(nextUsers);
  return NextResponse.json({ ok: true });
}
