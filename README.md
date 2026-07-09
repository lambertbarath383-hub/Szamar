This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Automatikus adatfrissítés (Players / Teams)

Az app már tud külső JSON forrásból automatikusan frissíteni:

- `GET /api/players`
- `GET /api/teams`

Ha nincs külső URL beállítva, fallbackként a helyi `app/data/*.ts` adatokat használja.

### 1) Állítsd be a forrás URL-eket

Hozz létre egy `.env.local` fájlt:

```env
PLAYERS_SOURCE_URL=https://pelda.hu/players.json
TEAMS_SOURCE_URL=https://pelda.hu/teams.json
MATCHES_SOURCE_URL=https://pelda.hu/matches.json
MATCHES_SOURCE_ALLOWED_HOSTS=pelda.hu,cdn.pelda.hu
APP_ADMIN_KEY=valami_eros_admin_kulcs
FACEIT_API_KEY=your_faceit_data_api_key
```

### 2) Elvárt JSON formátum

A források tömböt adjanak vissza, ugyanazzal a mezőszerkezettel, mint:

- `app/data/players.ts` (`players`)
- `app/data/teams.ts` (`teams`)

FACEIT szinkronhoz játékos szinten add meg opcionálisan:

- `faceitNickname` (pl. `ziganyhater`)
- `faceitProfileUrl` (pl. `https://www.faceit.com/en/players/ziganyhater`)

Vagy a `/players` oldalon a "FACEIT profil hozzárendelés játékoshoz" panelben bemásolhatod a FACEIT profil linket, és elmenti a hozzárendelést (localStorage).
Ez admin kulcshoz kötött (`APP_ADMIN_KEY` + böngészőben mentett `admin-key`), így csak admin tudja módosítani.

### 3) Frissülés működése

- API oldalon: fetch `revalidate` 300 mp
- UI oldalon: automatikus újratöltés 5 percenként
- FACEIT stat csak azoknál lesz, akiknél van `faceitNickname`
- Ha nincs FACEIT profil, a játékosnál nem jelenik meg stat
- `MATCHES_SOURCE_URL` esetén a meccsadatból automatikusan frissülnek a játékos/csapat mutatók
- A `/matches` oldalon admin módban megadhatsz matches forrás URL-t (host allowlisttel védve)

Megjegyzés Scope.gg linkhez:
- Az olyan oldallinkek, mint `https://app.scope.gg/matches/...` gyakran Cloudflare challenge mögött vannak, ezért szerver-oldalról közvetlenül nem olvashatók.
- Ilyenkor Scope API / exportált JSON / saját köztes JSON endpoint szükséges.

Így nem kell kézzel szólni minden adatfrissítéshez.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
