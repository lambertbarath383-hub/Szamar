"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  normalizeHttpUrl,
  readCustomMatchEntriesFromStorage,
  syncCustomMatchEntriesFromServer,
  writeCustomMatchEntriesToStorage,
  type CustomMatchEntry,
} from "@/app/lib/custom-matches";
import {
  normalizeBracketInput,
  readCustomBracketsFromStorage,
  syncCustomBracketsFromServer,
  writeCustomBracketsToStorage,
  type CustomBracketEntry,
} from "@/app/lib/custom-brackets";
import {
  sortUsersByRank,
} from "@/app/lib/site-users";
import { deleteSiteUser, fetchSiteUsers, patchSiteUser, type PublicSiteUser } from "@/app/lib/site-users-api";
import {
  readSiteTeamsFromStorage,
  readTeamInvitesFromStorage,
  syncSiteTeamsFromServer,
  syncTeamInvitesFromServer,
  writeSiteTeamsToStorage,
  writeTeamInvitesToStorage,
  type SiteTeam,
  type TeamInvite,
} from "@/app/lib/site-teams";
import {
  ELO_REQUESTS_CHANGED_EVENT,
  type EloChangeRequest,
} from "@/app/lib/elo-requests";
import { fetchEloRequests, patchEloRequest } from "@/app/lib/elo-requests-api";
import { publishModeratorAction } from "@/app/lib/moderator-actions";
import { APP_MINUTE_REFRESH_EVENT } from "@/app/lib/refresh-cycle";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [isModerator, setIsModerator] = useState<boolean | null>(null); // null = még tölt
  const [matchImageDataUrl, setMatchImageDataUrl] = useState("");
  const [matchImageName, setMatchImageName] = useState("");
  const [matchSourceUrl, setMatchSourceUrl] = useState("");
  const [matchResult, setMatchResult] = useState("");
  const [matchTeam1Name, setMatchTeam1Name] = useState("");
  const [matchTeam2Name, setMatchTeam2Name] = useState("");
  const [customMatches, setCustomMatches] = useState<CustomMatchEntry[]>([]);
  const [bracketUrl, setBracketUrl] = useState("");
  const [bracketName, setBracketName] = useState("");
  const [customBrackets, setCustomBrackets] = useState<CustomBracketEntry[]>([]);
  const [siteUsers, setSiteUsers] = useState<PublicSiteUser[]>([]);
  const [siteTeams, setSiteTeams] = useState<SiteTeam[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [eloRequests, setEloRequests] = useState<EloChangeRequest[]>([]);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingMatchTeam1, setEditingMatchTeam1] = useState("");
  const [editingMatchTeam2, setEditingMatchTeam2] = useState("");
  const [editingMatchResult, setEditingMatchResult] = useState("");
  const [editingMatchUrl, setEditingMatchUrl] = useState("");
  const [editingBracketId, setEditingBracketId] = useState<string | null>(null);
  const [editingBracketName, setEditingBracketName] = useState("");
  const [editingBracketUrl, setEditingBracketUrl] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserElo, setEditingUserElo] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [editingTeamLogo, setEditingTeamLogo] = useState("");
  const [editingTeamTier, setEditingTeamTier] = useState<"1" | "2" | "3">("3");
  const [editingTeamTierRank, setEditingTeamTierRank] = useState("");
  const [message, setMessage] = useState("");
  // per-item loading: ID-k halmaza – csak az érintett gomb töltőre áll
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isKeyVerifying, setIsKeyVerifying] = useState(false);
  // ref: szinkron ellenőrzés re-render nélkül
  const isVerifiedRef = useRef(false);
  const [isModeratorVerified, setIsModeratorVerified] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [newModeratorPassword, setNewModeratorPassword] = useState("");
  const [newAdminKey, setNewAdminKey] = useState("");
  const [configMessage, setConfigMessage] = useState("");
  const [currentModeratorPassword, setCurrentModeratorPassword] = useState("");
  const [currentAdminKey, setCurrentAdminKey] = useState("");

  const startLoading = (id: string) => setLoadingIds((prev) => new Set(prev).add(id));
  const stopLoading = (id: string) => setLoadingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  const isItemLoading = (id: string) => loadingIds.has(id);

  const loadSiteUsers = async (light = false) => {
    const users = await fetchSiteUsers({ light });
    setSiteUsers(users);
    return users;
  };

  const loadEloRequests = async () => {
    const requests = await fetchEloRequests();
    setEloRequests(requests);
    return requests;
  };

  const getModeratorName = (): string => {
    if (typeof window === "undefined") return "Moderátor";
    const raw = window.sessionStorage.getItem("moderator-session");
    if (!raw) return "Moderátor";
    try {
      const parsed = JSON.parse(raw) as { name?: string; isOwner?: boolean };
      if (parsed.isOwner) return "Tulajdonos";
      return parsed.name?.trim() || "Moderátor";
    } catch {
      return "Moderátor";
    }
  };

  useEffect(() => {
    // Ellenőrzés: owner-e a bejelentkezett moderátor
    // Moderátor bejelentkezés ellenőrzése – ha nincs session, nem férhet hozzá
    const rawSession = typeof window !== "undefined" ? window.sessionStorage.getItem("moderator-session") : null;
    if (!rawSession) {
      setIsModerator(false);
      return;
    }
    setIsModerator(true);

    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as { name?: string; isOwner?: boolean };
        if (parsed.isOwner === true) {
          setIsOwner(true);
          // Owner: töltse be az aktuális config értékeket
          fetch("/api/moderator/config?ownerName=Szamar19&ownerPassword=123")
            .then((r) => r.json() as Promise<{ ok?: boolean; config?: { moderatorPassword?: string; adminKey?: string } }>)
            .then((data) => {
              if (data.ok && data.config) {
                setCurrentModeratorPassword(data.config.moderatorPassword ?? "");
                setCurrentAdminKey(data.config.adminKey ?? "");
              }
            })
            .catch(() => {});
        }
      } catch {}
    }

    const loadAdminState = async () => {
      setAdminKey(window.localStorage.getItem("admin-key") ?? "");
      try {
        await Promise.all([
          syncCustomMatchEntriesFromServer(),
          syncCustomBracketsFromServer(),
          syncSiteTeamsFromServer(),
          syncTeamInvitesFromServer(),
        ]);
      } catch {}
      setCustomMatches(readCustomMatchEntriesFromStorage());
      setCustomBrackets(readCustomBracketsFromStorage());
      loadSiteUsers(true).catch(() => {});
      setSiteTeams(readSiteTeamsFromStorage());
      setTeamInvites(readTeamInvitesFromStorage());
      loadEloRequests().catch(() => {});
    };

    const timeoutId = setTimeout(() => {
      loadAdminState().catch(() => {});
    }, 0);
    const onMinuteRefresh = () => {
      loadAdminState().catch(() => {});
    };
    window.addEventListener(APP_MINUTE_REFRESH_EVENT, onMinuteRefresh);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener(APP_MINUTE_REFRESH_EVENT, onMinuteRefresh);
    };
  }, []);

  const verifyModeratorKey = async (key: string): Promise<string | null> => {
    const normalizedAdminKey = key.trim();
    if (!normalizedAdminKey) {
      isVerifiedRef.current = false;
      setIsModeratorVerified(false);
      return "Add meg a moderátor jelszót (kulcsot).";
    }

    // Szinkron gyors ellenőrzés ref-ből – nem kell API hívás
    if (isVerifiedRef.current) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch("/api/moderator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "admin", password: normalizedAdminKey, mode: "adminKey" }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      isVerifiedRef.current = false;
      setIsModeratorVerified(false);
      if (error instanceof DOMException && error.name === "AbortError") {
        return "Időtúllépés a moderátor ellenőrzésnél. Próbáld újra.";
      }
      return "Nem érhető el a moderátor ellenőrzés. Próbáld újra.";
    }
    clearTimeout(timeoutId);

    const payload = (await response.json()) as { ok?: boolean; message?: string };
    if (!response.ok || !payload.ok) {
      isVerifiedRef.current = false;
      setIsModeratorVerified(false);
      return payload.message ?? "Hibás kulcs.";
    }

    window.localStorage.setItem("admin-key", normalizedAdminKey);
    isVerifiedRef.current = true;
    setIsModeratorVerified(true);
    return null;
  };

  const verifyModeratorKeyManually = async () => {
    setMessage("");
    setIsKeyVerifying(true);
    try {
      const keyError = await verifyModeratorKey(adminKey);
      if (keyError) {
        setMessage(keyError);
        return;
      }
      setMessage("Moderátor kulcs ellenőrizve.");
    } finally {
      setIsKeyVerifying(false);
    }
  };

  const addMatch = async () => {
    setMessage("");
    if (!matchImageDataUrl) {
      setMessage("Válassz ki egy meccs képet.");
      return;
    }
    const normalizedSourceUrl = matchSourceUrl.trim()
      ? (normalizeHttpUrl(matchSourceUrl) ?? undefined)
      : undefined;
    if (matchSourceUrl.trim() && !normalizedSourceUrl) {
      setMessage("Érvénytelen forrás link.");
      return;
    }

    if (!isVerifiedRef.current) {
      startLoading("add-match");
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading("add-match");
      if (keyError) { setMessage(keyError); return; }
    }

    const existing = readCustomMatchEntriesFromStorage();
    const duplicate = existing.find((item) => item.imageDataUrl === matchImageDataUrl);
    if (duplicate) { setCustomMatches(existing); setMessage("Ez a kép már hozzá lett adva."); return; }

    const nextEntry: CustomMatchEntry = {
      id: `custom_match_${Date.now()}`,
      imageDataUrl: matchImageDataUrl,
      url: normalizedSourceUrl,
      result: matchResult.trim() || undefined,
      team1Name: matchTeam1Name.trim() || undefined,
      team2Name: matchTeam2Name.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const nextEntries = [nextEntry, ...existing];
    writeCustomMatchEntriesToStorage(nextEntries);
    setCustomMatches(nextEntries);
    setMatchImageDataUrl("");
    setMatchImageName("");
    setMatchSourceUrl("");
    setMatchResult("");
    setMatchTeam1Name("");
    setMatchTeam2Name("");
    setMessage("Új match hozzáadva.");
    publishModeratorAction("új meccset adott hozzá.");
  };

  const handleMatchImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setMatchImageDataUrl("");
      setMatchImageName("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMatchImageDataUrl("");
      setMatchImageName("");
      setMessage("Csak képfájl tölthető fel.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setMatchImageDataUrl(result);
      setMatchImageName(file.name);
      setMessage("");
    };
    reader.onerror = () => {
      setMatchImageDataUrl("");
      setMatchImageName("");
      setMessage("Nem sikerült beolvasni a képet.");
    };
    reader.readAsDataURL(file);
  };

  const removeMatch = async (matchId: string) => {
    setMessage("");
    if (!isVerifiedRef.current) {
      startLoading(`del-match-${matchId}`);
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading(`del-match-${matchId}`);
      if (keyError) { setMessage(keyError); return; }
    }
    const existing = readCustomMatchEntriesFromStorage();
    const nextEntries = existing.filter((item) => item.id !== matchId);
    writeCustomMatchEntriesToStorage(nextEntries);
    setCustomMatches(nextEntries);
    setMessage("Match törölve.");
    publishModeratorAction("törölt egy meccset.");
  };

  const startEditMatch = (item: CustomMatchEntry) => {
    setEditingMatchId(item.id);
    setEditingMatchTeam1(item.team1Name ?? "");
    setEditingMatchTeam2(item.team2Name ?? "");
    setEditingMatchResult(item.result ?? "");
    setEditingMatchUrl(item.url ?? "");
  };

  const cancelEditMatch = () => {
    setEditingMatchId(null);
    setEditingMatchTeam1("");
    setEditingMatchTeam2("");
    setEditingMatchResult("");
    setEditingMatchUrl("");
  };

  const saveMatchEdit = async () => {
    if (!editingMatchId) return;
    setMessage("");
    const normalizedSourceUrl = editingMatchUrl.trim()
      ? (normalizeHttpUrl(editingMatchUrl) ?? undefined)
      : undefined;
    if (editingMatchUrl.trim() && !normalizedSourceUrl) {
      setMessage("Érvénytelen forrás link.");
      return;
    }
    if (!isVerifiedRef.current) {
      startLoading("save-match");
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading("save-match");
      if (keyError) { setMessage(keyError); return; }
    }
    const existing = readCustomMatchEntriesFromStorage();
    const nextEntries = existing.map((item) =>
      item.id === editingMatchId
        ? {
            ...item,
            team1Name: editingMatchTeam1.trim() || undefined,
            team2Name: editingMatchTeam2.trim() || undefined,
            result: editingMatchResult.trim() || undefined,
            url: normalizedSourceUrl,
          }
        : item
    );
    writeCustomMatchEntriesToStorage(nextEntries);
    setCustomMatches(nextEntries);
    cancelEditMatch();
    setMessage("Match szerkesztve.");
    publishModeratorAction(
      `szerkesztett egy meccset (${editingMatchTeam1.trim() || "IMPORTÁLT"} vs ${editingMatchTeam2.trim() || "Ellenfél"}).`
    );
  };

  const addBracket = async () => {
    setMessage("");
    const normalized = normalizeBracketInput(bracketUrl, bracketName);
    if (!normalized) { setMessage("Érvénytelen bracket link."); return; }

    if (!isVerifiedRef.current) {
      startLoading("add-bracket");
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading("add-bracket");
      if (keyError) { setMessage(keyError); return; }
    }

    const existing = readCustomBracketsFromStorage();
    const duplicate = existing.find((item) => item.url.toLowerCase() === normalized.url.toLowerCase());
    if (duplicate) { setCustomBrackets(existing); setMessage("Ez a bracket már hozzá lett adva."); return; }

    const nextEntry: CustomBracketEntry = {
      id: `custom_bracket_${Date.now()}`,
      name: normalized.name,
      url: normalized.url,
      embedUrl: normalized.embedUrl,
      createdAt: new Date().toISOString(),
    };
    const nextEntries = [nextEntry, ...existing];
    writeCustomBracketsToStorage(nextEntries);
    setCustomBrackets(nextEntries);
    setBracketUrl("");
    setBracketName("");
    setMessage("Új bracket hozzáadva.");
    publishModeratorAction(`új bracketet adott hozzá (${normalized.name}).`);
  };

  const removeBracket = async (bracketId: string) => {
    setMessage("");
    if (!isVerifiedRef.current) {
      startLoading(`del-bracket-${bracketId}`);
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading(`del-bracket-${bracketId}`);
      if (keyError) { setMessage(keyError); return; }
    }
    const existing = readCustomBracketsFromStorage();
    const nextEntries = existing.filter((item) => item.id !== bracketId);
    writeCustomBracketsToStorage(nextEntries);
    setCustomBrackets(nextEntries);
    setMessage("Bracket törölve.");
    publishModeratorAction("törölt egy bracketet.");
  };

  const removeSiteUser = async (userId: string) => {
    setMessage("");
    startLoading(`del-user-${userId}`);
    try {
      const keyError = await verifyModeratorKey(adminKey);
      if (keyError) { setMessage(keyError); return; }
      await deleteSiteUser(userId, getModeratorName());
      setSiteUsers((prev) => prev.filter((u) => u.id !== userId));
      window.dispatchEvent(new Event("site-users-changed"));
      setMessage("Felhasználó törölve.");
    } catch {
      setMessage("Hálózati hiba történt.");
    } finally {
      stopLoading(`del-user-${userId}`);
    }
  };

  const startEditUserElo = (item: PublicSiteUser) => {
    setEditingUserId(item.id);
    setEditingUserElo(item.faceitElo !== null && item.faceitElo !== undefined ? String(item.faceitElo) : "");
  };

  const cancelEditUserElo = () => {
    setEditingUserId(null);
    setEditingUserElo("");
  };

  const saveUserElo = async () => {
    if (!editingUserId) return;
    const parsed = editingUserElo.trim() ? Number.parseInt(editingUserElo.trim(), 10) : null;
    if (editingUserElo.trim() && (Number.isNaN(parsed) || (parsed ?? 0) < 0)) {
      setMessage("Az ELO csak pozitív szám lehet.");
      return;
    }
    setMessage("");
    startLoading(`elo-user-${editingUserId}`);
    try {
      const keyError = await verifyModeratorKey(adminKey);
      if (keyError) { setMessage(keyError); return; }
      await patchSiteUser(editingUserId, { faceitElo: parsed }, getModeratorName());
      // Optimista frissítés – nincs re-fetch
      setSiteUsers((prev) => prev.map((u) => u.id === editingUserId ? { ...u, faceitElo: parsed } : u));
      window.dispatchEvent(new Event("site-users-changed"));
      cancelEditUserElo();
      setMessage("Felhasználó ELO szerkesztve.");
    } catch {
      setMessage("Hálózati hiba történt.");
    } finally {
      stopLoading(`elo-user-${editingUserId}`);
    }
  };

  const approveEloRequest = async (requestId: string) => {
    setMessage("");
    startLoading(`approve-${requestId}`);
    try {
      const keyError = await verifyModeratorKey(adminKey);
      if (keyError) { setMessage(keyError); return; }
      const target = eloRequests.find((item) => item.id === requestId);
      if (!target || target.status !== "pending") { setMessage("A kérelem már feldolgozásra került."); return; }
      await patchSiteUser(target.userId, { faceitElo: target.requestedElo }, getModeratorName());
      await patchEloRequest(requestId, {
        status: "approved",
        resolvedAt: new Date().toISOString(),
        reviewedBy: getModeratorName(),
      });
      // Optimista frissítés
      setSiteUsers((prev) => prev.map((u) => u.id === target.userId ? { ...u, faceitElo: target.requestedElo } : u));
      setEloRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "approved" as const } : r));
      window.dispatchEvent(new Event("site-users-changed"));
      window.dispatchEvent(new Event(ELO_REQUESTS_CHANGED_EVENT));
      setMessage("Kérelem elfogadva, ELO frissítve.");
    } catch {
      setMessage("Hálózati hiba történt.");
    } finally {
      stopLoading(`approve-${requestId}`);
    }
  };

  const rejectEloRequest = async (requestId: string) => {
    setMessage("");
    startLoading(`reject-${requestId}`);
    try {
      const keyError = await verifyModeratorKey(adminKey);
      if (keyError) { setMessage(keyError); return; }
      const target = eloRequests.find((item) => item.id === requestId);
      if (!target || target.status !== "pending") { setMessage("A kérelem már feldolgozásra került."); return; }
      await patchEloRequest(requestId, {
        status: "rejected",
        resolvedAt: new Date().toISOString(),
        reviewedBy: getModeratorName(),
      });
      setEloRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "rejected" as const } : r));
      window.dispatchEvent(new Event(ELO_REQUESTS_CHANGED_EVENT));
      setMessage("Kérelem elutasítva.");
    } catch {
      setMessage("Hálózati hiba történt.");
    } finally {
      stopLoading(`reject-${requestId}`);
    }
  };

  const startEditTeam = (team: SiteTeam) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setEditingTeamLogo(team.logo ?? "");
    setEditingTeamTier(String(team.tier) as "1" | "2" | "3");
    setEditingTeamTierRank(team.tierRank ? String(team.tierRank) : "");
  };

  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setEditingTeamName("");
    setEditingTeamLogo("");
    setEditingTeamTier("3");
    setEditingTeamTierRank("");
  };

  const handleAdminTeamLogoSelect = (event: ChangeEvent<HTMLInputElement>) => {
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
      setEditingTeamLogo(value);
      setMessage("");
    };
    reader.onerror = () => {
      setMessage("Nem sikerült beolvasni a képet.");
    };
    reader.readAsDataURL(file);
  };

  const saveTeamEdit = async () => {
    if (!editingTeamId) {
      return;
    }
    const normalizedName = editingTeamName.trim();
    if (!normalizedName) {
      setMessage("A csapat neve nem lehet üres.");
      return;
    }
    const parsedTierValue = Number.parseInt(editingTeamTier, 10);
    if (parsedTierValue !== 1 && parsedTierValue !== 2 && parsedTierValue !== 3) {
      setMessage("Érvénytelen tier.");
      return;
    }
    const parsedTier: 1 | 2 | 3 = parsedTierValue;
    const parsedTierRank = editingTeamTierRank.trim() ? Number.parseInt(editingTeamTierRank.trim(), 10) : null;
    if (parsedTier !== 3 && (parsedTierRank === null || Number.isNaN(parsedTierRank) || parsedTierRank < 1 || parsedTierRank > 8)) {
      setMessage("Tier 1 és Tier 2 esetén a helyezés 1 és 8 között kötelező.");
      return;
    }
    setMessage("");
    if (!isVerifiedRef.current) {
      startLoading("save-team");
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading("save-team");
      if (keyError) { setMessage(keyError); return; }
    }
    const existing = readSiteTeamsFromStorage();
    const nextTeams = existing.map((team) =>
      team.id === editingTeamId
        ? {
            ...team,
            name: normalizedName,
            logo: editingTeamLogo || undefined,
            tier: parsedTier,
            tierRank: parsedTier === 3 ? undefined : parsedTierRank ?? undefined,
          }
        : team
    );
    writeSiteTeamsToStorage(nextTeams);
    setSiteTeams(nextTeams);
    cancelEditTeam();
    setMessage("Csapat szerkesztve.");
    publishModeratorAction(`szerkesztette a ${normalizedName} csapatot (Tier ${parsedTier}).`);
  };

  const removeTeamAsAdmin = async (teamId: string) => {
    setMessage("");
    if (!isVerifiedRef.current) {
      startLoading(`del-team-${teamId}`);
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading(`del-team-${teamId}`);
      if (keyError) { setMessage(keyError); return; }
    }
    const existingTeams = readSiteTeamsFromStorage();
    const existingInvites = readTeamInvitesFromStorage();
    const nextTeams = existingTeams.filter((team) => team.id !== teamId);
    const nextInvites = existingInvites.filter((invite) => invite.teamId !== teamId);
    writeTeamInvitesToStorage(nextInvites);
    writeSiteTeamsToStorage(nextTeams);
    setTeamInvites(nextInvites);
    setSiteTeams(nextTeams);
    if (editingTeamId === teamId) cancelEditTeam();
    setMessage("Csapat törölve.");
    publishModeratorAction("törölt egy csapatot.");
  };

  const transferCaptainAsAdmin = async (teamId: string, newCaptainId: string) => {
    setMessage("");
    if (!isVerifiedRef.current) {
      startLoading(`transfer-${teamId}`);
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading(`transfer-${teamId}`);
      if (keyError) { setMessage(keyError); return; }
    }
    const existing = readSiteTeamsFromStorage();
    const nextTeams = existing.map((team) =>
      team.id === teamId && team.memberUserIds.includes(newCaptainId)
        ? { ...team, ownerUserId: newCaptainId }
        : team
    );
    writeSiteTeamsToStorage(nextTeams);
    setSiteTeams(nextTeams);
    setMessage("Kapitány átadva.");
    publishModeratorAction("kapitányt váltott egy csapatban.");
  };

  const removeTeamMemberAsAdmin = async (teamId: string, memberId: string) => {
    setMessage("");
    if (!isVerifiedRef.current) {
      startLoading(`kick-${teamId}-${memberId}`);
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading(`kick-${teamId}-${memberId}`);
      if (keyError) { setMessage(keyError); return; }
    }
    const existing = readSiteTeamsFromStorage();
    const target = existing.find((team) => team.id === teamId);
    if (!target) { setMessage("A csapat már nem található."); return; }
    if (target.ownerUserId === memberId) { setMessage("A kapitány nem törölhető. Előbb add át a kapitányi szerepet."); return; }
    const nextTeams = existing.map((team) =>
      team.id === teamId
        ? { ...team, memberUserIds: team.memberUserIds.filter((id) => id !== memberId) }
        : team
    );
    writeSiteTeamsToStorage(nextTeams);
    setSiteTeams(nextTeams);
    setMessage("Csapattag eltávolítva.");
    publishModeratorAction("eltávolított egy csapattagot.");
  };

  const rankedUsers = sortUsersByRank(siteUsers);
  const usersWithFaceit = siteUsers.filter((item) => Boolean(item.faceitProfileUrl)).length;
  const pendingEloRequests = eloRequests
    .filter((item) => item.status === "pending")
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  const usersById = new Map(siteUsers.map((user) => [user.id, user] as const));

  const startEditBracket = (item: CustomBracketEntry) => {
    setEditingBracketId(item.id);
    setEditingBracketName(item.name);
    setEditingBracketUrl(item.url);
  };

  const cancelEditBracket = () => {
    setEditingBracketId(null);
    setEditingBracketName("");
    setEditingBracketUrl("");
  };

  const saveBracketEdit = async () => {
    if (!editingBracketId) return;
    setMessage("");
    const normalized = normalizeBracketInput(editingBracketUrl, editingBracketName);
    if (!normalized) { setMessage("Érvénytelen bracket link."); return; }

    if (!isVerifiedRef.current) {
      startLoading("save-bracket");
      const keyError = await verifyModeratorKey(adminKey);
      stopLoading("save-bracket");
      if (keyError) { setMessage(keyError); return; }
    }

    const existing = readCustomBracketsFromStorage();
    const nextEntries = existing.map((item) =>
      item.id === editingBracketId
        ? { ...item, name: normalized.name, url: normalized.url, embedUrl: normalized.embedUrl }
        : item
    );
    writeCustomBracketsToStorage(nextEntries);
    setCustomBrackets(nextEntries);
    cancelEditBracket();
    setMessage("Bracket szerkesztve.");
    publishModeratorAction(`szerkesztett egy bracketet (${normalized.name}).`);
  };

  const saveOwnerConfig = async () => {
    setConfigMessage("");
    if (!newModeratorPassword && !newAdminKey) {
      setConfigMessage("Adj meg legalább egy új értéket.");
      return;
    }
    try {
      const body: Record<string, string> = {
        ownerName: "Szamar19",
        ownerPassword: "123",
      };
      if (newModeratorPassword.trim()) body.moderatorPassword = newModeratorPassword.trim();
      if (newAdminKey.trim()) body.adminKey = newAdminKey.trim();

      const response = await fetch("/api/moderator/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setConfigMessage(payload.message ?? "Hiba a mentésnél.");
        return;
      }
      if (newModeratorPassword.trim()) setCurrentModeratorPassword(newModeratorPassword.trim());
      if (newAdminKey.trim()) setCurrentAdminKey(newAdminKey.trim());
      setNewModeratorPassword("");
      setNewAdminKey("");
      setConfigMessage("Beállítások mentve.");
    } catch {
      setConfigMessage("Hálózati hiba.");
    }
  };

  // Még töltődik – ne villanjon fel semmi
  if (isModerator === null) {
    return <main className="container"><p style={{ color: "#aaa", marginTop: "40px" }}>Betöltés...</p></main>;
  }

  // Nincs bejelentkezve moderátorként
  if (!isModerator) {
    return (
      <main className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
        <h1 style={{ color: "#ce2939", fontSize: "2rem", fontWeight: 900 }}>🔒 Hozzáférés megtagadva</h1>
        <p style={{ color: "#aaa", fontSize: "1rem", textAlign: "center" }}>
          Az admin panelhez moderátorként kell bejelentkezni.
        </p>
        <a
          href="/auth"
          style={{
            display: "inline-block",
            marginTop: "8px",
            padding: "12px 28px",
            background: "#ce2939",
            color: "#fff",
            borderRadius: "8px",
            fontWeight: 700,
            textDecoration: "none",
            fontSize: "1rem",
          }}
        >
          Bejelentkezés
        </a>
      </main>
    );
  }

  return (
    <main className="container">
      <h1 className="title">ADMIN PANEL</h1>
      <div className="panel">
        <h2>Moderátor felület</h2>
        <p>Ugyanazzal a kulccsal (moderátor jelszó) tudsz meccset és bracketet kezelni.</p>
      </div>

      {isOwner && (
        <details className="faceit-linker-panel" style={{ marginTop: "14px", border: "2px solid #e74c3c" }} open>
          <summary style={{ cursor: "pointer", fontWeight: 700, color: "#e74c3c" }}>🔑 Tulajdonos beállítások</summary>
          <div style={{ marginTop: "12px" }}>
            <p style={{ marginBottom: "8px", fontSize: "13px", opacity: 0.8 }}>
              Jelenlegi moderátor jelszó: <strong>{currentModeratorPassword || "—"}</strong>
              &nbsp;|&nbsp;Jelenlegi admin kulcs: <strong>{currentAdminKey || "—"}</strong>
            </p>
            <div className="faceit-linker-row">
              <input
                className="faceit-linker-input"
                placeholder="Új moderátor belépési jelszó"
                value={newModeratorPassword}
                onChange={(e) => setNewModeratorPassword(e.target.value)}
              />
              <input
                className="faceit-linker-input"
                placeholder="Új admin kulcs"
                value={newAdminKey}
                onChange={(e) => setNewAdminKey(e.target.value)}
              />
              <button type="button" className="faceit-linker-btn" onClick={saveOwnerConfig}>
                Mentés
              </button>
            </div>
            {configMessage && <p className="faceit-linker-message" style={{ color: configMessage.includes("mentve") ? "green" : "#e74c3c" }}>{configMessage}</p>}
          </div>
        </details>
      )}

      <div className="faceit-linker-panel" style={{ marginTop: "18px" }}>
        <div className="faceit-linker-row">
          <input
            className="faceit-linker-input"
            placeholder="Kulcs (moderátor jelszó)"
            value={adminKey}
            onChange={(event) => {
              setAdminKey(event.target.value);
              setIsModeratorVerified(false);
            }}
          />
          <button type="button" className="faceit-linker-btn" onClick={verifyModeratorKeyManually} disabled={isKeyVerifying}>
            Kulcs ellenőrzése
          </button>
        </div>
        {message && <p className="faceit-linker-message">{message}</p>}
      </div>

      <details className="faceit-linker-panel" style={{ marginTop: "14px" }} open>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Matches hozzáadása</summary>
        <div className="faceit-linker-row" style={{ marginTop: "12px" }}>
          <input
            className="faceit-linker-input"
            type="file"
            accept="image/*"
            onChange={handleMatchImageSelect}
          />
          <button type="button" className="faceit-linker-btn" onClick={addMatch} disabled={isItemLoading("add-match")}>
            {isItemLoading("add-match") ? "..." : "Hozzáadás"}
          </button>
        </div>
        <div className="faceit-linker-row" style={{ marginTop: "10px" }}>
          <input
            className="faceit-linker-input"
            placeholder="1. csapat neve (opcionális)"
            value={matchTeam1Name}
            onChange={(event) => setMatchTeam1Name(event.target.value)}
          />
          <input
            className="faceit-linker-input"
            placeholder="2. csapat neve (opcionális)"
            value={matchTeam2Name}
            onChange={(event) => setMatchTeam2Name(event.target.value)}
          />
        </div>
        <div className="faceit-linker-row" style={{ marginTop: "10px" }}>
          <input
            className="faceit-linker-input"
            placeholder="Forrás link (opcionális)"
            value={matchSourceUrl}
            onChange={(event) => setMatchSourceUrl(event.target.value)}
          />
          <input
            className="faceit-linker-input"
            placeholder="Eredmény (pl. 13-8 vagy WIN by forfeit)"
            value={matchResult}
            onChange={(event) => setMatchResult(event.target.value)}
          />
        </div>
        {matchImageName && (
          <p className="faceit-linker-message">Kiválasztott kép: {matchImageName}</p>
        )}
        {customMatches.length > 0 && (
          <ul className="faceit-linker-list">
            {customMatches.map((item) => (
              <li key={item.id}>
                <span>
                  {item.imageDataUrl ? "Feltöltött meccs kép" : item.url}
                  <br />
                  {(item.team1Name || item.team2Name) && (
                    <>
                      <strong>Csapatok:</strong> {item.team1Name || "IMPORTÁLT"} vs {item.team2Name || "Ellenfél"}
                      <br />
                    </>
                  )}
                  {item.result && (
                    <>
                      <strong>Eredmény:</strong> {item.result}
                      <br />
                    </>
                  )}
                  {item.url && (
                    <>
                      <strong>Link:</strong> {item.url}
                      <br />
                    </>
                  )}
                  <small>{new Date(item.createdAt).toLocaleString("hu-HU")}</small>
                  {item.imageDataUrl && (
                    <>
                      <br />
                      <img
                        src={item.imageDataUrl}
                        alt="Meccs kép előnézet"
                        style={{ marginTop: "8px", width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px" }}
                      />
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => startEditMatch(item)}
                  aria-label="Match szerkesztése"
                  title="Match szerkesztése"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => removeMatch(item.id)}
                  disabled={isItemLoading(`del-match-${item.id}`)}
                  aria-label="Match törlése"
                  title="Match törlése"
                >
                  🗑
                </button>
                {editingMatchId === item.id && (
                  <div style={{ marginTop: "8px", width: "100%" }}>
                    <div className="faceit-linker-row">
                      <input
                        className="faceit-linker-input"
                        placeholder="1. csapat neve"
                        value={editingMatchTeam1}
                        onChange={(event) => setEditingMatchTeam1(event.target.value)}
                      />
                      <input
                        className="faceit-linker-input"
                        placeholder="2. csapat neve"
                        value={editingMatchTeam2}
                        onChange={(event) => setEditingMatchTeam2(event.target.value)}
                      />
                    </div>
                    <div className="faceit-linker-row" style={{ marginTop: "8px" }}>
                      <input
                        className="faceit-linker-input"
                        placeholder="Eredmény"
                        value={editingMatchResult}
                        onChange={(event) => setEditingMatchResult(event.target.value)}
                      />
                      <input
                        className="faceit-linker-input"
                        placeholder="Forrás link"
                        value={editingMatchUrl}
                        onChange={(event) => setEditingMatchUrl(event.target.value)}
                      />
                    </div>
                    <div className="faceit-linker-row" style={{ marginTop: "8px" }}>
                      <button type="button" className="faceit-linker-btn" onClick={saveMatchEdit} disabled={isItemLoading("save-match")}>
                        Mentés
                      </button>
                      <button type="button" className="faceit-linker-btn" onClick={cancelEditMatch}>
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="faceit-linker-panel" style={{ marginTop: "14px" }} open>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Bracket hozzáadása</summary>
        <div className="faceit-linker-row" style={{ marginTop: "12px" }}>
          <input
            className="faceit-linker-input"
            placeholder="Bracket neve (opcionális)"
            value={bracketName}
            onChange={(event) => setBracketName(event.target.value)}
          />
          <input
            className="faceit-linker-input"
            placeholder="Bracket link (https://...)"
            value={bracketUrl}
            onChange={(event) => setBracketUrl(event.target.value)}
          />
          <button type="button" className="faceit-linker-btn" onClick={addBracket} disabled={isItemLoading("add-bracket")}>
            {isItemLoading("add-bracket") ? "..." : "Hozzáadás"}
          </button>
        </div>
        {customBrackets.length > 0 && (
          <ul className="faceit-linker-list">
            {customBrackets.map((item) => (
              <li key={item.id}>
                <span>
                  {item.name} — {item.url}
                  <br />
                  <small>{new Date(item.createdAt).toLocaleString("hu-HU")}</small>
                </span>
                <button
                  type="button"
                  onClick={() => startEditBracket(item)}
                  aria-label="Bracket szerkesztése"
                  title="Bracket szerkesztése"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => removeBracket(item.id)}
                  disabled={isItemLoading(`del-bracket-${item.id}`)}
                  aria-label="Bracket törlése"
                  title="Bracket törlése"
                >
                  🗑
                </button>
                {editingBracketId === item.id && (
                  <div style={{ marginTop: "8px", width: "100%" }}>
                    <div className="faceit-linker-row">
                      <input
                        className="faceit-linker-input"
                        placeholder="Bracket neve"
                        value={editingBracketName}
                        onChange={(event) => setEditingBracketName(event.target.value)}
                      />
                      <input
                        className="faceit-linker-input"
                        placeholder="Bracket link"
                        value={editingBracketUrl}
                        onChange={(event) => setEditingBracketUrl(event.target.value)}
                      />
                    </div>
                    <div className="faceit-linker-row" style={{ marginTop: "8px" }}>
                      <button type="button" className="faceit-linker-btn" onClick={saveBracketEdit} disabled={isItemLoading("save-bracket")}>
                        Mentés
                      </button>
                      <button type="button" className="faceit-linker-btn" onClick={cancelEditBracket}>
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="faceit-linker-panel" style={{ marginTop: "14px" }} open>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          ELO kérelmek: {pendingEloRequests.length}
        </summary>
        {pendingEloRequests.length === 0 ? (
          <p className="faceit-linker-message" style={{ marginTop: "10px" }}>
            Nincs függő ELO kérelem.
          </p>
        ) : (
          <ul className="faceit-linker-list" style={{ marginTop: "10px" }}>
            {pendingEloRequests.map((request) => {
              const user = usersById.get(request.userId);
              return (
                <li key={request.id}>
                  <span>
                    <strong>{user?.name ?? "Ismeretlen játékos"}</strong>{" "}
                    (<span className={isOwner ? undefined : "email-blurred"}>{user?.email ?? "N/A"}</span>)
                    <br />
                    <strong>Kért ELO:</strong> {request.requestedElo} (max 4 számjegy)
                    <br />
                    <strong>Jelenlegi ELO:</strong> {user?.faceitElo ?? "N/A"}
                    <br />
                    <strong>FACEIT profil:</strong>{" "}
                    {user?.faceitProfileUrl ? (
                      <a href={user.faceitProfileUrl} target="_blank" rel="noreferrer">
                        {user.faceitProfileUrl}
                      </a>
                    ) : (
                      "N/A"
                    )}
                    <br />
                    <small>{new Date(request.createdAt).toLocaleString("hu-HU")}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => approveEloRequest(request.id)}
                    disabled={isItemLoading(`approve-${request.id}`)}
                    aria-label="Kérelem elfogadása"
                    title="Kérelem elfogadása"
                  >
                    ✅
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectEloRequest(request.id)}
                    disabled={isItemLoading(`reject-${request.id}`)}
                    aria-label="Kérelem elutasítása"
                    title="Kérelem elutasítása"
                  >
                    ❌
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </details>

      <details className="faceit-linker-panel" style={{ marginTop: "14px" }} open>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          Regisztrált felhasználók (FACEIT): {usersWithFaceit}
        </summary>
        {rankedUsers.length === 0 ? (
          <p className="faceit-linker-message" style={{ marginTop: "10px" }}>
            Még nincs regisztrált felhasználó.
          </p>
        ) : (
          <ul className="faceit-linker-list" style={{ marginTop: "10px" }}>
            {rankedUsers.map((item, index) => (
              <li key={item.id}>
                <span>
                  #{index + 1} — {item.name} (<span className={isOwner ? undefined : "email-blurred"}>{item.email}</span>)
                  <br />
                  <strong>FACEIT:</strong>{" "}
                  <a href={item.faceitProfileUrl} target="_blank" rel="noreferrer">
                    {item.faceitNickname}
                  </a>
                  <br />
                  <strong>ELO:</strong> {item.faceitElo ?? "N/A"} | <strong>Szint:</strong> {item.faceitLevel ?? "N/A"}
                  <br />
                  <small>{new Date(item.createdAt).toLocaleString("hu-HU")}</small>
                </span>
                <button
                  type="button"
                  onClick={() => startEditUserElo(item)}
                  aria-label="Felhasználó ELO szerkesztése"
                  title="Felhasználó ELO szerkesztése"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => removeSiteUser(item.id)}
                  disabled={isItemLoading(`del-user-${item.id}`)}
                  aria-label="Felhasználó törlése"
                  title="Felhasználó törlése"
                >
                  🗑
                </button>
                {editingUserId === item.id && (
                  <div style={{ marginTop: "8px", width: "100%" }}>
                    <div className="faceit-linker-row">
                      <input
                        className="faceit-linker-input"
                        placeholder="ELO"
                        value={editingUserElo}
                        onChange={(event) => setEditingUserElo(event.target.value)}
                      />
                      <button type="button" className="faceit-linker-btn" onClick={saveUserElo} disabled={isItemLoading(`elo-user-${editingUserId}`)}>
                        Mentés
                      </button>
                      <button type="button" className="faceit-linker-btn" onClick={cancelEditUserElo}>
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="faceit-linker-panel" style={{ marginTop: "14px" }} open>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          Regisztrált csapatok: {siteTeams.length} (Függő meghívók: {teamInvites.filter((item) => item.status === "pending").length})
        </summary>
        {siteTeams.length === 0 ? (
          <p className="faceit-linker-message" style={{ marginTop: "10px" }}>
            Még nincs regisztrált csapat.
          </p>
        ) : (
          <ul className="faceit-linker-list" style={{ marginTop: "10px" }}>
            {siteTeams.map((team) => (
              <li key={team.id}>
                <span>
                  <strong>{team.name}</strong> — Tagok: {team.memberUserIds.length}
                  <br />
                  <strong>Kapitány:</strong> {usersById.get(team.ownerUserId)?.name ?? "Ismeretlen"}
                  <br />
                  <strong>Tier:</strong> {team.tier} {team.tier !== 3 ? `| Helyezés: #${team.tierRank ?? "—"}` : ""}
                  <br />
                  <small>{new Date(team.createdAt).toLocaleString("hu-HU")}</small>
                  {team.logo && (
                    <>
                      <br />
                      <img
                        src={team.logo}
                        alt={`${team.name} logó`}
                        style={{ marginTop: "8px", width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px" }}
                      />
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => startEditTeam(team)}
                  aria-label="Csapat szerkesztése"
                  title="Csapat szerkesztése"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => removeTeamAsAdmin(team.id)}
                  disabled={isItemLoading(`del-team-${team.id}`)}
                  aria-label="Csapat törlése"
                  title="Csapat törlése"
                >
                  🗑
                </button>
                {editingTeamId === team.id && (
                  <div style={{ marginTop: "8px", width: "100%" }}>
                    <div className="faceit-linker-row">
                      <input
                        className="faceit-linker-input"
                        placeholder="Csapat neve"
                        value={editingTeamName}
                        onChange={(event) => setEditingTeamName(event.target.value)}
                      />
                      <input className="faceit-linker-input" type="file" accept="image/*" onChange={handleAdminTeamLogoSelect} />
                    </div>
                    <div className="faceit-linker-row" style={{ marginTop: "8px" }}>
                      <select
                        className="faceit-linker-input"
                        value={editingTeamTier}
                        onChange={(event) => setEditingTeamTier(event.target.value as "1" | "2" | "3")}
                      >
                        <option value="1">Tier 1</option>
                        <option value="2">Tier 2</option>
                        <option value="3">Tier 3</option>
                      </select>
                      <select
                        className="faceit-linker-input"
                        value={editingTeamTier === "3" ? "" : editingTeamTierRank}
                        disabled={editingTeamTier === "3"}
                        onChange={(event) => setEditingTeamTierRank(event.target.value)}
                      >
                        <option value="">Helyezés (1-8)</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((position) => (
                          <option key={position} value={String(position)}>
                            #{position}
                          </option>
                        ))}
                      </select>
                    </div>
                    {editingTeamLogo && (
                      <img
                        src={editingTeamLogo}
                        alt="Csapat logó előnézet"
                        style={{ marginTop: "8px", width: "70px", height: "70px", objectFit: "cover", borderRadius: "8px" }}
                      />
                    )}
                    <div className="faceit-linker-row" style={{ marginTop: "8px" }}>
                      <button type="button" className="faceit-linker-btn" onClick={saveTeamEdit} disabled={isItemLoading("save-team")}>
                        Mentés
                      </button>
                      <button type="button" className="faceit-linker-btn" onClick={cancelEditTeam}>
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ width: "100%", marginTop: "10px" }}>
                  <strong>Tagok:</strong>
                  <ul style={{ marginTop: "6px", listStyle: "none", padding: 0 }}>
                    {team.memberUserIds.map((memberId) => (
                      <li key={memberId} style={{ marginBottom: "6px" }}>
                        <span>
                          {usersById.get(memberId)?.name ?? "Ismeretlen"} {memberId === team.ownerUserId ? "(Kapitány)" : ""}
                        </span>
                        {memberId !== team.ownerUserId && (
                          <span style={{ marginLeft: "8px" }}>
                            <button
                              type="button"
                              className="faceit-linker-btn secondary"
                              onClick={() => transferCaptainAsAdmin(team.id, memberId)}
                              disabled={isItemLoading(`transfer-${team.id}`)}
                            >
                              Kapitány átadás
                            </button>
                            <button
                              type="button"
                              className="faceit-linker-btn secondary"
                              onClick={() => removeTeamMemberAsAdmin(team.id, memberId)}
                              disabled={isItemLoading(`kick-${team.id}-${memberId}`)}
                              style={{ marginLeft: "6px" }}
                            >
                              Tag törlése
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
      </details>
    </main>
  );
}
