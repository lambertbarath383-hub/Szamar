import { promises as fs } from "node:fs";
import path from "node:path";

const STORAGE_DIR = path.join(process.cwd(), "data");

async function ensureStorageFile(filePath: string) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf8");
  }
}

export async function readSharedArray<T>(fileName: string, isItem: (value: unknown) => value is T): Promise<T[]> {
  const filePath = path.join(STORAGE_DIR, fileName);
  await ensureStorageFile(filePath);
  const raw = await fs.readFile(filePath, "utf8");
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isItem);
  } catch {
    return [];
  }
}

export async function writeSharedArray<T>(fileName: string, data: T[]) {
  const filePath = path.join(STORAGE_DIR, fileName);
  await ensureStorageFile(filePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
