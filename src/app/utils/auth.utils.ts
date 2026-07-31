export function getTokenPayload(): any | null {
  const token = localStorage.getItem('jwtToken');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function getUserName(): string | null {
  const payload = getTokenPayload();
  if (!payload) return null;
  // Handles short 'name' key, ASP.NET's ClaimTypes.Name URI, and common fallbacks
  return (
    payload['name'] ??
    payload['unique_name'] ??
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ??
    payload['given_name'] ??
    null
  );
}

export function getUserRoles(): string[] {
  const payload = getTokenPayload();
  if (!payload) return [];
  // Handles short 'role'/'roles' keys and .NET's full claim URI.
  // ASP.NET emits a single string for one role, or a string[] for multiple —
  // normalize both into an array so callers never have to branch on shape.
  const raw =
    payload['role'] ??
    payload['roles'] ??
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    null;

  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// Back-compat single-role accessor — several components/guards still import
// this by name. Returns the first role on the token, or null if none.
export function getUserRole(): string | null {
  const roles = getUserRoles();
  return roles.length > 0 ? roles[0] : null;
}

export function hasRole(role: string): boolean {
  const target = role.toLowerCase();
  return getUserRoles().some(r => r.toLowerCase() === target);
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('jwtToken');
}