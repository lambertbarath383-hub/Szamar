export type TeamMember = {
  name: string;
  role: string;
};

export type TeamTrophy = {
  name: string;
  prize: string;
  date: string;
};

export type Team = {
  rank: number;
  name: string;
  country: string;
  logo: string;
  rating: number;
  wins: number;
  tournaments: number;
  coach: string;
  totalEarnings: string;
  players: TeamMember[];
  substitutes: TeamMember[];
  founded: number;
  trophies: TeamTrophy[];
};

export const teams: Team[] = [];
