import { NextResponse } from "next/server";
import { players, type Player } from "@/app/data/players";
import { enrichPlayerWithFaceit } from "@/app/lib/faceit";
import {
  buildFaceitProfileUrl,
  extractFaceitNickname,
  type FaceitOverride,
} from "@/app/lib/faceit-profile";
import {
  loadMatchesFromSource,
  mergePlayersWithMatches,
  resolveMatchesSourceOverride,
} from "@/app/lib/match-sync";

type PlayersPayload = {
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

export async function GET(request: Request) {
  const sourceUrl = process.env.PLAYERS_SOURCE_URL;
  let basePlayers: Player[] = players;
  let source: "remote" | "fallback" = "fallback";
  let sourceError = "";
  let overridesError = "";
  let matchesError = "";

  if (sourceUrl) {
    try {
      const response = await fetch(sourceUrl, {
        next: { revalidate: 300 },
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Forrás hiba: ${response.status} ${response.statusText}`);
      }

      const remoteData = await response.json();
      if (!Array.isArray(remoteData)) {
        throw new Error("A játékos forrás nem tömb formátumú JSON-t adott vissza.");
      }

      basePlayers = remoteData as Player[];
      source = "remote";
    } catch (error) {
      sourceError = error instanceof Error ? error.message : "Ismeretlen hiba a játékos forrásnál.";
    }
  } else {
    sourceError = "PLAYERS_SOURCE_URL nincs beállítva, fallback adat használva.";
  }

  const overridesRaw = new URL(request.url).searchParams.get("overrides");
  if (overridesRaw) {
    const adminKey = process.env.APP_ADMIN_KEY;
    const providedKey = request.headers.get("x-admin-key") ?? "";
    if (!adminKey || providedKey !== adminKey) {
      overridesError = "Nincs admin jogosultság a FACEIT hozzárendelések módosításához.";
    } else {
      try {
        const parsed = JSON.parse(overridesRaw) as FaceitOverride[];
        if (!Array.isArray(parsed)) {
          throw new Error("Az overrides mező nem tömb.");
        }

        const overrideMap = new Map<string, string>();
        for (const item of parsed) {
          const nickname = extractFaceitNickname(item.faceitProfileUrl);
          if (!nickname || !item.playerName) {
            continue;
          }
          overrideMap.set(item.playerName.trim().toLowerCase(), nickname);
        }

        basePlayers = basePlayers.map((player) => {
          const overrideNickname = overrideMap.get(player.name.trim().toLowerCase());
          if (!overrideNickname) {
            return player;
          }
          return {
            ...player,
            faceitNickname: overrideNickname,
            faceitProfileUrl: buildFaceitProfileUrl(overrideNickname),
          };
        });
      } catch (error) {
        overridesError = error instanceof Error ? error.message : "Hibás overrides JSON.";
      }
    }
  }

  const matchesOverride = resolveMatchesSourceOverride(request);
  const matchesSourceUrl =
    matchesOverride.sourceType === "override" ? matchesOverride.sourceUrl : process.env.MATCHES_SOURCE_URL;
  const hasExplicitMatchesSource = Boolean(matchesSourceUrl);
  if (hasExplicitMatchesSource) {
    const matchesResult = await loadMatchesFromSource(matchesSourceUrl);
    if (matchesOverride.error || matchesResult.error) {
      matchesError = [matchesOverride.error, matchesResult.error].filter(Boolean).join(" | ");
    }

    const failedExplicitSource = matchesResult.source === "fallback" && Boolean(matchesResult.error);
    if (!failedExplicitSource) {
      basePlayers = mergePlayersWithMatches(basePlayers, matchesResult.data);
    }
  }

  const enrichResults = await Promise.all(
    basePlayers.map((player) => enrichPlayerWithFaceit(player, process.env.FACEIT_API_KEY))
  );

  const enrichedPlayers = enrichResults.map((result) => result.player);
  const faceitErrors = enrichResults
    .map((result) => result.error)
    .filter((error): error is string => Boolean(error));

  const allErrors = [sourceError, overridesError, matchesError, ...faceitErrors].filter(Boolean).join(" | ");

  const liveCount = enrichedPlayers.filter((player) => player.hasFaceit && Boolean(player.faceitStatsUpdatedAt)).length;
  const fallbackCount = enrichedPlayers.filter((player) => player.hasFaceit && !player.faceitStatsUpdatedAt).length;
  const noProfileCount = enrichedPlayers.filter((player) => !player.hasFaceit).length;

  const payload: PlayersPayload = {
    data: enrichedPlayers,
    source,
    updatedAt: new Date().toISOString(),
    faceit: {
      configured: Boolean(process.env.FACEIT_API_KEY),
      liveCount,
      fallbackCount,
      noProfileCount,
    },
    ...(allErrors ? { error: allErrors } : {}),
  };

  return NextResponse.json(payload);
}
