import { matches as fallbackMatches, type Match, type PlayerMatchStats } from "@/app/data/matches";
import type { Player } from "@/app/data/players";
import type { Team } from "@/app/data/teams";

type MatchesLoadResult = {
  data: Match[];
  source: "fallback" | "remote" | "override";
  error?: string;
};

type PlayerAggregate = {
  name: string;
  team: string;
  pfp: string;
  k: number;
  d: number;
  adrSum: number;
  hsSum: number;
  ratingSum: number;
  maps: number;
  wins: number;
  losses: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseAllowedHosts(): Set<string> {
  const raw = process.env.MATCHES_SOURCE_ALLOWED_HOSTS;
  if (!raw) {
    return new Set<string>();
  }
  return new Set(
    raw
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function validateSourceUrl(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "A matches forrás URL csak http/https lehet.";
    }

    const allowedHosts = parseAllowedHosts();
    if (allowedHosts.size > 0 && !allowedHosts.has(parsed.hostname.toLowerCase())) {
      return `A forrás host nem engedélyezett: ${parsed.hostname}`;
    }
    return null;
  } catch {
    return "Érvénytelen matches forrás URL.";
  }
}

export async function loadMatchesFromSource(sourceUrl?: string): Promise<MatchesLoadResult> {
  if (!sourceUrl) {
    return {
      data: fallbackMatches,
      source: "fallback",
      error: "MATCHES_SOURCE_URL nincs beállítva, fallback adat használva.",
    };
  }

  const validationError = validateSourceUrl(sourceUrl);
  if (validationError) {
    return { data: fallbackMatches, source: "fallback", error: validationError };
  }

  try {
    const parsedSourceUrl = new URL(sourceUrl);
    const response = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      const cfMitigated = response.headers.get("cf-mitigated");
      if (response.status === 403 && parsedSourceUrl.hostname.includes("scope.gg") && cfMitigated) {
        throw new Error(
          "A Scope.gg link Cloudflare challenge mögött van (403), ezért a szerver nem tudja közvetlenül beolvasni. Adj meg Scope API/JSON export linket vagy saját köztes JSON endpointot."
        );
      }
      throw new Error(`Forrás hiba: ${response.status} ${response.statusText}`);
    }
    const remoteData = await response.json();
    let normalizedMatches: Match[];

    if (Array.isArray(remoteData)) {
      normalizedMatches = remoteData as Match[];
    } else if (remoteData && typeof remoteData === "object") {
      const candidate = remoteData as Match;
      const hasMatchShape =
        typeof candidate.id === "string" &&
        typeof candidate.team1 === "string" &&
        typeof candidate.team2 === "string" &&
        Array.isArray(candidate.team1_players) &&
        Array.isArray(candidate.team2_players);

      if (!hasMatchShape) {
        throw new Error("A meccs forrás formátuma nem támogatott (várt: Match[] vagy Match).");
      }

      normalizedMatches = [candidate];
    } else {
      throw new Error("A meccs forrás formátuma nem támogatott.");
    }

    return { data: normalizedMatches, source: "remote" };
  } catch (error) {
    return {
      data: fallbackMatches,
      source: "fallback",
      error: error instanceof Error ? error.message : "Ismeretlen matches forrás hiba.",
    };
  }
}

export function resolveMatchesSourceOverride(
  request: Request
): { sourceUrl?: string; sourceType: "default" | "override"; error?: string } {
  const url = new URL(request.url);
  const override = url.searchParams.get("matchesSource");
  if (!override) {
    return { sourceType: "default" };
  }

  const adminKey = process.env.APP_ADMIN_KEY;
  const providedKey = request.headers.get("x-admin-key") ?? "";
  if (!adminKey || providedKey !== adminKey) {
    return {
      sourceType: "default",
      error: "Nincs admin jogosultság a matchesSource felülíráshoz.",
    };
  }

  const validationError = validateSourceUrl(override);
  if (validationError) {
    return {
      sourceType: "default",
      error: validationError,
    };
  }

  return { sourceType: "override", sourceUrl: override };
}

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

function collectPlayerAggregates(matches: Match[]): Map<string, PlayerAggregate> {
  const map = new Map<string, PlayerAggregate>();

  const consume = (player: PlayerMatchStats, won: boolean) => {
    const key = normalizePlayerName(player.name);
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        name: player.name,
        team: player.team,
        pfp: player.pfp,
        k: player.k,
        d: player.d,
        adrSum: player.adr,
        hsSum: player.hs,
        ratingSum: player.rating,
        maps: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
      });
      return;
    }
    current.team = player.team;
    current.pfp = player.pfp || current.pfp;
    current.k += player.k;
    current.d += player.d;
    current.adrSum += player.adr;
    current.hsSum += player.hs;
    current.ratingSum += player.rating;
    current.maps += 1;
    current.wins += won ? 1 : 0;
    current.losses += won ? 0 : 1;
  };

  for (const match of matches) {
    const team1Won = match.score1 > match.score2;
    for (const player of match.team1_players) {
      consume(player, team1Won);
    }
    for (const player of match.team2_players) {
      consume(player, !team1Won);
    }
  }

  return map;
}

export function mergePlayersWithMatches(basePlayers: Player[], matches: Match[]): Player[] {
  const aggregates = collectPlayerAggregates(matches);
  const merged = basePlayers.map((player) => {
    const agg = aggregates.get(normalizePlayerName(player.name));
    if (!agg) {
      return player;
    }

    const kd = agg.d > 0 ? round2(agg.k / agg.d) : round2(agg.k);
    return {
      ...player,
      team: agg.team || player.team,
      pfp: agg.pfp || player.pfp,
      rating: round2(agg.ratingSum / agg.maps),
      kd,
      hs: round2(agg.hsSum / agg.maps),
      adr: round2(agg.adrSum / agg.maps),
      maps: agg.maps,
      wins: agg.wins,
      losses: agg.losses,
      hasFaceit: Boolean(player.faceitNickname),
    };
  });

  const knownNames = new Set(merged.map((player) => normalizePlayerName(player.name)));
  let nextRank = merged.length + 1;

  for (const agg of aggregates.values()) {
    const key = normalizePlayerName(agg.name);
    if (knownNames.has(key)) {
      continue;
    }
    const kd = agg.d > 0 ? round2(agg.k / agg.d) : round2(agg.k);
    merged.push({
      rank: nextRank++,
      name: agg.name,
      team: agg.team,
      rating: round2(agg.ratingSum / agg.maps),
      kd,
      country: "Unknown",
      pfp: agg.pfp || "https://via.placeholder.com/150?text=Player",
      hs: round2(agg.hsSum / agg.maps),
      adr: round2(agg.adrSum / agg.maps),
      maps: agg.maps,
      wins: agg.wins,
      losses: agg.losses,
      bio: "Automatikusan meccsadatból szinkronizált játékos.",
      totalEarnings: "$0",
      trophies: [],
      hasFaceit: false,
    });
  }

  return merged;
}

export function mergeTeamsWithMatches(baseTeams: Team[], matches: Match[]): Team[] {
  const teamMap = new Map<string, Team>();
  const normalize = (name: string) => name.trim().toLowerCase();

  for (const team of baseTeams) {
    teamMap.set(normalize(team.name), team);
  }

  const stats = new Map<
    string,
    { wins: number; losses: number; ratingSum: number; playerCount: number; players: Set<string> }
  >();

  const getStats = (teamName: string) => {
    const key = normalize(teamName);
    const current = stats.get(key);
    if (current) {
      return current;
    }
    const created = { wins: 0, losses: 0, ratingSum: 0, playerCount: 0, players: new Set<string>() };
    stats.set(key, created);
    return created;
  };

  for (const match of matches) {
    const team1Won = match.score1 > match.score2;
    const team1Stats = getStats(match.team1);
    const team2Stats = getStats(match.team2);

    team1Stats.wins += team1Won ? 1 : 0;
    team1Stats.losses += team1Won ? 0 : 1;
    team2Stats.wins += team1Won ? 0 : 1;
    team2Stats.losses += team1Won ? 1 : 0;

    for (const player of match.team1_players) {
      team1Stats.ratingSum += player.rating;
      team1Stats.playerCount += 1;
      team1Stats.players.add(player.name);
    }
    for (const player of match.team2_players) {
      team2Stats.ratingSum += player.rating;
      team2Stats.playerCount += 1;
      team2Stats.players.add(player.name);
    }
  }

  const merged = baseTeams.map((team) => {
    const teamStats = stats.get(normalize(team.name));
    if (!teamStats) {
      return team;
    }

    const computedRating =
      teamStats.playerCount > 0 ? round2(teamStats.ratingSum / teamStats.playerCount) : team.rating;

    return {
      ...team,
      rating: computedRating,
      wins: teamStats.wins,
      tournaments: Math.max(teamStats.wins + teamStats.losses, team.tournaments),
    };
  });

  const known = new Set(merged.map((team) => normalize(team.name)));
  let nextRank = merged.length + 1;
  for (const [key, teamStats] of stats.entries()) {
    if (known.has(key)) {
      continue;
    }
    const teamName = matches.find((match) => normalize(match.team1) === key)?.team1 ??
      matches.find((match) => normalize(match.team2) === key)?.team2 ??
      key;
    const players = Array.from(teamStats.players).slice(0, 5).map((name) => ({ name, role: "Player" }));
    merged.push({
      rank: nextRank++,
      name: teamName,
      country: "Unknown",
      logo: "https://via.placeholder.com/200?text=TEAM",
      rating: teamStats.playerCount > 0 ? round2(teamStats.ratingSum / teamStats.playerCount) : 1,
      wins: teamStats.wins,
      tournaments: teamStats.wins + teamStats.losses,
      coach: "Unknown",
      totalEarnings: "$0",
      players,
      substitutes: [],
      founded: 2026,
      trophies: [],
    });
  }

  return merged;
}
