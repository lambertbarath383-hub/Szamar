"use client";

import { useEffect, useState } from "react";
import { APP_MINUTE_REFRESH_EVENT, APP_MINUTE_REFRESH_INTERVAL_MS } from "@/app/lib/refresh-cycle";

function getSecondsToNextRefresh(now: number) {
  const elapsedInMinute = now % APP_MINUTE_REFRESH_INTERVAL_MS;
  const seconds = 60 - Math.floor(elapsedInMinute / 1000);
  return seconds <= 0 ? 60 : seconds;
}

export default function RefreshCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsToNextRefresh(Date.now()));

  useEffect(() => {
    let lastRefreshSlot = Math.floor(Date.now() / APP_MINUTE_REFRESH_INTERVAL_MS);
    const intervalId = setInterval(() => {
      const now = Date.now();
      const currentRefreshSlot = Math.floor(now / APP_MINUTE_REFRESH_INTERVAL_MS);
      if (currentRefreshSlot !== lastRefreshSlot) {
        lastRefreshSlot = currentRefreshSlot;
        window.dispatchEvent(new Event(APP_MINUTE_REFRESH_EVENT));
      }
      setSecondsLeft(getSecondsToNextRefresh(now));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return <div className="refresh-countdown">Frissítés: {secondsLeft}s</div>;
}

