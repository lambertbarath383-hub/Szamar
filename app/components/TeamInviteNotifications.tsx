"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchSiteUsers, type PublicSiteUser } from "@/app/lib/site-users-api";
import {
  findTeamByMemberId,
  readSiteTeamsFromStorage,
  readTeamInvitesFromStorage,
  writeSiteTeamsToStorage,
  writeTeamInvitesToStorage,
  type SiteTeam,
  type TeamInvite,
  SITE_TEAMS_CHANGED_EVENT,
  TEAM_INVITES_CHANGED_EVENT,
} from "@/app/lib/site-teams";

type SiteUserSession = {
  id: string;
  name: string;
  email: string;
};

type PendingInviteView = {
  invite: TeamInvite;
  team: SiteTeam | null;
  inviterName: string;
};

export default function TeamInviteNotifications() {
  const [session, setSession] = useState<SiteUserSession | null>(null);
  const [users, setUsers] = useState<PublicSiteUser[]>([]);
  const [teams, setTeams] = useState<SiteTeam[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [message, setMessage] = useState("");

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
        setUsers(await fetchSiteUsers());
      } catch {
        setUsers([]);
      }
      setTeams(readSiteTeamsFromStorage());
      setInvites(readTeamInvitesFromStorage());
    };

    const onUpdateState = () => {
      updateState().catch(() => {});
    };

    onUpdateState();
    window.addEventListener("site-user-session-changed", onUpdateState);
    window.addEventListener("site-users-changed", onUpdateState);
    window.addEventListener(SITE_TEAMS_CHANGED_EVENT, onUpdateState);
    window.addEventListener(TEAM_INVITES_CHANGED_EVENT, onUpdateState);
    window.addEventListener("storage", onUpdateState);

    return () => {
      window.removeEventListener("site-user-session-changed", onUpdateState);
      window.removeEventListener("site-users-changed", onUpdateState);
      window.removeEventListener(SITE_TEAMS_CHANGED_EVENT, onUpdateState);
      window.removeEventListener(TEAM_INVITES_CHANGED_EVENT, onUpdateState);
      window.removeEventListener("storage", onUpdateState);
    };
  }, []);

  const pendingInvites = useMemo<PendingInviteView[]>(() => {
    if (!session) {
      return [];
    }
    return invites
      .filter((invite) => invite.invitedUserId === session.id && invite.status === "pending")
      .map((invite) => {
        const team = teams.find((item) => item.id === invite.teamId) ?? null;
        const inviter = users.find((item) => item.id === invite.inviterUserId);
        return {
          invite,
          team,
          inviterName: inviter?.name ?? "Ismeretlen",
        };
      })
      .filter((entry) => entry.team !== null);
  }, [invites, session, teams, users]);

  const respondToInvite = (inviteId: string, nextStatus: "accepted" | "rejected") => {
    if (!session) {
      return;
    }

    const currentTeams = readSiteTeamsFromStorage();
    const currentInvites = readTeamInvitesFromStorage();
    const invite = currentInvites.find((item) => item.id === inviteId);
    if (!invite || invite.status !== "pending") {
      return;
    }
    const targetTeam = currentTeams.find((team) => team.id === invite.teamId);
    if (!targetTeam) {
      setMessage("A meghívó csapata már nem létezik.");
      writeTeamInvitesToStorage(
        currentInvites.map((item) =>
          item.id === invite.id ? { ...item, status: "rejected", respondedAt: new Date().toISOString() } : item
        )
      );
      return;
    }

    if (nextStatus === "accepted") {
      const existingTeam = findTeamByMemberId(currentTeams, session.id);
      if (existingTeam) {
        setMessage("Már csapatban vagy, ezt a meghívót nem tudod elfogadni.");
        return;
      }
    }

    const nextInvites = currentInvites.map((item) =>
      item.id === invite.id ? { ...item, status: nextStatus, respondedAt: new Date().toISOString() } : item
    );

    if (nextStatus === "accepted") {
      const nextTeams = currentTeams.map((team) =>
        team.id === targetTeam.id ? { ...team, memberUserIds: [...team.memberUserIds, session.id] } : team
      );
      writeSiteTeamsToStorage(nextTeams);
      setMessage(`Beléptél ide: ${targetTeam.name}`);
    } else {
      setMessage("A meghívót elutasítottad.");
    }

    writeTeamInvitesToStorage(nextInvites);
  };

  if (!session || pendingInvites.length === 0) {
    return null;
  }

  return (
    <aside className="team-invite-stack">
      {pendingInvites.map(({ invite, team, inviterName }) => (
        <div key={invite.id} className="team-invite-card">
          <p className="team-invite-title">Csapat meghívó</p>
          <p className="team-invite-text">
            <strong>{inviterName}</strong> meghívott ide: <strong>{team?.name}</strong>
          </p>
          <div className="team-invite-actions">
            <button type="button" className="faceit-linker-btn" onClick={() => respondToInvite(invite.id, "accepted")}>
              Elfogadom
            </button>
            <button
              type="button"
              className="faceit-linker-btn secondary"
              onClick={() => respondToInvite(invite.id, "rejected")}
            >
              Elutasítom
            </button>
          </div>
        </div>
      ))}
      {message && <p className="team-invite-message">{message}</p>}
    </aside>
  );
}
