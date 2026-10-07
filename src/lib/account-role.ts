import { safeAuthRedirect } from './auth-redirect';

export function isAdministrator(user: { role?: string }): boolean {
  return user.role === 'admin';
}

/** Preserve the existing service operator while adding dedicated admin accounts. */
export function isServiceOperator(user: { role?: string; email: string }, operatorEmail?: string): boolean {
  return isAdministrator(user) || Boolean(operatorEmail?.trim() && user.email.toLowerCase() === operatorEmail.trim().toLowerCase());
}

export function accountDestination(user: { role?: string }, next?: unknown): string {
  if (isAdministrator(user)) return '/admin';
  const destination = safeAuthRedirect(next);
  return destination === '/admin' || destination.startsWith('/admin/') ? '/app' : destination;
}
