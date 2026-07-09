"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import { fetchSiteUsers, patchSiteUser } from "@/app/lib/site-users-api";
import { ELO_REQUESTS_CHANGED_EVENT, type EloChangeRequest } from "@/app/lib/elo-requests";
import { createEloRequest, fetchEloRequests } from "@/app/lib/elo-requests-api";

type SiteUserSession = {
  id: string;
  name: string;
  email: string;
};

const EUROPEAN_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Albania" },
  { code: "AD", name: "Andorra" },
  { code: "AM", name: "Armenia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "XK", name: "Kosovo" },
  { code: "LV", name: "Latvia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "ME", name: "Montenegro" },
  { code: "NL", name: "Netherlands" },
  { code: "MK", name: "North Macedonia" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "SM", name: "San Marino" },
  { code: "RS", name: "Serbia" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" },
  { code: "GB", name: "United Kingdom" },
  { code: "VA", name: "Vatican City" },
];

export default function UserSettingsWidget() {
  const [session, setSession] = useState<SiteUserSession | null>(null);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [avatar, setAvatar] = useState("");
  const [faceitLink, setFaceitLink] = useState("");
  const [hasFaceit, setHasFaceit] = useState(false);
  const [requestedElo, setRequestedElo] = useState("");
  const [pendingEloRequest, setPendingEloRequest] = useState<EloChangeRequest | null>(null);
  const [message, setMessage] = useState("");

  const loadPendingRequest = async (userId: string) => {
    const requests = await fetchEloRequests();
    const pending =
      requests
        .filter((item) => item.userId === userId && item.status === "pending")
        .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0] ?? null;
    setPendingEloRequest(pending);
    return pending;
  };

  useEffect(() => {
    const updateSession = () => {
      const moderatorRaw = window.sessionStorage.getItem("moderator-session");
      if (moderatorRaw) {
        setSession(null);
        setOpen(false);
        return;
      }
      const raw = window.localStorage.getItem("site-user-session");
      if (!raw) {
        setSession(null);
        setOpen(false);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as SiteUserSession;
        setSession(parsed && parsed.id ? parsed : null);
      } catch {
        window.localStorage.removeItem("site-user-session");
        setSession(null);
      }
    };

    updateSession();
    window.addEventListener("site-user-session-changed", updateSession);
    window.addEventListener("moderator-session-changed", updateSession);
    window.addEventListener("storage", updateSession);
    return () => {
      window.removeEventListener("site-user-session-changed", updateSession);
      window.removeEventListener("moderator-session-changed", updateSession);
      window.removeEventListener("storage", updateSession);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchSiteUsers()
        .then((users) => {
          const current = users.find((item) => item.id === session.id);
          setDisplayName((current?.name ?? session.name).trim());
          setCountryCode((current?.manualCountryCode ?? current?.country ?? "").toUpperCase());
          setAvatar(current?.avatar ?? "");
          setFaceitLink(current?.faceitProfileUrl ?? "");
          setHasFaceit(Boolean(current?.faceitNickname));
          loadPendingRequest(session.id).catch(() => setPendingEloRequest(null));
        })
        .catch(() => {
          setDisplayName(session.name.trim());
          setCountryCode("");
          setAvatar("");
          setFaceitLink("");
          setHasFaceit(false);
          setPendingEloRequest(null);
        });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [session]);

  useEffect(() => {
    const updatePending = async () => {
      if (!session) {
        setPendingEloRequest(null);
        return;
      }
      try {
        await loadPendingRequest(session.id);
      } catch {
        setPendingEloRequest(null);
      }
    };
    const onUpdatePending = () => {
      updatePending().catch(() => {});
    };
    onUpdatePending();
    const intervalId = setInterval(onUpdatePending, 60000);
    window.addEventListener(ELO_REQUESTS_CHANGED_EVENT, onUpdatePending);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener(ELO_REQUESTS_CHANGED_EVENT, onUpdatePending);
    };
  }, [session]);

  const onImagePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage("Csak képfájl tölthető fel.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setAvatar(value);
      setMessage("");
    };
    reader.onerror = () => {
      setMessage("Nem sikerült beolvasni a képet.");
    };
    reader.readAsDataURL(file);
  };

  const saveSettings = async () => {
    if (!session) return;
    const nextName = displayName.trim();
    if (!nextName) {
      setMessage("A név megadása kötelező.");
      return;
    }

    const updates: Parameters<typeof patchSiteUser>[1] = {
      name: nextName,
      manualCountryCode: countryCode,
      avatar: avatar,
    };

    // FACEIT link frissítés ha megadták
    const newFaceitLink = faceitLink.trim();
    if (newFaceitLink && !hasFaceit) {
      const { extractFaceitNickname, buildFaceitProfileUrl } = await import("@/app/lib/faceit-profile");
      const nickname = extractFaceitNickname(newFaceitLink);
      if (!nickname) {
        setMessage("Érvénytelen FACEIT profil link.");
        return;
      }
      updates.faceitNickname = nickname;
      updates.faceitProfileUrl = buildFaceitProfileUrl(nickname);
      // ELO lekérés
      try {
        const summaryResponse = await fetch(`/api/faceit/summary?nickname=${encodeURIComponent(nickname)}`, { cache: "no-store" });
        if (summaryResponse.ok) {
          const summary = (await summaryResponse.json()) as { faceitElo?: number | null; faceitLevel?: number | null };
          updates.faceitElo = summary.faceitElo ?? null;
          updates.faceitLevel = summary.faceitLevel ?? null;
        }
      } catch {}
    }

    try {
      await patchSiteUser(session.id, updates);
    } catch {
      setMessage("Nem sikerült menteni a beállításokat.");
      return;
    }
    const nextSession: SiteUserSession = { ...session, name: nextName };
    window.localStorage.setItem("site-user-session", JSON.stringify(nextSession));
    setSession(nextSession);
    if (updates.faceitNickname) setHasFaceit(true);
    window.dispatchEvent(new Event("site-user-session-changed"));
    window.dispatchEvent(new Event("site-users-changed"));
    setMessage("Beállítások mentve.");
  };

  const submitEloRequest = async () => {
    if (!session) return;
    if (!hasFaceit) {
      setMessage("ELO kérelemhez először add meg a FACEIT profilod a beállításokban.");
      return;
    }
    const normalized = requestedElo.trim();
    if (!/^\d{1,4}$/.test(normalized)) {
      setMessage("Az ELO kérés 1-4 számjegy lehet.");
      return;
    }
    const value = Number.parseInt(normalized, 10);
    if (Number.isNaN(value) || value < 0 || value > 9999) {
      setMessage("Az ELO kérés 0 és 9999 között lehet.");
      return;
    }
    try {
      const nextRequest = await createEloRequest({
        id: `elo_req_${Date.now()}`,
        userId: session.id,
        requestedElo: value,
        createdAt: new Date().toISOString(),
      });
      setPendingEloRequest(nextRequest);
      setRequestedElo("");
      setMessage("ELO kérelem elküldve.");
      window.dispatchEvent(new Event(ELO_REQUESTS_CHANGED_EVENT));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Nem sikerült elküldeni az ELO kérelmet.";
      setMessage(messageText);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="user-settings-widget">
      <button type="button" className="user-settings-toggle" onClick={() => setOpen((current) => !current)}>
        Beállítások
      </button>
      {open && (
        <div className="user-settings-panel">
          <p className="user-settings-title">Játékos beállítások</p>
          <input
            className="faceit-linker-input"
            placeholder="Megjelenített név"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <select className="faceit-linker-input" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
            <option value="">Ország kiválasztása</option>
            {EUROPEAN_COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <input className="faceit-linker-input" type="file" accept="image/*" onChange={onImagePick} />
          {avatar && <img src={avatar} alt="Profilkép előnézet" className="user-settings-preview" />}
          {!hasFaceit && (
            <input
              className="faceit-linker-input"
              placeholder="FACEIT profil link hozzáadása (ELO kérelemhez szükséges)"
              value={faceitLink}
              onChange={(event) => setFaceitLink(event.target.value)}
            />
          )}
          {hasFaceit && (
            <p style={{ fontSize: "0.85rem", color: "#86efac", margin: 0 }}>✅ FACEIT profil összekapcsolva</p>
          )}
          <div className="faceit-linker-row">
            <input
              className="faceit-linker-input"
              placeholder="Kérelmezett FACEIT ELO (max 4 számjegy)"
              value={requestedElo}
              onChange={(event) => setRequestedElo(event.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={Boolean(pendingEloRequest)}
            />
            <button
              type="button"
              className="faceit-linker-btn secondary"
              onClick={submitEloRequest}
              disabled={Boolean(pendingEloRequest)}
            >
              ELO kérelem
            </button>
          </div>
          {pendingEloRequest && (
            <p className="faceit-linker-message">Függő ELO kérelmed: {pendingEloRequest.requestedElo}</p>
          )}
          <button type="button" className="faceit-linker-btn" onClick={saveSettings}>
            Mentés
          </button>
          {message && <p className="faceit-linker-message">{message}</p>}
        </div>
      )}
    </div>
  );
}
