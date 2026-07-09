"use client";

import { useMemo, useState } from "react";
import { buildFaceitProfileUrl, extractFaceitNickname } from "@/app/lib/faceit-profile";
import { type SiteUser } from "@/app/lib/site-users";

type FaceitSummaryResponse = {
  ok?: boolean;
  faceitElo?: number | null;
  faceitLevel?: number | null;
  country?: string | null;
  avatar?: string | null;
};

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerFaceitLink, setRegisterFaceitLink] = useState("");

  const [moderatorName, setModeratorName] = useState("");
  const [moderatorPassword, setModeratorPassword] = useState("");

  const titleText = useMemo(
    () => (mode === "login" ? "Bejelentkezés felhasználóként" : "Regisztráció"),
    [mode]
  );

  const isModeratorSessionActive = () => {
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean(window.localStorage.getItem("moderator-session"));
  };

  const isUserSessionActive = () => {
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean(window.localStorage.getItem("site-user-session"));
  };

  const handleRegister = async () => {
    setMessage("");
    if (isModeratorSessionActive()) {
      setMessage("Moderátorként már be vagy jelentkezve. Előbb jelentkezz ki.");
      return;
    }
    const name = registerName.trim();
    const email = registerEmail.trim().toLowerCase();
    const password = registerPassword;
    const confirmPassword = registerConfirmPassword;
    const faceitInput = registerFaceitLink.trim();

    if (!name || !email || !password || !confirmPassword || !faceitInput) {
      setMessage("Minden mező kitöltése kötelező.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("A jelszavak nem egyeznek.");
      return;
    }

    const nickname = extractFaceitNickname(faceitInput);
    if (!nickname) {
      setMessage("Érvénytelen FACEIT profil link.");
      return;
    }

    setIsLoading(true);
    try {
      let faceitElo: number | null = null;
      let faceitLevel: number | null = null;
      let country: string | undefined;
      let avatar: string | undefined;
      try {
        const summaryResponse = await fetch(`/api/faceit/summary?nickname=${encodeURIComponent(nickname)}`, {
          cache: "no-store",
        });
        if (summaryResponse.ok) {
          const summary = (await summaryResponse.json()) as FaceitSummaryResponse;
          faceitElo = summary.faceitElo ?? null;
          faceitLevel = summary.faceitLevel ?? null;
          country = summary.country ?? undefined;
          avatar = summary.avatar ?? undefined;
        }
      } catch {}

      const nextUser: SiteUser = {
        id: `user_${Date.now()}`,
        name,
        email,
        password,
        faceitProfileUrl: buildFaceitProfileUrl(nickname),
        faceitNickname: nickname,
        faceitElo,
        faceitLevel,
        country,
        avatar,
        createdAt: new Date().toISOString(),
      };

      const response = await fetch("/api/site-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...nextUser,
          mode: "register",
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Sikertelen regisztráció.");
        return;
      }
      window.localStorage.setItem(
        "site-user-session",
        JSON.stringify({ id: nextUser.id, name: nextUser.name, email: nextUser.email })
      );
      window.dispatchEvent(new Event("site-user-session-changed"));
      window.dispatchEvent(new Event("site-users-changed"));
      setMessage(`Sikeres regisztráció: ${nextUser.name}`);
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setRegisterFaceitLink("");
      setMode("login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setMessage("");
    if (isModeratorSessionActive()) {
      setMessage("Moderátorként már be vagy jelentkezve. Előbb jelentkezz ki.");
      return;
    }
    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword;
    if (!email || !password) {
      setMessage("Add meg az e-mail címet és a jelszót.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/site-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "login",
          email,
          password,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        user?: { id: string; name: string; email: string };
        message?: string;
      };
      if (!response.ok || !payload.ok || !payload.user) {
        setMessage(payload.message ?? "Hibás e-mail vagy jelszó.");
        return;
      }
      const user = payload.user;

      window.localStorage.setItem(
        "site-user-session",
        JSON.stringify({ id: user.id, name: user.name, email: user.email })
      );
      window.dispatchEvent(new Event("site-user-session-changed"));
      setMessage(`Sikeres bejelentkezés: ${user.name}`);
      setLoginPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeratorLogin = async () => {
    setMessage("");
    if (isUserSessionActive()) {
      setMessage("Felhasználóként már be vagy jelentkezve. Előbb jelentkezz ki.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/moderator/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: moderatorName,
          password: moderatorPassword,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; isOwner?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Hibás moderátor jelszó.");
        return;
      }

      const isOwner = payload.isOwner === true;
      const sessionName = moderatorName.trim() || "Moderátor";
      const nextSession = { name: sessionName, isOwner };
      window.localStorage.setItem("moderator-session", JSON.stringify(nextSession));

      if (isOwner) {
        // Owner login: piros "ismeretlen felhasználó" értesítés mindenkinek
        fetch("/api/moderator-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `mod_action_${Date.now()}`,
            text: "ismeretlen felhasználó bejelentkezett",
            createdAt: new Date().toISOString(),
            isError: true,
          }),
        }).catch(() => {});
        // Lokális esemény (csak saját böngésző, de a toast a polling fogja mutatni hamarosan)
        window.dispatchEvent(new CustomEvent("moderator-session-changed", { detail: {} }));
      } else {
        window.dispatchEvent(
          new CustomEvent("moderator-session-changed", {
            detail: { action: "login", name: sessionName },
          })
        );
      }
      setMessage(`Bejelentkezve: ${sessionName}`);
      setModeratorPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setMessage("");
    if (isModeratorSessionActive()) {
      setMessage("Moderátorként már be vagy jelentkezve. Előbb jelentkezz ki.");
      return;
    }
    const email = resetEmail.trim().toLowerCase();
    if (!email || !resetPassword || !resetConfirmPassword) {
      setMessage("Minden jelszócsere mező kitöltése kötelező.");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setMessage("A jelszavak nem egyeznek.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/site-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "reset_password",
          email,
          password: resetPassword,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Nem sikerült jelszót módosítani.");
        return;
      }
      setResetEmail("");
      setResetPassword("");
      setResetConfirmPassword("");
      setShowResetPassword(false);
      setMessage("Új jelszó mentve. Most már be tudsz jelentkezni.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container">
      <h1 className="title">BEJELENTKEZÉS</h1>
      <div className="panel" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div className="matches-banner-actions" style={{ marginBottom: "14px" }}>
          <button type="button" className="matches-link-btn" onClick={() => setMode("login")}>
            Bejelentkezés
          </button>
          <button type="button" className="matches-link-btn secondary" onClick={() => setMode("register")}>
            Regisztráció
          </button>
        </div>

        <h2 style={{ marginBottom: "12px" }}>{titleText}</h2>
        {mode === "login" ? (
          <>
            <div className="faceit-linker-row">
              <input
                className="faceit-linker-input"
                placeholder="E-mail"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
              <input
                className="faceit-linker-input"
                type="password"
                placeholder="Jelszó"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </div>
            <div className="faceit-linker-row" style={{ marginTop: "10px" }}>
              <button type="button" className="faceit-linker-btn" onClick={handleLogin} disabled={isLoading}>
                Bejelentkezés
              </button>
              <button
                type="button"
                className="faceit-linker-btn secondary"
                onClick={() => setShowResetPassword((current) => !current)}
              >
                {showResetPassword ? "Jelszócsere bezárása" : "Elfelejtett jelszó?"}
              </button>
            </div>
            {showResetPassword && (
              <div style={{ marginTop: "10px" }}>
                <div className="faceit-linker-row">
                  <input
                    className="faceit-linker-input"
                    placeholder="E-mail"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                  />
                  <input
                    className="faceit-linker-input"
                    type="password"
                    placeholder="Új jelszó"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                  />
                </div>
                <div className="faceit-linker-row" style={{ marginTop: "10px" }}>
                  <input
                    className="faceit-linker-input"
                    type="password"
                    placeholder="Új jelszó újra"
                    value={resetConfirmPassword}
                    onChange={(event) => setResetConfirmPassword(event.target.value)}
                  />
                  <button type="button" className="faceit-linker-btn" onClick={handleResetPassword} disabled={isLoading}>
                    Új jelszó mentése
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="faceit-linker-row">
              <input
                className="faceit-linker-input"
                placeholder="Felhasználónév"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
              />
              <input
                className="faceit-linker-input"
                placeholder="E-mail"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
              />
            </div>
            <div className="faceit-linker-row" style={{ marginTop: "10px" }}>
              <input
                className="faceit-linker-input"
                type="password"
                placeholder="Jelszó"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
              <input
                className="faceit-linker-input"
                type="password"
                placeholder="Jelszó újra"
                value={registerConfirmPassword}
                onChange={(event) => setRegisterConfirmPassword(event.target.value)}
              />
            </div>
            <div className="faceit-linker-row" style={{ marginTop: "10px" }}>
              <input
                className="faceit-linker-input"
                placeholder="FACEIT profil link (kötelező)"
                value={registerFaceitLink}
                onChange={(event) => setRegisterFaceitLink(event.target.value)}
              />
            </div>
            <div className="faceit-linker-row" style={{ marginTop: "10px" }}>
              <button type="button" className="faceit-linker-btn" onClick={handleRegister} disabled={isLoading}>
                Regisztráció
              </button>
            </div>
          </>
        )}

        {message && <p className="faceit-linker-message" style={{ marginTop: "10px" }}>{message}</p>}

        <div
          style={{
            marginTop: "22px",
            background: "#fff",
            color: "#111",
            borderRadius: "10px",
            padding: "14px",
          }}
        >
          <h3 style={{ marginBottom: "8px" }}>Moderátorként</h3>
          <div className="faceit-linker-row">
            <input
              className="faceit-linker-input"
              placeholder="Név"
              value={moderatorName}
              onChange={(event) => setModeratorName(event.target.value)}
            />
            <input
              className="faceit-linker-input"
              type="password"
              placeholder="Moderátor jelszó"
              value={moderatorPassword}
              onChange={(event) => setModeratorPassword(event.target.value)}
            />
            <button type="button" className="faceit-linker-btn" onClick={handleModeratorLogin} disabled={isLoading}>
              Belépés
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
