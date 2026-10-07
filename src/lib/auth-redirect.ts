/** Only internal authenticated routes may be used as post-login destinations. */
export function safeAuthRedirect(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '/app';
  if (!value.startsWith('/app/') && value !== '/app' && value !== '/admin' && !value.startsWith('/admin/')) return '/app';
  if (/[\\\r\n]/.test(value)) return '/app';
  try {
    const url = new URL(value, 'https://seder.invalid');
    if (url.origin !== 'https://seder.invalid' || !['/app', '/admin'].some((root) => url.pathname === root || url.pathname.startsWith(`${root}/`))) return '/app';
    return url.pathname + url.search;
  } catch { return '/app'; }
}
