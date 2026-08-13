import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quick-add-parser';

/** Wednesday 12 August 2026, midday in Israel — every expectation below is
 *  relative to this instant. */
const NOW = new Date('2026-08-12T09:00:00.000Z');

const parse = (text: string) => parseQuickAdd(text, NOW);

describe('title extraction', () => {
  it('keeps plain text untouched', () => {
    const r = parse('לקנות חלב');
    expect(r.title).toBe('לקנות חלב');
    expect(r.scheduledFor).toBeNull();
    expect(r.whenBucket).toBe('ANYTIME');
  });

  it('strips every recognised token from the title', () => {
    const r = parse('לסיים מצגת מחר בשעה 14:30 #עבודה !1');
    expect(r.title).toBe('לסיים מצגת');
    expect(r.scheduledFor).toBe('2026-08-13');
    expect(r.scheduledTime).toBe('14:30');
    expect(r.projectName).toBe('עבודה');
    expect(r.priority).toBe(1);
    expect(r.whenBucket).toBe('SCHEDULED');
  });

  it('handles tokens in the middle of a sentence', () => {
    const r = parse('להתקשר מחר לרופא השיניים');
    expect(r.title).toBe('להתקשר לרופא השיניים');
    expect(r.scheduledFor).toBe('2026-08-13');
  });

  it('leaves an empty title when the input is only tokens', () => {
    expect(parse('מחר #בית').title).toBe('');
  });
});

describe('relative days', () => {
  it.each([
    ['היום', '2026-08-12'],
    ['מחר', '2026-08-13'],
    ['מחרתיים', '2026-08-14'],
    ['בעוד יומיים', '2026-08-14'],
    ['בעוד 3 ימים', '2026-08-15'],
    ['בעוד שבוע', '2026-08-19'],
    ['בעוד שבועיים', '2026-08-26'],
    ['בעוד 2 שבועות', '2026-08-26'],
    ['בעוד חודש', '2026-09-12'],
  ])('%s → %s', (phrase, expected) => {
    expect(parse(`משימה ${phrase}`).scheduledFor).toBe(expected);
  });

  it('does not confuse מחר inside מחרתיים', () => {
    const r = parse('משימה מחרתיים');
    expect(r.scheduledFor).toBe('2026-08-14');
    expect(r.title).toBe('משימה');
  });
});

describe('weekdays', () => {
  // 12.08.2026 is a Wednesday (יום רביעי).
  it.each([
    ['יום ראשון', '2026-08-16'],
    ['יום שני', '2026-08-17'],
    ['יום שלישי', '2026-08-18'],
    ['ביום חמישי', '2026-08-13'],
    ['יום שישי', '2026-08-14'],
    ['בשבת', '2026-08-15'],
  ])('%s → %s', (phrase, expected) => {
    expect(parse(`משימה ${phrase}`).scheduledFor).toBe(expected);
  });

  it('a weekday that is today means next week', () => {
    expect(parse('משימה יום רביעי').scheduledFor).toBe('2026-08-19');
  });

  it('accepts the geresh short form', () => {
    expect(parse('משימה ביום ה׳').scheduledFor).toBe('2026-08-13');
  });

  it('שבוע הבא is the coming Sunday', () => {
    expect(parse('משימה שבוע הבא').scheduledFor).toBe('2026-08-16');
  });
});

describe('numeric dates', () => {
  it('reads day-first', () => {
    expect(parse('משימה 20/8').scheduledFor).toBe('2026-08-20');
    expect(parse('משימה 20.8').scheduledFor).toBe('2026-08-20');
  });

  it('accepts an explicit year', () => {
    expect(parse('משימה 03/01/2027').scheduledFor).toBe('2027-01-03');
  });

  it('rolls a past bare date into next year', () => {
    expect(parse('משימה 1/3').scheduledFor).toBe('2027-03-01');
  });

  it('ignores impossible dates', () => {
    const r = parse('משימה 45/99');
    expect(r.scheduledFor).toBeNull();
    expect(r.title).toBe('משימה 45/99');
  });
});

describe('time', () => {
  it.each([
    ['בשעה 14:30', '14:30'],
    ['ב-14:30', '14:30'],
    ['14:30', '14:30'],
    ['בשעה 9', '09:00'],
  ])('%s → %s', (phrase, expected) => {
    expect(parse(`משימה ${phrase}`).scheduledTime).toBe(expected);
  });

  it('a bare time implies today', () => {
    const r = parse('פגישה בשעה 08:15');
    expect(r.scheduledFor).toBe('2026-08-12');
    expect(r.whenBucket).toBe('SCHEDULED');
  });

  it('rejects an out-of-range hour', () => {
    expect(parse('משימה 99:99').scheduledTime).toBeNull();
  });
});

describe('deadline', () => {
  it('עד turns a date into a deadline, not a schedule', () => {
    const r = parse('להגיש דוח עד 20/8');
    expect(r.deadline).toBe('2026-08-20');
    expect(r.scheduledFor).toBeNull();
    expect(r.title).toBe('להגיש דוח');
  });

  it('supports a deadline and a schedule together', () => {
    const r = parse('להגיש דוח מחר עד יום ראשון');
    expect(r.scheduledFor).toBe('2026-08-13');
    expect(r.deadline).toBe('2026-08-16');
    expect(r.title).toBe('להגיש דוח');
  });

  it('accepts דדליין as the prefix', () => {
    expect(parse('משימה דדליין מחר').deadline).toBe('2026-08-13');
  });
});

describe('buckets', () => {
  it('מתישהו', () => {
    const r = parse('ללמוד גרמנית מתישהו');
    expect(r.whenBucket).toBe('SOMEDAY');
    expect(r.title).toBe('ללמוד גרמנית');
  });

  it('בכל עת', () => {
    expect(parse('לתקן את הברז בכל עת').whenBucket).toBe('ANYTIME');
  });

  it('an explicit date beats a bucket word', () => {
    expect(parse('משימה מתישהו מחר').whenBucket).toBe('SCHEDULED');
  });
});

describe('project, labels and priority', () => {
  it('picks up one project and several labels', () => {
    const r = parse('להזמין ציוד #עבודה @טלפון @סידורים');
    expect(r.projectName).toBe('עבודה');
    expect(r.labelNames).toEqual(['טלפון', 'סידורים']);
    expect(r.title).toBe('להזמין ציוד');
  });

  it('deduplicates repeated labels', () => {
    expect(parse('משימה @בית @בית').labelNames).toEqual(['בית']);
  });

  it.each([
    ['!1', 1],
    ['!4', 4],
    ['p2', 2],
    ['P3', 3],
  ])('%s → priority %i', (phrase, expected) => {
    expect(parse(`משימה ${phrase}`).priority).toBe(expected);
  });

  it('defaults to no priority', () => {
    expect(parse('משימה').priority).toBe(4);
  });

  it('does not treat p1 inside a word as a priority', () => {
    expect(parse('לבדוק top10').priority).toBe(4);
  });
});

describe('multi-word project and label names', () => {
  const vocab = {
    projects: ['טיול ליוון', 'בית', 'בית ספר'],
    labels: ['שיחות טלפון', 'מחשב'],
  };
  const withVocab = (text: string) => parseQuickAdd(text, NOW, vocab);

  it('matches a known two-word project instead of stopping at the space', () => {
    const r = withVocab('להזמין מסעדה #טיול ליוון מחר');
    expect(r.projectName).toBe('טיול ליוון');
    expect(r.title).toBe('להזמין מסעדה');
  });

  it('matches a known two-word label', () => {
    const r = withVocab('לסדר את הרשימה @שיחות טלפון');
    expect(r.labelNames).toEqual(['שיחות טלפון']);
    expect(r.title).toBe('לסדר את הרשימה');
  });

  it('prefers the longer name when one is a prefix of another', () => {
    expect(withVocab('לשלם #בית ספר').projectName).toBe('בית ספר');
    expect(withVocab('לשלם #בית').projectName).toBe('בית');
  });

  it('accepts quotes for a project that does not exist yet', () => {
    const r = parse('לתכנן #"פרויקט חדש לגמרי" מחר');
    expect(r.projectName).toBe('פרויקט חדש לגמרי');
    expect(r.title).toBe('לתכנן');
  });

  it('still takes a single word when the name is unknown', () => {
    const r = withVocab('לבדוק #רכש חדש');
    expect(r.projectName).toBe('רכש');
    expect(r.title).toBe('לבדוק חדש');
  });
});

describe('recurrence', () => {
  // NOW is Wednesday 12 August 2026 (weekday 3).
  it.each([
    ['כל יום', 'daily:1'],
    ['כל יומיים', 'daily:2'],
    ['כל 4 ימים', 'daily:4'],
    ['כל שבוע', 'weekly:1:'],
    ['כל שבועיים', 'weekly:2:'],
    ['כל 3 שבועות', 'weekly:3:'],
    ['כל יום שני', 'weekly:1:1'],
    ['כל שני', 'weekly:1:1'],
    ['כל שבת', 'weekly:1:6'],
    ['כל שני וחמישי', 'weekly:1:1,4'],
    ['כל יום עבודה', 'weekly:1:0,1,2,3,4'],
    ['כל חודש', 'monthly:1:12'],
    ['כל חודשיים', 'monthly:2:12'],
    ['כל שנה', 'yearly:1:8:12'],
  ])('%s → %s', (phrase, expected) => {
    expect(parse(`משימה ${phrase}`).recurrence).toBe(expected);
  });

  it('strips the phrase from the title', () => {
    const r = parse('להשקות את הצמחים כל יומיים');
    expect(r.title).toBe('להשקות את הצמחים');
    expect(r.recurrence).toBe('daily:2');
  });

  it('starts a weekly rule on the next matching day', () => {
    // Wednesday → the coming Monday.
    const r = parse('ישיבת צוות כל יום שני');
    expect(r.scheduledFor).toBe('2026-08-17');
    expect(r.whenBucket).toBe('SCHEDULED');
  });

  it('starts today when today already matches', () => {
    const r = parse('לעדכן דוח כל רביעי');
    expect(r.scheduledFor).toBe('2026-08-12');
  });

  it('starts a daily rule today', () => {
    expect(parse('לשתות מים כל יום').scheduledFor).toBe('2026-08-12');
  });

  it('lets an explicit date set the start', () => {
    const r = parse('לשלם שכירות כל חודש מ-20/8');
    // The "מ-" prefix is not a token, so the date stands on its own.
    expect(r.recurrence).toBe('monthly:1:12');
    expect(r.scheduledFor).toBe('2026-08-20');
  });

  it('reads "כל יום שני" as a rule, not as the next single Monday', () => {
    const r = parse('משימה כל יום שני');
    expect(r.recurrence).toBe('weekly:1:1');
    // The date phrase must not also be consumed as a one-off.
    expect(r.tokens.filter((t) => t.kind === 'date')).toHaveLength(0);
  });

  it('leaves non-repeating text alone', () => {
    expect(parse('לקנות חלב מחר').recurrence).toBeNull();
  });
});

describe('mixed-direction content', () => {
  it('survives the canonical bidi test string', () => {
    const r = parse('שלום John 050-1234567 ₪1,234 מחר');
    expect(r.title).toBe('שלום John 050-1234567 ₪1,234');
    expect(r.scheduledFor).toBe('2026-08-13');
  });
});

describe('tokens', () => {
  it('reports each consumed span for the composer chips', () => {
    const r = parse('משימה מחר #עבודה');
    expect(r.tokens.map((t) => t.kind).sort()).toEqual(['date', 'project']);
    expect(r.tokens.find((t) => t.kind === 'date')?.display).toBe('מחר');
  });
});
