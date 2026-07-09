import type { Player } from "@/app/data/players";

type FaceitGame = "cs2" | "csgo";

type FaceitPlayerResponse = {
  player_id: string;
  games?: {
    cs2?: {
      faceit_elo?: number;
      skill_level?: number;
    };
    csgo?: {
      faceit_elo?: number;
      skill_level?: number;
    };
  };
};

type FaceitStatsResponse = {
  lifetime?: Record<string, string>;
};

type EnrichResult = {
  player: Player;
  error?: string;
};

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(",", ".").replace("%", "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullStats(player: Player): Player {
  return {
    ...player,
    rating: null,
    kd: null,
    hs: null,
    adr: null,
    maps: null,
    wins: null,
    losses: null,
    faceitElo: null,
    faceitLevel: null,
    faceitGame: null,
    faceitStatsUpdatedAt: undefined,
  };
}

async function faceitGetPlayerByNickname(nickname: string, apiKey: string): Promise<FaceitPlayerResponse> {
  const response = await fetch(
    `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    throw new Error(`FACEIT player API hiba (${nickname}): ${response.status}`);
  }

  return (await response.json()) as FaceitPlayerResponse;
}

async function faceitGetStats(playerId: string, game: FaceitGame, apiKey: string): Promise<FaceitStatsResponse> {
  const response = await fetch(
    `https://open.faceit.com/data/v4/players/${encodeURIComponent(playerId)}/stats/${game}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    throw new Error(`FACEIT stats API hiba (${game}): ${response.status}`);
  }

  return (await response.json()) as FaceitStatsResponse;
}

export async function enrichPlayerWithFaceit(player: Player, apiKey?: string): Promise<EnrichResult> {
  if (!player.faceitNickname) {
    return {
      player: {
        ...nullStats(player),
        hasFaceit: false,
      },
    };
  }

  if (!apiKey) {
    return {
      player: {
        ...player,
        hasFaceit: true,
        faceitProfileUrl: player.faceitProfileUrl ?? `https://www.faceit.com/en/players/${player.faceitNickname}`,
      },
      error: `FACEIT_API_KEY nincs beállítva (${player.name}).`,
    };
  }

  try {
    const faceitPlayer = await faceitGetPlayerByNickname(player.faceitNickname, apiKey);

    const cs2Available = Boolean(faceitPlayer.games?.cs2);
    const selectedGame: FaceitGame = cs2Available ? "cs2" : "csgo";

    const statsResponse = await faceitGetStats(faceitPlayer.player_id, selectedGame, apiKey);
    const lifetime = statsResponse.lifetime ?? {};

    const matches = parseNumber(lifetime.Matches) ?? parseNumber(lifetime["Total Matches"]);
    const winRate = parseNumber(lifetime["Win Rate %"]) ?? parseNumber(lifetime["Win Rate"]);
    const wins = matches !== null && winRate !== null ? Math.round((matches * winRate) / 100) : null;
    const losses = matches !== null && wins !== null ? Math.max(matches - wins, 0) : null;

    const kd =
      parseNumber(lifetime["Average K/D Ratio"]) ??
      parseNumber(lifetime["K/D Ratio"]) ??
      parseNumber(lifetime["Average K/D"]);

    const enriched: Player = {
      ...player,
      hasFaceit: true,
      faceitProfileUrl: player.faceitProfileUrl ?? `https://www.faceit.com/en/players/${player.faceitNickname}`,
      faceitElo: faceitPlayer.games?.[selectedGame]?.faceit_elo ?? null,
      faceitLevel: faceitPlayer.games?.[selectedGame]?.skill_level ?? null,
      faceitGame: selectedGame,
      faceitStatsUpdatedAt: new Date().toISOString(),
      rating: kd,
      kd,
      hs: parseNumber(lifetime["Average Headshots %"]) ?? parseNumber(lifetime["Headshots %"]),
      adr: parseNumber(lifetime["Average ADR"]) ?? parseNumber(lifetime.ADR),
      maps: matches,
      wins,
      losses,
    };

    return { player: enriched };
  } catch (error) {
    return {
      player: {
        ...player,
        hasFaceit: true,
        faceitProfileUrl: player.faceitProfileUrl ?? `https://www.faceit.com/en/players/${player.faceitNickname}`,
      },
      error: error instanceof Error ? error.message : `Ismeretlen FACEIT hiba (${player.name}).`,
    };
  }
}
