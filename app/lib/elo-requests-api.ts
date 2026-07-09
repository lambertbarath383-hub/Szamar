import { type EloChangeRequest } from "@/app/lib/elo-requests";

type EloRequestsResponse = {
  ok?: boolean;
  data?: EloChangeRequest[];
  message?: string;
};

export async function fetchEloRequests(): Promise<EloChangeRequest[]> {
  const response = await fetch("/api/elo-requests", { cache: "no-store" });
  const payload = (await response.json()) as EloRequestsResponse;
  if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.message ?? "Nem sikerült betölteni az ELO kérelmeket.");
  }
  return payload.data;
}

export async function createEloRequest(input: {
  id?: string;
  userId: string;
  requestedElo: number;
  createdAt?: string;
}): Promise<EloChangeRequest> {
  const response = await fetch("/api/elo-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { ok?: boolean; request?: EloChangeRequest; message?: string };
  if (!response.ok || !payload.ok || !payload.request) {
    throw new Error(payload.message ?? "Nem sikerült létrehozni az ELO kérelmet.");
  }
  return payload.request;
}

export async function patchEloRequest(
  id: string,
  updates: Partial<Pick<EloChangeRequest, "status" | "resolvedAt" | "reviewedBy" | "userSeenAt">>
): Promise<EloChangeRequest> {
  const response = await fetch(`/api/elo-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const payload = (await response.json()) as { ok?: boolean; request?: EloChangeRequest; message?: string };
  if (!response.ok || !payload.ok || !payload.request) {
    throw new Error(payload.message ?? "Nem sikerült frissíteni az ELO kérelmet.");
  }
  return payload.request;
}
