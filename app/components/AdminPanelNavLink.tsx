"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminPanelNavLink() {
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    const updateState = () => {
      if (typeof window === "undefined") {
        return;
      }
      const raw = window.sessionStorage.getItem("moderator-session");
      setIsModerator(Boolean(raw));
    };

    updateState();
    window.addEventListener("moderator-session-changed", updateState);
    window.addEventListener("storage", updateState);

    return () => {
      window.removeEventListener("moderator-session-changed", updateState);
      window.removeEventListener("storage", updateState);
    };
  }, []);

  if (!isModerator) {
    return null;
  }

  return <Link href="/admin">ADMIN PANEL</Link>;
}
