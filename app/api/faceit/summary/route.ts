import { NextResponse } from "next/server";

type FaceitProfilePayload = {
  country?: string;
  avatar?: string;
  games?: {
    cs2?: { faceit_elo?: number; skill_level?: number };
    csgo?: { faceit_elo?: number; skill_level?: number };
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  if (!nickname) {
    return NextResponse.json({ ok: false, message: "Hiányzó nickname." }, { status: 400 });
  }

  const apiKey = process.env.FACEIT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "FACEIT API kulcs nincs beállítva." }, { status: 503 });
  }

  const playerResponse = await fetch(`https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 300 },
  });

  if (!playerResponse.ok) {
    return NextResponse.json(
      { ok: false, message: `FACEIT v4 hiba (${playerResponse.status}).` },
      { status: playerResponse.status === 404 ? 404 : 502 }
    );
  }

  const payload = (await playerResponse.json()) as FaceitProfilePayload;
  const selectedGame = payload.games?.cs2 ? "cs2" : payload.games?.csgo ? "csgo" : null;
  const gameStats = selectedGame ? payload.games?.[selectedGame] : undefined;

  return NextResponse.json({
    ok: true,
    faceitElo: gameStats?.faceit_elo ?? null,
    faceitLevel: gameStats?.skill_level ?? null,
    country: payload.country ?? null,
    avatar: payload.avatar ?? null,
    game: selectedGame,
  });
}
