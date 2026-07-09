"use client";

export type EloChangeRequest = {
  id: string;
  userId: string;
  requestedElo: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  reviewedBy?: string;
  userSeenAt?: string;
};

export const ELO_REQUESTS_STORAGE_KEY = "elo-change-requests";
export const ELO_REQUESTS_CHANGED_EVENT = "elo-change-requests-changed";

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

export function readEloRequestsFromStorage(): EloChangeRequest[] {
  if (typeof window === "undefined") {
    return [];
  }
  const parsed = parseJsonArray<EloChangeRequest>(window.localStorage.getItem(ELO_REQUESTS_STORAGE_KEY));
  return parsed.filter(
    (item) =>
      typeof item?.id === "string" &&
      typeof item?.userId === "string" &&
      typeof item?.requestedElo === "number" &&
      Number.isInteger(item.requestedElo) &&
      item.requestedElo >= 0 &&
      item.requestedElo <= 9999 &&
      (item?.status === "pending" || item?.status === "approved" || item?.status === "rejected") &&
      typeof item?.createdAt === "string" &&
      (typeof item?.resolvedAt === "undefined" || typeof item?.resolvedAt === "string") &&
      (typeof item?.reviewedBy === "undefined" || typeof item?.reviewedBy === "string") &&
      (typeof item?.userSeenAt === "undefined" || typeof item?.userSeenAt === "string")
  );
}

export function writeEloRequestsToStorage(requests: EloChangeRequest[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ELO_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new Event(ELO_REQUESTS_CHANGED_EVENT));
}
