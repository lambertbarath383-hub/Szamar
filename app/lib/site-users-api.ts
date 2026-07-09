import { type SiteUser } from "@/app/lib/site-users";

export type PublicSiteUser = Omit<SiteUser, "password">;

type SiteUsersResponse = {
  ok?: boolean;
  data?: PublicSiteUser[];
  message?: string;
};

export async function fetchSiteUsers(options?: { light?: boolean }): Promise<PublicSiteUser[]> {
  const url = options?.light ? "/api/site-users?light=1" : "/api/site-users";
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as SiteUsersResponse;
  if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.message ?? "Nem sikerült betölteni a felhasználókat.");
  }
  return payload.data;
}

export async function patchSiteUser(id: string, updates: Partial<SiteUser>, by?: string): Promise<PublicSiteUser> {
  const body = by ? { ...updates, _by: by } : updates;
  const response = await fetch(`/api/site-users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { ok?: boolean; user?: PublicSiteUser; message?: string };
  if (!response.ok || !payload.ok || !payload.user) {
    throw new Error(payload.message ?? "Nem sikerült menteni a felhasználót.");
  }
  return payload.user;
}

export async function deleteSiteUser(id: string, by?: string) {
  const response = await fetch(`/api/site-users/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(by ? { _by: by } : {}),
  });
  const payload = (await response.json()) as { ok?: boolean; message?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Nem sikerült törölni a felhasználót.");
  }
}
