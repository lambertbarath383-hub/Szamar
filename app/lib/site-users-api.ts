import { type SiteUser } from "@/app/lib/site-users";

export type PublicSiteUser = Omit<SiteUser, "password">;

type SiteUsersResponse = {
  ok?: boolean;
  data?: PublicSiteUser[];
  message?: string;
};

export async function fetchSiteUsers(): Promise<PublicSiteUser[]> {
  const response = await fetch("/api/site-users", { cache: "no-store" });
  const payload = (await response.json()) as SiteUsersResponse;
  if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.message ?? "Nem sikerült betölteni a felhasználókat.");
  }
  return payload.data;
}

export async function patchSiteUser(id: string, updates: Partial<SiteUser>): Promise<PublicSiteUser> {
  const response = await fetch(`/api/site-users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const payload = (await response.json()) as { ok?: boolean; user?: PublicSiteUser; message?: string };
  if (!response.ok || !payload.ok || !payload.user) {
    throw new Error(payload.message ?? "Nem sikerült menteni a felhasználót.");
  }
  return payload.user;
}

export async function deleteSiteUser(id: string) {
  const response = await fetch(`/api/site-users/${id}`, { method: "DELETE" });
  const payload = (await response.json()) as { ok?: boolean; message?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Nem sikerült törölni a felhasználót.");
  }
}
