import { promises as fs } from "node:fs";
import path from "node:path";

const STORAGE_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(STORAGE_DIR, "moderator-config.json");

export type ModeratorConfig = {
  moderatorPassword: string;
  adminKey: string;
};

const DEFAULT_CONFIG: ModeratorConfig = {
  moderatorPassword: process.env.MODERATOR_PASSWORD ?? process.env.APP_ADMIN_KEY ?? "12345",
  adminKey: process.env.MODERATOR_PASSWORD ?? process.env.APP_ADMIN_KEY ?? "12345",
};

export async function readModeratorConfig(): Promise<ModeratorConfig> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ModeratorConfig>;
    return {
      moderatorPassword: typeof parsed.moderatorPassword === "string" && parsed.moderatorPassword
        ? parsed.moderatorPassword
        : DEFAULT_CONFIG.moderatorPassword,
      adminKey: typeof parsed.adminKey === "string" && parsed.adminKey
        ? parsed.adminKey
        : DEFAULT_CONFIG.adminKey,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeModeratorConfig(config: Partial<ModeratorConfig>): Promise<ModeratorConfig> {
  const current = await readModeratorConfig();
  const next: ModeratorConfig = {
    moderatorPassword: typeof config.moderatorPassword === "string" && config.moderatorPassword
      ? config.moderatorPassword
      : current.moderatorPassword,
    adminKey: typeof config.adminKey === "string" && config.adminKey
      ? config.adminKey
      : current.adminKey,
  };
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
