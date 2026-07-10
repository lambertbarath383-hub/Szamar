"use client";

import { useEffect, useState } from "react";

type ModeratorSession = {
  name: string;
};

type ModeratorNotification = {
  id: number;
  text: string;
  error?: boolean;
};

export default function ModeratorLogin() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<ModeratorSession | null>(null);
  const [notification, setNotification] = useState<ModeratorNotification | null>(null);
  const [notificationLeaving, setNotificationLeaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const showNotification = (text: string, error = false) => {
    setNotificationLeaving(false);
    setNotification({
      id: Date.now(),
      text,
      error,
    });
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setNotification(null);
    try {
      const response = await fetch("/api/moderator/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, password }),
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        showNotification(payload.message ?? "Bejelentkezési hiba.", true);
        return;
      }

      const nextSession: ModeratorSession = {
        name: name.trim() || "Moderátor",
      };
      setSession(nextSession);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("moderator-session", JSON.stringify(nextSession));
        window.dispatchEvent(new Event("moderator-session-changed"));
      }
      setPassword("");
      showNotification(`Weboldal moderátor elérhető: ${nextSession.name}`);
    } catch {
      showNotification("Hálózati hiba bejelentkezés közben.", true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    const currentModeratorName = session?.name || "Moderátor";
    setSession(null);
    setName("");
    setPassword("");
    setNotification(null);
    setNotificationLeaving(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("moderator-session");
      window.dispatchEvent(new Event("moderator-session-changed"));
    }
    showNotification(`A moderátor kijelentkezett: ${currentModeratorName}`);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const raw = window.sessionStorage.getItem("moderator-session");
      if (!raw) {
        return;
      }
      try {
        const parsed = JSON.parse(raw) as ModeratorSession;
        setSession(parsed && parsed.name ? parsed : null);
      } catch {
        window.sessionStorage.removeItem("moderator-session");
        setSession(null);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!notification) {
      return;
    }
    const leaveTimeoutId = setTimeout(() => {
      setNotificationLeaving(true);
    }, 5000);

    const removeTimeoutId = setTimeout(() => {
      setNotification((current) => (current?.id === notification.id ? null : current));
      setNotificationLeaving(false);
    }, 5350);

    return () => {
      clearTimeout(leaveTimeoutId);
      clearTimeout(removeTimeoutId);
    };
  }, [notification]);

  return (
    <>
      <div className="moderator-login">
        {!session ? (
          <>
            <input
              className="moderator-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Név"
            />
            <input
              type="password"
              className="moderator-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Jelszó"
            />
            <button
              type="button"
              className="moderator-btn"
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? "..." : "Belépés"}
            </button>
          </>
        ) : (
          <>
            <span className="moderator-user">{session.name}</span>
            <button type="button" className="moderator-btn" onClick={handleLogout}>
              Kilépés
            </button>
          </>
        )}
      </div>

      {notification && (
        <div
          key={notification.id}
          className={`moderator-toast ${notification.error ? "error" : ""} ${
            notificationLeaving ? "leaving" : ""
          }`}
        >
          <div className="moderator-toast-text">{notification.text}</div>
          <div className="moderator-toast-progress" />
        </div>
      )}
    </>
  );
}
