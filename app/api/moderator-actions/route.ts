import { NextResponse } from "next/server";
import { readSharedArray, writeSharedArray } from "@/app/lib/server/shared-state-store";

const FILE = "moderator-actions.json";
const MAX_ENTRIES = 50;

type ModeratorActionEntry = {
  id: string;
  text: string;
  createdAt: string;
};

function isEntry(value: unknown): value is ModeratorActionEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.text === "string" && typeof v.createdAt === "string";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const entries = await readSharedArray<ModeratorActionEntry>(FILE, isEntry);
  const filtered = since ? entries.filter((e) => e.createdAt > since) : entries;
  return NextResponse.json({ ok: true, data: filtered });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.id !== "string" || typeof body.text !== "string" || typeof body.createdAt !== "string") {
    return NextResponse.json({ ok: false, message: "Érvénytelen adat." }, { status: 400 });
  }
  const entry: ModeratorActionEntry = {
    id: body.id,
    text: body.text,
    createdAt: body.createdAt,
  };
  const existing = await readSharedArray<ModeratorActionEntry>(FILE, isEntry);
  const next = [...existing, entry].slice(-MAX_ENTRIES);
  await writeSharedArray(FILE, next);
  return NextResponse.json({ ok: true, entry });
}
