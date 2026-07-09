import { NextResponse } from "next/server";
import { readSiteUsersFromFile, sanitizeSiteUser, writeSiteUsersToFile } from "@/app/lib/server/site-users-store";
import { logAction } from "@/app/lib/server/log-action";

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
    ...("name" in body && typeof body.name === "string" ? { name: body.name } : {}),
    ...("password" in body && typeof body.password === "string" ? { password: body.password } : {}),
    ...("faceitProfileUrl" in body && typeof body.faceitProfileUrl === "string" ? { faceitProfileUrl: body.faceitProfileUrl } : {}),
    ...("faceitNickname" in body && typeof body.faceitNickname === "string" ? { faceitNickname: body.faceitNickname } : {}),
    ...("faceitElo" in body ? { faceitElo: typeof body.faceitElo === "number" ? body.faceitElo : null } : {}),
    ...("faceitLevel" in body ? { faceitLevel: typeof body.faceitLevel === "number" ? body.faceitLevel : null } : {}),
    ...("country" in body ? { country: typeof body.country === "string" ? body.country : undefined } : {}),
    ...("manualCountryCode" in body ? { manualCountryCode: typeof body.manualCountryCode === "string" ? body.manualCountryCode : undefined } : {}),
    ...("avatar" in body ? { avatar: typeof body.avatar === "string" ? body.avatar : undefined } : {}),
  };

  const nextUsers = [...users];
  nextUsers[index] = updated;
  await writeSiteUsersToFile(nextUsers);

  const by = typeof body._by === "string" ? body._by : null;
  if (by) {
    await logAction(`✏️ ${by} (moderátor) szerkesztette: ${current.name}`);
  }

  return NextResponse.json({ ok: true, user: sanitizeSiteUser(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const users = await readSiteUsersFromFile();
  const target = users.find((item) => item.id === id);
  if (!target) {
    return NextResponse.json({ ok: false, message: "Felhasználó nem található." }, { status: 404 });
  }
  const nextUsers = users.filter((item) => item.id !== id);
  await writeSiteUsersToFile(nextUsers);

  const by = typeof body._by === "string" ? body._by : "Moderátor";
  await logAction(`🗑️ ${by} törölte a játékost: ${target.name}`);

  return NextResponse.json({ ok: true });
}
