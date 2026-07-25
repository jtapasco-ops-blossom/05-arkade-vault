"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

export interface SessionUser {
  name: string;
}

interface SessionValue {
  user: SessionUser | null;
  login: (u: SessionUser | null) => void;
  signOut: () => void;
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

  return (
    <SessionContext.Provider value={{ user, login, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
