// auth.utils.ts

export function getTokenPayload(): any | null {
  const token = localStorage.getItem('jwtToken');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function getUserRole(): string | null {
  const payload = getTokenPayload();
  if (!payload) return null;
  return (
    payload['role'] ??
    payload['roles'] ??
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    null
  );
}

/**
 * Returns true if the logged-in user's role matches the given role
 * (case-insensitive). Pass an array to check against multiple allowed roles.
 */
export function hasRole(role: string | string[]): boolean {
  const userRole = getUserRole();
  if (!userRole) return false;

  const roles = Array.isArray(role) ? role : [role];
  return roles.some((r) => r.toLowerCase() === userRole.toLowerCase());
}

export function getUserName(): string | null {
  const payload = getTokenPayload();
  if (!payload) return null;
  return (
    payload['name'] ??
    payload['unique_name'] ??
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ??
    payload['given_name'] ??
    null
  );
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('jwtToken');
}

// ── Centralized logout + cross-tab sync ─────────────────────────────────────

/**
 * The single source of truth for logging out. Every "Logout" button in the
 * app should call this instead of localStorage.clear() directly, so the
 * behavior (and any future cleanup) stays consistent everywhere.
 */
export function performLogout(): void {
  localStorage.clear();
  // Storage events don't fire in the tab that made the change — only in
  // OTHER tabs. That's exactly what we want here (this tab is about to
  // navigate away on its own), but it means we can't rely on the storage
  // event for this tab's own redirect; the caller still does that.
}

/**
 * Call once, near app bootstrap (e.g. in the root AppComponent). Listens for
 * localStorage changes made in OTHER browser tabs of the same origin.
 * When jwtToken disappears (i.e. another tab logged out), force this tab
 * back to the login screen too — instantly, no manual refresh needed.
 */
export function listenForCrossTabLogout(onForcedLogout: () => void): void {
  window.addEventListener('storage', (event: StorageEvent) => {
    // event.key === 'jwtToken' and event.newValue === null means the token
    // was removed (localStorage.clear() or removeItem both fire this way —
    // clear() actually fires with key === null, so we check both cases).
    const tokenWasCleared =
      (event.key === 'jwtToken' && !event.newValue) ||
      (event.key === null && !localStorage.getItem('jwtToken'));

    if (tokenWasCleared) {
      onForcedLogout();
    }
  });
}


export function listenForCrossTabLogin(onForcedLogin: (role: string | null) => void): void {
  window.addEventListener('storage', (event: StorageEvent) => {
    const tokenWasJustSet =
      event.key === 'jwtToken' && !event.oldValue && !!event.newValue;

    if (tokenWasJustSet) {
      onForcedLogin(getUserRole());
    }
  });
}