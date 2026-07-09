export type CustomBracketEntry = {
  id: string;
  name: string;
  url: string;
  embedUrl: string;
  createdAt: string;
};

export const CUSTOM_BRACKETS_STORAGE_KEY = "custom-brackets";
export const CUSTOM_BRACKETS_CHANGED_EVENT = "custom-brackets-changed";

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
