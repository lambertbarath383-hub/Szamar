"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MODERATOR_ACTION_EVENT,
  MODERATOR_ACTION_STORAGE_KEY,
  type ModeratorActionPayload,
} from "@/app/lib/moderator-actions";

type ModeratorSession = {
  name: string;
};

type SiteUserSession = {
  name: string;
};

type ModeratorNotification = {
  id: number;
  text: string;
  error?: boolean;
};

type ModeratorSessionChangedDetail = {
  action?: "login" | "logout";
  name?: string;
};

export default function NavbarAuthControl() {
  const [moderatorSession, setModeratorSession] = useState<ModeratorSession | null>(null);
  const [siteUserSession, setSiteUserSession] = useState<SiteUserSession | null>(null);
  const [notification, setNotification] = useState<ModeratorNotification | null>(null);
  const [notificationLeaving, setNotificationLeaving] = useState(false);

  const showNotification = (text: string, error = false) => {
    setNotificationLeaving(false);
    setNotification({
      id: Date.now(),
      text,
      error,
    });
  };

  useEffect(() => {
    const updateSessions = () => {
      const rawModerator = window.localStorage.getItem("moderator-session");
      if (!rawModerator) {
        setModeratorSession(null);
      } else {
        try {
          const parsed = JSON.parse(rawModerator) as ModeratorSession;
          setModeratorSession(parsed && parsed.name ? parsed : null);
        } catch {
          window.localStorage.removeItem("moderator-session");
          setModeratorSession(null);
        }
      }

      const rawUser = window.localStorage.getItem("site-user-session");
      if (!rawUser) {
        setSiteUserSession(null);
      } else {
        try {
          const parsed = JSON.parse(rawUser) as SiteUserSession;
          setSiteUserSession(parsed && parsed.name ? parsed : null);
        } catch {
          window.localStorage.removeItem("site-user-session");
          setSiteUserSession(null);
        }
      }
    };

    const onSessionChanged = (event: Event) => {
      const customEvent = event as CustomEvent<ModeratorSessionChangedDetail>;
      updateSessions();

      if (customEvent.detail?.action === "login" && customEvent.detail.name) {
        showNotification(`${customEvent.detail.name} web moderator\nbejelentkezett`);
      }
      if (customEvent.detail?.action === "logout" && customEvent.detail.name) {
        showNotification(`${customEvent.detail.name} web moderator\nkijelentkezett`);
      }
    };

    const onModeratorAction = (event: Event) => {
      const customEvent = event as CustomEvent<ModeratorActionPayload>;
      if (customEvent.detail?.text) {
        showNotification(customEvent.detail.text);
      }
    };

    const onStorage = (event: Event) => {
      updateSessions();
      const storageEvent = event as StorageEvent;
      if (storageEvent.key !== MODERATOR_ACTION_STORAGE_KEY || !storageEvent.newValue) {
        return;
      }
      try {
        const payload = JSON.parse(storageEvent.newValue) as ModeratorActionPayload;
        if (payload?.text) {
          showNotification(payload.text);
        }
      } catch {}
    };

    updateSessions();
    window.addEventListener("moderator-session-changed", onSessionChanged);
    window.addEventListener(MODERATOR_ACTION_EVENT, onModeratorAction);
    window.addEventListener("site-user-session-changed", updateSessions);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("moderator-session-changed", onSessionChanged);
      window.removeEventListener(MODERATOR_ACTION_EVENT, onModeratorAction);
      window.removeEventListener("site-user-session-changed", updateSessions);
      window.removeEventListener("storage", onStorage);
    };
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

  const handleModeratorLogout = () => {
    const currentModeratorName = moderatorSession?.name || "Moderátor";
    window.localStorage.removeItem("moderator-session");
    window.dispatchEvent(
      new CustomEvent<ModeratorSessionChangedDetail>("moderator-session-changed", {
        detail: { action: "logout", name: currentModeratorName },
      })
    );
  };

  const handleUserLogout = () => {
    window.localStorage.removeItem("site-user-session");
    window.dispatchEvent(new Event("site-user-session-changed"));
  };

  return (
    <>
      <div className="navbar-auth">
        {!moderatorSession && !siteUserSession ? (
          <Link href="/auth" className="navbar-login-link">
            BEJELENTKEZÉS
          </Link>
        ) : (
          <div className="navbar-auth-logged">
            <span className={`navbar-moderator-name ${moderatorSession ? "is-moderator" : ""}`}>
              {moderatorSession?.name ?? siteUserSession?.name ?? "Felhasználó"}
            </span>
            <button
              type="button"
              className="navbar-login-link"
              onClick={moderatorSession ? handleModeratorLogout : handleUserLogout}
            >
              KIJELENTKEZÉS
            </button>
          </div>
        )}
      </div>

      {notification && (
        <div
          key={notification.id}
          className={`moderator-toast ${notification.error ? "error" : ""} ${notificationLeaving ? "leaving" : ""}`}
        >
          <div className="moderator-toast-text">{notification.text}</div>
          <div className="moderator-toast-progress" />
        </div>
      )}
    </>
  );
}
