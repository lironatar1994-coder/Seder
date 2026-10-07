import { db } from '../db';
import { openToken, sealToken } from './crypto';

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'];
export const APP_URL = () => (process.env.APP_URL ?? 'http://localhost:3000/seder').replace(/\/$/, '');
export const CALLBACK_URL = () => `${APP_URL()}/api/google/callback`;
export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '', 'base64').length === 32 && process.env.GOOGLE_CALENDAR_ENABLED === '1');
}
export class GoogleError extends Error {
  constructor(public status: number, public reason = 'API_ERROR') { super(reason); }
}
export async function googleToken(parameters: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', ...parameters }), signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new GoogleError(response.status, data.error === 'invalid_grant' ? 'RECONNECT' : 'TOKEN_ERROR');
  if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') throw new GoogleError(502, 'TOKEN_ERROR');
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}
async function bearer(connectionId: string, force = false) {
  const connection = await db.googleCalendarConnection.findUniqueOrThrow({ where: { id: connectionId } });
  if (!force && connection.accessExpiresAt.getTime() > Date.now() + 60_000) return openToken(connection.accessToken);
  const data = await googleToken({ grant_type: 'refresh_token', refresh_token: openToken(connection.refreshToken) });
  await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { accessToken: sealToken(data.access_token), accessExpiresAt: new Date(Date.now() + data.expires_in * 1000), ...(data.refresh_token ? { refreshToken: sealToken(data.refresh_token) } : {}) } });
  return data.access_token;
}
/** Calendar access is read-only, including for any legacy token with broader grants. */
export async function googleRequest<T>(connectionId: string, path: string): Promise<T> {
  let token = await bearer(connectionId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
    if (response.status === 401 && attempt === 0) { token = await bearer(connectionId, true); continue; }
    if ((response.status === 429 || response.status >= 500) && attempt < 2) { await new Promise(resolve => setTimeout(resolve, Math.min(5000, 500 * 2 ** attempt))); continue; }
    if (!response.ok) throw new GoogleError(response.status, response.status === 401 ? 'RECONNECT' : response.status === 403 ? 'PERMISSIONS' : 'API_ERROR');
    return response.status === 204 ? undefined as T : await response.json() as T;
  }
  throw new GoogleError(503);
}
