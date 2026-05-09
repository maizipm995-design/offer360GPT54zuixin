export const ADMIN_TOKEN_COOKIE = 'offer360_admin_token';

const SEVEN_DAYS = 7 * 24 * 60 * 60;

export function persistAdminToken(token: string) {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${ADMIN_TOKEN_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SEVEN_DAYS}; Path=/; SameSite=Lax`;
}

export function clearAdminToken() {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${ADMIN_TOKEN_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
