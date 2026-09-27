/**
 * What this device already told us about its owner.
 *
 * Kept only in the browser: the details are re-typed on every booking
 * otherwise, and a repeat guest filling the same four fields again is the
 * most avoidable friction in the flow.
 */
const KEY = "bizarri:guest";

export interface RememberedGuest {
  name: string;
  phone: string;
  email: string;
}

export function rememberGuest(g: RememberedGuest) {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    // Private browsing and blocked site data both throw. Losing the
    // convenience is fine; failing the booking over it is not.
  }
}

export function readGuest(): RememberedGuest | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Partial<RememberedGuest>;
    if (!g?.name || !g?.email) return null;
    return { name: g.name, phone: g.phone ?? "", email: g.email };
  } catch {
    return null;
  }
}
