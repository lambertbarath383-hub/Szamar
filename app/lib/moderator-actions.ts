"use client";

export const MODERATOR_ACTION_EVENT = "moderator-action";
export const MODERATOR_ACTION_STORAGE_KEY = "moderator-last-action";

export type ModeratorActionPayload = {
  id: string;
  text: string;
  createdAt: string;
};

function resolveModeratorName() {
  if (typeof window === "undefined") {
    return "Moderátor";
  }
  const raw = window.localStorage.getItem("moderator-session");
  if (!raw) {
    return "Moderátor";
  }
  try {
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed?.name?.trim() || "Moderátor";
  } catch {
    return "Moderátor";
  }
}

export function publishModeratorAction(actionText: string) {
  if (typeof window === "undefined") {
    return;
  }
  const moderatorName = resolveModeratorName();
  const payload: ModeratorActionPayload = {
    id: `mod_action_${Date.now()}`,
    text: `${moderatorName} web moderator\n${actionText}`,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(MODERATOR_ACTION_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent<ModeratorActionPayload>(MODERATOR_ACTION_EVENT, { detail: payload }));
}
