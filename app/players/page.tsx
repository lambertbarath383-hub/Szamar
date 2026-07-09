"use client";

import { useEffect, useMemo, useState } from "react";
import { players, type Player } from "../data/players";
import { type FaceitOverride } from "../lib/faceit-profile";
import { SITE_USERS_CHANGED_EVENT, sortUsersByRank } from "../lib/site-users";
import { fetchSiteUsers, patchSiteUser, type PublicSiteUser } from "../lib/site-users-api";

type SelectedPlayer = Player | null;
type PlayersApiResponse = {
  data: Player[];
  source: "remote" | "fallback";
  error?: string;
  updatedAt: string;
  faceit: {
    configured: boolean;
    liveCount: number;
    fallbackCount: number;
    noProfileCount: number;
  };
};

type FaceitSummaryResponse = {
  ok?: boolean;
  faceitElo?: number | null;
  faceitLevel?: number | null;
  country?: string | null;
  avatar?: string | null;
};

function formatStat(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value}${suffix}`;
}

function getFaceitStatus(player: Player) {
  if (!player.hasFaceit) {
    return { label: "Nincs FACEIT", className: "faceit-badge none" };
  }
  if (player.faceitStatsUpdatedAt) {
    return { label: "Élő FACEIT adat", className: "faceit-badge live" };
  }
  return { label: "FACEIT profil csatlakoztatva", className: "faceit-badge live" };
}

function countryToFlag(value: string | null | undefined): string {
  const code = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🌍";
  }
  const base = 127397;
  return String.fromCodePoint(...code.split("").map((char) => base + char.charCodeAt(0)));
}

function mapSiteUsersToPlayers(users: PublicSiteUser[]): Player[] {
  const rankedUsers = sortUsersByRank(users);
  return rankedUsers.map((user, index) => ({
    rank: index + 1,
    name: user.name,
    team: "Regisztrált",
    rating: null,
    kd: null,
    country: user.manualCountryCode ?? user.country ?? "Unknown",
    pfp: user.avatar || `https://via.placeholder.com/150?text=${encodeURIComponent(user.name)}`,
    hs: null,
    adr: null,
    maps: null,
    wins: null,
    losses: null,
    bio: `Regisztrált játékos FACEIT profillal: ${user.faceitNickname}`,
    totalEarnings: "$0",
    trophies: [],
    faceitNickname: user.faceitNickname,
    faceitProfileUrl: user.faceitProfileUrl,
    hasFaceit: true,
    faceitElo: user.faceitElo ?? null,
    faceitLevel: user.faceitLevel ?? null,
    faceitGame: null,
    faceitStatsUpdatedAt: undefined,
  }));
}

export default function PlayersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [playersData, setPlayersData] = useState<Player[]>(
    players.map((player) => ({
      ...player,
      hasFaceit: Boolean(player.faceitNickname),
    }))
  );
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer>(null);
  const [registeredPlayers, setRegisteredPlayers] = useState<Player[]>([]);
  const [faceitOverrides] = useState<FaceitOverride[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    const raw = window.localStorage.getItem("faceit-overrides");
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as FaceitOverride[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [adminKey] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("admin-key") ?? "";
  });
  const [matchesSourceUrl] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("matches-source-url") ?? "";
  });

  const mergedPlayers = useMemo(() => {
    const seen = new Set<string>();
    const merged: Player[] = [];
    const ordered = [...registeredPlayers, ...playersData];
    for (const player of ordered) {
      const key = player.name.trim().toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(player);
    }
    const sorted = [...merged].sort((a, b) => {
      const eloA = a.faceitElo ?? -1;
      const eloB = b.faceitElo ?? -1;
      if (eloA !== eloB) {
        return eloB - eloA;
      }
      const levelA = a.faceitLevel ?? -1;
      const levelB = b.faceitLevel ?? -1;
      if (levelA !== levelB) {
        return levelB - levelA;
      }
      return a.name.localeCompare(b.name, "hu");
    });

    return sorted.map((player, index) => ({ ...player, rank: index + 1 }));
  }, [registeredPlayers, playersData]);

  const filteredPlayers = useMemo(
    () => mergedPlayers.filter((player) => player.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [mergedPlayers, searchQuery]
  );

  useEffect(() => {
    let isMounted = true;

    const loadPlayers = async () => {
      const params = new URLSearchParams();
      if (faceitOverrides.length > 0) {
        params.set("overrides", JSON.stringify(faceitOverrides));
      }
      if (matchesSourceUrl) {
        params.set("matchesSource", matchesSourceUrl);
      }
      const endpoint = params.toString() ? `/api/players?${params.toString()}` : "/api/players";

      const response = await fetch(endpoint, {
        cache: "no-store",
        headers: adminKey ? { "x-admin-key": adminKey } : undefined,
      });
      if (!response.ok) {
        throw new Error(`Játékos API hiba: ${response.status}`);
      }

      const payload = (await response.json()) as PlayersApiResponse;
      if (!Array.isArray(payload.data)) {
        throw new Error("Játékos API invalid formátum.");
      }

      if (!isMounted) {
        return;
      }

      setPlayersData(payload.data);
    };

    const runLoad = async () => {
      try {
        await loadPlayers();
      } catch {
        if (!isMounted) {
          return;
        }
      }
    };

    runLoad();
    const intervalId = setInterval(runLoad, 300000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [faceitOverrides, adminKey, matchesSourceUrl]);

  useEffect(() => {
    let isMounted = true;

    const refreshUsersFromFaceit = async () => {
      const currentUsers = await fetchSiteUsers();
      if (!isMounted) {
        return;
      }
      setRegisteredPlayers(mapSiteUsersToPlayers(currentUsers));

      const updatedUsers = await Promise.all(
        currentUsers.map(async (user) => {
          if (!user.faceitNickname) {
            return user;
          }
          try {
            const response = await fetch(`/api/faceit/summary?nickname=${encodeURIComponent(user.faceitNickname)}`, {
              cache: "no-store",
            });
            if (!response.ok) {
              return user;
            }
            const payload = (await response.json()) as FaceitSummaryResponse;
            return {
              ...user,
              faceitElo: payload.faceitElo ?? user.faceitElo ?? null,
              faceitLevel: payload.faceitLevel ?? user.faceitLevel ?? null,
              country: payload.country ?? user.country,
              avatar: payload.avatar ?? user.avatar,
            };
          } catch {
            return user;
          }
        })
      );

      if (!isMounted) {
        return;
      }

      const changed =
        JSON.stringify(currentUsers.map((item) => [item.id, item.faceitElo, item.faceitLevel, item.country, item.avatar])) !==
        JSON.stringify(updatedUsers.map((item) => [item.id, item.faceitElo, item.faceitLevel, item.country, item.avatar]));
      if (changed) {
        await Promise.all(
          updatedUsers.map(async (item, index) => {
            const original = currentUsers[index];
            if (
              original &&
              (original.faceitElo !== item.faceitElo ||
                original.faceitLevel !== item.faceitLevel ||
                original.country !== item.country ||
                original.avatar !== item.avatar)
            ) {
              await patchSiteUser(item.id, {
                faceitElo: item.faceitElo,
                faceitLevel: item.faceitLevel,
                country: item.country,
                avatar: item.avatar,
              });
            }
          })
        );
        window.dispatchEvent(new Event("site-users-changed"));
      }
      setRegisteredPlayers(mapSiteUsersToPlayers(updatedUsers));
    };

    const handleUsersChanged = async () => {
      try {
        const users = await fetchSiteUsers();
        setRegisteredPlayers(mapSiteUsersToPlayers(users));
      } catch {}
    };

    refreshUsersFromFaceit();
    const intervalId = setInterval(refreshUsersFromFaceit, 300000);
    window.addEventListener(SITE_USERS_CHANGED_EVENT, handleUsersChanged);
    window.addEventListener("site-user-session-changed", handleUsersChanged);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener(SITE_USERS_CHANGED_EVENT, handleUsersChanged);
      window.removeEventListener("site-user-session-changed", handleUsersChanged);
    };
  }, []);

  if (selectedPlayer) {
    return (
      <main className="container">
        <button 
          onClick={() => setSelectedPlayer(null)}
          className="mb-8 px-4 py-2 bg-orange-500 text-black font-bold rounded hover:bg-orange-400 transition"
        >
          ← Vissza a listához
        </button>

        <div className="player-profile-new">
          {/* SIDEBAR - Player Info */}
          <div className="player-sidebar-new">
            <div className="profile-image-new">
              <img 
                src={selectedPlayer.pfp} 
                alt={selectedPlayer.name}
                className="profile-img-new"
              />
              <div className="rank-badge-new">#{selectedPlayer.rank}</div>
            </div>

            <div className="player-info-sidebar-new">
              <h1 className="player-name-new">{selectedPlayer.name}</h1>
              <p className={getFaceitStatus(selectedPlayer).className}>{getFaceitStatus(selectedPlayer).label}</p>
              <p className="player-team-new">{selectedPlayer.team}</p>
              <p className="player-country-new">{countryToFlag(selectedPlayer.country)}</p>
              {selectedPlayer.hasFaceit && selectedPlayer.faceitProfileUrl && (
                <p className="player-country-new">
                  FACEIT:{" "}
                  <a href={selectedPlayer.faceitProfileUrl} target="_blank" rel="noreferrer">
                    {selectedPlayer.faceitNickname}
                  </a>
                </p>
              )}
               
              <div className="info-blocks-new">
                <div className="info-block-new">
                  <span className="info-label-new">Rating</span>
                  <span className="info-value-new">{formatStat(selectedPlayer.rating)}</span>
                </div>
                <div className="info-block-new">
                  <span className="info-label-new">K/D</span>
                  <span className="info-value-new">{formatStat(selectedPlayer.kd)}</span>
                </div>
                <div className="info-block-new">
                  <span className="info-label-new">HS %</span>
                  <span className="info-value-new">{formatStat(selectedPlayer.hs, "%")}</span>
                </div>
                <div className="info-block-new">
                  <span className="info-label-new">Total Earnings</span>
                  <span className="info-value-new earnings-new">{selectedPlayer.totalEarnings}</span>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="player-content-new">
            <div className="bio-section-new">
              <h2 className="section-title-new">📝 BIOGRAPHY</h2>
              <p className="bio-text-new">{selectedPlayer.bio}</p>
            </div>

            {/* STATS */}
            {selectedPlayer.hasFaceit ? (
              <div className="stats-section-new">
                <h2 className="section-title-new">📊 FACEIT STATS</h2>
                <div className="stats-grid-new">
                  <div className="stat-card-new">
                    <span className="stat-label-new">ADR</span>
                    <span className="stat-value-new">{formatStat(selectedPlayer.adr)}</span>
                  </div>
                  <div className="stat-card-new">
                    <span className="stat-label-new">Maps Played</span>
                    <span className="stat-value-new">{formatStat(selectedPlayer.maps)}</span>
                  </div>
                  <div className="stat-card-new">
                    <span className="stat-label-new">Wins</span>
                    <span className="stat-value-new">{formatStat(selectedPlayer.wins)}</span>
                  </div>
                  <div className="stat-card-new">
                    <span className="stat-label-new">Losses</span>
                    <span className="stat-value-new">{formatStat(selectedPlayer.losses)}</span>
                  </div>
                  <div className="stat-card-new">
                    <span className="stat-label-new">ELO</span>
                    <span className="stat-value-new">{formatStat(selectedPlayer.faceitElo)}</span>
                  </div>
                  <div className="stat-card-new">
                    <span className="stat-label-new">Level</span>
                    <span className="stat-value-new">{formatStat(selectedPlayer.faceitLevel)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="stats-section-new">
                <h2 className="section-title-new">📊 FACEIT STATS</h2>
                <p className="bio-text-new">Ehhez a játékoshoz nincs FACEIT profil, ezért nincs automatikus stat.</p>
              </div>
            )}

            {/* TROPHIES & EARNINGS */}
            {selectedPlayer.trophies && selectedPlayer.trophies.length > 0 && (
              <div className="trophies-section-new">
                <h2 className="section-title-new">🏆 TOURNAMENT TROPHIES</h2>
                <div className="trophies-list-new">
                  {selectedPlayer.trophies.map((trophy, index) => (
                    <div 
                      key={index}
                      className="trophy-item-new"
                      style={{
                        animation: `slide-up 0.5s ease-out backwards`,
                        animationDelay: `${index * 0.1}s`,
                      }}
                    >
                      <div className="trophy-icon-new">🏆</div>
                      <div className="trophy-info-new">
                        <p className="trophy-name-new">{trophy.name}</p>
                        <p className="trophy-date-new">{trophy.date}</p>
                      </div>
                      <div className="trophy-prize-new">{trophy.prize}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1 className="title">JÁTÉKOSOK</h1>

      <div className="search-container">
        <input
          type="text"
          placeholder="Keress játékosra... (pl: ZywOo, s1mple, niko)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <p className="search-result-count">
            {filteredPlayers.length} játékos talált
          </p>
        )}
      </div>

      {filteredPlayers.length > 0 ? (
        <div className="faceit-rankings-wrap">
          <div className="faceit-rankings-header">EU Rankings</div>
          <table className="faceit-rankings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Country</th>
                <th>Helyezés</th>
                <th>ELO</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={`${player.name}-${player.rank}`}>
                  <td>#{player.rank}</td>
                  <td>
                    <div className="faceit-player-cell">
                      <img src={player.pfp} alt={player.name} className="faceit-player-avatar" />
                      <div>
                        <p className="faceit-player-name">{player.name}</p>
                        <p className={getFaceitStatus(player).className}>{getFaceitStatus(player).label}</p>
                      </div>
                    </div>
                  </td>
                  <td>{countryToFlag(player.country)}</td>
                  <td>
                    <span className="faceit-level-chip">#{player.rank}</span>
                  </td>
                  <td className="faceit-elo-cell">{formatStat(player.faceitElo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-results">
          <p>
            Nincs találat a kereséshez: <strong>{searchQuery}</strong>
          </p>
        </div>
      )}
    </main>
  );
}