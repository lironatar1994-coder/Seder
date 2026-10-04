import { db } from '../src/server/db';
import { googleConfigured } from '../src/server/google/client';
import { syncGoogleCalendar } from '../src/server/google/sync';

let stopped = false;
process.on('SIGINT', () => { stopped = true; }); process.on('SIGTERM', () => { stopped = true; });
async function main() {
  console.log(JSON.stringify({ event: 'calendar.worker.started', configured: googleConfigured() }));
  while (!stopped) {
    if (googleConfigured()) {
      const connections = await db.googleCalendarConnection.findMany({ where: { OR: [{ lastError: null }, { lastError: { not: 'RECONNECT' } }] }, select: { id: true, lastSyncAt: true }, orderBy: { lastSyncAt: 'asc' }, take: 100 });
      for (const connection of connections) {
        if (stopped) break;
        if (!connection.lastSyncAt || Date.now() - connection.lastSyncAt.getTime() > 55_000) await syncGoogleCalendar(connection.id);
      }
    }
    for (let i = 0; i < 60 && !stopped; i++) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await db.$disconnect();
}
main().catch(() => { console.error(JSON.stringify({ event: 'calendar.worker.failed' })); process.exitCode = 1; });
