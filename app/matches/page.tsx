'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { matches } from '@/app/data/matches';
import type { Match, PlayerMatchStats } from '@/app/data/matches';
import {
  CUSTOM_MATCHES_CHANGED_EVENT,
  customMatchEntryToMatch,
  readCustomMatchEntriesFromStorage,
  syncCustomMatchEntriesFromServer,
} from '@/app/lib/custom-matches';
import { APP_MINUTE_REFRESH_EVENT } from "@/app/lib/refresh-cycle";

export default function MatchesPage() {
  const [customMatches, setCustomMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const matchesData = useMemo(() => [...customMatches, ...matches], [customMatches]);

  useEffect(() => {
    const loadCustomMatches = async () => {
      try {
        await syncCustomMatchEntriesFromServer();
      } catch {}
      const entries = readCustomMatchEntriesFromStorage();
      setCustomMatches(entries.map(customMatchEntryToMatch));
    };

    const timeoutId = setTimeout(() => {
      loadCustomMatches().catch(() => {});
    }, 0);
    const onCustomMatchesChanged = () => {
      loadCustomMatches().catch(() => {});
    };
    const onMinuteRefresh = () => {
      loadCustomMatches().catch(() => {});
    };
    window.addEventListener(CUSTOM_MATCHES_CHANGED_EVENT, onCustomMatchesChanged);
    window.addEventListener(APP_MINUTE_REFRESH_EVENT, onMinuteRefresh);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener(CUSTOM_MATCHES_CHANGED_EVENT, onCustomMatchesChanged);
      window.removeEventListener(APP_MINUTE_REFRESH_EVENT, onMinuteRefresh);
    };
  }, []);

  if (selectedMatch) {
    return (
      <MatchDetailView
        match={selectedMatch}
        onBack={() => setSelectedMatch(null)}
      />
    );
  }

  return (
    <main className="container matches-page">
      <h1 className="title">MECCSEK</h1>

      <section className="matches-grid">
        {matchesData.length === 0 && (
          <div className="search-result-count">
            <p>Még nincs hozzáadott meccs. Admin Panelen tudsz újat felvenni.</p>
          </div>
        )}
        {matchesData.map((match, index) => (
          <article key={match.id} className="match-card" style={{ animationDelay: `${index * 0.08}s` }}>
            <button type="button" className="match-card-main" onClick={() => setSelectedMatch(match)}>
              <div className="match-card-meta">
                <span>{match.date}</span>
                <span>{match.map}</span>
              </div>

              <div className="match-card-teams">
                <span className="match-team">{match.team1}</span>
                <span className="match-score">
                  {match.score1} | {match.score2}
                </span>
                <span className="match-team right">{match.team2}</span>
              </div>

              <p className="match-map-score">{match.map_score}</p>
              {match.imageUrl && (
                <img
                  src={match.imageUrl}
                  alt="Feltöltött meccs kép előnézet"
                  style={{ marginTop: "10px", width: "100%", maxHeight: "180px", objectFit: "cover", borderRadius: "8px" }}
                />
              )}
            </button>

            <div className="match-card-actions">
              <button type="button" className="matches-link-btn" onClick={() => setSelectedMatch(match)}>
                Részletei
              </button>
              {match.sourceUrl && (
                <a href={match.sourceUrl} target="_blank" rel="noreferrer" className="matches-link-btn secondary">
                  Link
                </a>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function MatchDetailView({
  match,
  onBack,
}: {
  match: Match;
  onBack: () => void;
}) {
  return (
    <main className="container matches-page">
      <button type="button" onClick={onBack} className="matches-back-btn">
        ← Vissza
      </button>

      <section className="match-detail-header">
        <div className="match-detail-team">
          <p className="name">{match.team1}</p>
          <p className="sub">{match.date}</p>
        </div>
        <div className="match-detail-score">
          <p className="map">{match.map}</p>
          <p className="score">
            {match.score1} | {match.score2}
          </p>
          <p className="sub">{match.map_score}</p>
        </div>
        <div className="match-detail-team right">
          <p className="name">{match.team2}</p>
          <p className="sub">{match.time}</p>
        </div>
      </section>

      {(match.team1_players.length > 0 || match.team2_players.length > 0) && (
        <section className="match-stats-grid">
          <TeamStatsTable team={match.team1} players={match.team1_players} winner={match.score1 > match.score2} />
          <TeamStatsTable team={match.team2} players={match.team2_players} winner={match.score2 > match.score1} />
        </section>
      )}

      <MatchMediaSection imageUrl={match.imageUrl ?? ""} activeMatchLink={match.sourceUrl ?? ""} />
    </main>
  );
}

function MatchMediaSection({
  imageUrl,
  activeMatchLink,
}: {
  imageUrl: string;
  activeMatchLink: string;
}) {
  if (imageUrl) {
    return (
      <section className="matches-embed">
        <div className="matches-embed-head">
          <p>Feltöltött meccs kép</p>
          {activeMatchLink && (
            <a href={activeMatchLink} target="_blank" rel="noreferrer" className="matches-link-btn">
              Forrás megnyitása
            </a>
          )}
        </div>
        <img
          src={imageUrl}
          alt="Feltöltött meccs kép"
          style={{ width: "100%", maxHeight: "720px", objectFit: "contain", background: "#050505", borderRadius: "8px" }}
        />
      </section>
    );
  }

  if (!activeMatchLink) {
    return (
      <section className="matches-embed">
        <div className="matches-embed-head">
          <p>Nincs beállított beágyazott link.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="matches-embed">
      <div className="matches-embed-head">
        <p>Beágyazott meccs/link nézet</p>
        <a href={activeMatchLink} target="_blank" rel="noreferrer" className="matches-link-btn">
          Megnyitás új lapon
        </a>
      </div>
      <iframe
        title="Beágyazott meccs link nézet"
        src={activeMatchLink}
        width="100%"
        height="620"
        loading="lazy"
        style={{ border: 0, background: '#050505' }}
      />
      <p className="search-result-count" style={{ marginTop: "10px" }}>
        Ez a beágyazás a hozzáadott match linkből jön.
      </p>
    </section>
  );
}

function TeamStatsTable({
  team,
  players,
  winner,
}: {
  team: string;
  players: PlayerMatchStats[];
  winner: boolean;
}) {
  return (
    <article className="team-stats-card">
      <div className={`team-stats-head ${winner ? 'win' : 'loss'}`}>
        <p>
          {winner ? 'WIN' : 'LOSS'} — {team}
        </p>
      </div>

      <div className="team-stats-table-wrap">
        <table className="team-stats-table">
          <thead>
            <tr>
              <th>JÁTÉKOS</th>
              <th>K</th>
              <th>D</th>
              <th>A</th>
              <th>DMG</th>
              <th>ADR</th>
              <th>RATING</th>
              <th>HS%</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, idx) => (
              <tr key={player.name} style={{ animationDelay: `${idx * 0.05}s` }}>
                <td>
                  <div className="team-stats-player">
                    <img src={player.pfp} alt={player.name} className="team-stats-avatar" />
                    <span>{player.name}</span>
                  </div>
                </td>
                <td>{player.k}</td>
                <td>{player.d}</td>
                <td>{player.a}</td>
                <td>{player.damage}</td>
                <td>{player.adr}</td>
                <td>{player.rating.toFixed(2)}</td>
                <td>{player.hs}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}