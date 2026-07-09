import { NextResponse } from "next/server";
import { type CustomBracketEntry } from "@/app/lib/custom-brackets";
import { readSharedArray, writeSharedArray } from "@/app/lib/server/shared-state-store";

const FILE_NAME = "custom-brackets.json";

function isCustomBracketEntry(value: unknown): value is CustomBracketEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<CustomBracketEntry>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.url === "string" &&
    typeof item.embedUrl === "string" &&
    typeof item.createdAt === "string"
  );
}

export async function GET() {
  const data = await readSharedArray<CustomBracketEntry>(FILE_NAME, isCustomBracketEntry);
  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { data?: unknown[] };
  const data = Array.isArray(body.data) ? body.data : null;
  if (!data || !data.every(isCustomBracketEntry)) {
    return NextResponse.json({ ok: false, message: "Érvénytelen bracket adat." }, { status: 400 });
  }
  await writeSharedArray<CustomBracketEntry>(FILE_NAME, data);
  return NextResponse.json({ ok: true });
}
