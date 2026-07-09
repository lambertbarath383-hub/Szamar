import { promises as fs } from "node:fs";
import path from "node:path";
import { type SiteUser } from "@/app/lib/site-users";

const STORAGE_DIR = path.join(process.cwd(), "data");
const STORAGE_FILE = path.join(STORAGE_DIR, "site-users.json");

function isSiteUser(item: unknown): item is SiteUser {
  if (!item || typeof item !== "object") {
    return false;
  }
  const value = item as Partial<SiteUser>;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.password === "string" &&
    typeof value.faceitProfileUrl === "string" &&
    typeof value.faceitNickname === "string" &&
    (typeof value.faceitElo === "undefined" || value.faceitElo === null || typeof value.faceitElo === "number") &&
    (typeof value.faceitLevel === "undefined" || value.faceitLevel === null || typeof value.faceitLevel === "number") &&
    (typeof value.country === "undefined" || typeof value.country === "string") &&
    (typeof value.manualCountryCode === "undefined" || typeof value.manualCountryCode === "string") &&
    (typeof value.avatar === "undefined" || typeof value.avatar === "string") &&
    typeof value.createdAt === "string"
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

export async function readSiteUsersFromFile(): Promise<SiteUser[]> {
  await ensureStorageFile();
  const raw = await fs.readFile(STORAGE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSiteUser);
  } catch {
    return [];
  }
}

export async function writeSiteUsersToFile(users: SiteUser[]) {
  await ensureStorageFile();
  await fs.writeFile(STORAGE_FILE, JSON.stringify(users, null, 2), "utf8");
}

export function sanitizeSiteUser(user: SiteUser): Omit<SiteUser, "password"> {
  const safeUser = { ...user };
  delete (safeUser as { password?: string }).password;
  return safeUser;
}
