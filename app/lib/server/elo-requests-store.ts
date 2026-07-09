import { promises as fs } from "node:fs";
import path from "node:path";
import { type EloChangeRequest } from "@/app/lib/elo-requests";

const STORAGE_DIR = path.join(process.cwd(), "data");
const STORAGE_FILE = path.join(STORAGE_DIR, "elo-requests.json");

function isEloStatus(value: unknown): value is EloChangeRequest["status"] {
  return value === "pending" || value === "approved" || value === "rejected";
}

function isEloChangeRequest(value: unknown): value is EloChangeRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<EloChangeRequest>;
  return (
    typeof item.id === "string" &&
    typeof item.userId === "string" &&
    typeof item.requestedElo === "number" &&
    Number.isInteger(item.requestedElo) &&
    item.requestedElo >= 0 &&
    item.requestedElo <= 9999 &&
    isEloStatus(item.status) &&
    typeof item.createdAt === "string" &&
    (typeof item.resolvedAt === "undefined" || typeof item.resolvedAt === "string") &&
    (typeof item.reviewedBy === "undefined" || typeof item.reviewedBy === "string") &&
    (typeof item.userSeenAt === "undefined" || typeof item.userSeenAt === "string")
  );
}

async function ensureStorageFile() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  try {
    await fs.access(STORAGE_FILE);
  } catch {
    await fs.writeFile(STORAGE_FILE, "[]", "utf8");
  }
}

export async function readEloRequestsFromFile(): Promise<EloChangeRequest[]> {
  await ensureStorageFile();
  const raw = await fs.readFile(STORAGE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isEloChangeRequest);
  } catch {
    return [];
  }
}

export async function writeEloRequestsToFile(requests: EloChangeRequest[]) {
  await ensureStorageFile();
  await fs.writeFile(STORAGE_FILE, JSON.stringify(requests, null, 2), "utf8");
}
