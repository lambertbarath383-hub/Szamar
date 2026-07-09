export type PlayerTrophy = {
  name: string;
  prize: string;
  date: string;
};

export type Player = {
  rank: number;
  name: string;
  team: string;
  rating: number | null;
  kd: number | null;
  country: string;
  pfp: string;
  hs: number | null;
  adr: number | null;
  maps: number | null;
  wins: number | null;
  losses: number | null;
  bio: string;
  totalEarnings: string;
  trophies: PlayerTrophy[];
  faceitNickname?: string;
  faceitProfileUrl?: string;
  hasFaceit?: boolean;
  faceitElo?: number | null;
  faceitLevel?: number | null;
  faceitGame?: "cs2" | "csgo" | null;
  faceitStatsUpdatedAt?: string;
};

export const players: Player[] = [];