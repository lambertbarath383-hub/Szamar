import { NextResponse } from "next/server";
import { teams, type Team } from "@/app/data/teams";
import {
  loadMatchesFromSource,
  mergeTeamsWithMatches,
  resolveMatchesSourceOverride,
} from "@/app/lib/match-sync";

type TeamsPayload = {
  data: Team[];
  source: "remote" | "fallback";
  error?: string;
  updatedAt: string;
};

export async function GET(request: Request) {
  const sourceUrl = process.env.TEAMS_SOURCE_URL;
  let baseTeams: Team[] = teams;
  let source: "remote" | "fallback" = "fallback";
  let sourceError = "";

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
        throw new Error("A csapat forrás nem tömb formátumú JSON-t adott vissza.");
      }

      baseTeams = remoteData as Team[];
      source = "remote";
    } catch (error) {
      sourceError = error instanceof Error ? error.message : "Ismeretlen hiba a csapat forrásnál.";
    }
  } else {
    sourceError = "TEAMS_SOURCE_URL nincs beállítva, fallback adat használva.";
  }

  const matchesOverride = resolveMatchesSourceOverride(request);
  const matchesSourceUrl =
    matchesOverride.sourceType === "override" ? matchesOverride.sourceUrl : process.env.MATCHES_SOURCE_URL;
  let mergedTeams = baseTeams;
  let matchesError = "";
  const hasExplicitMatchesSource = Boolean(matchesSourceUrl);
  if (hasExplicitMatchesSource) {
    const matchesResult = await loadMatchesFromSource(matchesSourceUrl);
    if (matchesOverride.error || matchesResult.error) {
      matchesError = [matchesOverride.error, matchesResult.error].filter(Boolean).join(" | ");
    }

    const failedExplicitSource = matchesResult.source === "fallback" && Boolean(matchesResult.error);
    if (!failedExplicitSource) {
      mergedTeams = mergeTeamsWithMatches(baseTeams, matchesResult.data);
    }
  }

  const allErrors = [sourceError, matchesError].filter(Boolean).join(" | ");

  const payload: TeamsPayload = {
    data: mergedTeams,
    source,
    updatedAt: new Date().toISOString(),
    ...(allErrors ? { error: allErrors } : {}),
  };
  return NextResponse.json(payload);
}
