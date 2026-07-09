"use client";

import { useEffect, useMemo, useState } from "react";
import { ELO_REQUESTS_CHANGED_EVENT, type EloChangeRequest } from "@/app/lib/elo-requests";
import { fetchEloRequests, patchEloRequest } from "@/app/lib/elo-requests-api";

type SiteUserSession = {
  id: string;
  name: string;
  email: string;
};

export default function EloRequestNotifications() {
  const [session, setSession] = useState<SiteUserSession | null>(null);
  const [requests, setRequests] = useState<EloChangeRequest[]>([]);

  useEffect(() => {
    const updateState = async () => {
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
      try {
        setRequests(await fetchEloRequests());
      } catch {
        setRequests([]);
      }
    };

    const onUpdateState = () => {
      updateState().catch(() => {});
    };

    onUpdateState();
    const intervalId = setInterval(onUpdateState, 60000);
    window.addEventListener("site-user-session-changed", onUpdateState);
    window.addEventListener(ELO_REQUESTS_CHANGED_EVENT, onUpdateState);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("site-user-session-changed", onUpdateState);
      window.removeEventListener(ELO_REQUESTS_CHANGED_EVENT, onUpdateState);
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

  const markSeen = async (requestId: string) => {
    await patchEloRequest(requestId, { userSeenAt: new Date().toISOString() });
    setRequests((previous) =>
      previous.map((request) => (request.id === requestId ? { ...request, userSeenAt: new Date().toISOString() } : request))
    );
    window.dispatchEvent(new Event(ELO_REQUESTS_CHANGED_EVENT));
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
