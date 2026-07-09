"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

export interface SessionUser {
  name: string;
}

export interface SavedScore {
  game: string;
  name: string;
  score: number;
  at: number;
}

interface SessionValue {
  user: SessionUser | null;
  login: (u: SessionUser | null) => void;
  signOut: () => void;
  saveScore: (entry: { game: string; name: string; score: number }) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getUserSnapshot(): string | null {
  try {
    return localStorage.getItem("av_user");
  } catch {
    return null;
  }
}

function parseUser(raw: string | null): SessionUser | null {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function notify() {
  for (const callback of listeners) callback();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getUserSnapshot, getServerSnapshot);
  const user = parseUser(raw);

  const login = useCallback((u: SessionUser | null) => {
    try {
      localStorage.setItem("av_user", JSON.stringify(u));
    } catch {}
    notify();
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem("av_user");
    } catch {}
    notify();
  }, []);

  const saveScore: SessionValue["saveScore"] = (entry) => {
    try {
      const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem("av_scores", JSON.stringify(all));
    } catch {}
  };

  return (
    <SessionContext.Provider value={{ user, login, signOut, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
