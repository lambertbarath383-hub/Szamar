import type { Match } from "@/app/data/matches";

export type CustomMatchEntry = {
  id: string;
  imageDataUrl?: string;
  url?: string;
  result?: string;
  team1Name?: string;
  team2Name?: string;
  createdAt: string;
};

export const CUSTOM_MATCHES_STORAGE_KEY = "custom-match-links";
export const CUSTOM_MATCHES_CHANGED_EVENT = "custom-matches-changed";

export function readCustomMatchEntriesFromStorage(): CustomMatchEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(CUSTOM_MATCHES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CustomMatchEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.createdAt === "string" &&
        (typeof item?.result === "undefined" || typeof item?.result === "string") &&
        (typeof item?.team1Name === "undefined" || typeof item?.team1Name === "string") &&
        (typeof item?.team2Name === "undefined" || typeof item?.team2Name === "string") &&
        (typeof item?.imageDataUrl === "string" || typeof item?.url === "string")
    );
  } catch {
    return [];
  }
}

export function writeCustomMatchEntriesToStorage(entries: CustomMatchEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CUSTOM_MATCHES_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CUSTOM_MATCHES_CHANGED_EVENT));
}

export function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function customMatchEntryToMatch(entry: CustomMatchEntry): Match {
  let host = "Feltöltött kép";
  if (entry.url) {
    try {
      host = new URL(entry.url).hostname;
    } catch {}
  }

  const created = new Date(entry.createdAt);
  const date = Number.isNaN(created.getTime())
    ? new Date().toLocaleDateString("hu-HU")
    : created.toLocaleDateString("hu-HU");
  const time = Number.isNaN(created.getTime())
    ? new Date().toLocaleTimeString("hu-HU")
    : created.toLocaleTimeString("hu-HU");

  const resultText = entry.result?.trim() || "N/A";
  const scoreMatch = resultText.match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
  const parsedScore1 = scoreMatch ? Number.parseInt(scoreMatch[1], 10) : 0;
  const parsedScore2 = scoreMatch ? Number.parseInt(scoreMatch[2], 10) : 0;
  const team1 = entry.team1Name?.trim() || "IMPORTÁLT";
  const team2 = entry.team2Name?.trim() || host;

  return {
    id: entry.id,
    team1,
    team2,
    score1: parsedScore1,
    score2: parsedScore2,
    map: entry.imageDataUrl ? "Feltöltött meccs kép" : "Külső meccs link",
    map_score: resultText,
    date,
    time,
    status: "LOSS",
    team1_players: [],
    team2_players: [],
    sourceUrl: entry.url,
    imageUrl: entry.imageDataUrl,
  };
}
