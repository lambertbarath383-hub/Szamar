import { NextResponse } from "next/server";
import { type TeamInvite } from "@/app/lib/site-teams";
import { readSharedArray, writeSharedArray } from "@/app/lib/server/shared-state-store";

const FILE_NAME = "team-invites.json";

function isInviteStatus(value: unknown): value is TeamInvite["status"] {
  return value === "pending" || value === "accepted" || value === "rejected";
}

function isTeamInvite(value: unknown): value is TeamInvite {
  if (!value || typeof value !== "object") {
    return false;
  }
  const invite = value as Partial<TeamInvite>;
  return (
    typeof invite.id === "string" &&
    typeof invite.teamId === "string" &&
    typeof invite.inviterUserId === "string" &&
    typeof invite.invitedUserId === "string" &&
    isInviteStatus(invite.status) &&
    typeof invite.createdAt === "string" &&
    (typeof invite.respondedAt === "undefined" || typeof invite.respondedAt === "string")
  );
}

export async function GET() {
  const data = await readSharedArray<TeamInvite>(FILE_NAME, isTeamInvite);
  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { data?: unknown[] };
  const data = Array.isArray(body.data) ? body.data : null;
  if (!data || !data.every(isTeamInvite)) {
    return NextResponse.json({ ok: false, message: "Érvénytelen meghívó adat." }, { status: 400 });
  }
  await writeSharedArray<TeamInvite>(FILE_NAME, data);
  return NextResponse.json({ ok: true });
}
