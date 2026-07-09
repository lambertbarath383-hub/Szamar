export type SiteUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  affiliation?: string;
  faceitProfileUrl: string;
  faceitNickname: string;
  faceitElo?: number | null;
  faceitLevel?: number | null;
  country?: string;
  manualCountryCode?: string;
  avatar?: string;
  createdAt: string;
};

export const SITE_USERS_STORAGE_KEY = "site-users";
export const SITE_USERS_CHANGED_EVENT = "site-users-changed";

export function readSiteUsersFromStorage(): SiteUser[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(SITE_USERS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SiteUser[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.email === "string" &&
        typeof item?.password === "string" &&
        (typeof item?.affiliation === "undefined" || typeof item?.affiliation === "string") &&
        typeof item?.faceitProfileUrl === "string" &&
        typeof item?.faceitNickname === "string" &&
        (typeof item?.country === "undefined" || typeof item?.country === "string") &&
        (typeof item?.manualCountryCode === "undefined" || typeof item?.manualCountryCode === "string") &&
        (typeof item?.avatar === "undefined" || typeof item?.avatar === "string") &&
        typeof item?.createdAt === "string"
    );
  } catch {
    return [];
  }
}

export function writeSiteUsersToStorage(users: SiteUser[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SITE_USERS_STORAGE_KEY, JSON.stringify(users));
  window.dispatchEvent(new Event(SITE_USERS_CHANGED_EVENT));
}

type RankableUser = {
  name: string;
  faceitElo?: number | null;
  faceitLevel?: number | null;
};

export function sortUsersByRank<T extends RankableUser>(users: T[]): T[] {
  return [...users].sort((a, b) => {
    const eloA = a.faceitElo ?? 0;
    const eloB = b.faceitElo ?? 0;
    if (eloA !== eloB) {
      return eloB - eloA;
    }
    const levelA = a.faceitLevel ?? 0;
    const levelB = b.faceitLevel ?? 0;
    if (levelA !== levelB) {
      return levelB - levelA;
    }
    return a.name.localeCompare(b.name, "hu");
  });
}
