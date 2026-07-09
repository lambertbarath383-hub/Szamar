"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ELO_REQUESTS_CHANGED_EVENT,
  readEloRequestsFromStorage,
  writeEloRequestsToStorage,
  type EloChangeRequest,
} from "@/app/lib/elo-requests";

type SiteUserSession = {
  id: string;
  name: string;
  email: string;
};

export default function EloRequestNotifications() {
  const [session, setSession] = useState<SiteUserSession | null>(null);
  const [requests, setRequests] = useState<EloChangeRequest[]>([]);

  useEffect(() => {
    const updateState = () => {
      const rawSession = window.localStorage.getItem("site-user-session");
      if (!rawSession) {
        setSession(null);
      } else {
        try {
          const parsed = JSON.parse(rawSession) as SiteUserSession;
          setSession(parsed && parsed.id ? parsed : null);
        } catch {
          window.localStorage.removeItem("site-user-session");
          setSession(null);
        }
      }
      setRequests(readEloRequestsFromStorage());
    };

    updateState();
    window.addEventListener("site-user-session-changed", updateState);
    window.addEventListener(ELO_REQUESTS_CHANGED_EVENT, updateState);
    window.addEventListener("storage", updateState);
    return () => {
      window.removeEventListener("site-user-session-changed", updateState);
      window.removeEventListener(ELO_REQUESTS_CHANGED_EVENT, updateState);
      window.removeEventListener("storage", updateState);
    };
  }, []);

  const pending = useMemo(() => {
    if (!session) {
      return null;
    }
    return (
      requests
        .filter((request) => request.userId === session.id && request.status === "pending")
        .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0] ?? null
    );
  }, [requests, session]);

  const unseenResolved = useMemo(() => {
    if (!session) {
      return [];
    }
    return requests
      .filter((request) => request.userId === session.id && request.status !== "pending" && !request.userSeenAt)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }, [requests, session]);

  const markSeen = (requestId: string) => {
    const nextRequests = readEloRequestsFromStorage().map((request) =>
      request.id === requestId
        ? {
            ...request,
            userSeenAt: new Date().toISOString(),
          }
        : request
    );
    writeEloRequestsToStorage(nextRequests);
  };

  if (!session || (!pending && unseenResolved.length === 0)) {
    return null;
  }

  return (
    <aside className="elo-request-stack">
      {pending && (
        <div className="elo-request-card">
          <p className="team-invite-title">ELO kérelem függőben</p>
          <p className="team-invite-text">A kérelmed ellenőrzés alatt van: {pending.requestedElo} ELO</p>
        </div>
      )}

      {unseenResolved.map((request) => (
        <div key={request.id} className="elo-request-card">
          <p className="team-invite-title">ELO kérelem elbírálva</p>
          <p className="team-invite-text">
            {request.status === "approved"
              ? `Elfogadva: ${request.requestedElo} ELO-ra frissítve.`
              : `Elutasítva: ${request.requestedElo} ELO kérés.`}
          </p>
          <button type="button" className="faceit-linker-btn secondary" onClick={() => markSeen(request.id)}>
            Rendben
          </button>
        </div>
      ))}
    </aside>
  );
}
