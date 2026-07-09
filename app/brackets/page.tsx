"use client";

import { useEffect, useState } from "react";
import {
  CUSTOM_BRACKETS_CHANGED_EVENT,
  readCustomBracketsFromStorage,
  syncCustomBracketsFromServer,
  type CustomBracketEntry,
} from "@/app/lib/custom-brackets";

export default function BracketsPage() {
  const [customBrackets, setCustomBrackets] = useState<CustomBracketEntry[]>([]);

  useEffect(() => {
    const loadBrackets = async () => {
      try {
        await syncCustomBracketsFromServer();
      } catch {}
      setCustomBrackets(readCustomBracketsFromStorage());
    };

    const timeoutId = setTimeout(() => {
      loadBrackets().catch(() => {});
    }, 0);
    const intervalId = setInterval(() => {
      loadBrackets().catch(() => {});
    }, 15000);
    const onLoadBrackets = () => {
      loadBrackets().catch(() => {});
    };
    window.addEventListener(CUSTOM_BRACKETS_CHANGED_EVENT, onLoadBrackets);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      window.removeEventListener(CUSTOM_BRACKETS_CHANGED_EVENT, onLoadBrackets);
    };
  }, []);

  return (
    <main className="container">
      <h1 className="title">BRACKETS</h1>

      {customBrackets.length === 0 && (
        <div className="panel" style={{ minHeight: "auto", padding: "20px", marginBottom: "16px" }}>
          <p>Még nincs hozzáadott bracket. Admin Panelen tudsz újat felvenni.</p>
        </div>
      )}

      {customBrackets.map((bracket) => (
        <details key={bracket.id} className="panel" style={{ minHeight: "auto", padding: "20px", marginBottom: "16px" }}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{bracket.name}</strong> — {new Date(bracket.createdAt).toLocaleString("hu-HU")}
          </summary>

          <p style={{ marginTop: "12px", marginBottom: "12px", opacity: 0.8 }}>Beágyazott bracket nézet</p>

          <iframe
            title={`${bracket.name} bracket`}
            src={bracket.embedUrl}
            width="100%"
            height="720"
            loading="lazy"
            style={{
              border: "2px solid #fff",
              background: "#050505",
            }}
          />

          <div style={{ marginTop: "12px" }}>
            <a
              href={bracket.url}
              target="_blank"
              rel="noreferrer"
              className="view-profile-btn"
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              Megnyitás külön oldalon
            </a>
          </div>
        </details>
      ))}
    </main>
  );
}
