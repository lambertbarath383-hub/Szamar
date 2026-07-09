import { NextResponse } from "next/server";
import { type CustomMatchEntry } from "@/app/lib/custom-matches";
import { readSharedArray, writeSharedArray } from "@/app/lib/server/shared-state-store";

const FILE_NAME = "custom-matches.json";

function isCustomMatchEntry(value: unknown): value is CustomMatchEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<CustomMatchEntry>;
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    (typeof item.result === "undefined" || typeof item.result === "string") &&
    (typeof item.team1Name === "undefined" || typeof item.team1Name === "string") &&
    (typeof item.team2Name === "undefined" || typeof item.team2Name === "string") &&
    (typeof item.imageDataUrl === "string" || typeof item.url === "string")
  );
}

export async function GET() {
  const data = await readSharedArray<CustomMatchEntry>(FILE_NAME, isCustomMatchEntry);
  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { data?: unknown[] };
  const data = Array.isArray(body.data) ? body.data : null;
  if (!data || !data.every(isCustomMatchEntry)) {
    return NextResponse.json({ ok: false, message: "Érvénytelen match adat." }, { status: 400 });
  }
  await writeSharedArray<CustomMatchEntry>(FILE_NAME, data);
  return NextResponse.json({ ok: true });
}
