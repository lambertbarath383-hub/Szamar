import { NextResponse } from "next/server";
import { type SiteTeam } from "@/app/lib/site-teams";
import { readSharedArray, writeSharedArray } from "@/app/lib/server/shared-state-store";

const FILE_NAME = "site-teams.json";

function isSiteTeam(value: unknown): value is SiteTeam {
  if (!value || typeof value !== "object") {
    return false;
  }
  const team = value as Partial<SiteTeam>;
  const tier = team.tier;
  return (
    typeof team.id === "string" &&
    typeof team.name === "string" &&
    typeof team.ownerUserId === "string" &&
    Array.isArray(team.memberUserIds) &&
    team.memberUserIds.every((id) => typeof id === "string") &&
    (typeof team.logo === "undefined" || typeof team.logo === "string") &&
    (tier === 1 || tier === 2 || tier === 3) &&
    (typeof team.tierRank === "undefined" ||
      (typeof team.tierRank === "number" && Number.isInteger(team.tierRank) && team.tierRank >= 1 && team.tierRank <= 8)) &&
    typeof team.createdAt === "string"
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const light = searchParams.get("light") === "1";
  const data = await readSharedArray<SiteTeam>(FILE_NAME, isSiteTeam);
  const result = light ? data.map(({ logo: _logo, ...rest }) => rest) : data;
  return NextResponse.json({ ok: true, data: result });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { data?: unknown[] };
  const data = Array.isArray(body.data) ? body.data : null;
  if (!data || !data.every(isSiteTeam)) {
    return NextResponse.json({ ok: false, message: "Érvénytelen csapat adat." }, { status: 400 });
  }
  await writeSharedArray<SiteTeam>(FILE_NAME, data);
  return NextResponse.json({ ok: true });
}
