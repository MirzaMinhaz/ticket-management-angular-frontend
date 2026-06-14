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