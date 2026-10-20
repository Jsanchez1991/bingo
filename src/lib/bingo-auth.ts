import { SaasPlanId } from "./bingo-patterns";

export type SaasRole = "SUPERADMIN" | "ORGANIZER" | "SELLER";

export interface BingoSaasSession {
  role: SaasRole;
  name: string;
  email?: string;
  organizerId?: string;
  organizationName?: string;
  planId?: SaasPlanId;
  defaultEventId?: string;
  sellerCode?: string;
  loggedInAt: string;
}

const SESSION_KEY = "gran_bingo_saas_session_v1";

export function getSaasSession(): BingoSaasSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BingoSaasSession;
  } catch {
    return null;
  }
}

export function setSaasSession(session: BingoSaasSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSaasSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
