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

export function getUserRole(): string | null {
  const payload = getTokenPayload();
  if (!payload) return null;
  // Handles both short 'role' key and .NET's full claim URI
  return (
    payload['role'] ??
    payload['roles'] ??
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    null
  );
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('jwtToken');
}