export type FaceitOverride = {
  playerName: string;
  faceitProfileUrl: string;
};

export function extractFaceitNickname(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (!value.includes("faceit.com")) {
    return value;
  }

  const match = value.match(/\/players\/([^/?#]+)/i);
  if (!match || !match[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

export function buildFaceitProfileUrl(nickname: string): string {
  return `https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`;
}
