import { readSharedArray, writeSharedArray } from "@/app/lib/server/shared-state-store";

const FILE = "moderator-actions.json";
const MAX_ENTRIES = 100;

type ActionEntry = {
  id: string;
  text: string;
  createdAt: string;
  isError?: boolean;
};

function isEntry(value: unknown): value is ActionEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.text === "string" && typeof v.createdAt === "string";
}

export async function logAction(text: string, isError = false): Promise<void> {
  try {
    const entry: ActionEntry = {
      id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      createdAt: new Date().toISOString(),
      ...(isError ? { isError: true } : {}),
    };
    const existing = await readSharedArray<ActionEntry>(FILE, isEntry);
    const next = [...existing, entry].slice(-MAX_ENTRIES);
    await writeSharedArray(FILE, next);
  } catch {
    // ne törje el a fő műveletet ha a log sikertelen
  }
}
