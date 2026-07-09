import { NextResponse } from "next/server";
import type { Match } from "@/app/data/matches";
import { loadMatchesFromSource, resolveMatchesSourceOverride } from "@/app/lib/match-sync";

type MatchesPayload = {
  data: Match[];
  source: "fallback" | "remote" | "override";
  error?: string;
  updatedAt: string;
};

export async function GET(request: Request) {
  const override = resolveMatchesSourceOverride(request);
  const sourceUrl = override.sourceType === "override" ? override.sourceUrl : process.env.MATCHES_SOURCE_URL;
  const result = await loadMatchesFromSource(sourceUrl);

  const payload: MatchesPayload = {
    data: result.data,
    source: override.sourceType === "override" && result.source !== "fallback" ? "override" : result.source,
    updatedAt: new Date().toISOString(),
    ...([override.error, result.error].filter(Boolean).join(" | ")
      ? { error: [override.error, result.error].filter(Boolean).join(" | ") }
      : {}),
  };

  return NextResponse.json(payload);
}
