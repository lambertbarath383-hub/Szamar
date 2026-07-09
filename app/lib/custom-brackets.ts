export type CustomBracketEntry = {
  id: string;
  name: string;
  url: string;
  embedUrl: string;
  createdAt: string;
};

export const CUSTOM_BRACKETS_STORAGE_KEY = "custom-brackets";
export const CUSTOM_BRACKETS_CHANGED_EVENT = "custom-brackets-changed";
const CUSTOM_BRACKETS_API_ENDPOINT = "/api/custom-brackets";

export function readCustomBracketsFromStorage(): CustomBracketEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(CUSTOM_BRACKETS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CustomBracketEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.url === "string" &&
        typeof item?.embedUrl === "string" &&
        typeof item?.createdAt === "string"
    );
  } catch {
    return [];
  }
}

export function writeCustomBracketsToStorage(entries: CustomBracketEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CUSTOM_BRACKETS_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CUSTOM_BRACKETS_CHANGED_EVENT));
  void pushCustomBracketsToServer(entries);
}

export async function pushCustomBracketsToServer(entries: CustomBracketEntry[]) {
  await fetch(CUSTOM_BRACKETS_API_ENDPOINT, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: entries }),
  });
}

export async function syncCustomBracketsFromServer() {
  if (typeof window === "undefined") {
    return [];
  }
  const response = await fetch(CUSTOM_BRACKETS_API_ENDPOINT, { cache: "no-store" });
  const payload = (await response.json()) as { ok?: boolean; data?: CustomBracketEntry[] };
  if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
    throw new Error("Nem sikerült szinkronizálni a bracketeket.");
  }
  window.localStorage.setItem(CUSTOM_BRACKETS_STORAGE_KEY, JSON.stringify(payload.data));
  window.dispatchEvent(new Event(CUSTOM_BRACKETS_CHANGED_EVENT));
  return payload.data;
}

export function normalizeBracketInput(urlValue: string, nameValue: string): { url: string; embedUrl: string; name: string } | null {
  const raw = urlValue.trim();
  if (!raw) {
    return null;
  }

  const normalizedUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(normalizedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    const host = parsed.hostname.toLowerCase();
    let embedUrl = normalizedUrl;
    if (host.includes("challonge.com")) {
      const cleanPath = parsed.pathname.endsWith("/module")
        ? parsed.pathname
        : `${parsed.pathname.replace(/\/$/, "")}/module`;
      embedUrl = `${parsed.protocol}//${parsed.host}${cleanPath}${parsed.search}`;
    }

    const autoName = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.hostname;
    const name = nameValue.trim() || autoName;

    return { url: normalizedUrl, embedUrl, name };
  } catch {
    return null;
  }
}
