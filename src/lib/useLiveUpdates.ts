"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "./supabase/client";

export type Connection = "connecting" | "live" | "offline";

const TABLES = ["matches", "goals", "teams", "players", "groups", "settings"];

// Realtime is the main path. Polling only covers a dropped connection, so it runs faster while it's down.
const POLL_LIVE_MS = 15_000;
const POLL_OFFLINE_MS = 5_000;

/**
 * Calls `onChange` whenever tournament data changes, plus on (re)connect, on return to the tab,
 * when the device comes back online, and on a fallback poll. Returns the realtime connection state.
 */
export function useLiveUpdates(url: string, key: string, onChange: () => void): Connection {
  const [connection, setConnection] = useState<Connection>("connecting");
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    const supabase = getBrowserSupabase(url, key);
    let status: Connection = "connecting";
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const fire = () => latest.current();
    // Bursts of changes (e.g. a goal and a period change) collapse into one update.
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(fire, 100);
    };
    const startPoll = () => {
      clearInterval(poll);
      poll = setInterval(fire, status === "live" ? POLL_LIVE_MS : POLL_OFFLINE_MS);
    };
    const setStatus = (next: Connection) => {
      if (next === status) return;
      status = next;
      setConnection(next);
      startPoll();
    };

    // A unique topic: realtime hands back an existing channel with the same name, even one still closing.
    let channel = supabase.channel(`tournament-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    for (const table of TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        setStatus("live");
        schedule(); // catch anything missed while (re)connecting
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        setStatus("offline");
      }
    });
    startPoll();

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", schedule);

    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", schedule);
      supabase.removeChannel(channel);
    };
  }, [url, key]);

  return connection;
}
