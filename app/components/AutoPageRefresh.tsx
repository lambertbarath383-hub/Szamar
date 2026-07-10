"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { APP_MINUTE_REFRESH_EVENT } from "@/app/lib/refresh-cycle";

export default function AutoPageRefresh() {
  const router = useRouter();

  useEffect(() => {
    const onMinuteRefresh = () => {
      router.refresh();
    };

    window.addEventListener(APP_MINUTE_REFRESH_EVENT, onMinuteRefresh);
    return () => {
      window.removeEventListener(APP_MINUTE_REFRESH_EVENT, onMinuteRefresh);
    };
  }, [router]);

  return null;
}

