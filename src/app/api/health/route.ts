import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '@/server/db';
import { googleConfigured } from '@/server/google/client';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const release = await readFile(join(process.cwd(), 'RELEASE.json'), 'utf8').then((text) => JSON.parse(text).commit as string).catch(() => 'development');
    return Response.json({ status: 'ok', release, mailConfigured: Boolean(process.env.SMTP_URL || process.env.RESEND_API_KEY), googleCalendarConfigured: googleConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ status: 'unavailable' }, { status: 503 }); }
}
