"use client";

import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { sortUsersByRank } from "@/app/lib/site-users";
import { fetchSiteUsers, type PublicSiteUser } from "@/app/lib/site-users-api";
import {
  findTeamByMemberId,
  readSiteTeamsFromStorage,
  readTeamInvitesFromStorage,
  syncSiteTeamsFromServer,
  syncTeamInvitesFromServer,
  writeSiteTeamsToStorage,
  writeTeamInvitesToStorage,
  type SiteTeam,
  type TeamInvite,
  SITE_TEAMS_CHANGED_EVENT,
  TEAM_INVITES_CHANGED_EVENT,
} from "@/app/lib/site-teams";
import { APP_MINUTE_REFRESH_EVENT } from "@/app/lib/refresh-cycle";

type SiteUserSession = {
  id: string;
  name: string;
  email: string;
};

export default function TeamsPage() {
  const [session, setSession] = useState<SiteUserSession | null>(null);
  const [users, setUsers] = useState<PublicSiteUser[]>([]);
  const [teams, setTeams] = useState<SiteTeam[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<SiteTeam | null>(null);
  const [teamName, setTeamName] = useState("");
  const [createTeamLogo, setCreateTeamLogo] = useState("");
  const [editTeamLogo, setEditTeamLogo] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
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
        setUsers(await fetchSiteUsers({ light: true }));
      } catch {
        setUsers([]);
      }
      try {
        await Promise.all([syncSiteTeamsFromServer(), syncTeamInvitesFromServer()]);
      } catch {}
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
    window.addEventListener(APP_MINUTE_REFRESH_EVENT, onUpdateState);

    return () => {
      window.removeEventListener("site-user-session-changed", onUpdateState);
      window.removeEventListener("site-users-changed", onUpdateState);
      window.removeEventListener(SITE_TEAMS_CHANGED_EVENT, onUpdateState);
      window.removeEventListener(TEAM_INVITES_CHANGED_EVENT, onUpdateState);
      window.removeEventListener(APP_MINUTE_REFRESH_EVENT, onUpdateState);
    };
  }, []);

  const usersById = useMemo(() => {
    const mapped = new Map<string, PublicSiteUser>();
    for (const user of users) {
      mapped.set(user.id, user);
    }
    return mapped;
  }, [users]);

  const userGlobalRankById = useMemo(() => {
    const ranked = sortUsersByRank(users);
    const rankMap = new Map<string, number>();
    ranked.forEach((user, index) => {
      rankMap.set(user.id, index + 1);
    });
    return rankMap;
  }, [users]);

  const sessionTeam = useMemo(() => {
    if (!session) {
      return null;
    }
    return findTeamByMemberId(teams, session.id);
  }, [session, teams]);
  const isSessionTeamCaptain = Boolean(session && sessionTeam && sessionTeam.ownerUserId === session.id);

  const filteredTeams = useMemo(
    () => teams.filter((team) => team.name.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    [searchQuery, teams]
  );

  const getTeamAverageElo = useCallback((team: SiteTeam) => {
    const values = team.memberUserIds
      .map((memberId) => usersById.get(memberId)?.faceitElo)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) {
      return 0;
    }
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [usersById]);

  const rankedTeams = useMemo(() => {
    const compareByManualRankThenElo = (a: SiteTeam, b: SiteTeam) => {
      const rankA = a.tierRank ?? 999;
      const rankB = b.tierRank ?? 999;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const avgA = getTeamAverageElo(a);
      const avgB = getTeamAverageElo(b);
      if (avgA !== avgB) {
        return avgB - avgA;
      }
      return a.name.localeCompare(b.name, "hu");
    };

    const tier1 = filteredTeams.filter((team) => team.tier === 1).sort(compareByManualRankThenElo);
    const tier2 = filteredTeams.filter((team) => team.tier === 2).sort(compareByManualRankThenElo);
    const tier3 = filteredTeams
      .filter((team) => team.tier === 3)
      .sort((a, b) => getTeamAverageElo(b) - getTeamAverageElo(a) || a.name.localeCompare(b.name, "hu"));

    return [
      ...tier1.map((team, index) => {
        const tierPlacement = team.tierRank ?? index + 1;
        return {
          team,
          tierPlacement,
          overallRank: tierPlacement,
          averageElo: getTeamAverageElo(team),
        };
      }),
      ...tier2.map((team, index) => {
        const tierPlacement = team.tierRank ?? index + 1;
        return {
          team,
          tierPlacement,
          overallRank: 8 + tierPlacement,
          averageElo: getTeamAverageElo(team),
        };
      }),
      ...tier3.map((team, index) => {
        const tierPlacement = index + 1;
        return {
          team,
          tierPlacement,
          overallRank: 16 + tierPlacement,
          averageElo: getTeamAverageElo(team),
        };
      }),
    ];
  }, [filteredTeams, getTeamAverageElo]);

  const selectedTeamMembers = useMemo(() => {
    if (!selectedTeam) {
      return [];
    }
    return selectedTeam.memberUserIds
      .map((memberId) => usersById.get(memberId))
      .filter((member): member is PublicSiteUser => Boolean(member))
      .sort((a, b) => {
        const eloA = a.faceitElo ?? -1;
        const eloB = b.faceitElo ?? -1;
        if (eloA !== eloB) {
          return eloB - eloA;
        }
        return a.name.localeCompare(b.name, "hu");
      });
  }, [selectedTeam, usersById]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setEditTeamLogo(sessionTeam?.logo ?? "");
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [sessionTeam]);

  useEffect(() => {
    if (!selectedTeam) {
      return;
    }
    const timeoutId = setTimeout(() => {
      const nextSelected = teams.find((team) => team.id === selectedTeam.id) ?? null;
      setSelectedTeam(nextSelected);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [selectedTeam, teams]);

  const getUserAvatar = (user: PublicSiteUser) => {
    return user.avatar || `https://via.placeholder.com/80?text=${encodeURIComponent(user.name.charAt(0).toUpperCase())}`;
  };

  const onTeamLogoPick = (event: ChangeEvent<HTMLInputElement>, mode: "create" | "edit") => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage("Csak képfájl tölthető fel logónak.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (mode === "create") {
        setCreateTeamLogo(value);
      } else {
        setEditTeamLogo(value);
      }
      setMessage("");
    };
    reader.onerror = () => {
      setMessage("Nem sikerült beolvasni a logó képet.");
    };
    reader.readAsDataURL(file);
  };

  const createTeam = () => {
    if (!session) {
      setMessage("Csapatot csak regisztrált, bejelentkezett felhasználó hozhat létre.");
      return;
    }
    const name = teamName.trim();
    if (!name) {
      setMessage("Add meg a csapat nevét.");
      return;
    }
    if (sessionTeam) {
      setMessage("Már tagja vagy egy csapatnak, nem hozhatsz létre újat.");
      return;
    }
    if (teams.some((team) => team.name.trim().toLowerCase() === name.toLowerCase())) {
      setMessage("Ilyen nevű csapat már létezik.");
      return;
    }

    const nextTeam: SiteTeam = {
      id: `team_${Date.now()}`,
      name,
      ownerUserId: session.id,
      memberUserIds: [session.id],
      logo: createTeamLogo || undefined,
      tier: 3,
      createdAt: new Date().toISOString(),
    };
    writeSiteTeamsToStorage([nextTeam, ...teams]);
    setTeamName("");
    setCreateTeamLogo("");
    setMessage(`Csapat létrehozva: ${name}`);
  };

  const saveTeamLogo = () => {
    if (!sessionTeam || !isSessionTeamCaptain) {
      return;
    }
    const nextTeams = teams.map((team) =>
      team.id === sessionTeam.id
        ? {
            ...team,
            logo: editTeamLogo || undefined,
          }
        : team
    );
    writeSiteTeamsToStorage(nextTeams);
    setMessage("Csapat logó mentve.");
  };

  const deleteOwnTeam = () => {
    if (!sessionTeam || !session || !isSessionTeamCaptain) {
      setMessage("Csak csapatkapitány törölheti a csapatot.");
      return;
    }
    const nextTeams = teams.filter((team) => team.id !== sessionTeam.id);
    const nextInvites = invites.filter((invite) => invite.teamId !== sessionTeam.id);
    writeTeamInvitesToStorage(nextInvites);
    writeSiteTeamsToStorage(nextTeams);
    setSelectedTeam(null);
    setMessage("Csapat törölve.");
  };

  const removeMemberFromOwnTeam = (memberId: string) => {
    if (!sessionTeam || !session || !isSessionTeamCaptain) {
      setMessage("Csak csapatkapitány távolíthat el tagot.");
      return;
    }
    if (memberId === sessionTeam.ownerUserId) {
      setMessage("A kapitányt nem lehet eltávolítani. Add át előbb a kapitányi szerepet.");
      return;
    }
    const nextTeams = teams.map((team) =>
      team.id === sessionTeam.id
        ? {
            ...team,
            memberUserIds: team.memberUserIds.filter((id) => id !== memberId),
          }
        : team
    );
    writeSiteTeamsToStorage(nextTeams);
    setMessage("Tag eltávolítva a csapatból.");
  };

  const transferOwnCaptain = (nextCaptainUserId: string) => {
    if (!sessionTeam || !session || !isSessionTeamCaptain) {
      setMessage("Csak csapatkapitány adhatja át a kapitányi szerepet.");
      return;
    }
    if (!sessionTeam.memberUserIds.includes(nextCaptainUserId)) {
      setMessage("Csak csapattagnak adható át a kapitányi szerep.");
      return;
    }
    if (nextCaptainUserId === sessionTeam.ownerUserId) {
      setMessage("Ez a játékos már kapitány.");
      return;
    }
    const nextTeams = teams.map((team) =>
      team.id === sessionTeam.id
        ? {
            ...team,
            ownerUserId: nextCaptainUserId,
          }
        : team
    );
    writeSiteTeamsToStorage(nextTeams);
    setMessage("Kapitányi szerep átadva.");
  };

  const inviteUser = () => {
    if (!session || !sessionTeam || !isSessionTeamCaptain) {
      setMessage("Csak csapatkapitány tud meghívót küldeni.");
      return;
    }

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setMessage("Add meg a meghívni kívánt játékos e-mail címét.");
      return;
    }

    const invitedUser = users.find((user) => user.email.toLowerCase() === email);
    if (!invitedUser) {
      setMessage("Nincs ilyen regisztrált felhasználó.");
      return;
    }
    if (invitedUser.id === session.id) {
      setMessage("Saját magadat nem hívhatod meg.");
      return;
    }
    if (findTeamByMemberId(teams, invitedUser.id)) {
      setMessage("A meghívott játékos már csapatban van.");
      return;
    }
    if (
      invites.some(
        (invite) =>
          invite.teamId === sessionTeam.id && invite.invitedUserId === invitedUser.id && invite.status === "pending"
      )
    ) {
      setMessage("Ennek a játékosnak már van függő meghívója ebbe a csapatba.");
      return;
    }

    const nextInvite: TeamInvite = {
      id: `invite_${Date.now()}`,
      teamId: sessionTeam.id,
      inviterUserId: session.id,
      invitedUserId: invitedUser.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    writeTeamInvitesToStorage([nextInvite, ...invites]);
    setInviteEmail("");
    setMessage(`Meghívó elküldve: ${invitedUser.name}`);
  };

  if (selectedTeam) {
    return (
      <main className="container">
        <button type="button" className="matches-link-btn" onClick={() => setSelectedTeam(null)} style={{ marginBottom: "16px" }}>
          ← Vissza a csapatokhoz
        </button>

        {sessionTeam && selectedTeam.id === sessionTeam.id && (
          <div className="panel" style={{ marginBottom: "16px" }}>
            <p className="user-settings-title">Csapat szerkesztés</p>
            {isSessionTeamCaptain ? (
              <>
                <div className="faceit-linker-row">
                  <input
                    className="faceit-linker-input"
                    placeholder="Meghívandó játékos e-mail címe"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                  <button type="button" className="faceit-linker-btn" onClick={inviteUser}>
                    Meghívás küldése
                  </button>
                </div>
                <div className="faceit-linker-row" style={{ marginTop: "8px" }}>
                  <input
                    className="faceit-linker-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => onTeamLogoPick(event, "edit")}
                  />
                  <button type="button" className="faceit-linker-btn secondary" onClick={saveTeamLogo}>
                    Logó mentése
                  </button>
                  <button type="button" className="faceit-linker-btn secondary" onClick={deleteOwnTeam}>
                    Csapat törlése
                  </button>
                </div>
                {editTeamLogo && <img src={editTeamLogo} alt="Csapat logó előnézet" className="user-settings-preview" />}
              </>
            ) : (
              <p className="faceit-linker-message">Csak a csapatkapitány szerkesztheti a csapatot.</p>
            )}
          </div>
        )}

        <div className="faceit-rankings-wrap">
          <div className="faceit-rankings-header">{selectedTeam.name} - Játékosok</div>
          <table className="faceit-rankings-table">
            <thead>
              <tr>
                <th>Név</th>
                <th>ELO</th>
                <th>Helyezés</th>
                {sessionTeam && selectedTeam.id === sessionTeam.id && isSessionTeamCaptain ? <th>Művelet</th> : null}
              </tr>
            </thead>
            <tbody>
              {selectedTeamMembers.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="faceit-player-cell">
                      <img src={getUserAvatar(member)} alt={member.name} className="faceit-player-avatar" />
                      <p className="faceit-player-name">{member.name}</p>
                    </div>
                  </td>
                  <td className="faceit-elo-cell">{member.faceitElo ?? "—"}</td>
                  <td>
                    <span className="faceit-level-chip">#{userGlobalRankById.get(member.id) ?? "—"}</span>
                  </td>
                  {sessionTeam && selectedTeam.id === sessionTeam.id && isSessionTeamCaptain ? (
                    <td>
                      {member.id === selectedTeam.ownerUserId ? (
                        <span className="faceit-linker-message">Kapitány</span>
                      ) : (
                        <div className="faceit-linker-row">
                          <button
                            type="button"
                            className="faceit-linker-btn secondary"
                            onClick={() => transferOwnCaptain(member.id)}
                          >
                            Kapitány átadás
                          </button>
                          <button
                            type="button"
                            className="faceit-linker-btn secondary"
                            onClick={() => removeMemberFromOwnTeam(member.id)}
                          >
                            Tag törlése
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1 className="title">CSAPATOK</h1>

      {!session ? (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <p>Csapat regisztrációhoz előbb jelentkezz be.</p>
          <Link href="/auth" className="faceit-linker-btn" style={{ display: "inline-flex", marginTop: "10px" }}>
            Bejelentkezés / Regisztráció
          </Link>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <p className="user-settings-title">Csapat regisztráció</p>
          {!sessionTeam ? (
            <>
              <div className="faceit-linker-row">
                <input
                  className="faceit-linker-input"
                  placeholder="Csapat neve"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                />
                <button type="button" className="faceit-linker-btn" onClick={createTeam}>
                  Csapat létrehozása
                </button>
              </div>
              <div className="faceit-linker-row" style={{ marginTop: "8px" }}>
                <input className="faceit-linker-input" type="file" accept="image/*" onChange={(event) => onTeamLogoPick(event, "create")} />
                {createTeamLogo && <img src={createTeamLogo} alt="Csapat logó előnézet" className="user-settings-preview" />}
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: "10px" }}>
                Aktív csapatod: <strong>{sessionTeam.name}</strong>
              </p>
              <button type="button" className="faceit-linker-btn" onClick={() => setSelectedTeam(sessionTeam)}>
                Csapat szerkesztése
              </button>
            </>
          )}
        </div>
      )}

      {message && <p className="faceit-linker-message">{message}</p>}

      <div className="search-container">
        <input
          type="text"
          placeholder="Keress csapatra..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="search-input"
        />
      </div>

      {rankedTeams.length > 0 ? (
        <div className="faceit-rankings-wrap">
          <div className="faceit-rankings-header">Team Rankings</div>
          <table className="faceit-rankings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Csapat</th>
                <th>Tier</th>
                <th>Tier hely</th>
                <th>Tagok</th>
                <th>Kapitány</th>
                <th>Átlag ELO</th>
              </tr>
            </thead>
            <tbody>
              {rankedTeams.map((entry) => (
                <tr key={entry.team.id}>
                  <td>#{entry.overallRank}</td>
                  <td>
                    <div className="faceit-player-cell">
                      <img
                        src={
                          entry.team.logo ||
                          `https://via.placeholder.com/80?text=${encodeURIComponent(entry.team.name.charAt(0).toUpperCase())}`
                        }
                        alt={entry.team.name}
                        className="faceit-player-avatar"
                      />
                      <button
                        type="button"
                        className="matches-link-btn secondary"
                        onClick={() => setSelectedTeam(entry.team)}
                        style={{ padding: "6px 12px" }}
                      >
                        {entry.team.name}
                      </button>
                    </div>
                  </td>
                  <td>Tier {entry.team.tier}</td>
                  <td>#{entry.tierPlacement}</td>
                  <td>{entry.team.memberUserIds.length}</td>
                  <td>{usersById.get(entry.team.ownerUserId)?.name ?? "Ismeretlen"}</td>
                  <td className="faceit-elo-cell">{entry.averageElo > 0 ? entry.averageElo : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-results">
          <p>Még nincs regisztrált csapat.</p>
        </div>
      )}
    </main>
  );
}
