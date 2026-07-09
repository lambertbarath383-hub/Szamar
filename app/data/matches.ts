export interface PlayerMatchStats {
  name: string;
  team: string;
  k: number;
  d: number;
  a: number;
  damage: number;
  adr: number;
  adr_diff: number;
  rating: number;
  hs: number;
  kast: number;
  trade_kills: number;
  pfp: string;
}

export interface Match {
  id: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  map: string;
  map_score: string;
  date: string;
  time: string;
  status: "WIN" | "LOSS";
  team1_players: PlayerMatchStats[];
  team2_players: PlayerMatchStats[];
  sourceUrl?: string;
  imageUrl?: string;
}

export const matches: Match[] = [];
