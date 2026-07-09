"use client";

export type SiteTeam = {
  id: string;
  name: string;
  ownerUserId: string;
  memberUserIds: string[];
  logo?: string;
  tier: 1 | 2 | 3;
  tierRank?: number;
  createdAt: string;
};

export type TeamInvite = {
  id: string;
  teamId: string;
  inviterUserId: string;
  invitedUserId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  respondedAt?: string;
};

export const SITE_TEAMS_STORAGE_KEY = "site-teams";
export const SITE_TEAMS_CHANGED_EVENT = "site-teams-changed";
export const TEAM_INVITES_STORAGE_KEY = "team-invites";
export const TEAM_INVITES_CHANGED_EVENT = "team-invites-changed";
const SITE_TEAMS_API_ENDPOINT = "/api/site-teams";
const TEAM_INVITES_API_ENDPOINT = "/api/team-invites";

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readSiteTeamsFromStorage(): SiteTeam[] {
  if (typeof window === "undefined") {
    return [];
  }
  const parsed = parseJsonArray<Partial<SiteTeam>>(window.localStorage.getItem(SITE_TEAMS_STORAGE_KEY));
  return parsed
    .filter(
      (team) =>
        typeof team?.id === "string" &&
        typeof team?.name === "string" &&
        typeof team?.ownerUserId === "string" &&
        Array.isArray(team?.memberUserIds) &&
        team.memberUserIds.every((id) => typeof id === "string") &&
        (typeof team?.logo === "undefined" || typeof team?.logo === "string") &&
        typeof team?.createdAt === "string"
    )
    .map((team) => {
      const normalizedTier = team.tier === 1 || team.tier === 2 || team.tier === 3 ? team.tier : 3;
      const normalizedTierRank =
        typeof team.tierRank === "number" && Number.isInteger(team.tierRank) && team.tierRank >= 1 && team.tierRank <= 8
          ? team.tierRank
          : undefined;
      return {
        id: team.id as string,
        name: team.name as string,
        ownerUserId: team.ownerUserId as string,
        memberUserIds: team.memberUserIds as string[],
        logo: team.logo,
        tier: normalizedTier,
        tierRank: normalizedTier === 3 ? undefined : normalizedTierRank,
        createdAt: team.createdAt as string,
      };
    });
}

export function writeSiteTeamsToStorage(teams: SiteTeam[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SITE_TEAMS_STORAGE_KEY, JSON.stringify(teams));
  window.dispatchEvent(new Event(SITE_TEAMS_CHANGED_EVENT));
  void pushSiteTeamsToServer(teams);
}

export function readTeamInvitesFromStorage(): TeamInvite[] {
  if (typeof window === "undefined") {
    return [];
  }
  const parsed = parseJsonArray<TeamInvite>(window.localStorage.getItem(TEAM_INVITES_STORAGE_KEY));
  return parsed.filter(
    (invite) =>
      typeof invite?.id === "string" &&
      typeof invite?.teamId === "string" &&
      typeof invite?.inviterUserId === "string" &&
      typeof invite?.invitedUserId === "string" &&
      (invite?.status === "pending" || invite?.status === "accepted" || invite?.status === "rejected") &&
      typeof invite?.createdAt === "string" &&
      (typeof invite?.respondedAt === "undefined" || typeof invite?.respondedAt === "string")
  );
}

export function writeTeamInvitesToStorage(invites: TeamInvite[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TEAM_INVITES_STORAGE_KEY, JSON.stringify(invites));
  window.dispatchEvent(new Event(TEAM_INVITES_CHANGED_EVENT));
  void pushTeamInvitesToServer(invites);
}

export async function pushSiteTeamsToServer(teams: SiteTeam[]) {
  await fetch(SITE_TEAMS_API_ENDPOINT, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: teams }),
  });
}

export async function pushTeamInvitesToServer(invites: TeamInvite[]) {
  await fetch(TEAM_INVITES_API_ENDPOINT, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: invites }),
  });
}

export async function syncSiteTeamsFromServer() {
  if (typeof window === "undefined") {
    return [];
  }
  const response = await fetch(SITE_TEAMS_API_ENDPOINT, { cache: "no-store" });
  const payload = (await response.json()) as { ok?: boolean; data?: SiteTeam[] };
  if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
    throw new Error("Nem sikerült szinkronizálni a csapatokat.");
  }
  window.localStorage.setItem(SITE_TEAMS_STORAGE_KEY, JSON.stringify(payload.data));
  window.dispatchEvent(new Event(SITE_TEAMS_CHANGED_EVENT));
  return payload.data;
}

export async function syncTeamInvitesFromServer() {
  if (typeof window === "undefined") {
    return [];
  }
  const response = await fetch(TEAM_INVITES_API_ENDPOINT, { cache: "no-store" });
  const payload = (await response.json()) as { ok?: boolean; data?: TeamInvite[] };
  if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
    throw new Error("Nem sikerült szinkronizálni a meghívókat.");
  }
  window.localStorage.setItem(TEAM_INVITES_STORAGE_KEY, JSON.stringify(payload.data));
  window.dispatchEvent(new Event(TEAM_INVITES_CHANGED_EVENT));
  return payload.data;
}

export function findTeamByMemberId(teams: SiteTeam[], userId: string): SiteTeam | null {
  return teams.find((team) => team.memberUserIds.includes(userId)) ?? null;
}
