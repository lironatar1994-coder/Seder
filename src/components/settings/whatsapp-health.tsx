import { cn } from '@/lib/cn';
import type { WhatsappHealth } from '@/server/whatsapp/health';
import { SettingsSection } from './shell';

const TIME = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

const KIND_WORDS: Record<string, string> = {
  CAPTURE: 'הודעה נכנסת',
  REPLY: 'תשובה',
  REMINDER: 'תזכורת',
};

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    // No rule of its own: the grid draws one continuous line under the whole
    // row, where four short ones with gaps between them read as damage.
    <div className="py-3">
      <div
        className={cn(
          'num text-2xl font-bold tabular-nums',
          tone === 'bad' ? 'text-p1' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

/**
 * What the service is doing for everyone, not just for you.
 *
 * Shown only to the operator. Counts and reasons, never message bodies — the
 * question is whether anything is broken, and answering it does not require
 * reading anybody's tasks.
 */
export function WhatsappHealthPanel({ health }: { health: WhatsappHealth }) {
  const quiet =
    health.captured === 0 &&
    health.repliesSent === 0 &&
    health.remindersSent === 0 &&
    health.outboundFailed === 0 &&
    health.ignoredInbound === 0;

  return (
    <SettingsSection
      title="מצב כללי"
      description={`כל החשבונות, ב־${health.windowHours} השעות האחרונות. בלי תוכן ההודעות.`}
    >
      <div className="grid grid-cols-2 gap-x-6 border-be border-line sm:grid-cols-4">
        <Figure label="חשבונות מחוברים" value={String(health.enabledAccounts)} />
        <Figure label="משימות נפתחו" value={String(health.captured)} />
        <Figure label="תזכורות נשלחו" value={String(health.remindersSent)} />
        <Figure
          label="שליחות נכשלו"
          value={String(health.outboundFailed)}
          tone={health.outboundFailed > 0 ? 'bad' : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-be border-line py-3 text-xs text-muted">
        <span>
          נשלחו <span className="num font-semibold text-ink-2">{health.sent}</span> מתוך תקרה יומית
          של <span className="num font-semibold text-ink-2">{health.dailyCap}</span>
        </span>
        <span>
          תזכורות עם אישור מסירה: <span className="num font-semibold text-ink-2">{health.remindersDelivered}</span>
        </span>
        <span>
          תשובות: <span className="num font-semibold text-ink-2">{health.repliesSent}</span>
        </span>
        <span>
          הודעות שלא טופלו:{' '}
          <span className="num font-semibold text-ink-2">{health.ignoredInbound}</span>
        </span>
      </div>

      {health.problems.length > 0 ? (
        <ul>
          {health.problems.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-be border-line py-2.5">
              <span className="text-sm font-semibold text-ink">
                {KIND_WORDS[row.kind] ?? row.kind}
              </span>
              <span className="text-xs text-muted">
                {row.who ?? 'מספר לא מזוהה'} · <bdi dir="ltr">{row.phone}</bdi>
              </span>
              <span className="num shrink-0 text-xs text-muted">{TIME.format(row.at)}</span>
              {/* The reason, verbatim. The system this replaces recorded a
                  failure and nothing else, which made 27 of them unfixable. */}
              <span dir="auto" className="w-full text-xs text-p2">
                {row.error ?? 'ללא פירוט'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-sm text-muted">
          {quiet ? 'שקט — לא עברו הודעות בחלון הזה.' : 'הכול עבר בלי תקלות.'}
        </p>
      )}
    </SettingsSection>
  );
}
